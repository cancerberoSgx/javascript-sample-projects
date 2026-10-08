// The catalog (rules.md §2.9): every English message parses, its placeholders are documented,
// every key is used by the code, and the translations bundled with the backend fit their keys.
// Writes backend/app/i18n/catalog.json (what the backend loads on startup, I18N-2) with:
//   UPDATE_CONFORMANCE=1 npx vitest run src/i18n

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOG, type MessageKey } from "./catalog";
import { checkTranslation, messageShape } from "./icu";
import { englishT } from "./index";

const BACKEND = join(__dirname, "../../../backend/app/i18n");
const CATALOG_JSON = join(BACKEND, "catalog.json");
const keys = Object.keys(CATALOG) as MessageKey[];

/** Keys built at runtime (`board.space.${type}`, log lines and errors from the server). */
const DYNAMIC_PREFIXES = ["board.space.", "board.win.", "board.result.", "play.status.", "log.", "error.", "engine."];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") && !path.endsWith("catalog.ts") ? [readFileSync(path, "utf8")] : [];
  });
}

describe("i18n catalog", () => {
  it.each(keys)("%s is valid ICU with documented placeholders", (key) => {
    const entry = CATALOG[key];
    expect(entry.description.length).toBeGreaterThan(10);
    const { args } = messageShape(entry.en);
    expect([...args].sort()).toEqual(Object.keys(entry.placeholders ?? {}).filter((p) => args.has(p)).sort());
    for (const p of args) expect(entry.placeholders, `{${p}} needs a description`).toHaveProperty(p);
  });

  it("has every key the code uses, and the code uses every key", () => {
    const code = sources(join(__dirname, "..")).join("\n");
    const unused = keys.filter((k) => !code.includes(`"${k}"`) && !DYNAMIC_PREFIXES.some((p) => k.startsWith(p)));
    expect(unused).toEqual([]);
  });

  it("formats with plurals, selects and tags", () => {
    expect(englishT("log.gameStarted", { board: "Snake", count: 1 })).toBe("Game started on “Snake” with 1 player.");
    expect(englishT("log.gameStarted", { board: "Snake", count: 3 })).toBe("Game started on “Snake” with 3 players.");
    expect(englishT("play.pill.mine", { phase: "AWAIT_ROLL" })).toBe("Your turn");
    expect(englishT("play.pill.mine", { phase: "AWAIT_MOVE" })).toBe("Your turn: moving");
    // A missing param falls back to the key rather than crashing
    expect(englishT("lobby.youreIn")).toBe("lobby.youreIn");
  });

  it("matches backend/app/i18n/catalog.json", () => {
    const fresh = {
      source_language: "en",
      keys: Object.fromEntries(
        keys.map((k) => {
          const e = CATALOG[k];
          return [k, { area: e.area, source: e.en, description: e.description, placeholders: e.placeholders ?? {}, max_length: e.maxLength ?? null }];
        }),
      ),
    };
    if (process.env.UPDATE_CONFORMANCE) writeFileSync(CATALOG_JSON, JSON.stringify(fresh, null, 1) + "\n");
    if (!existsSync(CATALOG_JSON)) return; // the backend isn't checked out next to the frontend
    expect(JSON.parse(readFileSync(CATALOG_JSON, "utf8"))).toEqual(fresh);
  });

  const bundledDir = join(BACKEND, "bundled");
  const bundled = existsSync(bundledDir) ? readdirSync(bundledDir).filter((f) => f.endsWith(".json")) : [];
  it.each(bundled)("bundled %s fits the catalog", (file) => {
    const { language, messages } = JSON.parse(readFileSync(join(bundledDir, file), "utf8")) as { language: string; messages: Record<string, string> };
    expect(file).toBe(`${language}.json`);
    const problems: string[] = [];
    for (const [key, message] of Object.entries(messages)) {
      const entry = CATALOG[key as MessageKey];
      if (!entry) {
        problems.push(`${key}: not in the catalog`);
        continue;
      }
      const { errors, warnings } = checkTranslation(entry.en, message, language);
      problems.push(...[...errors, ...warnings].map((p) => `${key}: ${p}`));
    }
    expect(problems).toEqual([]);
    expect(keys.filter((k) => !(k in messages))).toEqual([]);
  });
});
