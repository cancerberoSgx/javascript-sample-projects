import { describe, expect, it } from "vitest";
import { setBackground } from "../boardEditor/ops";
import type { Background } from "../engine/types";
import { boardAspect } from "./BackgroundEditor";
import { AREA_MARGIN, boardArea, cropRect, hasBackground, placeBackground } from "./background";

// rules.md §2.1.2, BKG-1 and BKG-2
const area = { x: 10, y: 20, w: 400, h: 200 }; // 2:1
const square = { w: 100, h: 100 };

describe("placeBackground", () => {
  it("cover fills the area and centers the overflow", () => {
    expect(placeBackground({}, square, area)).toEqual([{ x: 10, y: -80, w: 400, h: 400 }]);
  });

  it("cover keeps the part `position` points at", () => {
    const [top] = placeBackground({ position: { x: 0.5, y: 0 } }, square, area);
    expect(top.y).toBe(20); // the image's top edge on the area's top edge
    const [bottom] = placeBackground({ position: { x: 0.5, y: 1 } }, square, area);
    expect(bottom.y + bottom.h).toBe(220);
  });

  it("contain shows the whole image, placed by position", () => {
    expect(placeBackground({ fit: "contain" }, square, area)).toEqual([{ x: 110, y: 20, w: 200, h: 200 }]);
    expect(placeBackground({ fit: "contain", position: { x: 0, y: 0.5 } }, square, area)[0].x).toBe(10);
  });

  it("zoom scales cover and contain", () => {
    expect(placeBackground({ fit: "contain", zoom: 0.5 }, square, area)).toEqual([{ x: 160, y: 70, w: 100, h: 100 }]);
    expect(placeBackground({ zoom: 2 }, square, area)[0].w).toBe(800);
  });

  it("stretch is exactly the area", () => {
    expect(placeBackground({ fit: "stretch", zoom: 3 }, square, area)).toEqual([area]);
  });

  it("tile covers the whole area with tiles of tile_size × board width", () => {
    const tiles = placeBackground({ fit: "tile", tile_size: 0.25 }, { w: 200, h: 100 }, area);
    expect(tiles.every((t) => t.w === 100 && t.h === 50)).toBe(true);
    // Every point of the area is under some tile
    for (const [px, py] of [
      [10, 20],
      [409, 219],
      [200, 100],
    ])
      expect(tiles.some((t) => px >= t.x && px < t.x + t.w && py >= t.y && py < t.y + t.h)).toBe(true);
    // One tile sits centered (default position), the rest repeat from it
    expect(tiles.some((t) => t.x === 160 && t.y === 95)).toBe(true);
  });

  it("caps the number of tiles", () => {
    expect(placeBackground({ fit: "tile", tile_size: 0.0001 }, square, { x: 0, y: 0, w: 4000, h: 4000 }).length).toBeLessThanOrEqual(4000);
  });
});

describe("cropRect", () => {
  it("is the whole image by default and fractions of it otherwise", () => {
    const img = { width: 800, height: 600 };
    expect(cropRect({}, img)).toEqual({ x: 0, y: 0, w: 800, h: 600 });
    expect(cropRect({ crop: { x: 0.25, y: 0.5, w: 0.5, h: 0.5 } }, img)).toEqual({ x: 200, y: 300, w: 400, h: 300 });
  });

  it("stays inside the image even when the values don't", () => {
    const r = cropRect({ crop: { x: 0.9, y: -1, w: 0.5, h: 3 } }, { width: 100, height: 100 });
    expect([r.x, r.y, r.w, r.h].map(Math.round)).toEqual([90, 0, 10, 100]);
  });

  it("the cropped part is what gets fitted", () => {
    const bg: Background = { crop: { x: 0, y: 0, w: 0.5, h: 1 } }; // left half of a 200×100 image = a square
    const src = cropRect(bg, { width: 200, height: 100 });
    expect(placeBackground(bg, src, area)).toEqual(placeBackground({}, square, area));
  });
});

describe("board area and shape", () => {
  it("adds the margin around the grid cells (BKG-1)", () => {
    expect(boardArea({ x: 100, y: 50, w: 300, h: 200 }, 100)).toEqual({ x: 100 - 100 * AREA_MARGIN, y: 50 - 100 * AREA_MARGIN, w: 300 + 200 * AREA_MARGIN, h: 200 + 200 * AREA_MARGIN });
  });

  it("boardAspect is the area's width / height in cells", () => {
    const spaces = [
      { pos: { x: 0, y: 0 } },
      { pos: { x: 3, y: 1 } },
    ] as Parameters<typeof boardAspect>[0]["spaces"];
    expect(boardAspect({ spaces })).toBeCloseTo((4 + 2 * AREA_MARGIN) / (2 + 2 * AREA_MARGIN));
    expect(boardAspect({ spaces: [] })).toBeNull();
  });
});

describe("setBackground", () => {
  const def = { config: {}, slots: ["A"], spaces: [] };
  it("sets, replaces and removes the field", () => {
    const withBg = setBackground(def, { image: "a".repeat(64) + ".webp", fade: 0.2 });
    expect(withBg.background).toEqual({ image: "a".repeat(64) + ".webp", fade: 0.2 });
    expect("background" in setBackground(withBg, {})).toBe(false);
    expect("background" in setBackground(withBg, undefined)).toBe(false);
    expect(def).toEqual({ config: {}, slots: ["A"], spaces: [] }); // never mutates
  });

  it("only images and colors count as something to draw", () => {
    expect(hasBackground({ fit: "tile" })).toBe(false);
    expect(hasBackground({ color: "#000000" })).toBe(true);
    expect(hasBackground(null)).toBe(false);
  });
});
