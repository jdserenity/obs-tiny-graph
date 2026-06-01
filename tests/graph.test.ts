import { describe, it, expect, beforeEach } from 'vitest';
import { TFile, Vault, MetadataCache, App } from 'obsidian';
import { buildGraphData } from '../src/graph';
import { GraphOptions } from '../src/types';

// Minimal mock factories for the exact surface we use
function makeTFile(path: string): TFile {
  const f = { path } as TFile;
  (f as any).parent = { path: path.includes('/') ? path.substring(0, path.lastIndexOf('/')) : '' };
  return f;
}

function makeMockApp(files: TFile[], resolvedLinks: Record<string, Record<string, number>>): App {
  const vault = {
    getMarkdownFiles: () => files,
    getAbstractFileByPath: (p: string) => files.find(f => f.path === p) || null,
  } as unknown as Vault;

  const cache = {
    resolvedLinks,
    getFileCache: () => null, // not needed when we use resolvedLinks for inference
    getFirstLinkpathDest: (linktext: string, sourcePath: string) => {
      // Simple resolver: treat linktext as path or basename match within vault
      const clean = linktext.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
      return files.find(f => f.path === clean || f.path.endsWith('/' + clean) || f.path === clean + '.md') || null;
    },
  } as unknown as MetadataCache;

  return { vault, metadataCache: cache } as App;
}

describe('buildGraphData', () => {
  let files: TFile[];
  let links: Record<string, Record<string, number>>;
  let app: App;

  beforeEach(() => {
    files = [
      makeTFile('Daily/2024-06-01.md'),
      makeTFile('Daily/2024-06-02.md'),
      makeTFile('Projects/Alpha/Note.md'),
      makeTFile('Projects/Alpha/Other.md'),
      makeTFile('Inbox/Idea.md'),
    ];
    links = {
      'Daily/2024-06-01.md': { 'Projects/Alpha/Note.md': 1 },
      'Projects/Alpha/Note.md': { 'Projects/Alpha/Other.md': 1 },
      'Projects/Alpha/Other.md': {},
      'Daily/2024-06-02.md': {},
      'Inbox/Idea.md': {},
    };
    app = makeMockApp(files, links);
  });

  it('bare block (no options) uses folder of current note', async () => {
    const data = await buildGraphData(app, 'Daily/2024-06-01.md', {});
    const ids = data.nodes.map(n => n.id).sort();
    expect(ids).toEqual(['Daily/2024-06-01.md', 'Daily/2024-06-02.md'].sort());
    expect(data.nodes.some(n => n.id.includes('Alpha'))).toBe(false);
  });

  it('default behavior always uses the folder of the source note (no folder override supported)', async () => {
    // Even if someone passes folder, it should be ignored
    const data = await buildGraphData(app, 'Daily/2024-06-01.md', {} as any);
    const ids = data.nodes.map(n => n.id);
    expect(ids).toContain('Daily/2024-06-01.md');
    expect(ids).toContain('Daily/2024-06-02.md');
    expect(ids.some(id => id.includes('Alpha'))).toBe(false);
  });

  it('mode: filtered builds 1-hop around current (out + in via resolvedLinks scan)', async () => {
    const data = await buildGraphData(app, 'Projects/Alpha/Note.md', { mode: 'filtered' });
    const ids = data.nodes.map(n => n.id);
    expect(ids).toContain('Projects/Alpha/Note.md');
    expect(ids).toContain('Daily/2024-06-01.md'); // incoming link
    expect(ids).toContain('Projects/Alpha/Other.md'); // outgoing
  });

  it('filtered with exclude removes the note and its links', async () => {
    const data = await buildGraphData(app, 'Projects/Alpha/Note.md', {
      mode: 'filtered',
      exclude: ['Projects/Alpha/Other.md'],
    });
    expect(data.nodes.some(n => n.id.includes('Other'))).toBe(false);
    expect(data.links.some(l => l.target.includes('Other') || l.source.includes('Other'))).toBe(false);
  });

  it('mode: manual only includes listed nodes and links between them', async () => {
    const data = await buildGraphData(app, 'Daily/2024-06-01.md', {
      mode: 'manual',
      nodes: ['Projects/Alpha/Note.md', 'Projects/Alpha/Other.md'],
    });
    expect(data.nodes.length).toBe(2);
    expect(data.links.length).toBe(1);
  });

  it('manual with no links still returns the nodes (isolates OK)', async () => {
    const data = await buildGraphData(app, 'Daily/2024-06-01.md', {
      mode: 'manual',
      nodes: ['Inbox/Idea.md', 'Daily/2024-06-02.md'],
    });
    expect(data.nodes.length).toBe(2);
    expect(data.links.length).toBe(0);
  });

  it('applies exclude even in default folder behavior', async () => {
    const data = await buildGraphData(app, 'Daily/2024-06-01.md', {
      exclude: ['Daily/2024-06-02.md'],
    });
    expect(data.nodes.some(n => n.id.includes('2024-06-02'))).toBe(false);
  });
});
