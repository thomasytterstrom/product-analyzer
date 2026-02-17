export type ApiClient = {
  listProductNumbers(): Promise<string[]>;
  listSerialNumbers(productNumber: string): Promise<string[]>;
  listSnapshots(input: {
    productNumber: string;
    serialNumber: string;
  }): Promise<Array<{ deviceSnapshotId: string; snapshotId: string; timeStampUtc: string }>>;
  getSnapshotFields(
    deviceSnapshotId: string
  ): Promise<Array<{ fieldKey: string; valueText: string; valueType: string }>>;

  getConfigurationFields(configurationId: string): Promise<
    Array<{ configurationId: string; fieldKey: string; tracked: boolean; friendlyName: string | null }>
  >;
  saveConfigurationFields(
    configurationId: string,
    fields: Array<{ fieldKey: string; tracked: boolean; friendlyName?: string | null }>
  ): Promise<
    Array<{ configurationId: string; fieldKey: string; tracked: boolean; friendlyName: string | null }>
  >;


  getDiff(input: {
    productNumber: string;
    serialNumber: string;
    snapshotA: string;
    snapshotB: string;
  }): Promise<{
    configurationId: string;
    snapshotA: { deviceSnapshotId: string; snapshotId: string; timeStampUtc: string };
    snapshotB: { deviceSnapshotId: string; snapshotId: string; timeStampUtc: string };
    diff: {
      added: Array<{ key: string; to: string | null }>;
      removed: Array<{ key: string; from: string | null }>;
      changed: Array<{ key: string; from: string | null; to: string | null }>;
      unchanged: Array<{ key: string; value: string | null }>;
    };
  }>;

  getTimeSeries(input: {
    productNumber: string;
    serialNumber: string;
    snapshotIds: string[];
    fieldKeys: string[];
  }): Promise<
    Array<{
      fieldKey: string;
      points: Array<{
        deviceSnapshotId: string;
        timeStampUtc: string;
        valueText: string | null;
        valueType: string | null;
      }>;
    }>
  >;
};

export function createApiClient(opts: { baseUrl: string }): ApiClient {
  const raw = opts.baseUrl.trim();
  const fallbackOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";

  const baseUrl = (raw.length > 0 ? raw : fallbackOrigin).replace(/\/+$/, "");

  return {
    async listProductNumbers() {
      const res = await fetch(`${baseUrl}/product-numbers`);
      if (!res.ok) {
        throw new Error(`GET /product-numbers failed: ${res.status}`);
      }
      return (await res.json()) as string[];
    },

    async listSerialNumbers(productNumber: string) {
      const res = await fetch(
        `${baseUrl}/product-numbers/${encodeURIComponent(productNumber)}/serial-numbers`
      );
      if (!res.ok) {
        throw new Error(
          `GET /product-numbers/:productNumber/serial-numbers failed: ${res.status}`
        );
      }
      return (await res.json()) as string[];
    },

    async listSnapshots({ productNumber, serialNumber }) {
      const res = await fetch(
        `${baseUrl}/products/${encodeURIComponent(productNumber)}/${encodeURIComponent(serialNumber)}/snapshots`
      );
      if (!res.ok) {
        throw new Error(`GET /products/:productNumber/:serialNumber/snapshots failed: ${res.status}`);
      }
      return (await res.json()) as Array<{
        deviceSnapshotId: string;
        snapshotId: string;
        timeStampUtc: string;
      }>;
    },

    async getSnapshotFields(deviceSnapshotId: string) {
      const res = await fetch(
        `${baseUrl}/snapshots/${encodeURIComponent(deviceSnapshotId)}/fields`
      );
      if (!res.ok) {
        throw new Error(`GET /snapshots/:deviceSnapshotId/fields failed: ${res.status}`);
      }
      return (await res.json()) as Array<{ fieldKey: string; valueText: string; valueType: string }>;
    },

    async getConfigurationFields(configurationId: string) {
      const res = await fetch(
        `${baseUrl}/configurations/${encodeURIComponent(configurationId)}/fields`
      );
      if (!res.ok) {
        throw new Error(`GET /configurations/:configurationId/fields failed: ${res.status}`);
      }
      return (await res.json()) as Array<{
        configurationId: string;
        fieldKey: string;
        tracked: boolean;
        friendlyName: string | null;
      }>;
    },

    async saveConfigurationFields(
      configurationId: string,
      fields: Array<{ fieldKey: string; tracked: boolean; friendlyName?: string | null }>
    ) {
      const res = await fetch(
        `${baseUrl}/configurations/${encodeURIComponent(configurationId)}/fields`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fields })
        }
      );
      if (!res.ok) {
        throw new Error(`PUT /configurations/:configurationId/fields failed: ${res.status}`);
      }
      return (await res.json()) as Array<{
        configurationId: string;
        fieldKey: string;
        tracked: boolean;
        friendlyName: string | null;
      }>;
    },

    async getDiff({ productNumber, serialNumber, snapshotA, snapshotB }) {
      const res = await fetch(
        baseUrl +
          "/products/" +
          encodeURIComponent(productNumber) +
          "/" +
          encodeURIComponent(serialNumber) +
          "/diff?snapshotA=" +
          encodeURIComponent(snapshotA) +
          "&snapshotB=" +
          encodeURIComponent(snapshotB)
      );
      if (!res.ok) {
        throw new Error("GET /products/:productNumber/:serialNumber/diff failed: " + res.status);
      }
      return (await res.json()) as {
        configurationId: string;
        snapshotA: { deviceSnapshotId: string; snapshotId: string; timeStampUtc: string };
        snapshotB: { deviceSnapshotId: string; snapshotId: string; timeStampUtc: string };
        diff: {
          added: Array<{ key: string; to: string | null }>;
          removed: Array<{ key: string; from: string | null }>;
          changed: Array<{ key: string; from: string | null; to: string | null }>;
          unchanged: Array<{ key: string; value: string | null }>;
        };
      };
    },

    async getTimeSeries({ productNumber, serialNumber, snapshotIds, fieldKeys }) {
      const res = await fetch(
        `${baseUrl}/products/${encodeURIComponent(productNumber)}/${encodeURIComponent(serialNumber)}/timeseries`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ snapshotIds, fieldKeys })
        }
      );
      if (!res.ok) {
        throw new Error(`POST /products/:productNumber/:serialNumber/timeseries failed: ${res.status}`);
      }
      return (await res.json()) as Array<{
        fieldKey: string;
        points: Array<{
          deviceSnapshotId: string;
          timeStampUtc: string;
          valueText: string | null;
          valueType: string | null;
        }>;
      }>;
    }
  };
}
