import { fireEvent, render, screen } from "@testing-library/react";
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
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
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

    expect(await screen.findByRole("heading", { name: /Tracked fields/i })).toBeInTheDocument();

    const tracked = await screen.findByLabelText("Tracked root/FirmwareVersion");
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
});
