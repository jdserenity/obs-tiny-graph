import { GraphData, GraphNode } from './types';
import { computeLayout } from './layout';
import { layoutLabels } from './labels';

export interface RenderOptions {
  onNodeClick?: (node: GraphNode) => void;
}

interface Pos { x: number; y: number; }

const FIXED_HEIGHT = 180;
const NODE_RADIUS = 5;
const CENTER_RADIUS = 9;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.8;

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

  private panX = 0;
  private panY = 0;
  private zoom = 1;
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
    this.ro = new ResizeObserver(() => { if (!this.disposed) { this.initSize(); this.runLayout(); this.draw(); } });
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

  private logicalSize() {
    const dpr = window.devicePixelRatio || 1;
    return { w: this.canvas.width / dpr, h: this.canvas.height / dpr };
  }

  private getColors() {
    const s = getComputedStyle(document.body);
    const accent = s.getPropertyValue('--color-accent').trim() || s.getPropertyValue('--interactive-accent').trim();
    return {
      node: s.getPropertyValue('--graph-node').trim() || '#7aa2f7',
      nodeFocused: s.getPropertyValue('--graph-node-focused').trim() || '#a3c4ff',
      line: s.getPropertyValue('--graph-line').trim() || '#6a6a7a',
      text: s.getPropertyValue('--graph-text').trim() || s.getPropertyValue('--text-normal').trim() || '#c8c8c8',
      accent: accent || '#7aa2f7',
      bg: s.getPropertyValue('--background-secondary').trim() || 'rgba(30,30,36,0.65)',
    };
  }

  private runLayout() {
    const { w, h } = this.logicalSize();
    this.positions = computeLayout(this.data.nodes, this.data.links, w, h);
  }

  /** Screen (canvas) coords → layout/world coords */
  private screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.panX) / this.zoom, y: (sy - this.panY) / this.zoom };
  }

  private worldToScreen(wx: number, wy: number) {
    return { x: wx * this.zoom + this.panX, y: wy * this.zoom + this.panY };
  }

  private centerOfGraph(): Pos {
    const { w, h } = this.logicalSize();
    const center = this.data.nodes.find(n => n.isCenter);
    if (center) {
      const p = this.positions.get(center.id);
      if (p) return p;
    }
    let sx = 0, sy = 0, c = 0;
    for (const p of this.positions.values()) { sx += p.x; sy += p.y; c++; }
    return c ? { x: sx / c, y: sy / c } : { x: w / 2, y: h / 2 };
  }

  private resetView() {
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
  }

  private draw() {
    const ctx = this.ctx;
    const { w, h } = this.logicalSize();
    ctx.clearRect(0, 0, w, h);

    const c = this.getColors();
    const pos = this.positions;
    const hover = this.hoverId;
    const gc = this.centerOfGraph();
    const gcScreen = this.worldToScreen(gc.x, gc.y);

    const connected = new Set<string>();
    if (hover) {
      for (const l of this.data.links) {
        if (l.source === hover) connected.add(l.target);
        if (l.target === hover) connected.add(l.source);
      }
    }

    // full-bleed panel (matches code-block bounds — no inner inset border)
    ctx.fillStyle = c.bg;
    ctx.globalAlpha = 0.72;
    roundRect(ctx, 0, 0, w, h, 0);
    ctx.fill();
    ctx.globalAlpha = 1;

    for (const l of this.data.links) {
      const pa = pos.get(l.source), pb = pos.get(l.target);
      if (!pa || !pb) continue;
      const hl = hover && (l.source === hover || l.target === hover);
      const a = this.worldToScreen(pa.x, pa.y);
      const b = this.worldToScreen(pb.x, pb.y);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const bend = Math.min(14, dist * 0.12) * this.zoom;
      const cx = mx - (dy / dist) * bend, cy = my + (dx / dist) * bend;

      ctx.strokeStyle = c.line;
      ctx.lineWidth = (hl ? 2 : 1.25) * Math.max(0.75, this.zoom);
      ctx.globalAlpha = hl ? 0.95 : (hover ? 0.2 : 0.55);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(cx, cy, b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const node of this.data.nodes) {
      const p = pos.get(node.id);
      if (!p) continue;
      const { x: sx, y: sy } = this.worldToScreen(p.x, p.y);
      const isCenter = !!node.isCenter;
      const isHover = node.id === hover;
      const isConn = connected.has(node.id);
      const r = (isCenter ? CENTER_RADIUS : NODE_RADIUS) * Math.max(0.85, Math.min(1.2, this.zoom));
      const fill = isCenter ? c.accent : ((isHover || isConn) ? c.nodeFocused : c.node);

      if (isCenter || isHover) {
        ctx.fillStyle = fill;
        ctx.globalAlpha = isCenter ? 0.35 : 0.28;
        ctx.beginPath();
        ctx.arc(sx, sy, r + 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = fill;
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = isCenter ? 1.25 : 0.85;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (isCenter) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r + 2.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (isHover || isConn) {
        ctx.strokeStyle = c.nodeFocused;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const screenPos = new Map<string, { x: number; y: number; r: number }>();
    for (const node of this.data.nodes) {
      const p = pos.get(node.id);
      if (!p) continue;
      const s = this.worldToScreen(p.x, p.y);
      const r = (node.isCenter ? CENTER_RADIUS : NODE_RADIUS) * Math.max(0.85, Math.min(1.2, this.zoom));
      screenPos.set(node.id, { x: s.x, y: s.y, r });
    }
    const labels = layoutLabels(ctx, this.data.nodes, screenPos, gcScreen, hover, connected);

    ctx.textBaseline = 'middle';
    for (const lb of labels) {
      const dx = lb.textX - lb.nodeX, dy = lb.textY - lb.nodeY;
      const d = Math.hypot(dx, dy) || 1;
      const cos = dx / d, sin = dy / d;
      const edgeX = lb.nodeX + cos * lb.nodeR;
      const edgeY = lb.nodeY + sin * lb.nodeR;
      const anchorX = lb.isCenter ? lb.box.x + lb.box.w / 2 : (lb.align === 'left' ? lb.box.x : lb.box.x + lb.box.w);
      const anchorY = lb.isCenter ? lb.box.y : lb.box.y + lb.box.h / 2;

      ctx.strokeStyle = c.line;
      ctx.lineWidth = 0.75;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(edgeX, edgeY);
      ctx.lineTo(anchorX, anchorY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      roundRect(ctx, lb.box.x, lb.box.y, lb.box.w, lb.box.h, 4);
      ctx.fill();
      ctx.fillStyle = lb.isCenter ? c.accent : c.text;
      ctx.textAlign = lb.align;
      ctx.fillText(lb.text, lb.textX, lb.textY);
    }
    ctx.textAlign = 'left';
  }

  private attachEvents() {
    const canvas = this.canvas;

    const getScreenPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const { w: logicalW, h: logicalH } = this.logicalSize();
      return {
        x: ((e.clientX - rect.left) / rect.width) * logicalW,
        y: ((e.clientY - rect.top) / rect.height) * logicalH,
      };
    };

    const hitRadiusWorld = (node: GraphNode) => (node.isCenter ? CENTER_RADIUS : NODE_RADIUS) + 6;

    const onWheel = (e: WheelEvent) => {
      if (this.disposed) return;
      e.preventDefault();
      e.stopPropagation();
      const { x: sx, y: sy } = getScreenPos(e as unknown as PointerEvent);
      const oldZ = this.zoom;
      const factor = Math.exp(-e.deltaY * 0.0012);
      this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
      const ratio = this.zoom / oldZ;
      this.panX = sx - (sx - this.panX) * ratio;
      this.panY = sy - (sy - this.panY) * ratio;
      this.draw();
    };

    const onMove = (e: PointerEvent) => {
      if (this.disposed) return;

      if (this.isDragging) {
        const { x: screenX, y: screenY } = getScreenPos(e);
        this.panX += screenX - this.lastPointerX;
        this.panY += screenY - this.lastPointerY;
        this.lastPointerX = screenX;
        this.lastPointerY = screenY;
        this.draw();
        return;
      }

      const { x, y } = this.screenToWorld(getScreenPos(e).x, getScreenPos(e).y);
      let closest: string | null = null;
      let minD = 16;
      for (const node of this.data.nodes) {
        const p = this.positions.get(node.id);
        if (!p) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        const hr = hitRadiusWorld(node);
        if (d < Math.min(minD, hr)) { minD = d; closest = node.id; }
      }
      if (closest !== this.hoverId) {
        this.hoverId = closest;
        this.draw();
        canvas.style.cursor = closest ? 'pointer' : 'grab';
      }
    };

    const onLeave = () => {
      if (this.disposed) return;
      this.isDragging = false;
      if (this.hoverId !== null) { this.hoverId = null; this.draw(); }
      canvas.style.cursor = 'grab';
    };

    const onDown = (e: PointerEvent) => {
      if (this.disposed) return;
      const sp = getScreenPos(e);
      const { x, y } = this.screenToWorld(sp.x, sp.y);

      for (const node of this.data.nodes) {
        const p = this.positions.get(node.id);
        if (!p) continue;
        if (Math.hypot(p.x - x, p.y - y) < hitRadiusWorld(node)) return;
      }

      this.lastPointerX = sp.x;
      this.lastPointerY = sp.y;
      this.isDragging = true;
      canvas.style.cursor = 'grabbing';
    };

    const onUp = () => {
      if (this.disposed) return;
      this.isDragging = false;
      canvas.style.cursor = this.hoverId ? 'pointer' : 'grab';
    };

    const onClick = (e: PointerEvent) => {
      if (this.disposed || !this.opts.onNodeClick) return;
      const { x, y } = this.screenToWorld(getScreenPos(e).x, getScreenPos(e).y);
      for (const node of this.data.nodes) {
        const p = this.positions.get(node.id);
        if (!p) continue;
        if (Math.hypot(p.x - x, p.y - y) < hitRadiusWorld(node)) {
          this.opts.onNodeClick(node);
          break;
        }
      }
    };

    const onDblClick = (e: MouseEvent) => {
      if (this.disposed) return;
      e.preventDefault();
      this.resetView();
      this.draw();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('dblclick', onDblClick);

    (this as any)._handlers = { onMove, onLeave, onClick, onDown, onUp, onDblClick, onWheel };
  }

  destroy() {
    this.disposed = true;
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    const h = (this as any)._handlers;
    if (h) {
      const c = this.canvas;
      c.removeEventListener('wheel', h.onWheel);
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (rad <= 0) { ctx.rect(x, y, w, h); ctx.closePath(); return; }
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}
