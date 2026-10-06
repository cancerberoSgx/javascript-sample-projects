import { describe, expect, it } from "vitest";
import { NO_INSETS, boundsOf, clampCamera, ensureVisible, fitRect, pinch, scaleBounds, toScreen, toWorld, zoomAt, type Camera } from "./camera";

const world = { x: 0, y: 0, w: 1000, h: 500 };
const phone = { w: 400, h: 800 };
const TILE = 76.8;

describe("camera", () => {
  it("maps world to screen and back", () => {
    const cam = { x: 10, y: -20, scale: 2 };
    expect(toScreen(cam, { x: 5, y: 5 })).toEqual({ x: 20, y: -10 });
    expect(toWorld(cam, { x: 20, y: -10 })).toEqual({ x: 5, y: 5 });
  });

  it("fits a wide board in a portrait phone, centered in the free area", () => {
    const insets = { top: 60, right: 0, bottom: 140, left: 0 };
    const cam = fitRect(world, phone, insets, 10);
    expect(cam.scale).toBeCloseTo(0.4);
    const a = toScreen(cam, { x: 0, y: 0 });
    const b = toScreen(cam, { x: 1000, y: 500 });
    expect(a.x).toBeCloseTo(0);
    expect(b.x).toBeCloseTo(400);
    expect((a.y + b.y) / 2).toBeCloseTo(60 + (800 - 200) / 2);
  });

  it("caps the zoom of tiny boards", () => {
    const small = { x: 0, y: 0, w: 200, h: 100 };
    const bounds = scaleBounds(small, { w: 1600, h: 900 }, NO_INSETS, TILE);
    expect(bounds.auto! * TILE).toBeCloseTo(140);
    expect(bounds.max * TILE).toBeCloseTo(280);
    expect(fitRect(small, { w: 1600, h: 900 }, NO_INSETS, bounds.auto!).scale).toBeCloseTo(bounds.auto!);
  });

  it("zooms around a point without moving it", () => {
    const cam = { x: 0, y: 0, scale: 1 };
    const p = { x: 100, y: 50 };
    const before = toWorld(cam, p);
    const z = zoomAt(cam, 2, p, { min: 0.1, max: 5 });
    expect(z.scale).toBe(2);
    expect(toWorld(z, p)).toEqual(before);
    expect(zoomAt(cam, 100, p, { min: 0.1, max: 5 }).scale).toBe(5);
  });

  it("pinches: the point under the fingers follows them", () => {
    const start = { x: 0, y: 0, scale: 1 };
    const mid0 = { x: 200, y: 200 };
    const cam = pinch(start, mid0, 100, { x: 250, y: 220 }, 150, { min: 0.1, max: 5 });
    expect(cam.scale).toBeCloseTo(1.5);
    const w = toWorld(start, mid0);
    const s = toScreen(cam, w);
    expect(s.x).toBeCloseTo(250);
    expect(s.y).toBeCloseTo(220);
  });

  it("keeps part of the board on screen", () => {
    const bounds = { min: 0.1, max: 5 };
    const flung = clampCamera({ x: -99999, y: 99999, scale: 1 }, world, phone, bounds);
    // Board 1000 wide at scale 1 in a 400 view: at least 200px of it stays visible
    expect(toScreen(flung, { x: 1000, y: 0 }).x).toBeCloseTo(200);
    // Board 500 tall in an 800 view: at least 250px stays visible
    expect(toScreen(flung, { x: 0, y: 0 }).y).toBeCloseTo(800 - 250);
    const inside: Camera = { x: -100, y: 100, scale: 1 };
    expect(clampCamera(inside, world, phone, bounds)).toEqual(inside);
  });

  it("ensureVisible doesn't move when the targets are visible and tappable", () => {
    const cam = { x: 0, y: 0, scale: 1 };
    const rect = { x: 50, y: 50, w: 200, h: 200 };
    expect(ensureVisible(cam, rect, phone, NO_INSETS, TILE, { min: 0.1, max: 2 })).toBe(cam);
  });

  it("ensureVisible zooms in to comfortable tiles, and out when the targets don't fit", () => {
    const zoomedOut = { x: 0, y: 0, scale: 0.3 };
    const near = { x: 100, y: 100, w: 300, h: 150 };
    const cam = ensureVisible(zoomedOut, near, phone, NO_INSETS, TILE, { min: 0.1, max: 2 });
    expect(cam.scale * TILE).toBeCloseTo(48);
    const c = toScreen(cam, { x: 250, y: 175 });
    expect(c.x).toBeCloseTo(200);
    expect(c.y).toBeCloseTo(400);

    const far = { x: 0, y: 0, w: 1000, h: 100 };
    expect(ensureVisible({ x: 0, y: 0, scale: 2 }, far, phone, NO_INSETS, TILE, { min: 0.1, max: 2 }).scale).toBeCloseTo(0.4);
  });

  it("boundsOf pads the box around points", () => {
    expect(
      boundsOf(
        [
          { x: 10, y: 20 },
          { x: 30, y: 5 },
        ],
        5,
      ),
    ).toEqual({ x: 5, y: 0, w: 30, h: 25 });
  });
});
