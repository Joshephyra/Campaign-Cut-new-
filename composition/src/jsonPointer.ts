/**
 * Minimal RFC 6901 JSON pointer resolver. Returns undefined for a missing
 * path rather than throwing, so callers can decide how loud to be.
 */
export function resolvePointer(doc: unknown, pointer: string): unknown {
  if (pointer === '') return doc;
  if (!pointer.startsWith('/')) return undefined;

  let node: unknown = doc;
  for (const rawToken of pointer.slice(1).split('/')) {
    const token = rawToken.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node === null || typeof node !== 'object') return undefined;
    if (Array.isArray(node)) {
      const index = Number(token);
      if (!Number.isInteger(index) || index < 0 || index >= node.length) return undefined;
      node = node[index];
    } else {
      const record = node as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(record, token)) return undefined;
      node = record[token];
    }
  }
  return node;
}
