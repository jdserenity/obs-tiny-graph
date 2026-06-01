import { App, TFile } from 'obsidian';

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\.md$/, '');
}

export function resolveNote(ref: string | undefined, app: App, sourcePath: string): TFile | null {
  if (!ref) return null;
  const clean = String(ref).replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
  if (!clean) return null;
  return app.metadataCache.getFirstLinkpathDest(clean, sourcePath);
}

export function getCurrentFolder(sourcePath: string, app: App): string {
  const f = app.vault.getAbstractFileByPath(sourcePath) as TFile | null;
  if (!f || !f.parent) return '';
  return f.parent.path === '/' ? '' : f.parent.path;
}
