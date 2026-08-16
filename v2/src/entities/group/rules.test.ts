import { describe, expect, it } from "vitest";
import { canPermanentlyDeleteGroup } from "./rules";

describe("canPermanentlyDeleteGroup", () => {
  it("allows permanent delete only when the group has zero jobs", () => {
    expect(canPermanentlyDeleteGroup(0)).toBe(true);
  });

  it("blocks permanent delete when the group has any jobs", () => {
    expect(canPermanentlyDeleteGroup(1)).toBe(false);
    expect(canPermanentlyDeleteGroup(42)).toBe(false);
  });
});
