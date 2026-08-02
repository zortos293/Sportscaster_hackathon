import { describe, expect, it } from "vitest";
import { BoundedCache } from "./bounded-cache";

describe("BoundedCache", () => {
  it("evicts the least recently used entry", () => {
    const cache = new BoundedCache<string, string>(2);
    cache.set("first", "1");
    cache.set("second", "2");

    expect(cache.get("first")).toBe("1");
    cache.set("third", "3");

    expect(cache.get("second")).toBeUndefined();
    expect(cache.get("first")).toBe("1");
    expect(cache.get("third")).toBe("3");
  });

  it("keeps replacement entries within the limit", () => {
    const cache = new BoundedCache<string, string>(1);
    cache.set("game", "agent-1");
    cache.set("game", "agent-2");

    expect(cache.size).toBe(1);
    expect(cache.get("game")).toBe("agent-2");
  });

  it("rejects invalid limits", () => {
    expect(() => new BoundedCache(0)).toThrow(RangeError);
  });
});
