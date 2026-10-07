// Deck, board and organization files (rules.md SER-7 … SER-11): downloading an export and picking a file to import.

import { useRef } from "react";

/** "<slug>.<kind>.json", like the backend's Content-Disposition name. */
export function fileName(name: string, kind: "deck" | "board" | "organization") {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  return `${slug.slice(0, 80)}.${kind}.json`;
}

const inline = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(inline).join(", ")}]`
    : v !== null && typeof v === "object"
      ? `{${Object.entries(v)
          .filter(([, x]) => x !== undefined)
          .map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`)
          .join(", ")}}`
      : JSON.stringify(v);

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isRecordList = (v: unknown): v is Record<string, unknown>[] => Array.isArray(v) && v.length > 0 && v.every(isRecord);
/** Records holding lists of records (a deck inside an organization file) get a block; others a line. */
const isBlock = (v: unknown) => isRecord(v) && Object.values(v).some(isRecordList);

function block(data: Record<string, unknown>, pad: string): string {
  const inner = pad + "  ";
  const lines = Object.entries(data)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => {
      const value = isRecordList(v)
        ? `[\n${v.map((x) => inner + "  " + (isBlock(x) ? block(x, inner + "  ") : inline(x))).join(",\n")}\n${inner}]`
        : inline(v);
      return `${inner}${JSON.stringify(k)}: ${value}`;
    });
  return `{\n${lines.join(",\n")}\n${pad}}`;
}

/** JSON laid out like the example files: one line per card, category or space, so the file is easy
 *  to read, edit by hand and diff. In an organization file each deck and board is a block of its own. */
export function fileJson(data: object): string {
  return block(data as Record<string, unknown>, "") + "\n";
}

export function downloadJson(name: string, data: object) {
  const url = URL.createObjectURL(new Blob([fileJson(data)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reads a picked file as JSON. The error names the file, for the ErrorBox. */
export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${file.name} isn't valid JSON: ${(e as Error).message}`);
  }
}

/** A button that opens the file picker for a .json file. */
export function ImportButton({ label, disabled, onFile }: { label: string; disabled?: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="small" disabled={disabled} onClick={() => input.current?.click()}>
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // picking the same file again still fires
          if (file) onFile(file);
        }}
      />
    </>
  );
}
