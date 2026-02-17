import { describe, expect, it } from "vitest";

import { createApiClient } from "./api";

describe("createApiClient", () => {
  it("lists product numbers", async () => {
    const api = createApiClient({ baseUrl: "http://example.test" });

    // Minimal fetch stub (no mocking library):
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    // @ts-expect-error - override global fetch for test
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
});
