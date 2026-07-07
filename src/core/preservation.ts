import type { Annotation, HistoryEntry, ImageData } from '../types';

/**
 * Module-level registry that keeps each image's vector annotations and undo
 * history alive across editor destroy/recreate cycles within a page session.
 *
 * Hosts often tear the editor down and rebuild it whenever their surrounding
 * state changes (e.g. switching images in a review panel), and may feed back
 * a flattened annotated export instead of the original image. The registry
 * lets a new editor instance pick the vector state back up and re-edit it.
 */
export interface PreservedImageState {
  /** The exact url the annotations were drawn on (the original image). */
  url: string;
  rotation: number;
  note?: string;
  annotations: Annotation[];
  history: HistoryEntry[];
  historyIndex: number;
}

const MAX_ENTRIES = 100;

const byStateKey = new Map<string, PreservedImageState>();
const byUrl = new Map<string, PreservedImageState>();
const byName = new Map<string, PreservedImageState>();

/**
 * Filename-based identity: strips the extension and the `annotated-` /
 * `-annotated` markers hosts add to flattened exports, so
 * "annotated-foo.jpg" and "foo.tif" resolve to the same image.
 * Returns '' for names too generic to be an identity (e.g. "Image 1").
 */
function normalizeName(name: string): string {
  if (!name) return '';
  let base = name.replace(/\.[^.]+$/, '');
  base = base.replace(/^annotated-/i, '').replace(/-annotated$/i, '').trim().toLowerCase();
  if (!base || /^image \d+$/.test(base)) return '';
  return base;
}

function trim(map: Map<string, PreservedImageState>): void {
  while (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}

function reinsert(
  map: Map<string, PreservedImageState>,
  key: string,
  entry: PreservedImageState
): void {
  map.delete(key); // re-insert as most recent (Maps keep insertion order)
  map.set(key, entry);
  trim(map);
}

export function preserveImageState(image: ImageData, entry: PreservedImageState): void {
  if (image.stateKey) reinsert(byStateKey, image.stateKey, entry);
  if (entry.url && !entry.url.startsWith('data:')) reinsert(byUrl, entry.url, entry);
  const name = normalizeName(image.name);
  if (name) reinsert(byName, name, entry);
}

export function findPreservedState(image: ImageData): PreservedImageState | null {
  if (image.stateKey) {
    const byKey = byStateKey.get(image.stateKey);
    if (byKey) return byKey;
  }
  if (image.url && !image.url.startsWith('data:')) {
    const byExactUrl = byUrl.get(image.url);
    if (byExactUrl) return byExactUrl;
  }
  // A data: url or an "annotated-*" name means the host fed back a flattened
  // export — the original url is unknowable from the image itself, so fall
  // back to the filename identity.
  const looksFlattened =
    !image.url ||
    image.url.startsWith('data:') ||
    /(^|\/)annotated-|-annotated\./i.test(image.name || '');
  if (looksFlattened) {
    const name = normalizeName(image.name);
    if (name) {
      const byFileName = byName.get(name);
      if (byFileName) return byFileName;
    }
  }
  return null;
}

export function clearPreservedState(): void {
  byStateKey.clear();
  byUrl.clear();
  byName.clear();
}
