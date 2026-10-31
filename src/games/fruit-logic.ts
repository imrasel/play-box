export const GRAVITY = 560; // gentle, so fruit hangs in the air for small hands

/** Whether a finger moving from a to b passed through a circle. */
export function touchesCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / length)) : 0;
  const px = ax + t * dx - cx;
  const py = ay + t * dy - cy;
  return px * px + py * py <= r * r;
}

/** A throw from below the screen that peaks in view and stays inside the sides. */
export function launch(w: number, h: number, r: number, random: () => number = Math.random) {
  const x = r * 2 + random() * (w - r * 4);
  const peak = h * (0.12 + random() * 0.33);
  const y = h + r;
  const vy = -Math.sqrt(2 * GRAVITY * (y - peak));
  const flight = (2 * -vy) / GRAVITY;
  const target = r * 2 + random() * (w - r * 4);
  return { x, y, vx: (target - x) / flight, vy };
}
