import { Plugin, MarkdownPostProcessorContext, TFile, MarkdownView } from 'obsidian';
import { parseOptions } from './parser';
import { buildGraphData } from './graph';
import { TinyGraphRenderer } from './renderer';
import { GraphNode } from './types';
import { TinyGraphSettingTab } from './settings';

export default class TinyGraphPlugin extends Plugin {
  private renderers = new Set<TinyGraphRenderer>();

  async onload() {
    this.registerMarkdownCodeBlockProcessor('tiny-graph', (source, el, ctx) => {
      el.addClass('tiny-graph-block');
      this.renderBlock(source, el, ctx);
    });

    this.addSettingTab(new TinyGraphSettingTab(this.app, this));

    this.addCommand({
      id: 'insert-tiny-graph-block',
      name: 'Insert tiny-graph block',
      editorCallback: (editor) => {
        const snippet = '```tiny-graph\n# folder: Projects/Alpha   (optional override)\n# mode: filtered     # or manual\n# target: "[[Note]]"\n# exclude: ["[[Private]]"]\n# nodes: ["[[A]]", "[[B]]"]\n\n```';
        editor.replaceSelection(snippet);
      },
    });
  }

  private async renderBlock(source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
    const opts = parseOptions(source);
    const container = document.createElement('div');
    el.appendChild(container);

    if (opts.error) {
      const err = document.createElement('div');
      err.className = 'tiny-graph-error';
      err.textContent = 'tiny-graph: ' + opts.error;
      container.appendChild(err);
      return;
    }

    try {
      const data = await buildGraphData(this.app, ctx.sourcePath, opts);
      // Single fixed height only (user requirement: no height parameter, one size, simple)
      const renderer = new TinyGraphRenderer(container, data, {
        onNodeClick: (node: GraphNode) => {
          // Prefer opening in the leaf that contains the current view when possible
          const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf
            || this.app.workspace.getMostRecentLeaf()
            || this.app.workspace.getLeaf();
          if (node.file) {
            activeLeaf?.openFile(node.file as TFile);
          } else {
            this.app.workspace.openLinkText(node.label, ctx.sourcePath);
          }
        },
      });
      this.renderers.add(renderer);
    } catch (e) {
      const err = document.createElement('div');
      err.className = 'tiny-graph-error';
      err.textContent = 'tiny-graph render error';
      container.appendChild(err);
    }
  }

  onunload() {
    for (const r of this.renderers) r.destroy();
    this.renderers.clear();
  }
}
