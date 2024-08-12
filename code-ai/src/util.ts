import * as Mustache from 'mustache';

export function renderTemplate(s: string, vars: any) {
  return Mustache.render(s, vars, {}, { escape: s => s });
}
