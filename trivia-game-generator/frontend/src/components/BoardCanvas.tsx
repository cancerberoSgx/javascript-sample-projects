import { useEffect, useMemo, useRef, useState } from "react";
import { isFork } from "../engine/board";
import type { Background, BoardDefinition, GameView, Space } from "../engine/types";
import { BackgroundLayer, boardArea, hasBackground, useBackgroundImage, type Rect } from "./background";
import { NO_INSETS, boundsOf, toWorld, type Insets } from "./camera";
import { useBoardCamera, type CameraCommand } from "./useBoardCamera";

interface Props {
  board: BoardDefinition;
  /** Drawn under the board (rules.md §2.1.2). Not part of the engine's board. */
  background?: Background | null;
  game: GameView | null;
  onSpaceClick: (index: number) => void;
  onHover: (space: Space | null) => void;
  /**
   * Play screen: the canvas fills its container and the board pans and zooms inside it
   * (drag, pinch, wheel, double tap). `insets` is the screen space floating controls cover.
   */
  viewport?: { insets: Insets; command: CameraCommand | null };
  /** A space to show as hovered (e.g. a legal-move button the user is pointing at). */
  highlight?: number | null;
}

/** Board cell size (px at zoom 1) in viewport mode. */
const WORLD_CELL = 96;

const STEP_MS = 160;
const SPECIAL_LABEL: Record<string, string> = {
  start: "START",
  finish: "FINISH",
  roll_again: "ROLL\nAGAIN",
  penalty: "SKIP\nTURN",
  wildcard: "WILD",
};

interface Layout {
  cell: number;
  tile: number;
  center: (s: Space) => { x: number; y: number };
  width: number;
  height: number;
  /** The board area the background fills (BKG-1). */
  area: Rect;
}

/**
 * Fits the board to `width`, or with `fixedCell`, lays it out at that cell size (its own width).
 * `transpose` swaps the grid's x and y (a mirror across the diagonal: same paths, same arrows),
 * so a wide board can fill a portrait phone.
 */
function computeLayout(spaces: Space[], width: number, fixedCell?: number, transpose = false): Layout {
  const gx = (s: Space) => (transpose ? s.pos.y : s.pos.x);
  const gy = (s: Space) => (transpose ? s.pos.x : s.pos.y);
  const xs = spaces.map(gx);
  const ys = spaces.map(gy);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const cols = maxX - minX + 1;
  const rows = maxY - minY + 1;
  const pad = 16;
  if (fixedCell) width = cols * fixedCell + pad * 2;
  const cell = fixedCell ?? Math.min(96, (width - pad * 2) / cols);
  const height = Math.max(200, rows * cell + pad * 2);
  const offsetX = (width - cols * cell) / 2;
  const offsetY = (height - rows * cell) / 2;
  return {
    cell,
    tile: cell * 0.8,
    width,
    height,
    area: boardArea({ x: offsetX, y: offsetY, w: cols * cell, h: rows * cell }, cell),
    center: (s) => ({ x: offsetX + (gx(s) - minX + 0.5) * cell, y: offsetY + (gy(s) - minY + 0.5) * cell }),
  };
}

/**
 * Viewport mode: lay a wide board out tall on a portrait screen (and the other way round) when
 * that makes its tiles clearly bigger. Not with a background image, which is drawn for the
 * board's own shape.
 */
function shouldTranspose(spaces: Space[], view: { w: number; h: number }, withImage: boolean): boolean {
  if (withImage || !view.w || !view.h || !spaces.length) return false;
  const xs = spaces.map((s) => s.pos.x);
  const ys = spaces.map((s) => s.pos.y);
  const cols = Math.max(...xs) - Math.min(...xs) + 1;
  const rows = Math.max(...ys) - Math.min(...ys) + 1;
  // Roughly the free area: the floating bars take ~250px of height
  const [w, h] = [view.w, Math.max(1, view.h - 250)];
  const fit = (c: number, r: number) => Math.min(w / c, h / r);
  return fit(rows, cols) > fit(cols, rows) * 1.25;
}

export type Theme = ReturnType<typeof readTheme>;

export function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    bg: v("--canvas-bg"),
    /** Around the board in viewport mode. */
    table: v("--table"),
    text: v("--text"),
    muted: v("--muted"),
    edge: v("--edge"),
    accent: v("--accent"),
    border: v("--border"),
    error: v("--error-text"),
    warning: v("--warning"),
    tileText: "#ffffff",
    special: {
      start: v("--space-start"),
      finish: v("--space-finish"),
      roll_again: v("--space-roll"),
      penalty: v("--space-penalty"),
      wildcard: v("--space-wild"),
    } as Record<string, string>,
  };
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

type Pt = { x: number; y: number };

/** Distance from p to the segment a-b. */
export function segmentDistance(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** An arrow that would cross another tile bends around it: returns the two control points
 *  of that curve, or null when the straight line is clear. */
export function arrowBend(from: Pt, to: Pt, centers: Pt[], tile: number): [Pt, Pt] | null {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const away = (c: Pt, p: Pt) => Math.hypot(c.x - p.x, c.y - p.y) > 1;
  if (!len || !centers.some((c) => away(c, from) && away(c, to) && segmentDistance(c, from, to) < tile * 0.55)) return null;
  const h = tile * 1.6;
  const [px, py] = [((to.y - from.y) / len) * h, (-(to.x - from.x) / len) * h];
  return [
    { x: from.x + px, y: from.y + py },
    { x: to.x + px, y: to.y + py },
  ];
}

/** Points along an arrow (straight or bent), trimmed by `trim` at both ends: for drawing and hit tests. */
export function arrowPoints(from: Pt, to: Pt, trim: number, bend: [Pt, Pt] | null, steps = 24): Pt[] {
  const unit = (a: Pt, b: Pt) => {
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  };
  const [c1, c2] = bend ?? [to, from];
  const u1 = unit(from, c1);
  const u2 = unit(to, c2);
  const a = { x: from.x + u1.x * trim, y: from.y + u1.y * trim };
  const b = { x: to.x + u2.x * trim, y: to.y + u2.y * trim };
  if (!bend) return [a, b];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const [k0, k1, k2, k3] = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3];
    return { x: k0 * a.x + k1 * c1.x + k2 * c2.x + k3 * b.x, y: k0 * a.y + k1 * c1.y + k2 * c2.y + k3 * b.y };
  });
}

export function arrow(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, trim: number, head: number, bend: [Pt, Pt] | null = null) {
  if (!bend && Math.hypot(to.x - from.x, to.y - from.y) < trim * 2) return;
  const pts = arrowPoints(from, to, trim, bend);
  const e = pts[pts.length - 1];
  const p = pts[pts.length - 2];
  const l = Math.hypot(e.x - p.x, e.y - p.y) || 1;
  const [ux, uy] = [(e.x - p.x) / l, (e.y - p.y) / l];
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(e.x, e.y);
  ctx.lineTo(e.x - ux * head - uy * head * 0.6, e.y - uy * head + ux * head * 0.6);
  ctx.lineTo(e.x - ux * head + uy * head * 0.6, e.y - uy * head - ux * head * 0.6);
  ctx.closePath();
  ctx.fill();
}

/** Draws one space: its color, number, fork mark, main label and optional label. Shared by the
 *  play board and the board editor. */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  s: Space,
  { x, y }: { x: number; y: number },
  tile: number,
  categoryColor: string | undefined,
  categoryName: string | undefined,
) {
  const half = tile / 2;
  roundRect(ctx, x - half, y - half, tile, tile, tile * 0.16);
  ctx.fillStyle = (s.category ? categoryColor : theme.special[s.type]) ?? theme.muted;
  ctx.fill();

  ctx.fillStyle = theme.tileText;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `600 ${Math.max(9, tile * 0.15)}px system-ui, sans-serif`;
  ctx.fillText(String(s.index), x - half + tile * 0.08, y - half + tile * 0.07);
  if (isFork(s)) {
    ctx.textAlign = "right";
    ctx.fillText("⑂", x + half - tile * 0.08, y - half + tile * 0.07);
  }

  const main = s.type === "hq" ? `★ HQ\n${categoryName ?? ""}` : s.category ? (categoryName ?? s.category) : (SPECIAL_LABEL[s.type] ?? s.type);
  const lines = main.split("\n");
  const size = Math.max(8, tile * (lines.some((l) => l.length > 8) ? 0.13 : 0.16));
  const lift = s.label ? tile * 0.06 : 0;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) => ctx.fillText(line, x, y + tile * 0.08 - lift + (i - (lines.length - 1) / 2) * size * 1.15, tile * 0.92));
  if (s.label) {
    ctx.font = `italic 500 ${Math.max(8, tile * 0.12)}px system-ui, sans-serif`;
    ctx.textBaseline = "bottom";
    ctx.fillText(s.label, x, y + half - tile * 0.05, tile * 0.9);
  }
}

export function BoardCanvas({ board, background, game, onSpaceClick, onHover, viewport, highlight = null }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(800);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [mouseOver, setHovered] = useState<number | null>(null);
  const hovered = highlight ?? mouseOver;
  const [themeTick, setThemeTick] = useState(0);
  const [anim, setAnim] = useState<{ playerId: string; path: number[]; start: number } | null>(null);
  const [now, setNow] = useState(0);
  const bgImage = useBackgroundImage(background);
  const [bgLayer] = useState(() => new BackgroundLayer());

  const zoomable = !!viewport;
  const transpose = zoomable && shouldTranspose(board.spaces, view, hasBackground(background));
  const layout = useMemo(
    () => (zoomable ? computeLayout(board.spaces, 0, WORLD_CELL, transpose) : computeLayout(board.spaces, width)),
    [board, width, zoomable, transpose],
  );
  const byIndex = useMemo(() => new Map(board.spaces.map((s) => [s.index, s])), [board]);
  const categoryColor = useMemo(() => Object.fromEntries(board.categories.map((c) => [c.id, c.color])), [board]);
  const categoryName = useMemo(() => Object.fromEntries(board.categories.map((c) => [c.id, c.name])), [board]);

  // Track container width
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, entry.contentRect.width));
      setView({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Redraw when the color scheme changes
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const fn = () => setThemeTick((t) => t + 1);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  // Start a move animation whenever a new move happens
  const moveSeq = game?.last_move?.seq;
  useEffect(() => {
    const m = game?.last_move;
    if (!m) return setAnim(null);
    setAnim({ playerId: m.player_id, path: m.path, start: performance.now() });
  }, [moveSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!anim) return;
    let raf = 0;
    const tick = () => {
      const t = performance.now();
      setNow(t);
      if (t - anim.start < (anim.path.length - 1) * STEP_MS) raf = requestAnimationFrame(tick);
      else setAnim(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim]);

  const choosing = game?.phase === "AWAIT_MOVE";
  const destinations = choosing ? game.destinations : {};
  const previewPath = hovered !== null ? destinations[hovered] : undefined;

  // ---- Viewport mode: the camera ----
  const world = useMemo(() => ({ x: 0, y: 0, w: layout.width, h: layout.height }), [layout]);
  const spaceAtWorld = (p: { x: number; y: number }, snap: number) => {
    const half = layout.tile / 2;
    const hit = board.spaces.find((s) => {
      const c = layout.center(s);
      return Math.abs(p.x - c.x) <= half && Math.abs(p.y - c.y) <= half;
    });
    if (hit || !snap) return hit ?? null;
    // Near miss on a small screen: the closest legal destination within reach of the finger
    let best: Space | null = null;
    let bestD = half + snap;
    for (const s of board.spaces) {
      if (!(s.index in destinations)) continue;
      const c = layout.center(s);
      const d = Math.max(Math.abs(p.x - c.x), Math.abs(p.y - c.y));
      if (d <= bestD) [best, bestD] = [s, d];
    }
    return best;
  };
  const { cam, handlers } = useBoardCamera({
    enabled: !!viewport,
    canvasRef,
    view,
    world,
    tile: layout.tile,
    insets: viewport?.insets ?? NO_INSETS,
    command: viewport?.command ?? null,
    rectOf: (indexes) => {
      const pts = indexes.flatMap((i) => (byIndex.has(i) ? [layout.center(byIndex.get(i)!)] : []));
      return pts.length ? boundsOf(pts, layout.cell * 0.6) : null;
    },
    onTap: (p) => {
      if (!cam) return false;
      const s = spaceAtWorld(toWorld(cam, p), 18 / cam.scale);
      if (!s) return false;
      onSpaceClick(s.index);
      return s.index in destinations;
    },
    onHover: (p) => {
      const s = p && cam ? spaceAtWorld(toWorld(cam, p), 0) : null;
      if ((s?.index ?? null) !== mouseOver) {
        setHovered(s?.index ?? null);
        onHover(s);
      }
    },
  });

  // Keep redrawing while a destination must be picked, so legal targets pulse
  useEffect(() => {
    if (!choosing) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [choosing]);

  // ---- Draw ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const theme = readTheme();
    const { tile, center } = layout;
    if (viewport) {
      // The canvas covers the view; the board sits on a "table" at the camera's position.
      // Phones get at most 2x pixels: 3x costs a lot of fill rate for little visible gain.
      if (!cam) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const [w, h] = [Math.round(view.w * dpr), Math.round(view.h * dpr)];
      if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h];
      canvas.style.width = `${view.w}px`;
      canvas.style.height = `${view.h}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = theme.table || theme.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.setTransform(dpr * cam.scale, 0, 0, dpr * cam.scale, dpr * cam.x, dpr * cam.y);
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
      ctx.shadowBlur = 24;
      roundRect(ctx, 0, 0, layout.width, layout.height, layout.cell * 0.2);
      ctx.fillStyle = theme.bg;
      ctx.fill();
      ctx.restore();
    } else {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = layout.width * dpr;
      canvas.height = layout.height * dpr;
      canvas.style.width = `${layout.width}px`;
      canvas.style.height = `${layout.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = theme.bg;
      ctx.fillRect(0, 0, layout.width, layout.height);
    }
    if (hasBackground(background)) bgLayer.draw(ctx, background, bgImage, layout.area, theme.bg, layout.cell * 0.2);

    // Edges. Over an image, each arrow gets a halo in the board color so it stays visible.
    const head = Math.max(5, tile * 0.1);
    const line = Math.max(1.5, tile * 0.03);
    const centers = board.spaces.map(center);
    for (const halo of bgImage ? [true, false] : [false]) {
      ctx.lineWidth = halo ? line + 4 : line;
      ctx.globalAlpha = halo ? 0.75 : 1;
      for (const s of board.spaces) {
        const fork = isFork(s);
        for (const n of s.next) {
          const target = byIndex.get(n);
          if (!target) continue;
          ctx.strokeStyle = ctx.fillStyle = halo ? theme.bg : fork ? theme.accent : theme.edge;
          arrow(ctx, center(s), center(target), tile * 0.5, halo ? head + 2 : head, arrowBend(center(s), center(target), centers, tile));
        }
      }
    }
    ctx.globalAlpha = 1;

    // Hovered destination path preview
    if (previewPath && game) {
      const from = byIndex.get(game.players[game.active_player].current_space)!;
      const pts = [from, ...previewPath.map((i) => byIndex.get(i)!)].map(center);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = Math.max(3, tile * 0.08);
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.setLineDash([tile * 0.12, tile * 0.1]);
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Tiles. While choosing a move, everything except the legal targets and the
    // active player's own space is dimmed, so the targets can't be missed.
    const currentSpace = game?.players[game.active_player].current_space;
    const pulse = 0.5 + 0.5 * Math.sin(now / 220);
    for (const s of board.spaces) {
      const { x, y } = center(s);
      const half = tile / 2;
      const legal = s.index in destinations;
      ctx.globalAlpha = choosing && !legal && s.index !== currentSpace ? 0.28 : 1;

      if (legal) {
        ctx.save();
        ctx.shadowColor = theme.accent;
        ctx.shadowBlur = tile * (0.25 + 0.25 * pulse);
        roundRect(ctx, x - half - 5, y - half - 5, tile + 10, tile + 10, tile * 0.22);
        ctx.fillStyle = theme.accent;
        ctx.fill();
        ctx.restore();
      }
      drawTile(ctx, theme, s, { x, y }, tile, s.category ? categoryColor[s.category] : undefined, s.category ? categoryName[s.category] : undefined);
      if (hovered === s.index) {
        roundRect(ctx, x - half, y - half, tile, tile, tile * 0.16);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fill();
      }

      if (legal) {
        // "Move here" badge on the top edge (corners are used by the index, fork icon and tokens)
        const br = Math.max(7, tile * 0.13);
        const bx = x;
        const by = y - half;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fillStyle = theme.accent;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `800 ${br * 1.2}px system-ui, sans-serif`;
        ctx.fillText("➜", bx, by + 0.5);
      }
    }
    ctx.globalAlpha = 1;

    // Player tokens
    if (game) {
      const r = tile * 0.14;
      const corners = [
        [-1, 1],
        [1, 1],
        [-1, -0.2],
        [1, -0.2],
      ];
      game.players.forEach((p, i) => {
        if (p.removed) return; // MPL-9
        let pos = center(byIndex.get(p.current_space)!);
        if (anim && anim.playerId === p.id) {
          const t = Math.max(0, Math.min((now - anim.start) / STEP_MS, anim.path.length - 1));
          const k = Math.floor(t);
          const a = center(byIndex.get(anim.path[k])!);
          const b = center(byIndex.get(anim.path[Math.min(k + 1, anim.path.length - 1)])!);
          pos = { x: a.x + (b.x - a.x) * (t - k), y: a.y + (b.y - a.y) * (t - k) };
        }
        const [cx, cy] = corners[i % 4];
        const tx = pos.x + cx * tile * 0.3;
        const ty = pos.y + cy * tile * 0.3;
        ctx.beginPath();
        ctx.arc(tx, ty, r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.lineWidth = i === game.active_player && game.phase !== "GAME_OVER" ? 3 : 1.5;
        ctx.strokeStyle = i === game.active_player && game.phase !== "GAME_OVER" ? theme.text : "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${r * 1.1}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.name.slice(0, 1).toUpperCase(), tx, ty + 0.5);
      });
    }
  }, [board, game, layout, hovered, anim, now, themeTick, byIndex, categoryColor, categoryName, destinations, previewPath, background, bgImage, bgLayer, viewport, cam, view]);

  // ---- Hit testing ----
  const spaceAtPoint = (e: React.MouseEvent<HTMLCanvasElement>): Space | null => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const half = layout.tile / 2;
    return board.spaces.find((s) => {
      const c = layout.center(s);
      return Math.abs(px - c.x) <= half && Math.abs(py - c.y) <= half;
    }) ?? null;
  };

  if (viewport)
    return (
      <div ref={wrapRef} className="board-viewport">
        <canvas ref={canvasRef} style={{ cursor: hovered !== null && hovered in destinations ? "pointer" : "grab" }} {...handlers} />
      </div>
    );

  return (
    <div ref={wrapRef} className="board-canvas">
      <canvas
        ref={canvasRef}
        style={{ cursor: hovered !== null && hovered in destinations ? "pointer" : "default" }}
        onMouseMove={(e) => {
          const s = spaceAtPoint(e);
          const idx = s?.index ?? null;
          if (idx !== hovered) {
            setHovered(idx);
            onHover(s);
          }
        }}
        onMouseLeave={() => {
          setHovered(null);
          onHover(null);
        }}
        onClick={(e) => {
          const s = spaceAtPoint(e);
          if (s) onSpaceClick(s.index);
        }}
      />
    </div>
  );
}
