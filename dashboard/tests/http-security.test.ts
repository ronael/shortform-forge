import { describe, expect, it } from "vitest";
import { parseByteRange, sameHostOrigin } from "../server/http-security.js";

describe("dashboard HTTP security", () => {
  it("accepts matching LAN origins and rejects another host", () => {
    expect(sameHostOrigin("http://192.168.1.21:4173", "192.168.1.21:4173")).toBe(true);
    expect(sameHostOrigin("http://attacker.test", "192.168.1.21:4173")).toBe(false);
  });

  it("parses bounded media ranges and rejects overflow", () => {
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(() => parseByteRange("bytes=100-", 100)).toThrow(RangeError);
  });
});
