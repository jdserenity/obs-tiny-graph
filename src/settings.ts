import { App, PluginSettingTab, Setting } from 'obsidian';
import TinyGraphPlugin from './main';

export class TinyGraphSettingTab extends PluginSettingTab {
  plugin: TinyGraphPlugin;

  constructor(app: App, plugin: TinyGraphPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Tiny Graph' });

    const intro = containerEl.createDiv();
    intro.innerHTML = `
      <p>Tiny Graph lets you embed compact interactive graphs anywhere in a note using a code block.</p>
      <p><strong>Just write this</strong> and it shows the graph for the folder the note lives in:</p>
    `;

    const ex1 = containerEl.createEl('pre');
    ex1.textContent = '```tiny-graph\n```';

    containerEl.createEl('p', { text: 'Other examples:' });

    const ex2 = containerEl.createEl('pre');
    ex2.textContent = '```tiny-graph\n# (no options needed — uses the folder of this note automatically)\n```';

    const ex3 = containerEl.createEl('pre');
    ex3.textContent = '```tiny-graph\nmode: filtered\ntarget: "[[Some Note]]"\nexclude: ["[[Private]]"]\n```';

    const ex4 = containerEl.createEl('pre');
    ex4.textContent = '```tiny-graph\nmode: manual\nnodes:\n  - "[[Concept A]]"\n  - "[[Concept B]]"\n```';

    containerEl.createEl('h3', { text: 'Options (YAML inside the block)' });

    new Setting(containerEl)
      .setName('mode')
      .setDesc('Use "filtered" or "manual". Omit the key entirely for the default (graph of the folder this note lives in).');

    new Setting(containerEl)
      .setName('target / nodes / exclude')
      .setDesc('See the README for the full list and syntax. [[wikilinks]] are accepted. There is no height or folder parameter — the graph is always sized the same and uses the current note\'s folder.');

    const tip = containerEl.createDiv({ cls: 'mod-muted' });
    tip.innerHTML = `
      <p>Use the command <strong>"Insert tiny-graph block"</strong> (Command Palette) to paste a ready-made example.</p>
      <p>Drag the graph with your mouse to pan around. Double-click to reset the view. The size is fixed and the folder always comes from the note the block is placed in.</p>
    `;
  }
}
