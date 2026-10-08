// Root only: the UI's translations (rules.md §2.9, I18N-*). Every key of the catalog with its
// context, and per language its translations: edit with a live preview, review machine output,
// translate the missing or outdated ones with an organization's OpenAI / Gemini key, export and
// import a language as a file. English is the source: its texts come from the code.

import { IntlMessageFormat } from "intl-messageformat";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, type LanguageStats, type Organization, type Provider, type Translation, type TranslationKey } from "../api";
import { checkTranslation, messageShape } from "../i18n/icu";
import { ErrorBox, useAction } from "./common";
import { ImportButton, downloadJson, readJsonFile } from "./files";

const AI_BATCH = 30;

type Filter = "all" | "missing" | "outdated" | "machine" | "reviewed" | "warnings" | "obsolete";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["missing", "Missing"],
  ["outdated", "Outdated"],
  ["machine", "To review"],
  ["reviewed", "Reviewed"],
  ["warnings", "With warnings"],
  ["obsolete", "Obsolete"],
];

export function TranslationsPage() {
  const lang = useParams().lang;
  const navigate = useNavigate();
  const [languages, setLanguages] = useState<LanguageStats[]>([]);
  const [keys, setKeys] = useState<TranslationKey[]>([]);
  const load = useAction();

  const reloadLanguages = () => api.translationLanguages().then(setLanguages, load.setError);
  useEffect(() => {
    load.run(async () => {
      const [l, k] = await Promise.all([api.translationLanguages(), api.translationKeys()]);
      setLanguages(l);
      setKeys(k);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The list URL opens the first language to translate
  useEffect(() => {
    if (!lang && languages.length) navigate(`/translations/${(languages.find((l) => l.code !== "en") ?? languages[0]).code}`, { replace: true });
  }, [lang, languages, navigate]);

  const selected = languages.find((l) => l.code === lang) ?? null;
  return (
    <div className="orgs-page translations-page">
      <section className="panel org-list">
        <h2>Languages</h2>
        <ErrorBox error={load.error} />
        <ul>
          {languages.map((l) => (
            <li key={l.code}>
              <button className={l.code === lang ? "on" : ""} onClick={() => navigate(`/translations/${l.code}`)}>
                <span>
                  {l.native_name} <span className="muted small">{l.code}</span>
                  {!l.enabled && <span className="chip">off</span>}
                </span>
                <span className="small muted">
                  {l.code === "en" ? `source · ${keys.filter((k) => !k.obsolete).length}` : <Progress language={l} />}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <NewLanguageForm onCreated={(code) => reloadLanguages().then(() => navigate(`/translations/${code}`))} />
      </section>
      <div className="org-detail">
        {selected && selected.code === "en" && <SourceView keys={keys} />}
        {selected && selected.code !== "en" && (
          <LanguageView key={selected.code} language={selected} keys={keys} onStatsChanged={reloadLanguages} onDeleted={() => reloadLanguages().then(() => navigate("/translations"))} />
        )}
        {lang && languages.length > 0 && !selected && <p className="muted">Language “{lang}” not found.</p>}
      </div>
    </div>
  );
}

function Progress({ language: l }: { language: LanguageStats }) {
  const total = l.translated + l.missing;
  const pct = total ? Math.round((100 * l.translated) / total) : 100;
  return (
    <span title={`${l.translated} translated, ${l.missing} missing, ${l.outdated} outdated, ${l.machine} to review`}>
      {pct}%{l.outdated + l.machine > 0 && <span className="chip warn">{l.outdated + l.machine}</span>}
    </span>
  );
}

function NewLanguageForm({ onCreated }: { onCreated: (code: string) => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [native, setNative] = useState("");
  const action = useAction();
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        action.run(async () => {
          await api.createLanguage({ code: code.trim(), name: name.trim(), native_name: native.trim() });
          onCreated(code.trim());
          setCode("");
          setName("");
          setNative("");
        });
      }}
    >
      <strong className="small">Add a language</strong>
      <input required placeholder="Code (fr, pt-BR, es-419)" value={code} onChange={(e) => setCode(e.target.value)} pattern="[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|[0-9]{3}))?" />
      <input required placeholder="Name in English (French)" value={name} onChange={(e) => setName(e.target.value)} />
      <input required placeholder="Own name (Français)" value={native} onChange={(e) => setNative(e.target.value)} />
      <ErrorBox error={action.error} />
      <button className="small" disabled={action.busy}>
        + Add
      </button>
    </form>
  );
}

// ---------- shared: filters and the key's context ----------

function useKeyFilter(keys: TranslationKey[]) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const areas = useMemo(() => [...new Set(keys.map((k) => k.area))].sort(), [keys]);
  const matches = (k: TranslationKey, extra = "") => {
    if (area && k.area !== area) return false;
    const s = q.trim().toLowerCase();
    return !s || `${k.key} ${k.source} ${k.description} ${extra}`.toLowerCase().includes(s);
  };
  const controls = (
    <>
      <input type="search" placeholder="Search keys, English, translations…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">
        <option value="">All areas</option>
        {areas.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </>
  );
  return { matches, controls };
}

function KeyContext({ k }: { k: TranslationKey }) {
  return (
    <div className="key-context">
      <div className="row wrap">
        <code>{k.key}</code>
        <span className="chip">{k.area}</span>
        {k.max_length && <span className="chip">≤ {k.max_length} chars</span>}
        {k.obsolete && <span className="chip warn">obsolete</span>}
      </div>
      <p className="small muted">{k.description}</p>
      {Object.keys(k.placeholders).length > 0 && (
        <ul className="placeholders small">
          {Object.entries(k.placeholders).map(([p, what]) => (
            <li key={p}>
              <code>{`{${p}}`}</code> {what}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** English: the catalog itself, read only. */
function SourceView({ keys }: { keys: TranslationKey[] }) {
  const { matches, controls } = useKeyFilter(keys);
  const shown = keys.filter((k) => matches(k));
  return (
    <section className="panel">
      <h2>English (source)</h2>
      <p className="small muted">
        English texts come from the code (<code>frontend/src/i18n/catalog.ts</code>) and are loaded into the database on startup. Change them there; their
        translations then show as outdated.
      </p>
      <div className="row wrap translation-filters">{controls}</div>
      <p className="small muted">{shown.length} keys</p>
      <div className="translation-list">
        {shown.map((k) => (
          <div key={k.key} className="translation-row">
            <KeyContext k={k} />
            <div className="source-text">{k.source}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- a language ----------

function LanguageView({
  language,
  keys,
  onStatsChanged,
  onDeleted,
}: {
  language: LanguageStats;
  keys: TranslationKey[];
  onStatsChanged: () => void;
  onDeleted: () => void;
}) {
  const [rows, setRows] = useState<Record<string, Translation>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const { matches, controls } = useKeyFilter(keys);
  const action = useAction();
  const code = language.code;

  const reload = () =>
    api.translations(code).then((list) => setRows(Object.fromEntries(list.map((t) => [t.key, t]))), action.setError);
  useEffect(() => {
    reload();
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = (t: Translation | null, key: string) => {
    setRows((r) => {
      const next = { ...r };
      if (t) next[key] = t;
      else delete next[key];
      return next;
    });
    onStatsChanged();
  };

  const state = (k: TranslationKey) => {
    const t = rows[k.key];
    if (k.obsolete) return "obsolete";
    if (!t) return "missing";
    if (t.outdated) return "outdated";
    return t.status;
  };
  const shown = keys.filter((k) => {
    const s = state(k);
    if (filter === "obsolete" ? s !== "obsolete" : s === "obsolete" && filter !== "all") return false;
    if (filter === "warnings" ? !rows[k.key]?.warnings.length : filter !== "all" && filter !== "obsolete" && s !== filter) return false;
    return matches(k, rows[k.key]?.message);
  });
  const todo = keys.filter((k) => !k.obsolete && (state(k) === "missing" || state(k) === "outdated"));

  return (
    <>
      <section className="panel">
        <div className="row between wrap">
          <h2>
            {language.native_name} <span className="muted small">{language.name} · {code}</span>
          </h2>
          <span className="row">
            <label className="small row">
              <input
                type="checkbox"
                checked={language.enabled}
                onChange={(e) => action.run(async () => (await api.updateLanguage(code, { enabled: e.target.checked }), onStatsChanged()))}
              />
              Players can pick it
            </label>
          </span>
        </div>
        <p className="small muted">
          {language.translated} translated · {language.missing} missing · {language.outdated} outdated · {language.machine} machine-translated to review. Missing
          texts show in English. Edits reach devices on their next page load.
        </p>
        <ErrorBox error={action.error} />
        <AiPanel code={code} todo={todo} onDone={() => (reload(), onStatsChanged())} />
        <div className="row wrap">
          <button
            className="small"
            onClick={() => action.run(async () => downloadJson(`translations.${code}.json`, await api.exportTranslations(code)))}
            title="Every key with its context, English text and translation: translate it anywhere, then import it"
          >
            ⬇ Export file
          </button>
          <ImportButton
            label="⬆ Import file"
            disabled={action.busy}
            onFile={(file) =>
              action.run(async () => {
                const res = await api.importTranslations(code, await readJsonFile(file));
                alert(`${res.imported} translation(s) saved, ${res.unchanged} unchanged.`);
                await reload();
                onStatsChanged();
              })
            }
          />
          <span className="spacer" />
          <button
            className="small danger"
            onClick={() =>
              confirm(`Delete ${language.name} and all its translations? Users and games that use it go back to automatic.`) &&
              action.run(async () => (await api.deleteLanguage(code), onDeleted()))
            }
          >
            Delete language
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="row wrap translation-filters">
          {controls}
          <div className="tabs" role="group" aria-label="Show">
            {FILTERS.map(([f, label]) => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <p className="small muted">{shown.length} keys</p>
        <div className="translation-list">
          {shown.map((k) => (
            <TranslationRow key={k.key} k={k} code={code} t={rows[k.key] ?? null} state={state(k)} onChanged={(t) => changed(t, k.key)} />
          ))}
        </div>
      </section>
    </>
  );
}

/** Translates the missing and outdated keys with an organization's key, a batch at a time (I18N-8). */
function AiPanel({ code, todo, onDone }: { code: string; todo: TranslationKey[]; onDone: () => void }) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<{ key: string; reason: string }[]>([]);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.listOrganizations().then((list) => {
      const usable = list.filter((o) => o.has_openai_api_key || o.has_gemini_api_key);
      setOrgs(usable);
      setOrgId((id) => id ?? usable[0]?.id ?? null);
    }, setError);
  }, []);
  const org = orgs.find((o) => o.id === orgId);
  const providers: Provider[] = org ? [...(org.has_openai_api_key ? ["openai" as const] : []), ...(org.has_gemini_api_key ? ["gemini" as const] : [])] : [];
  const chosen = provider && providers.includes(provider) ? provider : (providers[0] ?? null);

  const run = async () => {
    if (!orgId) return;
    setError(null);
    setFailed([]);
    const keys = todo.map((k) => k.key);
    setProgress({ done: 0, total: keys.length });
    try {
      for (let i = 0; i < keys.length; i += AI_BATCH) {
        const res = await api.translateWithAi(code, { organization_id: orgId, provider: chosen, keys: keys.slice(i, i + AI_BATCH) });
        setFailed((f) => [...f, ...res.failed]);
        setProgress({ done: Math.min(keys.length, i + AI_BATCH), total: keys.length });
        onDone();
      }
    } catch (e) {
      setError(e);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="inline-form">
      <div className="row wrap">
        <strong className="small">✨ Translate with AI</strong>
        {orgs.length ? (
          <>
            <label className="small">
              Key of{" "}
              <select value={orgId ?? ""} onChange={(e) => setOrgId(Number(e.target.value))}>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            {providers.length > 1 && (
              <select value={chosen ?? ""} onChange={(e) => setProvider(e.target.value as Provider)} aria-label="Provider">
                <option value="openai">OpenAI ({org?.openai_model ?? org?.default_openai_model})</option>
                <option value="gemini">Gemini ({org?.gemini_model ?? org?.default_gemini_model})</option>
              </select>
            )}
            <button className="small primary" disabled={!todo.length || !!progress} onClick={run}>
              {progress ? `Translating ${progress.done}/${progress.total}…` : `Translate ${todo.length} missing or outdated`}
            </button>
          </>
        ) : (
          <span className="small muted">No organization has an OpenAI or Gemini key. Add one on the Organizations tab.</span>
        )}
      </div>
      <p className="small muted">
        Each key goes to the model with its description, area and placeholders, plus some of this language's reviewed texts for consistent wording. Results are
        saved as “to review”.
      </p>
      <ErrorBox error={error} />
      {failed.length > 0 && (
        <div className="warn small">
          Not translated:
          <ul>
            {failed.map((f) => (
              <li key={f.key}>
                <code>{f.key}</code>: {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Sample values for a preview: numbers for plurals and numbers, the first case for selects. */
function sampleValues(source: string, placeholders: Record<string, string>): Record<string, unknown> {
  const values: Record<string, unknown> = { die: (c: unknown) => `[${c}]` };
  try {
    const ast = new IntlMessageFormat(source, "en").getAst() as unknown as { type: number; value: string; options?: Record<string, unknown> }[];
    const walk = (els: typeof ast) => {
      for (const e of els) {
        if (e.type === 6 || e.type === 2) values[e.value] = 2;
        else if (e.type === 5) values[e.value] = Object.keys(e.options ?? {}).find((o) => o !== "other") ?? "other";
        else if (e.type === 1 && !(e.value in values)) values[e.value] = /number|count|round|value|points|space|max|sides|limit|level|roll/.test(e.value) ? 3 : `‹${e.value}›`;
        for (const o of Object.values(e.options ?? {})) walk((o as { value: typeof ast }).value);
      }
    };
    walk(ast);
  } catch {
    // the source always parses (catalog.test.ts)
  }
  for (const p of Object.keys(placeholders)) if (!(p in values)) values[p] = `‹${p}›`;
  return values;
}

function preview(message: string, locale: string, values: Record<string, unknown>): string {
  try {
    const tags = Object.fromEntries([...messageShape(message, locale).tags].map((t) => [t, (c: unknown[]) => (t === "die" ? `[${c.join("")}]` : c.join(""))]));
    const out = new IntlMessageFormat(message, locale).format({ ...values, ...tags } as Record<string, never>);
    return Array.isArray(out) ? out.join("") : String(out);
  } catch (e) {
    return `⚠ ${(e as Error).message}`;
  }
}

function TranslationRow({
  k,
  code,
  t,
  state,
  onChanged,
}: {
  k: TranslationKey;
  code: string;
  t: Translation | null;
  state: string;
  onChanged: (t: Translation | null) => void;
}) {
  const [draft, setDraft] = useState(t?.message ?? "");
  const action = useAction();
  useEffect(() => setDraft(t?.message ?? ""), [t?.message]);
  const dirty = draft !== (t?.message ?? "");
  const check = draft.trim() ? checkTranslation(k.source, draft, code) : { errors: [], warnings: [] };
  const values = useMemo(() => sampleValues(k.source, k.placeholders), [k.source, k.placeholders]);
  const save = () => action.run(async () => onChanged(await api.saveTranslation(code, k.key, { message: draft })));
  const tooLong = k.max_length && draft.length > k.max_length * 1.3;

  return (
    <div className={`translation-row state-${state}`}>
      <KeyContext k={k} />
      <div className="source-text">{k.source}</div>
      <div className="stack">
        <textarea
          lang={code}
          rows={Math.min(6, Math.max(1, Math.ceil(Math.max(draft.length, k.source.length) / 60)))}
          value={draft}
          placeholder="Not translated: shows in English"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && dirty && !check.errors.length) save();
          }}
        />
        {draft.trim() && !check.errors.length && <div className="small preview" lang={code}>{preview(draft, code, values)}</div>}
        {check.errors.map((e) => (
          <div key={e} className="small error-text">
            {e}
          </div>
        ))}
        {check.warnings.map((w) => (
          <div key={w} className="small muted">
            ⚠ {w}
          </div>
        ))}
        {tooLong && <div className="small muted">⚠ Longer than the {k.max_length}-character hint: it may not fit.</div>}
        <ErrorBox error={action.error} />
        <div className="row wrap">
          {state === "missing" && <span className="chip">missing</span>}
          {state === "outdated" && <span className="chip warn" title="The English text changed after this was translated">outdated</span>}
          {state === "machine" && <span className="chip warn">machine · to review</span>}
          {state === "reviewed" && <span className="chip">reviewed</span>}
          {t && <span className="small muted">{[t.updated_by_name ?? "bundled", new Date(t.updated_at).toLocaleDateString()].join(" · ")}</span>}
          <span className="spacer" />
          {(dirty || state === "machine" || state === "outdated") && (
            <button className="small primary" disabled={!draft.trim() || !!check.errors.length || action.busy} onClick={save} title="Ctrl+Enter">
              {dirty ? "Save" : "Mark reviewed"}
            </button>
          )}
          {dirty && (
            <button className="small" onClick={() => setDraft(t?.message ?? "")}>
              Undo
            </button>
          )}
          {t && !dirty && (
            <button
              className="small danger"
              disabled={action.busy}
              onClick={() => confirm(`Delete this translation? “${k.key}” will show in English.`) && action.run(async () => (await api.deleteTranslation(code, k.key), onChanged(null)))}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
