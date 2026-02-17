export type ApiClient = {
  listProductNumbers(): Promise<string[]>;
};

export function createApiClient(opts: { baseUrl: string }): ApiClient {
  const baseUrl = opts.baseUrl.replace(/\/+$/, "");

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
