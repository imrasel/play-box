type Attrs = Record<string, string | number | boolean | ((e: MouseEvent) => void)>;

export function h(tag: string, attrs: Attrs = {}, ...children: (Node | string)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'onclick') el.addEventListener('click', v as EventListener);
    else if (k === 'hidden') (el as HTMLElement).hidden = !!v;
    else el.setAttribute(k, String(v));
  }
  el.append(...children);
  return el;
}
