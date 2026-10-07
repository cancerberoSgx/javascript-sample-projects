import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fileJson, fileName } from "./files";

const read = (path: string) => JSON.parse(readFileSync(new URL(`../../public/${path}`, import.meta.url), "utf8"));

describe("deck and board files (SER-7)", () => {
  it("names files after the item", () => {
    expect(fileName("General Knowledge (sample)", "deck")).toBe("general-knowledge-sample.deck.json");
    expect(fileName("¡¡!!", "board")).toBe("item.board.json");
  });

  it("writes one line per card, category or space, and reads back the same data", () => {
    for (const path of ["decks/general.json", "boards/loop-shortcut.json"]) {
      const data = read(path);
      const text = fileJson(data);
      expect(JSON.parse(text)).toEqual(data);
      const records = (data.cards?.length ?? 0) + (data.categories?.length ?? 0) + (data.spaces?.length ?? 0);
      // {, }, one line per top-level key, two bracket lines per record list, one per record
      const lists = ["cards", "categories", "spaces"].filter((k) => data[k]?.length).length;
      expect(text.trim().split("\n")).toHaveLength(2 + Object.keys(data).length + lists + records);
    }
  });

  it("gives each deck of an organization file its own block, one line per card", () => {
    const deck = read("decks/general.json");
    const text = fileJson({ schema_version: 2, kind: "organization", categories: deck.categories, decks: [deck, deck] });
    expect(JSON.parse(text)).toEqual({ schema_version: 2, kind: "organization", categories: deck.categories, decks: [deck, deck] });
    const lines = text.split("\n");
    expect(lines).toContain('    {');
    expect(lines).toContain('      "name": "General Knowledge (sample)",');
    expect(lines.filter((l) => l.startsWith('        {"id": "science-1"'))).toHaveLength(2);
  });

  it("leaves out undefined fields", () => {
    expect(fileJson({ a: 1, b: undefined, c: [{ x: 1, y: undefined }] })).toBe('{\n  "a": 1,\n  "c": [\n    {"x": 1}\n  ]\n}\n');
  });
});
