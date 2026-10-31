// iPhones refuse orientation lock, so on an upright phone the CSS turns
// `.piano` 90° clockwise. Screen coordinates must be turned back to match.
const upright = matchMedia('(orientation: portrait) and (max-width: 600px)');

/** A pointer's position inside `el`, in the element's own unrotated pixels. */
export function localPoint(e: { clientX: number; clientY: number }, el: Element) {
  const r = el.getBoundingClientRect();
  return upright.matches
    ? { x: e.clientY - r.top, y: r.right - e.clientX }
    : { x: e.clientX - r.left, y: e.clientY - r.top };
}
