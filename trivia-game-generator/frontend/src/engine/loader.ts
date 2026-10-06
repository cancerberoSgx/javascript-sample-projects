// Loads board/deck JSON files from public/ for the boards demo.

import { placeholderMapping, resolveBoard, resolveGame } from "./resolve";
import type { BoardDefinition, BoardFile, DeckDefinition, DeckFile, SlotMapping } from "./types";

export interface ManifestEntry {
  file: string; // path relative to public/, e.g. "boards/linear-basic.json"
  name: string;
  description?: string;
}

export interface Manifest {
  boards: ManifestEntry[];
  decks: ManifestEntry[];
}

export interface LoadedBoard {
  file: BoardFile;
  deckFile: DeckFile;
  mapping: SlotMapping;
  /** For drawing, even when there are errors (unmapped slots get placeholder colors). null if the file has no slots/spaces. */
  preview: BoardDefinition | null;
  /** Ready to play; null when there are errors */
  board: BoardDefinition | null;
  deck: DeckDefinition | null;
  rawJson: string; // the board file exactly as served, for the JSON viewer
  errors: string[];
}

const base = import.meta.env.BASE_URL;

async function fetchText(path: string): Promise<string> {
  const res = await fetch(base + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.text();
}

export async function loadManifest(): Promise<Manifest> {
  return JSON.parse(await fetchText("boards/index.json"));
}

export async function loadDeck(file: string): Promise<DeckFile> {
  return JSON.parse(await fetchText(file));
}

/**
 * Parses a board (fetched or uploaded) and plays it with `deck`. The demo maps the
 * board's slots to the deck's categories in order: first slot to first category, etc.
 */
export function prepareBoard(rawJson: string, deckFile: DeckFile): LoadedBoard {
  let file: BoardFile;
  try {
    file = JSON.parse(rawJson);
  } catch (e) {
    throw new Error(`Board file is not valid JSON: ${(e as Error).message}`);
  }
  const mapping: SlotMapping = Object.fromEntries(
    (file.slots ?? []).flatMap((slot, i) => (deckFile.categories[i] ? [[slot, deckFile.categories[i]]] : [])),
  );
  const game = resolveGame(file, mapping, deckFile);
  const preview = Array.isArray(file.slots) && Array.isArray(file.spaces) ? resolveBoard(file, { ...placeholderMapping(file), ...mapping }) : null;
  return { file, deckFile, mapping, rawJson, preview, ...game };
}

export async function loadBoard(file: string, deckFile: DeckFile): Promise<LoadedBoard> {
  return prepareBoard(await fetchText(file), deckFile);
}
