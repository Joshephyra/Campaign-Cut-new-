/**
 * The tagging convention (SPEC.md 1.1, AE-AUTHORING.md):
 *
 *   cc.<role>       one editable slot      cc.headline
 *   cc.<role>.<n>   a repeated slot        cc.stat.1, cc.stat.2
 *
 * Case-sensitive. Exact. A name that does not start with "cc." is not a
 * tag at all and the layer is locked craft.
 */
export type ParsedTag = {
  /** The trimmed layer name, e.g. "cc.stat.2". */
  tag: string;
  /** Everything after "cc." minus a trailing numeric index, e.g. "stat" or "safe.disclaimer". */
  role: string;
  /** 1-based index for repeated slots, otherwise undefined. */
  index: number | undefined;
};

const PREFIX = 'cc.';

export function parseTag(layerName: string): ParsedTag | null {
  const tag = layerName.trim();
  if (!tag.startsWith(PREFIX)) return null;
  const rest = tag.slice(PREFIX.length);
  if (rest.length === 0) return null;

  const indexed = /^(.+)\.(\d+)$/.exec(rest);
  if (indexed) {
    return { tag, role: indexed[1]!, index: Number(indexed[2]) };
  }
  return { tag, role: rest, index: undefined };
}
