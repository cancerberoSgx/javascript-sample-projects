// Choosing and tuning a background (rules.md §2.1.2): the organization's image library (upload,
// import from a URL, pick, rename, delete), the fit, a crop rectangle and the look sliders.
// Used by the board editor (a board's default background) and the game setup (a game's own).

import { useRef, useState } from "react";
import { api, type LibraryImage } from "../api";
import type { Background, BackgroundFit, BoardFile } from "../engine/types";
import { AREA_MARGIN, BACKGROUND_DEFAULTS, mediaUrl } from "./background";
import { ErrorBox, useAction, useList } from "./common";

type Crop = NonNullable<Background["crop"]>;
/** `coalesce`: edits with the same key in a row (dragging a slider) can be one undo step. */
export type BackgroundChange = (next: Background, coalesce?: string) => void;

const FITS: { fit: BackgroundFit; label: string; hint: string }[] = [
  { fit: "cover", label: "Fill", hint: "Fills the board and cuts what doesn't fit" },
  { fit: "contain", label: "Fit", hint: "Shows the whole image, with bands of the fill color" },
  { fit: "stretch", label: "Stretch", hint: "Fills the board, ignoring the image's proportions" },
  { fit: "tile", label: "Mosaic", hint: "Repeats the image like tiles" },
];

/** Width / height of a board's background area (BKG-1), for "match the board" crops. */
export function boardAspect(board: Pick<BoardFile, "spaces">): number | null {
  const placed = board.spaces.filter((s) => s.pos && Number.isFinite(s.pos.x) && Number.isFinite(s.pos.y));
  if (!placed.length) return null;
  const xs = placed.map((s) => s.pos.x);
  const ys = placed.map((s) => s.pos.y);
  return (Math.max(...xs) - Math.min(...xs) + 1 + 2 * AREA_MARGIN) / (Math.max(...ys) - Math.min(...ys) + 1 + 2 * AREA_MARGIN);
}

/** Removes settings equal to their defaults, so only real choices are stored. */
function tidy(bg: Background): Background {
  const out: Background = { ...bg };
  const d = BACKGROUND_DEFAULTS as Record<string, unknown>;
  for (const k of Object.keys(out) as (keyof Background)[]) {
    const v = out[k];
    if (v === undefined || JSON.stringify(v) === JSON.stringify(d[k])) delete out[k];
  }
  return out;
}

export function BackgroundEditor({ orgId, value, onChange, aspect }: { orgId: number; value: Background; onChange: BackgroundChange; aspect: number | null }) {
  const [browsing, setBrowsing] = useState(!value.image);
  const set = (patch: Partial<Background>, coalesce?: string) => onChange(tidy({ ...value, ...patch }), coalesce);
  const fit = value.fit ?? BACKGROUND_DEFAULTS.fit;
  const pos = value.position ?? BACKGROUND_DEFAULTS.position;

  return (
    <div className="bg-editor">
      <div className="row wrap">
        {value.image ? (
          <img className="bg-current" src={mediaUrl(value.image)} alt="Background" />
        ) : (
          <span className="bg-current empty muted small">No image</span>
        )}
        <div className="stack">
          <button className="small" onClick={() => setBrowsing((b) => !b)}>
            {browsing ? "Close library" : value.image ? "Change image…" : "Choose an image…"}
          </button>
          {value.image && (
            <button className="small" onClick={() => onChange(tidy({ ...value, image: undefined, crop: undefined }))}>
              Remove image
            </button>
          )}
        </div>
      </div>
      {browsing && (
        <ImageLibrary
          orgId={orgId}
          selected={value.image ?? null}
          onPick={(key) => {
            onChange(tidy({ ...value, image: key, crop: key === value.image ? value.crop : undefined }));
            setBrowsing(false);
          }}
        />
      )}

      {value.image && (
        <>
          <div className="tabs bg-fits" role="group" aria-label="How the image fills the board">
            {FITS.map((f) => (
              <button key={f.fit} title={f.hint} className={fit === f.fit ? "on" : ""} onClick={() => set({ fit: f.fit })}>
                {f.label}
              </button>
            ))}
          </div>
          <p className="muted small">{FITS.find((f) => f.fit === fit)?.hint}.</p>

          <CropEditor image={value.image} crop={value.crop} aspect={aspect} onChange={(crop, coalesce) => set({ crop }, coalesce)} />

          <div className="grid-form compact">
            {fit === "tile" ? (
              <Slider label="Tile size" value={value.tile_size ?? BACKGROUND_DEFAULTS.tile_size} min={0.02} max={1} step={0.01} percent onChange={(v) => set({ tile_size: v }, "bg:tile")} />
            ) : (
              fit !== "stretch" && <Slider label="Zoom" value={value.zoom ?? 1} min={0.25} max={4} step={0.05} suffix="×" onChange={(v) => set({ zoom: v }, "bg:zoom")} />
            )}
            {fit !== "stretch" && (
              <>
                <Slider label="Horizontal" value={pos.x} min={0} max={1} step={0.01} percent onChange={(v) => set({ position: { ...pos, x: v } }, "bg:px")} />
                <Slider label="Vertical" value={pos.y} min={0} max={1} step={0.01} percent onChange={(v) => set({ position: { ...pos, y: v } }, "bg:py")} />
              </>
            )}
            <Slider label="Opacity" value={value.opacity ?? 1} min={0} max={1} step={0.01} percent onChange={(v) => set({ opacity: v }, "bg:opacity")} />
            <Slider label="Fade" value={value.fade ?? 0} min={0} max={0.9} step={0.01} percent onChange={(v) => set({ fade: v }, "bg:fade")} />
            <Slider label="Blur" value={value.blur ?? 0} min={0} max={20} step={0.5} suffix=" px" onChange={(v) => set({ blur: v }, "bg:blur")} />
            <label>Grayscale</label>
            <label className="check small">
              <input type="checkbox" checked={!!value.grayscale} onChange={(e) => set({ grayscale: e.target.checked })} />
              Black and white
            </label>
          </div>
        </>
      )}

      <div className="grid-form compact">
        <label>Fill color</label>
        <label className="check small">
          <input type="checkbox" checked={!!value.color} onChange={(e) => set({ color: e.target.checked ? "#1e293b" : undefined })} />
          {value.color ? (
            <input type="color" value={value.color} onChange={(e) => set({ color: e.target.value }, "bg:color")} aria-label="Fill color" />
          ) : (
            <span className="muted">{value.image ? "Behind the image (transparent parts, Fit bands)" : "A plain color instead of an image"}</span>
          )}
        </label>
      </div>
      {value.image && (
        <button className="small self-start" onClick={() => onChange({ image: value.image })}>
          Reset settings
        </button>
      )}
      <p className="muted small">Fade veils the image in the board's color so spaces and arrows stay readable. Images are re-encoded (WebP, at most 3000 px) and every device downloads them once.</p>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  percent,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  percent?: boolean;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <>
      <label>{label}</label>
      <span className="row slider">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
        <span className="small muted">{percent ? `${Math.round(value * 100)}%` : `${value}${suffix}`}</span>
      </span>
    </>
  );
}

// ---------- crop ----------

type Drag = { mode: "move" | "nw" | "ne" | "sw" | "se" | "new"; start: { x: number; y: number }; crop: Crop };
const WHOLE: Crop = { x: 0, y: 0, w: 1, h: 1 };
const MIN = 0.03;
const round = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The image with the crop rectangle on it: drag inside to move it, drag a corner to resize,
 *  drag outside it (or anywhere, while the whole image is used) to draw a new one. */
function CropEditor({ image, crop, aspect, onChange }: { image: string; crop?: Crop; aspect: number | null; onChange: (crop: Crop | undefined, coalesce?: string) => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const c = crop ?? WHOLE;

  const at = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  };
  const emit = (next: Crop) => {
    const tidy = { x: round(next.x), y: round(next.y), w: round(next.w), h: round(next.h) };
    onChange(tidy.x === 0 && tidy.y === 0 && tidy.w === 1 && tidy.h === 1 ? undefined : tidy, "bg:crop");
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = at(e);
    const dx = p.x - drag.start.x;
    const dy = p.y - drag.start.y;
    const s = drag.crop;
    if (drag.mode === "move") return emit({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) });
    if (drag.mode === "new") {
      const [x0, x1] = [Math.min(drag.start.x, p.x), Math.max(drag.start.x, p.x)];
      const [y0, y1] = [Math.min(drag.start.y, p.y), Math.max(drag.start.y, p.y)];
      if (x1 - x0 < MIN || y1 - y0 < MIN) return;
      return emit({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    let [left, top, right, bottom] = [s.x, s.y, s.x + s.w, s.y + s.h];
    if (drag.mode.includes("w")) left = clamp(left + dx, 0, right - MIN);
    if (drag.mode.includes("e")) right = clamp(right + dx, left + MIN, 1);
    if (drag.mode.includes("n")) top = clamp(top + dy, 0, bottom - MIN);
    if (drag.mode.includes("s")) bottom = clamp(bottom + dy, top + MIN, 1);
    emit({ x: left, y: top, w: right - left, h: bottom - top });
  };
  const begin = (mode: Drag["mode"]) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    boxRef.current!.setPointerCapture(e.pointerId);
    setDrag({ mode, start: at(e), crop: c });
  };

  /** The largest crop with the board's shape, centered on the current crop. */
  const matchBoard = () => {
    if (!aspect || !natural) return;
    const imgAspect = natural.w / natural.h;
    // In fractions of the image: w / h * imgAspect = aspect
    let w = 1;
    let h = imgAspect / aspect;
    if (h > 1) [w, h] = [aspect / imgAspect, 1];
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    emit({ x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h), w, h });
  };

  return (
    <div className="stack">
      <div className="row between wrap">
        <span className="small">
          <strong>Crop</strong> <span className="muted">· {crop ? `${Math.round(c.w * 100)}% × ${Math.round(c.h * 100)}% of the image` : "the whole image"}</span>
        </span>
        <span className="row">
          <button className="small" disabled={!aspect || !natural} onClick={matchBoard} title="The biggest part of the image with the board's shape">
            Match board shape
          </button>
          <button className="small" disabled={!crop} onClick={() => onChange(undefined)}>
            Whole image
          </button>
        </span>
      </div>
      <div
        ref={boxRef}
        className="crop-box"
        onPointerDown={begin("new")}
        onPointerMove={move}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        <img src={mediaUrl(image)} alt="" draggable={false} onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
        <div className="crop-rect" style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` }} onPointerDown={begin(crop ? "move" : "new")}>
          {(["nw", "ne", "sw", "se"] as const).map((h) => (
            <span key={h} className={`crop-handle ${h}`} onPointerDown={begin(h)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- library ----------

const sizeText = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function usageText(img: LibraryImage) {
  const parts = [img.board_count && `${img.board_count} board${img.board_count === 1 ? "" : "s"}`, img.game_count && `${img.game_count} game${img.game_count === 1 ? "" : "s"}`].filter(Boolean);
  return parts.length ? `Used by ${parts.join(" and ")}` : "Not used";
}

/** The organization's images (BKG-3): pick one, add one (file, drop, URL), rename or delete. */
export function ImageLibrary({ orgId, selected, onPick }: { orgId: number; selected: string | null; onPick: (key: string) => void }) {
  const images = useList(() => api.listImages(orgId), [orgId]);
  const action = useAction();
  const [url, setUrl] = useState("");
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = (load: () => Promise<LibraryImage>) =>
    action.run(async () => {
      const img = await load();
      await images.reload();
      onPick(img.key);
    });
  const uploadFile = (file: File | undefined) => file && add(() => api.uploadImage(file, orgId));

  return (
    <div
      className={`image-library ${over ? "drop" : ""}`}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        uploadFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="row wrap">
        <button className="small primary" disabled={action.busy} onClick={() => fileRef.current?.click()}>
          ⬆ Upload image
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          hidden
          onChange={(e) => {
            uploadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <form
          className="row grow"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) add(() => api.importImage(url.trim(), orgId)).then((ok) => ok && setUrl(""));
          }}
        >
          <input className="grow" type="url" placeholder="…or paste an image URL" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="small" disabled={action.busy || !url.trim()}>
            Import
          </button>
        </form>
      </div>
      {action.busy && <p className="muted small">Processing the image…</p>}
      <ErrorBox error={action.error ?? images.error} />
      <p className="muted small">Drop an image here, upload one (PNG, JPEG, WebP, AVIF or GIF, up to 10 MB) or import one from a URL: the server keeps its own copy.</p>
      {images.loaded && !images.items.length ? (
        <p className="muted small">This organization has no images yet.</p>
      ) : (
        <ul className="image-grid">
          {images.items.map((img) => (
            <LibraryItem key={img.id} img={img} selected={img.key === selected} onPick={() => onPick(img.key)} onChanged={images.reload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function LibraryItem({ img, selected, onPick, onChanged }: { img: LibraryImage; selected: boolean; onPick: () => void; onChanged: () => Promise<void> }) {
  const action = useAction();
  const inUse = img.board_count + img.game_count > 0;
  return (
    <li className={selected ? "on" : ""}>
      <button className="thumb" onClick={onPick} title={`Use "${img.name}"`}>
        <img src={img.url} alt={img.name} loading="lazy" />
      </button>
      <span className="small name" title={img.source_url ?? img.name}>
        {img.name}
      </span>
      <span className="muted tiny">
        {img.width}×{img.height} · {sizeText(img.bytes)}
      </span>
      <span className="row between">
        <span className="muted tiny">{usageText(img)}</span>
        <span className="row">
          <button
            className="tiny"
            title="Rename"
            onClick={() => {
              const name = prompt("Image name", img.name)?.trim();
              if (name && name !== img.name) action.run(async () => (await api.renameImage(img.id, name), onChanged()));
            }}
          >
            ✎
          </button>
          <button
            className="tiny danger"
            disabled={inUse}
            title={inUse ? `${usageText(img)}: change their backgrounds first` : "Delete"}
            onClick={() => confirm(`Delete "${img.name}"?`) && action.run(async () => (await api.deleteImage(img.id), onChanged()))}
          >
            ✕
          </button>
        </span>
      </span>
      <ErrorBox error={action.error} />
    </li>
  );
}
