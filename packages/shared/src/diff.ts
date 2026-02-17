export type AttributeDiffAdded = { key: string; to: string | null };
export type AttributeDiffRemoved = { key: string; from: string | null };
export type AttributeDiffChanged = {
  key: string;
  from: string | null;
  to: string | null;
};
export type AttributeDiffUnchanged = { key: string; value: string | null };

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
    const av = a[key] ?? null;
    const bv = b[key] ?? null;

    if (!(key in a) && key in b) added.push({ key, to: bv });
    else if (key in a && !(key in b)) removed.push({ key, from: av });
    else if (av !== bv) changed.push({ key, from: av, to: bv });
    else unchanged.push({ key, value: av });
  }

  return { added, removed, changed, unchanged };
}
