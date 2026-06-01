# Architecture

Tiny Graph embeds compact interactive graphs inside notes using a code block. It is deliberately minimal and uses only Obsidian APIs plus a tiny bundled YAML parser and custom Canvas2D drawing.

## Product Intent (confirmed)
Lightweight code-block-first plugin (`tiny-graph` fence, plugin id `tiny-graph`) that renders ~180px tall graphs anywhere. Default behavior (bare block) shows notes from the folder of the containing note. Supports explicit `folder:` override, `mode: filtered`, and `mode: manual` via YAML. Graphs are drawn with Canvas2D to match Obsidian native graph aesthetics via `--graph-*` CSS variables. Nodes are clickable and open in the active leaf.

## Key Confirmed Decisions
- No `mode: folder` syntax. Folder behavior is implicit default (or triggered by `folder:` key). The presence of the block in a note selects its folder.
- A read-only plugin settings tab exists only for usage instructions. No height/folder parameters exist (fixed size, folder always derived from the note containing the block). The canvas supports mouse-drag panning of the view.
- One fixed default height. Width follows the code block container.
- Snapshot rendering only (no live metadata cache subscriptions in v1).
- Build artifact layout required by obs-deploy: `npm run build` emits `dist/main.js`; `manifest.json` and `styles.css` live at repository root.
- Rendering is custom Canvas2D (force-directed layout in `src/layout.ts`, hit-tested interaction). No vis-network or other graph libraries.
- Host note (or filtered `target`) is marked `isCenter` on its node: larger, accent-colored, pinned at layout center.
- Theming strictly via Obsidian's `--graph-node`, `--graph-line`, `--graph-node-focused`, `--graph-text` (with `--text-normal` fallbacks).

## Syntax (confirmed, v1)
- Bare:

  ```tiny-graph
  ```

- Folder override:

  ```tiny-graph
  folder: Projects/Alpha
  height: 100
  ```

- Filtered:

  ```tiny-graph
  mode: filtered
  target: "[[Note]]"
  exclude: ["[[Private]]"]
  ```

- Manual:

  ```tiny-graph
  mode: manual
  nodes: ["[[A]]", "[[B]]"]
  ```

`[[ ]]` syntax is stripped for convenience in relevant fields. Full YAML lists and scalars supported via the `yaml` package.

## Components & Data Flow
1. `registerMarkdownCodeBlockProcessor('tiny-graph', ...)` in `src/main.ts` receives source + `ctx.sourcePath`.
2. `src/parser.ts:parseOptions(source)` → `GraphOptions` (or error).
3. `src/graph.ts:buildGraphData(app, sourcePath, opts)` → `{nodes: Node[], links: Link[]}` using `vault.getMarkdownFiles()`, `metadataCache.resolvedLinks`, and `getFirstLinkpathDest`.
4. `src/renderer.ts:TinyGraphRenderer` mounts a `<canvas>` in the supplied element, runs a simple force layout, draws with current CSS variable values, and wires pointer events for hover + click-to-open.
5. Cleanup on plugin unload and per-element destroy.

Error and empty states render a short message inside the container.

## Technology Stack
- TypeScript (strict)
- `yaml` (runtime, bundled)
- esbuild (output `dist/main.js`)
- vitest (unit tests only for parser and graph logic)
- Pure Obsidian `Plugin`, `MarkdownPostProcessorContext`, `TFile`, metadata cache, and workspace APIs
- CanvasRenderingContext2D for all drawing and interaction

## Project Structure (at v1 completion)
```
src/
  main.ts
  parser.ts
  graph.ts
  renderer.ts
  types.ts
  utils.ts
tests/
  parser.test.ts
  graph.test.ts
styles.css
manifest.json
versions.json
esbuild.config.mjs (outfile: dist/main.js)
package.json (build produces dist/, test runs vitest)
```

## Testing
- Every behavior in parser and graph builder has automated unit test coverage (`npm test`).
- Renderer, theming, click behavior, and Obsidian integration verified by building and loading the plugin in a real vault.
- No items were added to docs/TODO.md.

## Deploy Compatibility
`npm run build` + root `manifest.json` + `styles.css` are sufficient for `obs-deploy` (and manual installation). dist/ is already in .gitignore.

This document contains only confirmed facts and decisions. Open questions and future work remain outside this file.