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
});
