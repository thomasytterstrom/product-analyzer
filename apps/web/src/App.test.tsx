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
    expect(screen.getByRole("main")).toBeInTheDocument();

    // Key sections should exist even before any data loads.
    expect(screen.getByRole("heading", { name: /Selection/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Snapshots/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Fields \(Snapshot A\)/i })).toBeInTheDocument();

    // Analysis tabs
    const tabs = screen.getByRole("tablist", { name: /analysis/i });
    const diffTab = within(tabs).getByRole("tab", { name: /diff/i });
    const trendsTab = within(tabs).getByRole("tab", { name: /trends/i });

    expect(diffTab).toHaveAttribute("aria-selected", "true");
    expect(trendsTab).toHaveAttribute("aria-selected", "false");

    // Diff should be visible by default, trends should not.
    expect(screen.getByRole("heading", { name: /diff/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /trends/i })).not.toBeInTheDocument();

    fireEvent.click(trendsTab);
    expect(screen.getByRole("tab", { name: /trends/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /diff/i })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("heading", { name: /trends/i })).toBeInTheDocument();
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

  it("derives ConfigurationId and allows editing + saving tracked fields", async () => {
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

    // Change values
    fireEvent.click(tracked); // toggle -> unchecked
    fireEvent.change(friendly, { target: { value: "Firmware" } });

    fireEvent.click(screen.getByRole("button", { name: /save tracked fields/i }));

    // Assert we persisted via PUT
    const putCall = calls.find((c) =>
      c.url.includes("/configurations/cfg-1/fields") && c.init?.method === "PUT"
    );
    expect(putCall).toBeTruthy();
    expect(putCall?.init?.headers).toEqual({ "content-type": "application/json" });
    expect(putCall?.init?.body).toBe(
      JSON.stringify({
        fields: [{ fieldKey: "root/FirmwareVersion", tracked: false, friendlyName: "Firmware" }]
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

    // Trends UI is under the Analysis tab.
    fireEvent.click(screen.getByRole("tab", { name: /trends/i }));

    // Select snapshots to include in the trend
    fireEvent.click(await screen.findByLabelText("Include snap-1"));
    fireEvent.click(await screen.findByLabelText("Include snap-2"));

    // Choose tracked field
    fireEvent.change(await screen.findByLabelText("Trend field"), {
      target: { value: "root/FirmwareVersion" }
    });

    fireEvent.click(screen.getByRole("button", { name: /show trend/i }));

    expect(await screen.findByRole("heading", { name: /Trends/i })).toBeInTheDocument();

    const trendTable = await screen.findByLabelText("Trend");
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

    // Trends UI is under the Analysis tab.
    fireEvent.click(screen.getByRole("tab", { name: /trends/i }));

    // Select snapshots to include in the trend
    fireEvent.click(await screen.findByLabelText("Include snap-1"));
    fireEvent.click(await screen.findByLabelText("Include snap-2"));

    // Choose tracked field
    fireEvent.change(await screen.findByLabelText("Trend field"), {
      target: { value: "root/FirmwareVersion" }
    });

    fireEvent.click(screen.getByRole("button", { name: /show trend/i }));

    const svg = (await screen.findByLabelText("Trend chart")) as unknown as SVGElement;
    expect(svg.tagName.toLowerCase()).toBe("svg");
    expect(svg.querySelectorAll("circle").length).toBe(2);
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(0);
  });
});
