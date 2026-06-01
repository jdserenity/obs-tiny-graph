import { GraphNode } from './types';

export interface LabelPlacement {
  id: string;
  text: string;
  textX: number;
  textY: number;
  align: CanvasTextAlign;
  box: { x: number; y: number; w: number; h: number };
  isCenter: boolean;
  nodeX: number;
  nodeY: number;
  nodeR: number;
}

const FONT = '500 10px ui-sans-serif, system-ui, -apple-system, sans-serif';
const LINE_H = 14;
const PAD_X = 5;
const PAD_Y = 3;

function measure(ctx: CanvasRenderingContext2D, text: string) {
  const w = ctx.measureText(text).width;
  return { w: w + PAD_X * 2, h: LINE_H + PAD_Y };
}

function boxesOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function truncate(label: string, maxLen: number) {
  return label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label;
}

/** Place labels in screen space; center note label sits below the hub node. */
export function layoutLabels(
  ctx: CanvasRenderingContext2D,
  nodes: GraphNode[],
  screenPos: Map<string, { x: number; y: number; r: number }>,
  gcScreen: { x: number; y: number },
  hoverId: string | null,
  connected: Set<string>,
): LabelPlacement[] {
  ctx.font = FONT;
  const showAll = nodes.length <= 14;
  const items: { node: GraphNode; sx: number; sy: number; r: number; text: string; angle: number }[] = [];

  for (const node of nodes) {
    const sp = screenPos.get(node.id);
    if (!sp) continue;
    const isCenter = !!node.isCenter;
    const isHover = node.id === hoverId;
    if (!showAll && !isCenter && !isHover && !connected.has(node.id)) continue;

    const text = truncate(node.label, isCenter ? 28 : 22);
    let angle = Math.atan2(sp.y - gcScreen.y, sp.x - gcScreen.x);
    if (isCenter) angle = Math.PI / 2;
    items.push({ node, sx: sp.x, sy: sp.y, r: sp.r, text, angle });
  }

  items.sort((a, b) => a.angle - b.angle);

  const placed: LabelPlacement[] = [];
  const boxes: { x: number; y: number; w: number; h: number }[] = [];

  for (const it of items) {
    const isCenter = !!it.node.isCenter;
    let dist = it.r + (isCenter ? 16 : 22);
    const cos = Math.cos(it.angle), sin = Math.sin(it.angle);
    let align: CanvasTextAlign = 'center';
    let textX = 0, textY = 0, box = { x: 0, y: 0, w: 0, h: 0 };

    for (let attempt = 0; attempt < 14; attempt++) {
      const ax = it.sx + cos * dist;
      const ay = it.sy + sin * dist;
      const m = measure(ctx, it.text);

      if (isCenter) {
        textX = it.sx;
        textY = ay + m.h / 2;
        box = { x: textX - m.w / 2, y: ay, w: m.w, h: m.h };
        align = 'center';
      } else {
        align = cos >= 0 ? 'left' : 'right';
        textX = ax + (cos >= 0 ? PAD_X : -PAD_X);
        textY = ay;
        box = { x: cos >= 0 ? ax : ax - m.w, y: ay - m.h / 2, w: m.w, h: m.h };
      }

      const nodePad = 6;
      const nodeBox = { x: it.sx - it.r - nodePad, y: it.sy - it.r - nodePad, w: (it.r + nodePad) * 2, h: (it.r + nodePad) * 2 };
      let hit = boxesOverlap(box, nodeBox);
      for (const b of boxes) { if (boxesOverlap(box, b)) { hit = true; break; } }

      if (!hit) break;
      dist += 11;
    }

    boxes.push(box);
    placed.push({
      id: it.node.id,
      text: it.text,
      textX,
      textY,
      align,
      box,
      isCenter,
      nodeX: it.sx,
      nodeY: it.sy,
      nodeR: it.r,
    });
  }

  placed.sort((a, b) => (a.isCenter ? 1 : 0) - (b.isCenter ? 1 : 0));
  return placed;
}
