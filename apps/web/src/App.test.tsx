import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  beforeEach(() => {
    // Default stub to avoid unhandled rejections in tests that don't care about data loading.
    globalThis.fetch = async () => {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };
  });

  it("renders header", () => {
    render(<App />);
    expect(screen.getByText(/Product Analyzer/i)).toBeInTheDocument();
  });

  it("renders semantic layout regions and key sections", () => {
    render(<App />);

    // Landmarks
    expect(screen.getByRole("banner")).toBeInTheDocument();
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass("max-w-7xl");

    // Key sections should exist even before any data loads.
    expect(screen.getByRole("heading", { name: /Selection/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Snapshots/i })).toBeInTheDocument();

    // Workspace tabs (Configure fields default, Analysis hidden by default)
    const workspaceTabs = screen.getByRole("tablist", { name: /workspace/i });
    const configureTab = within(workspaceTabs).getByRole("tab", { name: /configure fields/i });
    const analysisWorkspaceTab = within(workspaceTabs).getByRole("tab", { name: /analysis/i });

    expect(configureTab).toHaveAttribute("aria-selected", "true");
    expect(analysisWorkspaceTab).toHaveAttribute("aria-selected", "false");

    // Configure fields panel should be visible by default
    expect(screen.getByRole("heading", { name: /Fields \(Snapshot A\)/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Diff/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Trends/i })).not.toBeInTheDocument();

    // Switch to Analysis workspace
    fireEvent.click(analysisWorkspaceTab);

    // Nested Analysis tabs: Diff default, Trends hidden by default
    const analysisTabs = screen.getByRole("tablist", { name: /analysis/i });
    const diffTab = within(analysisTabs).getByRole("tab", { name: /diff/i });
    const trendsTab = within(analysisTabs).getByRole("tab", { name: /trends/i });

    expect(diffTab).toHaveAttribute("aria-selected", "true");
    expect(trendsTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { name: /Diff/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Trends/i })).not.toBeInTheDocument();

    fireEvent.click(trendsTab);
    expect(screen.getByRole("heading", { name: /Trends/i })).toBeInTheDocument();
  });

  it("loads and shows product numbers", async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify(["531285301", "999"]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    render(<App />);

    expect(await screen.findByText("531285301")).toBeInTheDocument();
    expect(await screen.findByText("999")).toBeInTheDocument();
  });

  it("loads serial numbers after selecting a product number", async () => {
    globalThis.fetch = async (url: any) => {
      const u = String(url);
      if (u.includes("/product-numbers/") && u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1", "S2"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify(["531285301"]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    render(<App />);

    // wait for product number option
    await screen.findByText("531285301");

    const select = screen.getByLabelText("Product number");
    fireEvent.change(select, { target: { value: "531285301" } });

    expect(await screen.findByText("S1")).toBeInTheDocument();
    expect(await screen.findByText("S2")).toBeInTheDocument();
  });

  it("loads snapshots after selecting product number and serial number", async () => {
    globalThis.fetch = async (url: any) => {
      const u = String(url);
      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (u.includes("/products/531285301/S1/diff")) {
        return new Response(
          JSON.stringify({
            configurationId: "cfg-1",
            snapshotA: {
              deviceSnapshotId: "ds1",
              snapshotId: "snap-1",
              timeStampUtc: "2026-02-17T07:50:23.000Z"
            },
            snapshotB: {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            },
            diff: {
              added: [],
              removed: [],
              changed: [{ key: "root/FirmwareVersion", from: "A", to: "B" }],
              unchanged: []
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    // Wait for async-loaded options to exist before selecting them.
    await screen.findByRole("option", { name: "531285301" });

    const productSelect = screen.getByLabelText("Product number");
    fireEvent.change(productSelect, { target: { value: "531285301" } });

    const serialSelect = await screen.findByLabelText("Serial number");

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(serialSelect, { target: { value: "S1" } });

    expect(await screen.findByText(/snap-2/)).toBeInTheDocument();
    expect(await screen.findByText(/2026-02-18T07:50:23\.000Z/)).toBeInTheDocument();
  });

  it("loads snapshot fields after clicking a snapshot", async () => {
    const calls: string[] = [];

    globalThis.fetch = async (url: any) => {
      const u = String(url);
      calls.push(u);

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/snapshots/ds2/fields")) {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/FirmwareVersion",
              valueText: "599807801M",
              valueType: "string"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });

    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    const snap = await screen.findByText(/snap-2/);
    fireEvent.click(snap);

    expect(await screen.findByLabelText("Fields (Snapshot A)")).toBeInTheDocument();
    expect(await screen.findByText("root/FirmwareVersion")).toBeInTheDocument();
    expect(await screen.findByText("599807801M")).toBeInTheDocument();
    expect(calls.some((c) => c.includes("/snapshots/ds2/fields"))).toBe(true);
  });

  it("renders fields table without Type column and with wider Value column", async () => {
    const longFieldKey =
      "root/SomeExtremelyLongFieldKeyThatHasNoSpacesAndWouldOtherwiseOverflowIntoTheNextColumn/Segment1/Segment2/Segment3";

    globalThis.fetch = async (url: any) => {
      const u = String(url);

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/snapshots/ds2/fields")) {
        return new Response(
          JSON.stringify([
            {
              fieldKey: longFieldKey,
              valueText: "599807801M",
              valueType: "string"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });
    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    fireEvent.click(await screen.findByText(/snap-2/));

    const table = await screen.findByLabelText("Fields (Snapshot A)");
    const tableWithin = within(table);

    // We use a fixed table layout so column widths are honored (otherwise the long field keys
    // can steal all horizontal space and Friendly name won't visually grow).
    expect(table).toHaveClass("table-fixed");
    expect(table).toHaveClass("min-w-[72rem]");

    const keyHeader = tableWithin.getByRole("columnheader", { name: /field key/i });
    expect(keyHeader).toBeInTheDocument();
    expect(keyHeader).toHaveClass("w-[32rem]");

    const valueHeader = tableWithin.getByRole("columnheader", { name: /value \(a\)/i });
    expect(valueHeader).toHaveClass("w-[22rem]");

    const keyCell = tableWithin.getByText(longFieldKey).closest("td");
    expect(keyCell).not.toBeNull();
    // Critical: long unbroken keys must not visually overlap the Value (A) column.
    // We enforce that by requiring the key cell to allow breaking/wrapping.
    expect(keyCell).toHaveClass("break-all");

    expect(tableWithin.queryByRole("columnheader", { name: /type/i })).not.toBeInTheDocument();
    const trackedHeader = tableWithin.getByRole("columnheader", { name: /tracked/i });
    expect(trackedHeader).toBeInTheDocument();
    expect(trackedHeader).toHaveClass("w-[8rem]");
    const friendlyHeader = tableWithin.getByRole("columnheader", { name: /friendly name/i });
    expect(friendlyHeader).toBeInTheDocument();
    // Friendly name should receive the remaining horizontal space.
    expect(friendlyHeader).not.toHaveClass("w-[22rem]");
  });

  it("derives ConfigurationId and persists tracked toggle immediately when clicking Track", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      calls.push({ url: u, init });

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/snapshots/ds2/fields")) {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/ConfigurationId",
              valueText: "cfg-1",
              valueType: "string"
            },
            {
              fieldKey: "root/FirmwareVersion",
              valueText: "599807801M",
              valueType: "string"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/configurations/cfg-1/fields") && (!init || init.method === "GET")) {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: "FW"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (u.includes("/configurations/cfg-1/fields") && init?.method === "PUT") {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: false,
              friendlyName: "Firmware"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });

    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    fireEvent.click(await screen.findByText(/snap-2/));

    expect(await screen.findByRole("heading", { name: /Fields \(Snapshot A\)/i })).toBeInTheDocument();

    const tracked = await screen.findByLabelText("Track root/FirmwareVersion");
    expect((tracked as HTMLInputElement).checked).toBe(true);

    const friendly = await screen.findByLabelText("Friendly name root/FirmwareVersion");
    expect((friendly as HTMLInputElement).value).toBe("FW");

    // Toggle tracked -> should persist immediately via PUT
    fireEvent.click(tracked); // toggle -> unchecked

    // Assert we persisted via PUT (no explicit Save click required)
    const putCall = calls.find((c) =>
      c.url.includes("/configurations/cfg-1/fields") && c.init?.method === "PUT"
    );
    expect(putCall).toBeTruthy();
    expect(putCall?.init?.headers).toEqual({ "content-type": "application/json" });
    expect(putCall?.init?.body).toBe(
      JSON.stringify({
        fields: [{ fieldKey: "root/FirmwareVersion", tracked: false, friendlyName: "FW" }]
      })
    );
  });

  it("filters Fields (Snapshot A) rows by field key and friendly name", async () => {
    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds1",
              snapshotId: "snap-1",
              timeStampUtc: "2026-02-17T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/snapshots/ds1/fields")) {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/ConfigurationId",
              valueText: "cfg-1",
              valueType: "string"
            },
            {
              fieldKey: "root/FirmwareVersion",
              valueText: "599807801M",
              valueType: "string"
            },
            {
              fieldKey: "root/EngineSpeed",
              valueText: "3120",
              valueType: "number"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/configurations/cfg-1/fields")) {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: "FW"
            },
            {
              configurationId: "cfg-1",
              fieldKey: "root/EngineSpeed",
              tracked: false,
              friendlyName: null
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });
    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    fireEvent.click(await screen.findByText(/snap-1/));

    const fieldsTable = await screen.findByLabelText("Fields (Snapshot A)");
    const w = within(fieldsTable);

    // Wait for fields to be rendered.
    expect(await w.findByText("root/FirmwareVersion")).toBeInTheDocument();
    expect(await w.findByText("root/EngineSpeed")).toBeInTheDocument();

    const filter = await screen.findByLabelText(/filter fields/i);

    // Friendly-name filter.
    fireEvent.change(filter, { target: { value: "fw" } });
    expect(w.getByText("root/FirmwareVersion")).toBeInTheDocument();
    expect(w.queryByText("root/EngineSpeed")).not.toBeInTheDocument();

    // Field-key filter.
    fireEvent.change(filter, { target: { value: "engine" } });
    expect(w.queryByText("root/FirmwareVersion")).not.toBeInTheDocument();
    expect(w.getByText("root/EngineSpeed")).toBeInTheDocument();
  });

  it("saves friendlyName as null when cleared", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      calls.push({ url: u, init });

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/snapshots/ds2/fields")) {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/ConfigurationId",
              valueText: "cfg-1",
              valueType: "string"
            },
            {
              fieldKey: "root/FirmwareVersion",
              valueText: "599807801M",
              valueType: "string"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/configurations/cfg-1/fields") && (!init || init.method === "GET")) {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: "FW"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (u.includes("/configurations/cfg-1/fields") && init?.method === "PUT") {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: null
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });

    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    fireEvent.click(await screen.findByText(/snap-2/));

    const friendly = await screen.findByLabelText("Friendly name root/FirmwareVersion");
    fireEvent.change(friendly, { target: { value: "   " } });

    fireEvent.click(screen.getByRole("button", { name: /save tracked fields/i }));

    const putCall = calls.find((c) =>
      c.url.includes("/configurations/cfg-1/fields") && c.init?.method === "PUT"
    );
    expect(putCall).toBeTruthy();
    expect(putCall?.init?.body).toBe(
      JSON.stringify({
        fields: [{ fieldKey: "root/FirmwareVersion", tracked: true, friendlyName: null }]
      })
    );
  });

  it("can track a discovered field even when no configuration fields exist yet", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      calls.push({ url: u, init });

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds1",
              snapshotId: "snap-1",
              timeStampUtc: "2026-02-17T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/snapshots/ds1/fields")) {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/ConfigurationId",
              valueText: "cfg-1",
              valueType: "string"
            },
            {
              fieldKey: "root/FirmwareVersion",
              valueText: "599807801M",
              valueType: "string"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (u.includes("/configurations/cfg-1/fields") && (!init || init.method === "GET")) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (u.includes("/configurations/cfg-1/fields") && init?.method === "PUT") {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: null
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });
    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    fireEvent.click(await screen.findByText(/snap-1/));

    const tracked = await screen.findByLabelText("Track root/FirmwareVersion");
    expect((tracked as HTMLInputElement).checked).toBe(false);

    fireEvent.click(tracked);

    const putCall = calls.find((c) =>
      c.url.includes("/configurations/cfg-1/fields") && c.init?.method === "PUT"
    );
    expect(putCall).toBeTruthy();
    expect(putCall?.init?.body).toBe(
      JSON.stringify({
        fields: [{ fieldKey: "root/FirmwareVersion", tracked: true, friendlyName: null }]
      })
    );
  });

  it("shows diff for tracked fields between two snapshots", async () => {
    const calls: string[] = [];

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      calls.push(`${init?.method ?? "GET"} ${u}`);

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            },
            {
              deviceSnapshotId: "ds1",
              snapshotId: "snap-1",
              timeStampUtc: "2026-02-17T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/snapshots/ds1/fields")) {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/ConfigurationId",
              valueText: "cfg-1",
              valueType: "string"
            },
            {
              fieldKey: "root/FirmwareVersion",
              valueText: "A",
              valueType: "string"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/snapshots/ds2/fields")) {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/ConfigurationId",
              valueText: "cfg-1",
              valueType: "string"
            },
            {
              fieldKey: "root/FirmwareVersion",
              valueText: "B",
              valueType: "string"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }
      if (u.includes("/configurations/cfg-1/fields")) {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: "FW"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response(
  JSON.stringify({
    configurationId: "cfg-1",
    snapshotA: { deviceSnapshotId: "ds1", snapshotId: "snap-1", timeStampUtc: "2026-02-17T07:50:23.000Z" },
    snapshotB: { deviceSnapshotId: "ds2", snapshotId: "snap-2", timeStampUtc: "2026-02-18T07:50:23.000Z" },
    diff: { added: [], removed: [], changed: [{ key: "root/FirmwareVersion", from: "A", to: "B" }], unchanged: [] }
  }),
  { status: 200, headers: { "content-type": "application/json" } }
);
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });

    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    // View snapshot A
    fireEvent.click(await screen.findByText(/snap-1/));

    // Choose snapshot B to compare
    fireEvent.click(await screen.findByLabelText("Compare snap-2"));

    expect(await screen.findByRole("heading", { name: /Diff/i })).toBeInTheDocument();

    const diffTable = await screen.findByRole("table", { name: "Diff" });
    const w = within(diffTable);
    expect(w.getByRole("cell", { name: "FW" })).toBeInTheDocument();
    expect(w.getByRole("cell", { name: "A" })).toBeInTheDocument();
    expect(w.getByRole("cell", { name: "B" })).toBeInTheDocument();

    expect(calls.some((c) => c.includes("/snapshots/ds1/fields"))).toBe(true);
    expect(calls.some((c) => c.includes("/snapshots/ds2/fields"))).toBe(true);

    expect(calls.some((c) => c.includes("/products/531285301/S1/diff"))).toBe(true);
  });

  it("shows a trend (time series) for a tracked field across selected snapshots", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);
      calls.push({ url: u, init });

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            },
            {
              deviceSnapshotId: "ds1",
              snapshotId: "snap-1",
              timeStampUtc: "2026-02-17T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      // Snapshot A (selected) => provides ConfigurationId
      if (u.includes("/snapshots/ds1/fields")) {
        return new Response(
          JSON.stringify([
            { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
            { fieldKey: "root/FirmwareVersion", valueText: "A", valueType: "string" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (u.includes("/snapshots/ds2/fields")) {
        return new Response(
          JSON.stringify([
            { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
            { fieldKey: "root/FirmwareVersion", valueText: "B", valueType: "string" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (u.includes("/products/531285301/S1/timeseries") && init?.method === "POST") {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/FirmwareVersion",
              points: [
                {
                  deviceSnapshotId: "ds1",
                  timeStampUtc: "2026-02-17T07:50:23.000Z",
                  valueText: "A",
                  valueType: "string"
                },
                {
                  deviceSnapshotId: "ds2",
                  timeStampUtc: "2026-02-18T07:50:23.000Z",
                  valueText: "B",
                  valueType: "string"
                }
              ]
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (u.includes("/configurations/cfg-1/fields")) {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: "FW"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });
    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    // Select snapshot A
    fireEvent.click(await screen.findByText(/snap-1/));

    // Switch to Workspace: Analysis, then Analysis tab: Trends
    {
      const workspaceTabs = screen.getByRole("tablist", { name: /workspace/i });
      const analysisWorkspaceTab = within(workspaceTabs).getByRole("tab", { name: /analysis/i });
      fireEvent.click(analysisWorkspaceTab);

      const analysisTabs = screen.getByRole("tablist", { name: /analysis/i });
      const trendsTab = within(analysisTabs).getByRole("tab", { name: /trends/i });
      fireEvent.click(trendsTab);
    }

    // Select snapshots to include in the trend
    fireEvent.click(await screen.findByLabelText("Include snap-1"));
    fireEvent.click(await screen.findByLabelText("Include snap-2"));

    // Choose tracked field(s)
    fireEvent.click(await screen.findByLabelText("Select trend root/FirmwareVersion"));

    fireEvent.click(screen.getByRole("button", { name: /show trend/i }));

    expect(screen.getByRole("heading", { name: /Trends/i })).toBeInTheDocument();

    // The per-series values table should have a visible series label above it.
    const valuesRegion = await screen.findByRole("region", { name: /trend values\s+fw/i });
    expect(within(valuesRegion).getByText("FW")).toBeInTheDocument();

    const trendTable = within(valuesRegion).getByRole("table", { name: /trend\s+fw/i });
    const w = within(trendTable);
    // Ordered by timeStampUtc asc
    expect(w.getByRole("cell", { name: "2026-02-17T07:50:23.000Z" })).toBeInTheDocument();
    expect(w.getByRole("cell", { name: "A" })).toBeInTheDocument();
    expect(w.getByRole("cell", { name: "2026-02-18T07:50:23.000Z" })).toBeInTheDocument();
    expect(w.getByRole("cell", { name: "B" })).toBeInTheDocument();

    const post = calls.find((c) =>
      c.url.includes("/products/531285301/S1/timeseries") && c.init?.method === "POST"
    );
    expect(post).toBeTruthy();
  });

  it("plots numeric trend values on a chart", async () => {
    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            },
            {
              deviceSnapshotId: "ds1",
              snapshotId: "snap-1",
              timeStampUtc: "2026-02-17T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      // Snapshot A (selected) => provides ConfigurationId
      if (u.includes("/snapshots/ds1/fields")) {
        return new Response(
          JSON.stringify([
            { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
            { fieldKey: "root/FirmwareVersion", valueText: "1", valueType: "number" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (u.includes("/snapshots/ds2/fields")) {
        return new Response(
          JSON.stringify([
            { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
            { fieldKey: "root/FirmwareVersion", valueText: "2", valueType: "number" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (u.includes("/products/531285301/S1/timeseries") && init?.method === "POST") {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/FirmwareVersion",
              points: [
                {
                  deviceSnapshotId: "ds1",
                  timeStampUtc: "2026-02-17T07:50:23.000Z",
                  valueText: "1",
                  valueType: "number"
                },
                {
                  deviceSnapshotId: "ds2",
                  timeStampUtc: "2026-02-18T07:50:23.000Z",
                  valueText: "2",
                  valueType: "number"
                }
              ]
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (u.includes("/configurations/cfg-1/fields")) {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: "FW"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });
    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    // Select snapshot A
    fireEvent.click(await screen.findByText(/snap-1/));

    // Switch to Workspace: Analysis, then Analysis tab: Trends
    {
      const workspaceTabs = screen.getByRole("tablist", { name: /workspace/i });
      const analysisWorkspaceTab = within(workspaceTabs).getByRole("tab", { name: /analysis/i });
      fireEvent.click(analysisWorkspaceTab);

      const analysisTabs = screen.getByRole("tablist", { name: /analysis/i });
      const trendsTab = within(analysisTabs).getByRole("tab", { name: /trends/i });
      fireEvent.click(trendsTab);
    }

    // Select snapshots to include in the trend (Select all)
    fireEvent.click(await screen.findByLabelText(/select all snapshots/i));
    expect(await screen.findByLabelText("Include snap-1")).toBeChecked();
    expect(await screen.findByLabelText("Include snap-2")).toBeChecked();

    // Choose tracked field(s)
    fireEvent.click(await screen.findByLabelText("Select trend root/FirmwareVersion"));

    fireEvent.click(screen.getByRole("button", { name: /show trend/i }));

    const hero = await screen.findByTestId("trend-hero");
    expect(within(hero).getByLabelText("Trend chart")).toBeInTheDocument();

    const seriesList = await screen.findByRole("list", { name: /trend series/i });
    expect(within(seriesList).getByText("FW")).toBeInTheDocument();

    const valuesGrid = await screen.findByTestId("trend-values-grid");
    expect(valuesGrid).toHaveClass("grid");
    expect(valuesGrid).toHaveClass("md:grid-cols-2");

    // And the per-field table still renders points, with a visible label above it.
    const valuesRegion = await screen.findByRole("region", { name: /trend values\s+fw/i });
    expect(within(valuesRegion).getByText("FW")).toBeInTheDocument();

    const trendTable = within(valuesRegion).getByRole("table", { name: /trend\s+fw/i });
    expect(within(trendTable).getByRole("cell", { name: "2026-02-17T07:50:23.000Z" })).toBeInTheDocument();
    expect(within(trendTable).getByRole("cell", { name: "1" })).toBeInTheDocument();
  });

  it("can plot multiple numeric trend fields as multiple series", async () => {
    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            },
            {
              deviceSnapshotId: "ds1",
              snapshotId: "snap-1",
              timeStampUtc: "2026-02-17T07:50:23.000Z"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      // Snapshot A (selected) => provides ConfigurationId
      if (u.includes("/snapshots/ds1/fields")) {
        return new Response(
          JSON.stringify([
            { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
            { fieldKey: "root/FirmwareVersion", valueText: "1", valueType: "number" },
            { fieldKey: "root/Temperature", valueText: "10", valueType: "number" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (u.includes("/snapshots/ds2/fields")) {
        return new Response(
          JSON.stringify([
            { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
            { fieldKey: "root/FirmwareVersion", valueText: "2", valueType: "number" },
            { fieldKey: "root/Temperature", valueText: "12", valueType: "number" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (u.includes("/configurations/cfg-1/fields")) {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: "FW"
            },
            {
              configurationId: "cfg-1",
              fieldKey: "root/Temperature",
              tracked: true,
              friendlyName: "Temp"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (u.includes("/products/531285301/S1/timeseries") && init?.method === "POST") {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/FirmwareVersion",
              points: [
                {
                  deviceSnapshotId: "ds1",
                  timeStampUtc: "2026-02-17T07:50:23.000Z",
                  valueText: "1",
                  valueType: "number"
                },
                {
                  deviceSnapshotId: "ds2",
                  timeStampUtc: "2026-02-18T07:50:23.000Z",
                  valueText: "2",
                  valueType: "number"
                }
              ]
            },
            {
              fieldKey: "root/Temperature",
              points: [
                {
                  deviceSnapshotId: "ds1",
                  timeStampUtc: "2026-02-17T07:50:23.000Z",
                  valueText: "10",
                  valueType: "number"
                },
                {
                  deviceSnapshotId: "ds2",
                  timeStampUtc: "2026-02-18T07:50:23.000Z",
                  valueText: "12",
                  valueType: "number"
                }
              ]
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });
    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    // Select snapshot A
    fireEvent.click(await screen.findByText(/snap-1/));

    // Switch to Workspace: Analysis, then Analysis tab: Trends
    {
      const workspaceTabs = screen.getByRole("tablist", { name: /workspace/i });
      const analysisWorkspaceTab = within(workspaceTabs).getByRole("tab", { name: /analysis/i });
      fireEvent.click(analysisWorkspaceTab);

      const analysisTabs = screen.getByRole("tablist", { name: /analysis/i });
      const trendsTab = within(analysisTabs).getByRole("tab", { name: /trends/i });
      fireEvent.click(trendsTab);
    }

    // Select snapshots to include in the trend
    fireEvent.click(await screen.findByLabelText("Include snap-1"));
    fireEvent.click(await screen.findByLabelText("Include snap-2"));

    // Choose multiple tracked fields
    fireEvent.click(await screen.findByLabelText("Select trend root/FirmwareVersion"));
    fireEvent.click(await screen.findByLabelText("Select trend root/Temperature"));

    fireEvent.click(screen.getByRole("button", { name: /show trend/i }));

    const hero = await screen.findByTestId("trend-hero");
    expect(within(hero).getByLabelText("Trend chart")).toBeInTheDocument();

    const seriesList = await screen.findByRole("list", { name: /trend series/i });
    const w = within(seriesList);
    expect(w.getByText("FW")).toBeInTheDocument();
    expect(w.getByText("Temp")).toBeInTheDocument();
  });

  it("assigns distinct colors to each trend series", async () => {
    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            {
              deviceSnapshotId: "ds2",
              snapshotId: "snap-2",
              timeStampUtc: "2026-02-18T07:50:23.000Z"
            },
            {
              deviceSnapshotId: "ds1",
              snapshotId: "snap-1",
              timeStampUtc: "2026-02-17T07:50:23.000Z"
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      // Snapshot A (selected) => provides ConfigurationId
      if (u.includes("/snapshots/ds1/fields")) {
        return new Response(
          JSON.stringify([
            { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
            { fieldKey: "root/FirmwareVersion", valueText: "1", valueType: "number" },
            { fieldKey: "root/Temperature", valueText: "10", valueType: "number" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      if (u.includes("/snapshots/ds2/fields")) {
        return new Response(
          JSON.stringify([
            { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
            { fieldKey: "root/FirmwareVersion", valueText: "2", valueType: "number" },
            { fieldKey: "root/Temperature", valueText: "12", valueType: "number" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (u.includes("/configurations/cfg-1/fields")) {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: "FW"
            },
            {
              configurationId: "cfg-1",
              fieldKey: "root/Temperature",
              tracked: true,
              friendlyName: "Temp"
            }
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (u.includes("/products/531285301/S1/timeseries") && init?.method === "POST") {
        return new Response(
          JSON.stringify([
            {
              fieldKey: "root/FirmwareVersion",
              points: [
                {
                  deviceSnapshotId: "ds1",
                  timeStampUtc: "2026-02-17T07:50:23.000Z",
                  valueText: "1",
                  valueType: "number"
                },
                {
                  deviceSnapshotId: "ds2",
                  timeStampUtc: "2026-02-18T07:50:23.000Z",
                  valueText: "2",
                  valueType: "number"
                }
              ]
            },
            {
              fieldKey: "root/Temperature",
              points: [
                {
                  deviceSnapshotId: "ds1",
                  timeStampUtc: "2026-02-17T07:50:23.000Z",
                  valueText: "10",
                  valueType: "number"
                },
                {
                  deviceSnapshotId: "ds2",
                  timeStampUtc: "2026-02-18T07:50:23.000Z",
                  valueText: "12",
                  valueType: "number"
                }
              ]
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });
    fireEvent.change(screen.getByLabelText("Product number"), {
      target: { value: "531285301" }
    });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), {
      target: { value: "S1" }
    });

    // Select snapshot A
    fireEvent.click(await screen.findByText(/snap-1/));

    // Switch to Workspace: Analysis, then Analysis tab: Trends
    {
      const workspaceTabs = screen.getByRole("tablist", { name: /workspace/i });
      const analysisWorkspaceTab = within(workspaceTabs).getByRole("tab", { name: /analysis/i });
      fireEvent.click(analysisWorkspaceTab);

      const analysisTabs = screen.getByRole("tablist", { name: /analysis/i });
      const trendsTab = within(analysisTabs).getByRole("tab", { name: /trends/i });
      fireEvent.click(trendsTab);
    }

    fireEvent.click(await screen.findByLabelText("Include snap-1"));
    fireEvent.click(await screen.findByLabelText("Include snap-2"));

    fireEvent.click(await screen.findByLabelText("Select trend root/FirmwareVersion"));
    fireEvent.click(await screen.findByLabelText("Select trend root/Temperature"));

    fireEvent.click(screen.getByRole("button", { name: /show trend/i }));

    const seriesList = await screen.findByRole("list", { name: /trend series/i });
    const fw = within(seriesList).getByText("FW").closest("li");
    const temp = within(seriesList).getByText("Temp").closest("li");

    expect(fw).toBeTruthy();
    expect(temp).toBeTruthy();

    // Deterministic token assignment (index order, cycled).
    expect(fw).toHaveAttribute("data-series-color", "chart-1");
    expect(temp).toHaveAttribute("data-series-color", "chart-2");

    const hero = await screen.findByTestId("trend-hero");
    const chart = within(hero).getByLabelText("Trend chart");
    // Recharts renders SVG paths; assert our stroke values are present.
    expect(chart.querySelectorAll('path[stroke="hsl(var(--chart-1))"]').length).toBeGreaterThan(0);
    expect(chart.querySelectorAll('path[stroke="hsl(var(--chart-2))"]').length).toBeGreaterThan(0);

    // Timestamp should be visible even without hovering a point.
    const timeRange = within(hero).getByLabelText(/trend time range/i);
    expect(timeRange).toHaveTextContent("2026-02-17");
    expect(timeRange).toHaveTextContent("2026-02-18");
  });

  it("lays out Trends controls as two columns under a hero chart panel", async () => {
    globalThis.fetch = async (url: any, init?: any) => {
      const u = String(url);

      if (u.endsWith("/product-numbers")) {
        return new Response(JSON.stringify(["531285301"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/serial-numbers")) {
        return new Response(JSON.stringify(["S1"]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      if (u.includes("/products/") && u.includes("/snapshots")) {
        return new Response(
          JSON.stringify([
            { deviceSnapshotId: "ds2", snapshotId: "snap-2", timeStampUtc: "2026-02-18T07:50:23.000Z" },
            { deviceSnapshotId: "ds1", snapshotId: "snap-1", timeStampUtc: "2026-02-17T07:50:23.000Z" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      // Snapshot A (selected) => provides ConfigurationId
      if (u.includes("/snapshots/ds1/fields")) {
        return new Response(
          JSON.stringify([
            { fieldKey: "root/ConfigurationId", valueText: "cfg-1", valueType: "string" },
            { fieldKey: "root/FirmwareVersion", valueText: "1", valueType: "number" }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (u.includes("/configurations/cfg-1/fields")) {
        return new Response(
          JSON.stringify([
            {
              configurationId: "cfg-1",
              fieldKey: "root/FirmwareVersion",
              tracked: true,
              friendlyName: "FW"
            }
          ]),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };

    render(<App />);

    await screen.findByRole("option", { name: "531285301" });
    fireEvent.change(screen.getByLabelText("Product number"), { target: { value: "531285301" } });

    await screen.findByRole("option", { name: "S1" });
    fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: "S1" } });

    // Select snapshot A => enables trends
    fireEvent.click(await screen.findByText(/snap-1/));

    // Switch to Workspace: Analysis, then Analysis tab: Trends
    {
      const workspaceTabs = screen.getByRole("tablist", { name: /workspace/i });
      fireEvent.click(within(workspaceTabs).getByRole("tab", { name: /analysis/i }));

      const analysisTabs = screen.getByRole("tablist", { name: /analysis/i });
      fireEvent.click(within(analysisTabs).getByRole("tab", { name: /trends/i }));
    }

    const hero = await screen.findByTestId("trend-hero");
    const controls = await screen.findByTestId("trend-controls-grid");

    // “Hero chart” panel exists and appears above controls in DOM order.
    expect(hero).toBeInTheDocument();
    expect(controls).toBeInTheDocument();
    expect(hero.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Controls are a responsive two-column grid.
    expect(controls).toHaveClass("grid");
    expect(controls).toHaveClass("md:grid-cols-2");

    // Before "Show trend", the hero shows a placeholder message (no chart yet).
    expect(within(hero).getByText("Chart")).toBeInTheDocument();
    expect(within(hero).getByText(/select snapshots \+ fields/i)).toBeInTheDocument();

    // Section headings still present.
    expect(within(controls).getByText(/include snapshots/i)).toBeInTheDocument();
    expect(within(controls).getByText(/trend fields/i)).toBeInTheDocument();
  });
});
