import { parse } from 'yaml';
import { GraphOptions } from './types';

function stripWikilink(s: string): string {
  if (typeof s !== 'string') return s;
  const t = s.trim().replace(/^\[\[|\]\]$/g, '');
  // keep "Note|Alias" as "Note|Alias" for resolution later; caller can split if needed
  return t;
}

function normalizeValue(v: any): any {
  if (typeof v === 'string') return stripWikilink(v);
  if (Array.isArray(v)) return v.map(normalizeValue);
  if (v && typeof v === 'object') {
    const o: any = {};
    for (const k of Object.keys(v)) o[k] = normalizeValue(v[k]);
    return o;
  }
  return v;
}

export function parseOptions(source: string): GraphOptions {
  const trimmed = source.trim();
  if (!trimmed) return {};
  try {
    const raw = parse(trimmed) ?? {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const opts: GraphOptions = {};
      for (const [k, v] of Object.entries(raw)) {
        const key = k.toLowerCase();
        if (key === 'mode') {
          const m = String(v).toLowerCase();
          if (m === 'filtered' || m === 'manual') opts.mode = m as any;
        } else if (key === 'target') {
          (opts as any)[key] = normalizeValue(v);
        } else if (key === 'exclude' || key === 'nodes') {
          (opts as any)[key] = normalizeValue(v);
        }
        // height and folder are intentionally ignored (user wants fixed single height + folder always comes from the note the block is in)
      }
      return opts;
    }
    return {};
  } catch (e) {
    return { error: (e as Error).message };
  }
}
