import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isFork } from "../engine/board";
import type { Background, BoardDefinition, Space } from "../engine/types";
import { arrow, arrowBend, arrowPoints, drawTile, readTheme, roundRect, segmentDistance } from "../components/BoardCanvas";
import { BackgroundLayer, boardArea, hasBackground, useBackgroundImage } from "../components/background";
import type { Pos } from "./ops";

export type Selection = { kind: "space"; index: number } | { kind: "arrow"; from: number; to: number } | null;
/** Waiting for the user to pick the target of a new arrow ("arrow" replaces, "branch" adds). */
export type Pending = { kind: "arrow" | "branch"; from: number } | null;

interface Props {
  /** The board being edited, resolved with placeholder categories (resolveBoard + placeholderMapping). */
  board: BoardDefinition;
  /** Drawn in the board area, like on the play board (rules.md BKG-1). */
  background?: Background;
  cell: number;
  selection: Selection;
  pending: Pending;
  /** Spaces with problems, outlined in red (error) or amber (warning). */
  marks: Map<number, "error" | "warning">;
  /** Spaces of the problem the user points at: drawn with a strong glow. */
  focus: number[];
  onCellClick: (pos: Pos, space: number | null) => void;
  onArrowClick: (from: number, to: number) => void;
  onMove: (index: number, pos: Pos) => void;
  /** Rendered over the canvas at the selected space (the halo). */
  overlay: (center: { x: number; y: number }, tile: number) => ReactNode;
}

const MARGIN = 2; // empty cells around the board, room to grow

/** The board editor's drawing surface: a grid with the board on it. Click empty cells to add
 *  spaces, click spaces or arrows to select them, drag spaces to move them. */
export function EditorCanvas({ board, background, cell, selection, pending, marks, focus, onCellClick, onArrowClick, onMove, overlay }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewWidth, setViewWidth] = useState(800);
  const [mouse, setMouse] = useState<Pos | null>(null);
  const [press, setPress] = useState<{ start: Pos; space: number | null; dragging: boolean } | null>(null);
  const [themeTick, setThemeTick] = useState(0);
  const [now, setNow] = useState(0);
  const bgImage = useBackgroundImage(background);
  const [bgLayer] = useState(() => new BackgroundLayer());

  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([entry]) => setViewWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const fn = () => setThemeTick((t) => t + 1);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  // Pulse the focused problem's spaces
  useEffect(() => {
    if (!focus.length) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  const layout = useMemo(() => {
    const placed = board.spaces.filter((s) => s.pos && Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y));
    const xs = placed.map((s) => s.pos.x);
    const ys = placed.map((s) => s.pos.y);
    const minX = Math.floor(Math.min(0, ...xs)) - MARGIN;
    const minY = Math.floor(Math.min(0, ...ys)) - MARGIN;
    const cols = Math.max(Math.ceil(Math.max(0, ...xs)) + MARGIN - minX + 1, Math.ceil(viewWidth / cell));
    const rows = Math.max(Math.ceil(Math.max(0, ...ys)) + MARGIN - minY + 1, 7);
    return {
      tile: cell * 0.8,
      width: cols * cell,
      height: rows * cell,
      center: (p: Pos) => ({ x: (p.x - minX + 0.5) * cell, y: (p.y - minY + 0.5) * cell }),
      cellAt: (px: number, py: number): Pos => ({ x: Math.floor(px / cell) + minX, y: Math.floor(py / cell) + minY }),
      // The cells the spaces span, as on the play board (BoardCanvas computeLayout)
      area: placed.length
        ? boardArea(
            {
              x: (Math.min(...xs) - minX) * cell,
              y: (Math.min(...ys) - minY) * cell,
              w: (Math.max(...xs) - Math.min(...xs) + 1) * cell,
              h: (Math.max(...ys) - Math.min(...ys) + 1) * cell,
            },
            cell,
          )
        : null,
      placed,
    };
  }, [board, cell, viewWidth]);
  const byIndex = useMemo(() => new Map(layout.placed.map((s) => [s.index, s])), [layout]);
  const colors = useMemo(() => Object.fromEntries(board.categories.map((c) => [c.id, c])), [board]);

  const spaceAtPoint = (p: Pos): Space | undefined => {
    const half = layout.tile / 2;
    return layout.placed.find((s) => {
      const c = layout.center(s.pos);
      return Math.abs(p.x - c.x) <= half && Math.abs(p.y - c.y) <= half;
    });
  };
  /** Each arrow's points, bent around tiles it would cross (same shape as drawn). */
  const arrows = useMemo(() => {
    const centers = layout.placed.map((s) => layout.center(s.pos));
    return layout.placed.flatMap((s) =>
      s.next.flatMap((n) => {
        const t = byIndex.get(n);
        if (!t) return [];
        const [a, b] = [layout.center(s.pos), layout.center(t.pos)];
        const bend = arrowBend(a, b, centers, layout.tile);
        return [{ from: s.index, to: n, bend, points: arrowPoints(a, b, layout.tile / 2, bend) }];
      }),
    );
  }, [layout, byIndex]);
  const arrowAtPoint = (p: Pos): { from: number; to: number } | undefined =>
    arrows.find((a) => a.points.some((q, i) => i > 0 && segmentDistance(p, a.points[i - 1], q) < Math.max(6, layout.tile * 0.1)));

  const dragging = press?.dragging && press.space !== null ? press.space : null;
  const hoverSpace = mouse ? spaceAtPoint(mouse) : undefined;
  const hoverArrow = mouse && !hoverSpace && !pending ? arrowAtPoint(mouse) : undefined;
  const hoverCell = mouse && !hoverSpace && !hoverArrow ? layout.cellAt(mouse.x, mouse.y) : null;

  // ---- Draw ----
  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = layout.width * dpr;
    canvas.height = layout.height * dpr;
    canvas.style.width = `${layout.width}px`;
    canvas.style.height = `${layout.height}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const theme = readTheme();
    const { tile, center } = layout;
    const half = tile / 2;
    const step = tile / 0.8;

    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, layout.width, layout.height);
    if (hasBackground(background) && layout.area) bgLayer.draw(ctx, background, bgImage, layout.area, theme.bg, step * 0.2);

    // Grid
    ctx.globalAlpha = bgImage ? 0.45 : 1;
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = step; x < layout.width; x += step) (ctx.moveTo(Math.round(x) + 0.5, 0), ctx.lineTo(Math.round(x) + 0.5, layout.height));
    for (let y = step; y < layout.height; y += step) (ctx.moveTo(0, Math.round(y) + 0.5), ctx.lineTo(layout.width, Math.round(y) + 0.5));
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Where a click would add a space
    if (hoverCell && dragging === null) {
      const c = center(hoverCell);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 1.5;
      roundRect(ctx, c.x - half, c.y - half, tile, tile, tile * 0.16);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = theme.accent;
      ctx.font = `600 ${tile * 0.4}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", c.x, c.y);
    }

    const posOf = (s: Space) => (dragging === s.index && mouse ? mouse : center(s.pos));

    // Arrows (over an image, with a halo in the board color, as on the play board)
    const head = Math.max(5, tile * 0.1);
    if (bgImage) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = ctx.fillStyle = theme.bg;
      ctx.lineWidth = Math.max(1.5, tile * 0.03) + 4;
      for (const a of arrows) arrow(ctx, posOf(byIndex.get(a.from)!), posOf(byIndex.get(a.to)!), half, head + 2, dragging === a.from || dragging === a.to ? null : a.bend);
      ctx.globalAlpha = 1;
    }
    for (const a of arrows) {
      const [s, t] = [byIndex.get(a.from)!, byIndex.get(a.to)!];
      const moving = dragging === a.from || dragging === a.to;
      const selected = selection?.kind === "arrow" && selection.from === a.from && selection.to === a.to;
      const hovered = hoverArrow?.from === a.from && hoverArrow.to === a.to;
      ctx.strokeStyle = ctx.fillStyle = selected ? theme.text : isFork(s) ? theme.accent : theme.edge;
      ctx.lineWidth = selected || hovered ? Math.max(3, tile * 0.07) : Math.max(1.5, tile * 0.03);
      arrow(ctx, posOf(s), posOf(t), half, selected ? head * 1.3 : head, moving ? null : a.bend);
    }

    // The arrow being drawn
    if (pending && mouse) {
      const from = byIndex.get(pending.from);
      if (from) {
        ctx.strokeStyle = ctx.fillStyle = theme.accent;
        ctx.lineWidth = Math.max(2, tile * 0.05);
        ctx.setLineDash([6, 5]);
        arrow(ctx, center(from.pos), mouse, half * 0.2, head);
        ctx.setLineDash([]);
      }
    }

    // Spaces
    const pulse = 0.5 + 0.5 * Math.sin(now / 200);
    for (const s of layout.placed) {
      const c = posOf(s);
      if (dragging === s.index) {
        // Ghost where it was, and where it would land
        const home = center(s.pos);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = theme.muted;
        roundRect(ctx, home.x - half, home.y - half, tile, tile, tile * 0.16);
        ctx.stroke();
        const target = center(layout.cellAt(c.x, c.y));
        ctx.strokeStyle = theme.accent;
        roundRect(ctx, target.x - half, target.y - half, tile, tile, tile * 0.16);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.85;
      }
      const mark = marks.get(s.index);
      if (focus.includes(s.index)) {
        ctx.save();
        ctx.shadowColor = theme.error;
        ctx.shadowBlur = tile * (0.2 + 0.3 * pulse);
        roundRect(ctx, c.x - half - 6, c.y - half - 6, tile + 12, tile + 12, tile * 0.24);
        ctx.fillStyle = theme.error;
        ctx.fill();
        ctx.restore();
      } else if (mark) {
        roundRect(ctx, c.x - half - 7, c.y - half - 7, tile + 14, tile + 14, tile * 0.26);
        ctx.strokeStyle = mark === "error" ? theme.error : theme.warning;
        ctx.lineWidth = 2.5;
        ctx.setLineDash(mark === "error" ? [] : [5, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const cat = s.category ? colors[s.category] : undefined;
      drawTile(ctx, theme, s, c, tile, cat?.color, cat?.name);
      if (hoverSpace?.index === s.index || (pending && hoverSpace?.index === s.index)) {
        roundRect(ctx, c.x - half, c.y - half, tile, tile, tile * 0.16);
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fill();
      }
      const isSelected = selection?.kind === "space" && selection.index === s.index;
      if (isSelected || pending?.from === s.index) {
        roundRect(ctx, c.x - half - 4, c.y - half - 4, tile + 8, tile + 8, tile * 0.22);
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }, [layout, byIndex, arrows, colors, selection, pending, marks, focus, mouse, hoverCell?.x, hoverCell?.y, hoverArrow?.from, hoverArrow?.to, hoverSpace?.index, dragging, now, themeTick, background, bgImage]); // eslint-disable-line react-hooks/exhaustive-deps

  const point = (e: React.PointerEvent): Pos => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const selectedSpace = selection?.kind === "space" ? byIndex.get(selection.index) : undefined;
  const cursor = dragging !== null ? "grabbing" : pending ? "crosshair" : hoverSpace || hoverArrow ? "pointer" : "copy";

  return (
    <div ref={wrapRef} className="editor-canvas">
      <div className="editor-surface" style={{ width: layout.width, height: layout.height }}>
        <canvas
          ref={canvasRef}
          style={{ cursor, touchAction: "none" }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const p = point(e);
            (e.target as Element).setPointerCapture(e.pointerId);
            setPress({ start: p, space: pending ? null : (spaceAtPoint(p)?.index ?? null), dragging: false });
          }}
          onPointerMove={(e) => {
            const p = point(e);
            setMouse(p);
            if (press && !press.dragging && press.space !== null && Math.hypot(p.x - press.start.x, p.y - press.start.y) > 6) setPress({ ...press, dragging: true });
          }}
          onPointerUp={(e) => {
            const p = point(e);
            const was = press;
            setPress(null);
            if (!was) return;
            if (was.dragging && was.space !== null) {
              const target = layout.cellAt(p.x, p.y);
              const s = byIndex.get(was.space)!;
              if (target.x !== s.pos.x || target.y !== s.pos.y) onMove(was.space, target);
              return;
            }
            const space = spaceAtPoint(p);
            const hit = !space && !pending ? arrowAtPoint(p) : undefined;
            if (hit) onArrowClick(hit.from, hit.to);
            else onCellClick(layout.cellAt(p.x, p.y), space?.index ?? null);
          }}
          onPointerLeave={() => setMouse(null)}
        />
        {selectedSpace && dragging === null && overlay(layout.center(selectedSpace.pos), layout.tile)}
      </div>
    </div>
  );
}
