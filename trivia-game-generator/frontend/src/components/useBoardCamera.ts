// Touch and mouse input for BoardCanvas's `viewport` mode (the play screen): one finger or the
// mouse drags, two fingers pinch, the wheel zooms, a double tap zooms in, a short tap is a tap.
// The math lives in camera.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampCamera, ensureVisible, fitRect, lerpCamera, pinch, scaleBounds, zoomAt, type Camera, type Insets, type Pt, type Rect, type Size } from "./camera";

/** Something the screen asks the camera to do. A new `seq` runs it again. */
export interface CameraCommand {
  seq: number;
  kind: "fit" | "zoomIn" | "zoomOut" | "focus";
  /** focus: board spaces to bring into view. */
  spaces?: number[];
  /** focus: even right after the user moved the board themselves. */
  force?: boolean;
}

/** A finger that moves less than this (px) is still a tap. */
const TAP_SLOP = 10;
const DOUBLE_TAP_MS = 320;
const ANIM_MS = 380;
/** Automatic focus leaves the board alone for this long after the user moves it. */
const HANDS_OFF_MS = 6000;

type Gesture = { kind: "pan"; start: Pt; cam0: Camera; moved: boolean; t0: number } | { kind: "pinch"; mid0: Pt; dist0: number; cam0: Camera };

interface Options {
  enabled: boolean;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  view: Size;
  world: Rect;
  tile: number;
  insets: Insets;
  /** Board-space rect for a focus command's spaces. */
  rectOf: (spaces: number[]) => Rect | null;
  command: CameraCommand | null;
  /** A tap at this screen point. Return true when it did something (so it isn't a double tap's first half). */
  onTap: (p: Pt) => boolean;
  /** Mouse hover (null when it leaves). */
  onHover: (p: Pt | null) => void;
}

export function useBoardCamera({ enabled, canvasRef, view, world, tile, insets, rectOf, command, onTap, onHover }: Options) {
  const [cam, setCamState] = useState<Camera | null>(null);
  const camRef = useRef<Camera | null>(null);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);
  const lastManual = useRef(0);
  const lastTap = useRef<{ t: number; p: Pt } | null>(null);
  const anim = useRef(0);

  const ready = enabled && view.w > 0 && view.h > 0;
  const bounds = useMemo(() => scaleBounds(world, view, insets, tile), [world, view, insets, tile]);
  // The latest values for event handlers, which outlive renders
  const live = useRef({ world, view, bounds, insets, tile, rectOf, onTap, onHover });
  live.current = { world, view, bounds, insets, tile, rectOf, onTap, onHover };

  const setCam = useCallback((c: Camera) => {
    const { world, view, bounds } = live.current;
    const next = clampCamera(c, world, view, bounds);
    camRef.current = next;
    setCamState(next);
  }, []);

  const stopAnim = () => cancelAnimationFrame(anim.current);
  const animateTo = useCallback(
    (target: Camera) => {
      cancelAnimationFrame(anim.current);
      const from = camRef.current;
      if (!from || matchMedia("(prefers-reduced-motion: reduce)").matches) return setCam(target);
      const t0 = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - t0) / ANIM_MS);
        setCam(lerpCamera(from, target, 1 - (1 - t) ** 3));
        if (t < 1) anim.current = requestAnimationFrame(tick);
      };
      anim.current = requestAnimationFrame(tick);
    },
    [setCam],
  );
  useEffect(() => () => cancelAnimationFrame(anim.current), []);

  // First view, or a different board: show all of it
  const worldKey = `${world.w}x${world.h}`;
  useEffect(() => {
    if (!ready) return;
    const { world, view, insets, bounds } = live.current;
    setCam(fitRect(world, view, insets, bounds.auto ?? bounds.max));
  }, [ready, worldKey, setCam]);

  // The view changed size (rotation, browser bars): keep the board point at its center
  const prevView = useRef(view);
  useEffect(() => {
    const before = prevView.current;
    prevView.current = view;
    const c = camRef.current;
    if (!ready || !c || (before.w === view.w && before.h === view.h) || !before.w) return;
    setCam({ scale: c.scale, x: c.x + (view.w - before.w) / 2, y: c.y + (view.h - before.h) / 2 });
  }, [ready, view, setCam]);

  // Commands from the screen's buttons and game events
  useEffect(() => {
    if (!ready || !command || !camRef.current) return;
    const { world, view, insets, bounds, tile, rectOf } = live.current;
    const c = camRef.current;
    const center = { x: insets.left + (view.w - insets.left - insets.right) / 2, y: insets.top + (view.h - insets.top - insets.bottom) / 2 };
    if (command.kind === "fit") animateTo(fitRect(world, view, insets, bounds.auto ?? bounds.max));
    else if (command.kind === "zoomIn") animateTo(zoomAt(c, 1.6, center, bounds));
    else if (command.kind === "zoomOut") animateTo(zoomAt(c, 1 / 1.6, center, bounds));
    else {
      if (!command.force && performance.now() - lastManual.current < HANDS_OFF_MS) return;
      const rect = rectOf(command.spaces ?? []);
      if (rect) animateTo(ensureVisible(c, rect, view, insets, tile, bounds));
    }
  }, [ready, command, animateTo]); // only a new command runs one

  // The wheel zooms around the cursor. Native listener: React's wheel handler is passive.
  useEffect(() => {
    const el = canvasRef.current;
    if (!ready || !el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const c = camRef.current;
      if (!c) return;
      stopAnim();
      lastManual.current = performance.now();
      const r = el.getBoundingClientRect();
      // Trackpad pinches arrive as ctrl+wheel with small deltas: make them as quick as wheel notches
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      setCam(zoomAt(c, Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015)), { x: e.clientX - r.left, y: e.clientY - r.top }, live.current.bounds));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ready, canvasRef, setCam]);

  const local = (e: React.PointerEvent): Pt => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const two = () => {
    const [a, b] = [...pointers.current.values()];
    return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, dist: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  const startPan = (p: Pt, moved: boolean) => {
    gesture.current = { kind: "pan", start: p, cam0: camRef.current!, moved, t0: performance.now() };
  };

  const handlers = {
    onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!camRef.current || (e.pointerType === "mouse" && e.button !== 0)) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      stopAnim();
      pointers.current.set(e.pointerId, local(e));
      if (pointers.current.size === 1) startPan(local(e), false);
      else if (pointers.current.size === 2) {
        const { mid, dist } = two();
        gesture.current = { kind: "pinch", mid0: mid, dist0: dist, cam0: camRef.current };
      }
    },
    onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
      const p = local(e);
      if (!pointers.current.has(e.pointerId)) {
        if (e.pointerType === "mouse") live.current.onHover(p);
        return;
      }
      pointers.current.set(e.pointerId, p);
      const g = gesture.current;
      if (g?.kind === "pan") {
        const dx = p.x - g.start.x;
        const dy = p.y - g.start.y;
        if (!g.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
        g.moved = true;
        lastManual.current = performance.now();
        setCam({ scale: g.cam0.scale, x: g.cam0.x + dx, y: g.cam0.y + dy });
      } else if (g?.kind === "pinch" && pointers.current.size >= 2) {
        const { mid, dist } = two();
        lastManual.current = performance.now();
        setCam(pinch(g.cam0, g.mid0, g.dist0, mid, dist, live.current.bounds));
      }
    },
    onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
      const g = gesture.current;
      const p = local(e);
      pointers.current.delete(e.pointerId);
      if (pointers.current.size === 1) {
        // One finger left after a pinch: keep panning with it, never a tap
        startPan([...pointers.current.values()][0], true);
        return;
      }
      if (pointers.current.size > 0) return;
      gesture.current = null;
      if (g?.kind !== "pan" || g.moved || performance.now() - g.t0 > 600) return;
      if (live.current.onTap(p)) {
        lastTap.current = null;
        return;
      }
      const prev = lastTap.current;
      if (prev && performance.now() - prev.t < DOUBLE_TAP_MS && Math.hypot(p.x - prev.p.x, p.y - prev.p.y) < 40) {
        lastTap.current = null;
        lastManual.current = performance.now();
        const c = camRef.current!;
        const { bounds, world, view, insets } = live.current;
        // Zoomed all the way in: a double tap goes back to the whole board
        animateTo(c.scale >= bounds.max * 0.95 ? fitRect(world, view, insets, bounds.auto ?? bounds.max) : zoomAt(c, 2, p, bounds));
      } else lastTap.current = { t: performance.now(), p };
    },
    onPointerCancel(e: React.PointerEvent<HTMLCanvasElement>) {
      pointers.current.delete(e.pointerId);
      if (!pointers.current.size) gesture.current = null;
    },
    onPointerLeave(e: React.PointerEvent<HTMLCanvasElement>) {
      if (e.pointerType === "mouse") live.current.onHover(null);
    },
  };

  return { cam: ready ? cam : null, handlers };
}
