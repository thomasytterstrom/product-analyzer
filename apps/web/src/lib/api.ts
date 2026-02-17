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
    }
  };
}
