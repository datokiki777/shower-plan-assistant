/** Turns any pasted address or link into a guaranteed-tappable Google Maps
 * URL. Ported from V1's `normalizeMapsLink` (js/app.js) - stored
 * pre-normalized in V2 (Client.googleMapsLink), unlike V1 which only
 * normalized at share/open time. See DATA_MODEL.md §1. */
export function normalizeMapsLink(value: string): string {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
}
