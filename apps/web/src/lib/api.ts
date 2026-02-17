export type ApiClient = {
  listProductNumbers(): Promise<string[]>;
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
    }
  };
}
