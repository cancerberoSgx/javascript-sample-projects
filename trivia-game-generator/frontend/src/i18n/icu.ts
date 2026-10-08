// What an ICU message uses: its placeholders ({name}) and tags (<b>). Checks a translation against
// its English message (I18N-4). backend/app/i18n/icu.py does the same on the server.

import { IntlMessageFormat } from "intl-messageformat";

// Element types of @formatjs/icu-messageformat-parser
const LITERAL = 0;
const POUND = 7;
const TAG = 8;
const SELECT = 5;
const PLURAL = 6;

interface Element {
  type: number;
  value?: string;
  options?: Record<string, { value: Element[] }>;
  children?: Element[];
}

export interface MessageShape {
  args: Set<string>;
  tags: Set<string>;
}

/** Parses an ICU message. Throws with the parser's error when it's not valid. */
export function messageShape(message: string, locale = "en"): MessageShape {
  const ast = new IntlMessageFormat(message, locale).getAst() as unknown as Element[];
  const shape: MessageShape = { args: new Set(), tags: new Set() };
  const walk = (elements: Element[]) => {
    for (const e of elements) {
      if (e.type === LITERAL || e.type === POUND) continue;
      if (e.type === TAG) {
        shape.tags.add(e.value!);
        walk(e.children ?? []);
        continue;
      }
      shape.args.add(e.value!);
      if (e.type === SELECT || e.type === PLURAL) for (const o of Object.values(e.options ?? {})) walk(o.value);
    }
  };
  walk(ast);
  return shape;
}

/** Problems of a translation compared with its English message: errors make it unusable,
 *  warnings are things it leaves out. */
export function checkTranslation(source: string, message: string, locale: string): { errors: string[]; warnings: string[] } {
  let shape: MessageShape;
  try {
    shape = messageShape(message, locale);
  } catch (e) {
    return { errors: [`Not valid ICU MessageFormat: ${(e as Error).message}`], warnings: [] };
  }
  const want = messageShape(source);
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const a of shape.args) if (!want.args.has(a)) errors.push(`Unknown placeholder {${a}}`);
  for (const tag of shape.tags) if (!want.tags.has(tag)) errors.push(`Unknown tag <${tag}>`);
  for (const a of want.args) if (!shape.args.has(a)) warnings.push(`Leaves out {${a}}`);
  for (const tag of want.tags) if (!shape.tags.has(tag)) warnings.push(`Leaves out <${tag}>`);
  return { errors, warnings };
}
