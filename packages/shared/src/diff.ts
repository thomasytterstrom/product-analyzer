export type AttributeDiffAdded = { key: string; to: string | null };
export type AttributeDiffRemoved = { key: string; from: string | null };
export type AttributeDiffChanged = {
  key: string;
  from: string | null;
  to: string | null;
};
export type AttributeDiffUnchanged = { key: string; value: string | null };

const hasOwn = (obj: object, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

export function diffAttributes(
  a: Record<string, string | null | undefined>,
  b: Record<string, string | null | undefined>
) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);

  const added: AttributeDiffAdded[] = [];
  const removed: AttributeDiffRemoved[] = [];
  const changed: AttributeDiffChanged[] = [];
  const unchanged: AttributeDiffUnchanged[] = [];

  for (const key of [...keys].sort()) {
    // Treat `undefined` as "missing" rather than a real value.
    const aHas = hasOwn(a, key) && a[key] !== undefined;
    const bHas = hasOwn(b, key) && b[key] !== undefined;

    const av = aHas ? (a[key] ?? null) : null;
    const bv = bHas ? (b[key] ?? null) : null;

    if (!aHas && bHas) added.push({ key, to: bv });
    else if (aHas && !bHas) removed.push({ key, from: av });
    else if (av !== bv) changed.push({ key, from: av, to: bv });
    else unchanged.push({ key, value: av });
  }

  return { added, removed, changed, unchanged };
}
