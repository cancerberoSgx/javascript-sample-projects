// Board backgrounds (rules.md §2.1.2, BKG-*): where the image goes (pure math, tested in
// background.test.ts), loading it, and drawing it. Shared by the play board (BoardCanvas) and
// the board editor (EditorCanvas).

import { useEffect, useState } from "react";
import type { Background } from "../engine/types";

export const BACKGROUND_DEFAULTS = {
  fit: "cover",
  crop: { x: 0, y: 0, w: 1, h: 1 },
  position: { x: 0.5, y: 0.5 },
  zoom: 1,
  tile_size: 0.25,
  opacity: 1,
  fade: 0,
  blur: 0,
  grayscale: false,
} as const;

/** BKG-1: the area margin around the spaces' grid cells, in cells. */
export const AREA_MARGIN = 0.15;
/** `blur` is in px on a board this wide; it scales with the board. */
const BLUR_REFERENCE_WIDTH = 800;
/** Tile mode never draws more tiles than this (tiny tiles on a huge board). */
const MAX_TILES = 4000;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const mediaUrl = (key: string) => `/media/${key}`;

/** A background with something to draw (an image or a color). */
export const hasBackground = (bg: Background | null | undefined): bg is Background => !!bg && (!!bg.image || !!bg.color);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** BKG-1: the board area, from the grid-cell rectangle that holds every space. */
export function boardArea(cells: Rect, cell: number): Rect {
  const m = cell * AREA_MARGIN;
  return { x: cells.x - m, y: cells.y - m, w: cells.w + 2 * m, h: cells.h + 2 * m };
}

/** The part of the image to use (`crop`, BKG-2), in image pixels. */
export function cropRect(bg: Background, img: { width: number; height: number }): Rect {
  const c = bg.crop ?? BACKGROUND_DEFAULTS.crop;
  const x = clamp(c.x, 0, 1);
  const y = clamp(c.y, 0, 1);
  const w = clamp(c.w, 0.001, 1 - x);
  const h = clamp(c.h, 0.001, 1 - y);
  return { x: x * img.width, y: y * img.height, w: Math.max(1, w * img.width), h: Math.max(1, h * img.height) };
}

/**
 * Where the (cropped) image is drawn inside `area` (BKG-2): one rectangle, or one per tile.
 * Rectangles may stick out of the area; the caller clips to it.
 */
export function placeBackground(bg: Background, src: { w: number; h: number }, area: Rect): Rect[] {
  const fit = bg.fit ?? BACKGROUND_DEFAULTS.fit;
  const pos = bg.position ?? BACKGROUND_DEFAULTS.position;
  const px = clamp(pos.x, 0, 1);
  const py = clamp(pos.y, 0, 1);
  if (fit === "stretch") return [{ ...area }];
  if (fit === "tile") {
    const tw = Math.max(2, area.w * clamp(bg.tile_size ?? BACKGROUND_DEFAULTS.tile_size, 0.02, 1));
    const th = tw * (src.h / src.w);
    // One tile sits where `position` says (like contain); the others repeat from it
    const ox = area.x + (area.w - tw) * px;
    const oy = area.y + (area.h - th) * py;
    const x0 = ox - Math.ceil((ox - area.x) / tw) * tw;
    const y0 = oy - Math.ceil((oy - area.y) / th) * th;
    const out: Rect[] = [];
    for (let y = y0; y < area.y + area.h && out.length < MAX_TILES; y += th)
      for (let x = x0; x < area.x + area.w && out.length < MAX_TILES; x += tw) out.push({ x, y, w: tw, h: th });
    return out;
  }
  const fitScale = fit === "cover" ? Math.max(area.w / src.w, area.h / src.h) : Math.min(area.w / src.w, area.h / src.h);
  const scale = fitScale * clamp(bg.zoom ?? BACKGROUND_DEFAULTS.zoom, 0.25, 4);
  const w = src.w * scale;
  const h = src.h * scale;
  return [{ x: area.x + (area.w - w) * px, y: area.y + (area.h - h) * py, w, h }];
}

// ---------- loading ----------

const loaded = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string): Promise<HTMLImageElement> {
  let p = loaded.get(url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Couldn't load ${url}`));
      img.src = url;
    });
    p.catch(() => loaded.delete(url)); // try again next time
    loaded.set(url, p);
  }
  return p;
}

/** The background's image once it has loaded (null before, without an image, or if it fails). */
export function useBackgroundImage(bg: Background | null | undefined): HTMLImageElement | null {
  const key = bg?.image ?? null;
  const [img, setImg] = useState<{ key: string; img: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    loadImage(mediaUrl(key)).then(
      (i) => live && setImg({ key, img: i }),
      () => live && setImg(null),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return key && img?.key === key ? img.img : null;
}

// ---------- drawing ----------

/**
 * Renders the image part of a background (crop, fit, opacity, blur, grayscale) once into an
 * offscreen canvas and reuses it while nothing changes, so boards that redraw every frame (the
 * pulsing move targets) only copy one bitmap.
 */
export class BackgroundLayer {
  private key = "";
  private canvas: HTMLCanvasElement | null = null;

  draw(ctx: CanvasRenderingContext2D, bg: Background, img: HTMLImageElement | null, area: Rect, canvasBg: string, radius: number) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(area.x, area.y, area.w, area.h, radius);
    ctx.clip();
    if (bg.color) {
      ctx.fillStyle = bg.color;
      ctx.fillRect(area.x, area.y, area.w, area.h);
    }
    if (img) {
      const layer = this.layer(bg, img, area);
      if (layer) ctx.drawImage(layer, area.x, area.y, area.w, area.h);
    }
    const fade = clamp(bg.fade ?? 0, 0, 0.9);
    if (fade > 0) {
      ctx.globalAlpha = fade;
      ctx.fillStyle = canvasBg;
      ctx.fillRect(area.x, area.y, area.w, area.h);
    }
    ctx.restore();
  }

  private layer(bg: Background, img: HTMLImageElement, area: Rect): HTMLCanvasElement | null {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(area.w * dpr);
    const h = Math.round(area.h * dpr);
    if (w < 1 || h < 1) return null;
    const key = JSON.stringify([img.src, bg.fit, bg.crop, bg.position, bg.zoom, bg.tile_size, bg.opacity, bg.blur, bg.grayscale, w, h]);
    if (key === this.key && this.canvas) return this.canvas;

    const canvas = this.canvas ?? document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);
    const local = { x: 0, y: 0, w, h };
    const src = cropRect(bg, img);
    const filters = [];
    const blur = clamp(bg.blur ?? 0, 0, 20) * (area.w / BLUR_REFERENCE_WIDTH) * dpr;
    if (blur > 0) filters.push(`blur(${blur.toFixed(2)}px)`);
    if (bg.grayscale) filters.push("grayscale(1)");
    ctx.filter = filters.join(" ") || "none";
    ctx.globalAlpha = clamp(bg.opacity ?? 1, 0, 1);
    ctx.imageSmoothingQuality = "high";
    // A blur fades the image's own edges out: a single image is drawn a bit larger to hide that
    const grow = blur > 0 && bg.fit !== "tile" && bg.fit !== "contain" ? blur * 2 : 0;
    for (const d of placeBackground(bg, src, local))
      ctx.drawImage(img, src.x, src.y, src.w, src.h, d.x - grow, d.y - grow, d.w + 2 * grow, d.h + 2 * grow);
    this.canvas = canvas;
    this.key = key;
    return canvas;
  }
}
