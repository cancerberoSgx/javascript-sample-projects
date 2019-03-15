import { CSSProperties } from 'react';

export function query<T extends HTMLElement= HTMLElement>(s: string): T {
  return document.querySelector<T>(s)!
}

export function queryAll<T extends HTMLElement= HTMLElement>(s: string): T[] {
  return Array.from(document.querySelectorAll<T>(s))
}

export function escapeHtml(html: string) {
  return html.replace(/\&/g, '&amp;').replace(/\</g, '&lt;').replace(/\>/g, '&gt;').trim()
}

export function shorter(s: string, l = 20) {
  s = typeof s !== 'string' ? (s + '') : s
  const postFix = s.length > l ? '...' : ''
  return `"${s.trim().substring(0, Math.min(s.length, l))}${postFix}"`
}

export function tryTo<F extends (...args: any[]) => any>(f: F): ReturnType<F> | undefined {
  try {
    return f()
  } catch (error) {
  }
}

export function printMs(ms: number, config: {
  minutes?: boolean;
  seconds?: boolean;
  ms?: boolean;
} = { minutes: false, seconds: true, ms: true }) {
  config = { ...{ minutes: false, seconds: true, ms: true }, ...config }
  const seconds = config.seconds && Math.floor(ms / 1000)
  const minutes = config.minutes && seconds && Math.floor(seconds / 60)
  const milliseconds = config.ms && Math.floor(ms % 1000 || ms)
  return `${minutes ? `${minutes} minutes ` : ''}${seconds ? `${seconds} seconds ` : ''}${milliseconds ? `${milliseconds} ms ` : ''}`
}

export function getEnumKey(anEnum: any, value: any): string {
  for (const key in anEnum) {
    if (value === anEnum[key]) {
      return key
    }
  }
  return ''
}

export function enumKeys<T=string>(anEnum: any): T[] {
  const a = []
  for (let i in anEnum) {
    a.push(i)
  }
  return a as any
}

export function keys<T extends string>(o: Partial<{ [k in T]: any }>): T[] {
  return Object.keys(o) as T[]
}

export class Emitter<E=any, L extends (e: E) => void=(e: E) => void,> {
  private l: L[] = []
  add(l: L) {
    this.l.push(l)
  }
  emit(e: E) {
    this.l.forEach(l => l(e))
  }
}export function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}