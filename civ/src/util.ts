let util;

export function append(s, parent = document.body) {
  const e = document.createElement('div');
  e.innerHTML = s;
  parent.append(e);
  return e;
}

export function findParent(e: HTMLElement, predicate: (e: HTMLElement) => boolean, includeSelf=true): HTMLElement | null {
  if(includeSelf && predicate(e)) {
    return e;
  }
  if (e.parentElement) {
    if (predicate(e.parentElement)) {
      return e.parentElement;
    }
    else {
      return findParent(e.parentElement, predicate, false);
    }
  }
  return null;
}
