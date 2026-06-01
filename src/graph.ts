import { App, TFile } from 'obsidian';
import { GraphData, GraphLink, GraphNode, GraphOptions } from './types';
import { getCurrentFolder, resolveNote } from './utils';

function getLinkMap(app: App) {
  return app.metadataCache.resolvedLinks || {};
}

function collectFolderNotes(app: App, folder: string): TFile[] {
  const all = app.vault.getMarkdownFiles();
  if (!folder) return all;
  const prefix = folder.endsWith('/') ? folder : folder + '/';
  return all.filter(f => f.path === folder || f.path.startsWith(prefix));
}

function collectNeighborhood(app: App, center: TFile | null): TFile[] {
  if (!center) return [];
  const res: TFile[] = [center];
  const linkMap = getLinkMap(app);
  // outgoing
  const outs = linkMap[center.path] || {};
  for (const t of Object.keys(outs)) {
    const tf = app.vault.getAbstractFileByPath(t) as TFile | null;
    if (tf) res.push(tf);
  }
  // incoming (scan)
  for (const [src, targets] of Object.entries(linkMap)) {
    if (targets[center.path]) {
      const sf = app.vault.getAbstractFileByPath(src) as TFile | null;
      if (sf) res.push(sf);
    }
  }
  // unique
  const seen = new Set<string>();
  return res.filter(f => { if (seen.has(f.path)) return false; seen.add(f.path); return true; });
}

function applyExclude(nodes: TFile[], excludeRefs: string[] | undefined, app: App, sourcePath: string): TFile[] {
  if (!excludeRefs || excludeRefs.length === 0) return nodes;
  const exSet = new Set<string>();
  for (const r of excludeRefs) {
    const f = resolveNote(r, app, sourcePath);
    if (f) exSet.add(f.path);
  }
  return nodes.filter(f => !exSet.has(f.path));
}

function buildLinksWithin(nodes: TFile[], app: App): GraphLink[] {
  const ids = new Set(nodes.map(f => f.path));
  const linkMap = getLinkMap(app);
  const out: GraphLink[] = [];
  const seen = new Set<string>();
  for (const src of nodes) {
    const targets = linkMap[src.path] || {};
    for (const tgt of Object.keys(targets)) {
      if (ids.has(tgt)) {
        const key = [src.path, tgt].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ source: src.path, target: tgt });
        }
      }
    }
  }
  return out;
}

export async function buildGraphData(app: App, sourcePath: string, opts: GraphOptions): Promise<GraphData> {
  if (opts.error) return { nodes: [], links: [] };

  let candidates: TFile[] = [];

  const mode = opts.mode;
  if (mode === 'filtered') {
    const targetRef = opts.target || sourcePath;
    const center = resolveNote(targetRef, app, sourcePath);
    candidates = collectNeighborhood(app, center);
  } else if (mode === 'manual') {
    const refs = opts.nodes || [];
    candidates = refs.map(r => resolveNote(r, app, sourcePath)).filter((f): f is TFile => !!f);
  } else {
    // Default: always the folder of the note that contains the code block.
    // No folder: override is supported (user request for simplicity).
    const folder = getCurrentFolder(sourcePath, app);
    candidates = collectFolderNotes(app, folder);
  }

  candidates = applyExclude(candidates, opts.exclude, app, sourcePath);

  let centerPath: string | null = null;
  if (mode === 'filtered') {
    const targetRef = opts.target || sourcePath;
    const center = resolveNote(targetRef, app, sourcePath);
    centerPath = center?.path ?? null;
  } else if (mode !== 'manual') {
    centerPath = sourcePath;
  }

  const nodes: GraphNode[] = candidates.map(f => ({
    id: f.path,
    label: f.basename || f.path.split('/').pop() || f.path,
    file: f,
    isCenter: centerPath !== null && f.path === centerPath,
  }));

  const links = buildLinksWithin(candidates, app);

  // stable sort for deterministic layout
  nodes.sort((a, b) => a.id.localeCompare(b.id));
  links.sort((a, b) => (a.source + a.target).localeCompare(b.source + b.target));

  return { nodes, links };
}
