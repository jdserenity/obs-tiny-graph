import { GraphData, GraphNode } from './types';

export interface RenderOptions {
  onNodeClick?: (node: GraphNode) => void;
}

interface Pos { x: number; y: number; }

// Single fixed height only - no height parameter allowed (user requirement)
const FIXED_HEIGHT = 110;
const NODE_RADIUS = 5;
const LABEL_FONT_SIZE = 9;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
  return (h >>> 0) / 0xffffffff;
}

export class TinyGraphRenderer {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private data: GraphData;
  private opts: RenderOptions;
  private positions = new Map<string, Pos>();
  private hoverId: string | null = null;
  private ro: ResizeObserver | null = null;
  private disposed = false;

  // Pan / drag support (user requirement: ability to drag the graph view)
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  constructor(container: HTMLElement, data: GraphData, opts: RenderOptions = {}) {
    this.container = container;
    this.data = data;
    this.opts = opts;

    this.container.classList.add('tiny-graph-container');
    this.container.style.height = FIXED_HEIGHT + 'px';

    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Canvas 2D not available');
    this.ctx = ctx;

    this.initSize();
    this.runLayout();
    this.draw();

    this.attachEvents();
    this.ro = new ResizeObserver(() => { if (!this.disposed) { this.initSize(); this.draw(); } });
    this.ro.observe(this.container);
  }

  private initSize() {
    const w = Math.max(200, this.container.clientWidth || 320);
    const h = FIXED_HEIGHT;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private getColors() {
    const s = getComputedStyle(document.body);
    return {
      node: s.getPropertyValue('--graph-node').trim() || '#7aa2f7',
      nodeFocused: s.getPropertyValue('--graph-node-focused').trim() || '#a3c4ff',
      line: s.getPropertyValue('--graph-line').trim() || '#6a6a7a',
      text: s.getPropertyValue('--graph-text').trim() || s.getPropertyValue('--text-normal').trim() || '#c8c8c8',
    };
  }

  private runLayout() {
    const nodes = this.data.nodes;
    const links = this.data.links;
    if (nodes.length === 0) return;

    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    const cx = w / 2, cy = h / 2;
    const n = nodes.length;

    // deterministic initial positions
    nodes.forEach((node, i) => {
      const h = hash(node.id + i);
      const angle = h * Math.PI * 2;
      const r = Math.min(w, h) * 0.32 + (i % 3) * 3;
      if (!this.positions.has(node.id)) {
        this.positions.set(node.id, {
          x: cx + Math.cos(angle) * r,
          y: cy + Math.sin(angle) * r * 0.6,
        });
      }
    });

    const pos = this.positions;
    const k = Math.sqrt((w * h) / Math.max(1, n)) * 0.9; // ideal dist
    const iters = Math.min(90, 40 + n * 2);

    for (let iter = 0; iter < iters; iter++) {
      // repulsion
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = nodes[i].id, b = nodes[j].id;
          const pa = pos.get(a)!, pb = pos.get(b)!;
          let dx = pa.x - pb.x, dy = pa.y - pb.y;
          let d2 = dx * dx + dy * dy + 0.01;
          if (d2 < 1) d2 = 1;
          const f = (k * k) / d2;
          const fx = dx * f * 0.6, fy = dy * f * 0.6;
          pa.x += fx; pa.y += fy;
          pb.x -= fx; pb.y -= fy;
        }
      }
      // attraction
      for (const l of links) {
        const pa = pos.get(l.source)!, pb = pos.get(l.target)!;
        if (!pa || !pb) continue;
        let dx = pa.x - pb.x, dy = pa.y - pb.y;
        const d = Math.hypot(dx, dy) + 0.01;
        const f = 0.08 * (d - k);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        pa.x -= fx; pa.y -= fy;
        pb.x += fx; pb.y += fy;
      }
      // gravity + bounds
      for (const p of pos.values()) {
        p.x = p.x * 0.985 + cx * 0.015;
        p.y = p.y * 0.985 + cy * 0.015;
        p.x = Math.max(18, Math.min(w - 18, p.x));
        p.y = Math.max(18, Math.min(h - 14, p.y));
      }
    }
  }

  private draw() {
    const ctx = this.ctx;
    const w = this.canvas.width / (window.devicePixelRatio || 1);
    const h = this.canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);

    const c = this.getColors();
    const pos = this.positions;
    const hover = this.hoverId;
    const px = this.panX;
    const py = this.panY;

    const connected = new Set<string>();
    if (hover) {
      for (const l of this.data.links) {
        if (l.source === hover) connected.add(l.target);
        if (l.target === hover) connected.add(l.source);
      }
    }

    // links (with pan applied)
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 1;
    for (const l of this.data.links) {
      const pa = pos.get(l.source), pb = pos.get(l.target);
      if (!pa || !pb) continue;
      const hl = hover && (l.source === hover || l.target === hover);
      ctx.globalAlpha = hl ? 1 : (hover ? 0.18 : 0.65);
      if (hl) ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.moveTo(pa.x + px, pa.y + py);
      ctx.lineTo(pb.x + px, pb.y + py);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.globalAlpha = 1;

    // nodes (with pan)
    for (const node of this.data.nodes) {
      const p = pos.get(node.id);
      if (!p) continue;
      const sx = p.x + px;
      const sy = p.y + py;
      const isHover = node.id === hover;
      const isConn = connected.has(node.id);
      ctx.fillStyle = (isHover || isConn) ? c.nodeFocused : c.node;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.arc(sx, sy, NODE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isHover || isConn) {
        ctx.strokeStyle = c.nodeFocused;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(sx, sy, NODE_RADIUS + 1.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 0.75;
      }
    }

    // labels
    ctx.fillStyle = c.text;
    ctx.font = `${LABEL_FONT_SIZE}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const node of this.data.nodes) {
      const p = pos.get(node.id);
      if (!p) continue;
      const isHover = node.id === hover;
      const show = isHover || this.data.nodes.length < 12;
      if (!show) continue;
      let label = node.label;
      if (label.length > 18) label = label.slice(0, 15) + '…';
      const sx = p.x + px;
      const sy = p.y + py;
      const x = sx + NODE_RADIUS + 3;
      const y = sy;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(x - 2, y - LABEL_FONT_SIZE / 2 - 1.5, tw + 4, LABEL_FONT_SIZE + 3);
      ctx.fillStyle = c.text;
      ctx.fillText(label, x, y);
    }
  }

  private attachEvents() {
    const canvas = this.canvas;

    const getLogicalPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const logicalW = this.canvas.width / dpr;
      const logicalH = this.canvas.height / dpr;
      const screenX = ((e.clientX - rect.left) / rect.width) * logicalW;
      const screenY = ((e.clientY - rect.top) / rect.height) * logicalH;
      // Convert screen to world (subtract pan)
      return { x: screenX - this.panX, y: screenY - this.panY };
    };

    const onMove = (e: PointerEvent) => {
      if (this.disposed) return;

      if (this.isDragging) {
        // Drag to pan the view
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const logicalW = this.canvas.width / dpr;
        const logicalH = this.canvas.height / dpr;
        const screenX = ((e.clientX - rect.left) / rect.width) * logicalW;
        const screenY = ((e.clientY - rect.top) / rect.height) * logicalH;

        this.panX += screenX - this.lastPointerX;
        this.panY += screenY - this.lastPointerY;
        this.lastPointerX = screenX;
        this.lastPointerY = screenY;
        this.draw();
        return;
      }

      // Normal hover detection (in world coordinates)
      const { x, y } = getLogicalPos(e);
      let closest: string | null = null;
      let minD = 14;
      for (const node of this.data.nodes) {
        const p = this.positions.get(node.id);
        if (!p) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < minD) { minD = d; closest = node.id; }
      }
      if (closest !== this.hoverId) {
        this.hoverId = closest;
        this.draw();
        canvas.style.cursor = closest ? 'pointer' : (this.isDragging ? 'grabbing' : '');
      }
    };

    const onLeave = () => {
      if (this.disposed) return;
      this.isDragging = false;
      if (this.hoverId !== null) { this.hoverId = null; this.draw(); }
      canvas.style.cursor = '';
    };

    const onDown = (e: PointerEvent) => {
      if (this.disposed) return;
      const { x, y } = getLogicalPos(e);

      // Check if we clicked on a node first (click takes priority over drag start)
      for (const node of this.data.nodes) {
        const p = this.positions.get(node.id);
        if (!p) continue;
        if (Math.hypot(p.x - x, p.y - y) < 13) {
          // Node click will be handled on 'click' event
          return;
        }
      }

      // Start panning
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const logicalW = this.canvas.width / dpr;
      const logicalH = this.canvas.height / dpr;
      this.lastPointerX = ((e.clientX - rect.left) / rect.width) * logicalW;
      this.lastPointerY = ((e.clientY - rect.top) / rect.height) * logicalH;
      this.isDragging = true;
      canvas.style.cursor = 'grabbing';
    };

    const onUp = () => {
      if (this.disposed) return;
      this.isDragging = false;
      canvas.style.cursor = this.hoverId ? 'pointer' : '';
    };

    const onClick = (e: PointerEvent) => {
      if (this.disposed || !this.opts.onNodeClick || this.isDragging) return;
      const { x, y } = getLogicalPos(e);
      for (const node of this.data.nodes) {
        const p = this.positions.get(node.id);
        if (!p) continue;
        if (Math.hypot(p.x - x, p.y - y) < 13) {
          this.opts.onNodeClick(node);
          break;
        }
      }
    };

    // Double click to reset pan (nice usability)
    const onDblClick = () => {
      if (this.disposed) return;
      this.panX = 0;
      this.panY = 0;
      this.draw();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('dblclick', onDblClick);

    (this as any)._handlers = { onMove, onLeave, onClick, onDown, onUp, onDblClick };
  }

  destroy() {
    this.disposed = true;
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    const h = (this as any)._handlers;
    if (h) {
      const c = this.canvas;
      c.removeEventListener('pointerdown', h.onDown);
      c.removeEventListener('pointermove', h.onMove);
      c.removeEventListener('pointerup', h.onUp);
      c.removeEventListener('pointerleave', h.onLeave);
      c.removeEventListener('click', h.onClick);
      c.removeEventListener('dblclick', h.onDblClick);
    }
    this.container.innerHTML = '';
    this.positions.clear();
  }
}
