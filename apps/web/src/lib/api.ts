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

  syncData(): Promise<{
    success: boolean;
    metadataMigrated: number;
    snapshotsMigrated: number;
    errors: string[];
  }>;
};

async function getResponseErrorMessage(res: Response, fallbackMessage: string) {
  const contentType = res.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      const payload = (await res.json()) as { error?: unknown; message?: unknown };
      if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
        return payload.error;
      }
      if (typeof payload?.message === "string" && payload.message.trim().length > 0) {
        return payload.message;
      }
    }

    const text = await res.text();
    if (text.trim().length > 0) {
      return text;
    }
  } catch {
    // Fall through to the default message when the response body cannot be parsed.
  }

  return fallbackMessage;
}

async function ensureOk(res: Response, fallbackMessage: string) {
  if (res.ok) {
    return;
  }

  throw new Error(await getResponseErrorMessage(res, fallbackMessage));
}

export function createApiClient(opts: { baseUrl: string; token?: string }): ApiClient {
  const raw = opts.baseUrl.trim();
  const fallbackOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "http://localhost";

  const baseUrl = (raw.length > 0 ? raw : fallbackOrigin).replace(/\/+$/, "");

  const getHeaders = (includeJsonContentType = false) => {
    const headers: Record<string, string> = {
    };
    if (includeJsonContentType) {
      headers["content-type"] = "application/json";
    }
    if (opts.token) {
      headers["Authorization"] = `Bearer ${opts.token}`;
    }
    return headers;
  };

  return {
    async listProductNumbers() {
      const res = await fetch(`${baseUrl}/product-numbers`, { headers: getHeaders() });
      await ensureOk(res, `GET /product-numbers failed: ${res.status}`);
      return (await res.json()) as string[];
    },

    async listSerialNumbers(productNumber: string) {
      const res = await fetch(
        `${baseUrl}/product-numbers/${encodeURIComponent(productNumber)}/serial-numbers`,
        { headers: getHeaders() }
      );
      await ensureOk(res, `GET /product-numbers/:productNumber/serial-numbers failed: ${res.status}`);
      return (await res.json()) as string[];
    },

    async listSnapshots({ productNumber, serialNumber }) {
      const res = await fetch(
        `${baseUrl}/products/${encodeURIComponent(productNumber)}/${encodeURIComponent(serialNumber)}/snapshots`,
        { headers: getHeaders() }
      );
      await ensureOk(res, `GET /products/:productNumber/:serialNumber/snapshots failed: ${res.status}`);
      return (await res.json()) as Array<{
        deviceSnapshotId: string;
        snapshotId: string;
        timeStampUtc: string;
      }>;
    },

    async getSnapshotFields(deviceSnapshotId: string) {
      const res = await fetch(`${baseUrl}/snapshots/${encodeURIComponent(deviceSnapshotId)}/fields`, {
        headers: getHeaders()
      });
      await ensureOk(res, `GET /snapshots/:deviceSnapshotId/fields failed: ${res.status}`);
      return (await res.json()) as Array<{ fieldKey: string; valueText: string; valueType: string }>;
    },

    async getConfigurationFields(configurationId: string) {
      const res = await fetch(
        `${baseUrl}/configurations/${encodeURIComponent(configurationId)}/fields`,
        { headers: getHeaders() }
      );
      await ensureOk(res, `GET /configurations/:configurationId/fields failed: ${res.status}`);
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
          headers: getHeaders(true),
          body: JSON.stringify({ fields })
        }
      );
      await ensureOk(res, `PUT /configurations/:configurationId/fields failed: ${res.status}`);
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
          encodeURIComponent(snapshotB),
        { headers: getHeaders() }
      );
      await ensureOk(res, "GET /products/:productNumber/:serialNumber/diff failed: " + res.status);
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
          headers: getHeaders(true),
          body: JSON.stringify({ snapshotIds, fieldKeys })
        }
      );
      await ensureOk(res, `POST /products/:productNumber/:serialNumber/timeseries failed: ${res.status}`);
      return (await res.json()) as Array<{
        fieldKey: string;
        points: Array<{
          deviceSnapshotId: string;
          timeStampUtc: string;
          valueText: string | null;
          valueType: string | null;
        }>;
      }>;
    },

    async syncData() {
      const res = await fetch(`${baseUrl}/sync`, {
        method: "POST",
        headers: getHeaders()
      });
      await ensureOk(res, `POST /sync failed: ${res.status}`);
      return (await res.json()) as {
        success: boolean;
        metadataMigrated: number;
        snapshotsMigrated: number;
        errors: string[];
      };
    }
  };
}
