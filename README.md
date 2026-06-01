# Tiny Graph

Embed compact, interactive, custom-drawn graphs inside any note using a code block.

- Default: drop ` ```tiny-graph ` in a note → shows notes from that note's folder + links between them.
- Explicit: `folder:`, `mode: filtered`, or `mode: manual` via YAML.
- Canvas2D rendering styled with Obsidian's native graph CSS variables.
- Click nodes to open notes. Hover highlights connections.
- ~180px tall by default. No settings UI. Simple and lightweight.

## Install

**Recommended (with obs-deploy):**

```bash
npm run build
obs-deploy
```

**Manual:**

1. Copy these three files into your vault's `.obsidian/plugins/tiny-graph/`:
   - `dist/main.js` → `main.js`
   - `manifest.json`
   - `styles.css`
2. Reload plugins or restart Obsidian.
3. Enable "Tiny Graph".

Releases (when published) can be installed via Obsidian Community Plugins or by unzipping into the plugins folder.

## Usage

### Bare block (the main intended way)

```tiny-graph
```

This renders a compact graph of the notes in **the same folder as the note you put the block in**. No options needed.

### Filtered mode (normal local graph around a note)

```tiny-graph
mode: filtered
target: "[[Meeting Notes]]"
exclude:
  - "[[Private Stuff]]"
```

### Manual mode (only specific notes you list)

```tiny-graph
mode: manual
nodes:
  - "[[Concept A]]"
  - "[[Concept B]]"
  - "[[Concept C]]"
```

`[[wikilink]]` syntax works in `target`, `nodes`, and `exclude`.

**There is no `height` or `folder` option.** The size is fixed. The folder is always taken from the note the block lives in.

## Interaction

- **Click** a node → opens the note.
- **Hover** a node → highlights its connections.
- **Drag** the background → pans the graph view around.
- **Scroll wheel** → zoom in/out (toward cursor).
- **Double-click** the graph → resets pan and zoom.

## Why so few options?

The goal is simple plug-and-play. Put the block in a note and it just shows that folder's graph. Use `mode: filtered` or `mode: manual` when you need something different.

Put the block anywhere. Multiple blocks per note are supported.

## Development

```bash
npm install
npm run dev          # watch + rebuild to dist/main.js
npm test             # vitest (parser + graph logic with mocks)
npm run build        # production bundle + type check
```

- Tests cover every behavior of the parser and graph builder (`npm test`).
- Renderer and full plugin behavior are verified by loading the built plugin in Obsidian.
- The build output (`dist/main.js` + root `manifest.json` + `styles.css`) is compatible with `obs-deploy`.

## Architecture notes

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the confirmed component map, data flow, and stack.

The plugin uses only public Obsidian APIs (`registerMarkdownCodeBlockProcessor`, `metadataCache.resolvedLinks`, `vault`, workspace) plus a bundled `yaml` parser and a pure Canvas2D implementation. No external graph libraries.

## License

MIT
