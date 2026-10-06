import { describe, expect, it } from "vitest";
import { largestRemainder } from "./GenerateCards";

// Same results as the backend's generation.largest_remainder (tests/test_generation.py), so the
// counts the form previews are the counts the server asks for.
describe("largestRemainder", () => {
  it("splits exactly, giving ties to the first", () => {
    expect(largestRemainder(100, [20, 80])).toEqual([20, 80]);
    expect(largestRemainder(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(largestRemainder(7, [0.3, 0.3, 0.4]).reduce((a, b) => a + b)).toBe(7);
    expect(largestRemainder(5, [0, 0])).toEqual([0, 0]);
  });
});
