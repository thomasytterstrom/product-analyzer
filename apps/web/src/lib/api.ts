export type ApiClient = {
  listProductNumbers(): Promise<string[]>;
  listSerialNumbers(productNumber: string): Promise<string[]>;
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
    }
  };
}
