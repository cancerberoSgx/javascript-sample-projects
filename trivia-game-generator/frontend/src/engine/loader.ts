// Loads board/deck JSON files from public/. This is the only module that does I/O,
// so it can later be replaced by API calls without touching the engine.

import { validateBoard } from "./board";
import type { BoardDefinition, DeckDefinition } from "./types";

export interface BoardManifestEntry {
  file: string; // path relative to public/, e.g. "boards/linear-basic.json"
  name: string;
  description?: string;
}

export interface LoadedBoard {
  board: BoardDefinition;
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

export async function loadManifest(): Promise<BoardManifestEntry[]> {
  return JSON.parse(await fetchText("boards/index.json")).boards;
}

/** Parses a board from JSON text (fetched or uploaded), loads its deck, and validates both. */
export async function loadBoardFromJson(rawJson: string): Promise<LoadedBoard> {
  let board: BoardDefinition;
  try {
    board = JSON.parse(rawJson);
  } catch (e) {
    throw new Error(`Board file is not valid JSON: ${(e as Error).message}`);
  }
  let deck: DeckDefinition | null = null;
  try {
    deck = JSON.parse(await fetchText(board.deck));
  } catch {
    deck = null; // reported by validateBoard
  }
  return { board, deck, rawJson, errors: validateBoard(board, deck) };
}

export async function loadBoard(file: string): Promise<LoadedBoard> {
  return loadBoardFromJson(await fetchText(file));
}
