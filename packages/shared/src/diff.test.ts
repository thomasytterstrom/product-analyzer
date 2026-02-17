import { describe, expect, it } from "vitest";
import { diffAttributes } from "./diff";

describe("diffAttributes", () => {
  it("detects changed and added keys", () => {
    const a = { price: "10", name: "X" };
    const b = { price: "12", name: "X", color: "red" };

    const d = diffAttributes(a, b);

    expect(d.changed).toEqual([{ key: "price", from: "10", to: "12" }]);
    expect(d.added).toEqual([{ key: "color", to: "red" }]);
    expect(d.removed).toEqual([]);
  });
});
