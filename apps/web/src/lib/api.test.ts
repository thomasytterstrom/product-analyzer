import { describe, expect, it } from "vitest";

import { createApiClient } from "./api";

describe("createApiClient", () => {
  it("lists product numbers", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    // Minimal fetch stub (no mocking library):
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(["531285301", "999"]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    const result = await api.listProductNumbers();

    expect(result).toEqual(["531285301", "999"]);
    expect(calls[0].url).toBe("http://example.test/product-numbers");
  });

  it("lists serial numbers for a product number", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(["S1", "S2"]), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };

    const result = await api.listSerialNumbers("531285301");

    expect(result).toEqual(["S1", "S2"]);
    expect(calls[0].url).toBe(
      "http://example.test/product-numbers/531285301/serial-numbers"
    );
  });

  it("lists snapshots for a product + serial", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
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
    };

    const result = await api.listSnapshots({
      productNumber: "531285301",
      serialNumber: "S1"
    });

    expect(result).toEqual([
      {
        deviceSnapshotId: "ds2",
        snapshotId: "snap-2",
        timeStampUtc: "2026-02-18T07:50:23.000Z"
      }
    ]);
    expect(calls[0].url).toBe("http://example.test/products/531285301/S1/snapshots");
  });

  it("gets flattened fields for a snapshot", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
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
    };

    const result = await api.getSnapshotFields("ds2");

    expect(result).toEqual([
      {
        fieldKey: "root/FirmwareVersion",
        valueText: "599807801M",
        valueType: "string"
      }
    ]);
    expect(calls[0].url).toBe("http://example.test/snapshots/ds2/fields");
  });
});
