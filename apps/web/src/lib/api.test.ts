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

  it("gets configuration fields for a configuration id", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
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
    };

    const result = await api.getConfigurationFields("cfg-1");

    expect(result).toEqual([
      {
        configurationId: "cfg-1",
        fieldKey: "root/FirmwareVersion",
        tracked: true,
        friendlyName: "FW"
      }
    ]);
    expect(calls[0].url).toBe("http://example.test/configurations/cfg-1/fields");
  });

  it("saves configuration fields for a configuration id", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
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
    };

    const result = await api.saveConfigurationFields("cfg-1", [
      { fieldKey: "root/FirmwareVersion", tracked: false, friendlyName: "Firmware" }
    ]);

    expect(result).toEqual([
      {
        configurationId: "cfg-1",
        fieldKey: "root/FirmwareVersion",
        tracked: false,
        friendlyName: "Firmware"
      }
    ]);

    expect(calls[0].url).toBe("http://example.test/configurations/cfg-1/fields");
    expect(calls[0].init?.method).toBe("PUT");
    expect(calls[0].init?.headers).toEqual({ "content-type": "application/json" });
    expect(calls[0].init?.body).toBe(
      JSON.stringify({
        fields: [{ fieldKey: "root/FirmwareVersion", tracked: false, friendlyName: "Firmware" }]
      })
    );
  });

  it("gets a time series for selected snapshots and field keys", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
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
              }
            ]
          }
        ]),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const result = await api.getTimeSeries({
      productNumber: "531285301",
      serialNumber: "S1",
      snapshotIds: ["ds1", "ds2"],
      fieldKeys: ["root/FirmwareVersion"]
    });

    expect(result).toEqual([
      {
        fieldKey: "root/FirmwareVersion",
        points: [
          {
            deviceSnapshotId: "ds1",
            timeStampUtc: "2026-02-17T07:50:23.000Z",
            valueText: "A",
            valueType: "string"
          }
        ]
      }
    ]);

    expect(calls[0].url).toBe("http://example.test/products/531285301/S1/timeseries");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers).toEqual({ "content-type": "application/json" });
    expect(calls[0].init?.body).toBe(
      JSON.stringify({
        snapshotIds: ["ds1", "ds2"],
        fieldKeys: ["root/FirmwareVersion"]
      })
    );
  });

  it("syncs without sending an empty json content type header", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          success: true,
          metadataMigrated: 1,
          snapshotsMigrated: 2,
          errors: []
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const result = await api.syncData();

    expect(result).toEqual({
      success: true,
      metadataMigrated: 1,
      snapshotsMigrated: 2,
      errors: []
    });
    expect(calls[0].url).toBe("http://example.test/sync");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers).toEqual({});
    expect(calls[0].init?.body).toBeUndefined();
  });

  it("surfaces backend sync error messages", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: "DATABASE_URL is not configured. Sync only works when a remote Postgres database is targeted."
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" }
        }
      );

    await expect(api.syncData()).rejects.toThrow(
      "DATABASE_URL is not configured. Sync only works when a remote Postgres database is targeted."
    );
  });
});
