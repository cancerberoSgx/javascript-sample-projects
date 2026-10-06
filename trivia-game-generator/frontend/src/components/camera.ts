// Pan and zoom for the play screen's board (BoardCanvas `viewport` mode). Pure math, no DOM:
// a camera maps board ("world") coordinates to screen pixels as screen = world * scale + (x, y).

export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Size {
  w: number;
  h: number;
}
/** Screen space covered by floating controls, kept clear when fitting. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export interface Camera {
  x: number;
  y: number;
  scale: number;
}
export interface ScaleBounds {
  min: number;
  /** How far the user can zoom in. */
  max: number;
  /** How far fitting and focusing zoom in on their own (default: max). */
  auto?: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
/** Fitting and focusing never make tiles bigger than this on screen (px), however small the board. */
export const MAX_TILE_PX = 140;
/** The user can zoom in further, up to this. */
export const MAX_ZOOM_TILE_PX = 280;
/** A tile smaller than this on screen is hard to tap: focusing zooms in until tiles reach it. */
export const COMFORT_TILE_PX = 48;

export const toWorld = (cam: Camera, p: Pt): Pt => ({ x: (p.x - cam.x) / cam.scale, y: (p.y - cam.y) / cam.scale });
export const toScreen = (cam: Camera, p: Pt): Pt => ({ x: p.x * cam.scale + cam.x, y: p.y * cam.scale + cam.y });

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The part of the view not covered by controls (at least 1px each way). */
function inner(view: Size, insets: Insets): Rect {
  return {
    x: insets.left,
    y: insets.top,
    w: Math.max(1, view.w - insets.left - insets.right),
    h: Math.max(1, view.h - insets.top - insets.bottom),
  };
}

/** The scale that fits `rect` in the free part of the view, capped at `max`. */
export function fitScale(rect: Rect, view: Size, insets: Insets, max: number): number {
  const area = inner(view, insets);
  return Math.min(max, area.w / Math.max(1, rect.w), area.h / Math.max(1, rect.h));
}

/** Zoom limits: out to a bit below "whole board fits", in to MAX_ZOOM_TILE_PX tiles (MAX_TILE_PX on its own). */
export function scaleBounds(world: Rect, view: Size, insets: Insets, tile: number): ScaleBounds {
  const auto = MAX_TILE_PX / tile;
  const fit = fitScale(world, view, insets, auto);
  return { min: Math.min(fit * 0.7, auto), max: MAX_ZOOM_TILE_PX / tile, auto };
}

/** Centers `rect` in the free part of the view at `scale`. */
export function centerOn(rect: Rect, scale: number, view: Size, insets: Insets): Camera {
  const area = inner(view, insets);
  return {
    scale,
    x: area.x + area.w / 2 - (rect.x + rect.w / 2) * scale,
    y: area.y + area.h / 2 - (rect.y + rect.h / 2) * scale,
  };
}

/** The whole rect, as big as it fits (up to `max`), centered. */
export function fitRect(rect: Rect, view: Size, insets: Insets, max: number): Camera {
  return centerOn(rect, fitScale(rect, view, insets, max), view, insets);
}

/**
 * Keeps part of the board on screen: on each axis, at least half of the board or half of the
 * view (whichever is smaller) stays visible, so the board can't be flung away and lost.
 */
export function clampCamera(cam: Camera, world: Rect, view: Size, bounds: ScaleBounds): Camera {
  const scale = clamp(cam.scale, bounds.min, bounds.max);
  const axis = (pos: number, start: number, size: number, viewSize: number) => {
    const len = size * scale;
    const keep = Math.min(len, viewSize) / 2;
    // board spans [pos + start*scale, pos + start*scale + len]; it must overlap [0, viewSize] by `keep`
    return clamp(pos, keep - len - start * scale, viewSize - keep - start * scale);
  };
  return { scale, x: axis(cam.x, world.x, world.w, view.w), y: axis(cam.y, world.y, world.h, view.h) };
}

/** Zooms by `factor` around screen point `p` (the board point under it stays put). */
export function zoomAt(cam: Camera, factor: number, p: Pt, bounds: ScaleBounds): Camera {
  const scale = clamp(cam.scale * factor, bounds.min, bounds.max);
  const w = toWorld(cam, p);
  return { scale, x: p.x - w.x * scale, y: p.y - w.y * scale };
}

/**
 * Two-finger gesture: the board point that was under the first midpoint follows the fingers'
 * midpoint, and the scale follows the distance between them.
 */
export function pinch(start: Camera, mid0: Pt, dist0: number, mid: Pt, dist: number, bounds: ScaleBounds): Camera {
  const scale = clamp((start.scale * dist) / Math.max(1, dist0), bounds.min, bounds.max);
  const w = toWorld(start, mid0);
  return { scale, x: mid.x - w.x * scale, y: mid.y - w.y * scale };
}

/**
 * Brings `rect` (e.g. the active token and its legal moves) into view, moving as little as
 * possible: nothing when it's already visible with tappable tiles; otherwise centers it, zoomed
 * in to comfortable tiles if it fits that way, or zoomed out until it fits.
 */
export function ensureVisible(cam: Camera, rect: Rect, view: Size, insets: Insets, tile: number, bounds: ScaleBounds): Camera {
  const area = inner(view, insets);
  const a = toScreen(cam, { x: rect.x, y: rect.y });
  const b = toScreen(cam, { x: rect.x + rect.w, y: rect.y + rect.h });
  const visible = a.x >= area.x - 1 && a.y >= area.y - 1 && b.x <= area.x + area.w + 1 && b.y <= area.y + area.h + 1;
  const comfort = COMFORT_TILE_PX / tile;
  const auto = bounds.auto ?? bounds.max;
  if (visible && cam.scale >= Math.min(comfort, auto) - 1e-9) return cam;
  const fit = fitScale(rect, view, insets, Math.max(auto, Math.min(cam.scale, bounds.max)));
  // At least comfortable tiles (keeping a bigger zoom), but never so big that the rect doesn't fit
  const scale = clamp(Math.min(Math.max(comfort, cam.scale), fit), bounds.min, bounds.max);
  return centerOn(rect, scale, view, insets);
}

/** Smallest rect holding all the points, grown by `pad` on every side. */
export function boundsOf(points: Pt[], pad: number): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
}

export function lerpCamera(a: Camera, b: Camera, t: number): Camera {
  return { scale: a.scale + (b.scale - a.scale) * t, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
