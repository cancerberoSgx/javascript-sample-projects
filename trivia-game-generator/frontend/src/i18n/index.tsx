// UI translations at runtime (rules.md §2.9). English comes with the code (catalog.ts); other
// languages come from the server (GET /api/i18n/messages/:code), cached in localStorage so a
// reload doesn't flash English. Messages are ICU MessageFormat, formatted with intl-messageformat.
//
// Which language a device shows (I18N-3), first match wins:
//   1. this device's choice (localStorage "trivia.lang", set with the language menu)
//   2. the logged-in user's preference
//   3. the hint of the page: the game's language on the player page, else the user's organization's
//   4. the browser's languages
//   5. English

import { IntlMessageFormat } from "intl-messageformat";
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Language } from "../api";
import { useAuth } from "../auth";
import { CATALOG, isMessageKey, type MessageKey } from "./catalog";

export type { MessageKey } from "./catalog";
export type Params = Record<string, string | number>;
/** Rich params may also hold React nodes and tag handlers: <b> is bold by default. */
export type RichParams = Record<string, string | number | ReactNode | ((chunks: ReactNode[]) => ReactNode)>;

export const SOURCE_LANGUAGE = "en";
const DEVICE_KEY = "trivia.lang";
const ENGLISH: Language = { code: "en", name: "English", native_name: "English" };

export interface Translator {
  (key: MessageKey, params?: Params): string;
  /** Formats a message with tags (<b>…</b>) or React values into React nodes. */
  rich: (key: MessageKey, params?: RichParams) => ReactNode;
  /** The language being shown, e.g. "es". */
  lang: string;
}

interface I18nState {
  t: Translator;
  lang: string;
  /** The enabled languages (English first). */
  languages: Language[];
  /** This device's choice, or null for automatic. */
  deviceLanguage: string | null;
  /** The language "automatic" resolves to (no device choice or user preference). */
  automatic: string;
  setDeviceLanguage: (code: string | null) => void;
  /** Pages say which language fits them (the game's, the organization's). */
  setHint: (code: string | null) => void;
}

const I18nContext = createContext<I18nState | null>(null);

// ---------- storage ----------

function read<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode): the choice lasts until reload
  }
}

// ---------- formatting ----------

const compiled = new Map<string, IntlMessageFormat | null>();

function compile(message: string, lang: string): IntlMessageFormat | null {
  const id = `${lang}\u0000${message}`;
  let f = compiled.get(id);
  if (f === undefined) {
    try {
      f = new IntlMessageFormat(message, lang);
    } catch {
      f = null; // a broken translation: the caller falls back to English
    }
    compiled.set(id, f);
  }
  return f;
}

const bold = (chunks: ReactNode[]) => <strong>{chunks}</strong>;

/** Formats `key` in `lang` (or English, if the translation is missing or broken). */
function formatMessage(messages: Record<string, string>, lang: string, key: MessageKey, params: RichParams | undefined, rich: boolean): unknown {
  const values = rich ? { b: bold, ...params } : params;
  const attempts: [string | undefined, string][] = [
    [messages[key], lang],
    [CATALOG[key]?.en, SOURCE_LANGUAGE],
  ];
  for (const [message, locale] of attempts) {
    if (message === undefined) continue;
    const f = compile(message, locale);
    if (!f) continue;
    try {
      return f.format(values as Record<string, never>);
    } catch {
      // a placeholder the params don't have: try English
    }
  }
  return key;
}

function makeTranslator(lang: string, messages: Record<string, string>): Translator {
  const t = ((key: MessageKey, params?: Params) => {
    const out = formatMessage(messages, lang, key, params, false);
    return Array.isArray(out) ? out.join("") : String(out);
  }) as Translator;
  t.rich = (key, params) => {
    const out = formatMessage(messages, lang, key, params, true);
    if (!Array.isArray(out)) return out as ReactNode;
    return out.map((part, i) => <Fragment key={i}>{part as ReactNode}</Fragment>);
  };
  t.lang = lang;
  return t;
}

/** English only: for code outside the provider (and tests). */
export const englishT = makeTranslator(SOURCE_LANGUAGE, {});

// ---------- language choice ----------

function browserLanguage(available: string[]): string | null {
  for (const wanted of navigator.languages ?? [navigator.language]) {
    if (available.includes(wanted)) return wanted;
    const base = wanted.split("-")[0];
    if (available.includes(base)) return base;
  }
  return null;
}

interface CachedMessages {
  version: string;
  messages: Record<string, string>;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [languages, setLanguages] = useState<Language[]>(() => read<Language[]>("trivia.languages") ?? [ENGLISH]);
  const [deviceLanguage, setDevice] = useState<string | null>(() => read<string>(DEVICE_KEY));
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    api.languages().then((list) => {
      setLanguages(list);
      write("trivia.languages", list);
    }, () => {});
  }, []);

  const codes = languages.map((l) => l.code);
  const usable = (code: string | null | undefined) => (code && codes.includes(code) ? code : null);
  const automatic = usable(hint) ?? usable(user?.organization_language) ?? browserLanguage(codes) ?? SOURCE_LANGUAGE;
  const lang = usable(deviceLanguage) ?? usable(user?.language) ?? automatic;

  const [cache, setCache] = useState<Record<string, CachedMessages>>({});
  const messages = lang === SOURCE_LANGUAGE ? null : (cache[lang] ?? read<CachedMessages>(`trivia.i18n.${lang}`));

  useEffect(() => {
    if (lang === SOURCE_LANGUAGE) return;
    let live = true;
    api.messages(lang).then((m) => {
      if (!live) return;
      const entry = { version: m.version, messages: m.messages };
      setCache((c) => ({ ...c, [lang]: entry }));
      write(`trivia.i18n.${lang}`, entry);
    }, () => {});
    return () => {
      live = false;
    };
  }, [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const messageMap = messages?.messages;
  const t = useMemo(() => makeTranslator(lang, messageMap ?? {}), [lang, messageMap]);
  const setDeviceLanguage = useCallback((code: string | null) => {
    setDevice(code);
    write(DEVICE_KEY, code);
  }, []);

  const value = useMemo<I18nState>(
    () => ({ t, lang, languages, deviceLanguage, automatic, setDeviceLanguage, setHint }),
    [t, lang, languages, deviceLanguage, automatic, setDeviceLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}

/** The translator of the language this device shows. */
export function useT(): Translator {
  return useContext(I18nContext)?.t ?? englishT;
}

/** Tells the provider which language suits this page (the game's), while it's mounted. */
export function useLanguageHint(code: string | null | undefined) {
  const ctx = useContext(I18nContext);
  const set = ctx?.setHint;
  useEffect(() => {
    if (!set) return;
    set(code ?? null);
    return () => set(null);
  }, [code, set]);
}

/** An error to show, translated when the server (or engine) gave it a catalog key (I18N-7). */
export function errorText(t: Translator, error: { message: string; code?: string; params?: Params }): string {
  return error.code && isMessageKey(error.code) ? t(error.code, error.params ?? {}) : error.message;
}

/** The language menu: automatic (game / organization / browser) or a fixed language. Logged-in
 *  users also save the choice as their preference. */
export function LanguagePicker({ className, label = true }: { className?: string; label?: boolean }) {
  const { t, languages, deviceLanguage, automatic, setDeviceLanguage } = useI18n();
  const { user, refresh } = useAuth();
  if (languages.length < 2) return null;
  const native = (code: string) => languages.find((l) => l.code === code)?.native_name ?? code;
  const current = deviceLanguage ?? user?.language ?? "";
  const select = (
    <select
      value={current}
      aria-label={label ? undefined : t("common.language")}
      onChange={(e) => {
        const code = e.target.value || null;
        setDeviceLanguage(code);
        if (user && !user.impersonator) api.updateUser(user.id, { language: code }).then(refresh, () => {});
      }}
    >
      <option value="">{t("common.languageAuto", { language: native(automatic) })}</option>
      {languages.map((l) => (
        <option key={l.code} value={l.code} lang={l.code}>
          {l.native_name}
        </option>
      ))}
    </select>
  );
  if (!label) return <span className={className}>{select}</span>;
  return (
    <label className={`language-picker ${className ?? ""}`}>
      <span>{t("common.language")}</span> {select}
    </label>
  );
}
