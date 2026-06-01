import { describe, it, expect } from 'vitest';
import { layoutLabels } from '../src/labels';

function mockCtx() {
  return {
    font: '',
    measureText(text: string) {
      return { width: text.length * 6.5 };
    },
  } as unknown as CanvasRenderingContext2D;
}

function boxesOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe('layoutLabels', () => {
  it('places center label below hub without overlapping a right neighbor label', () => {
    const ctx = mockCtx();
    const nodes = [
      { id: 'c', label: 'Center Note', isCenter: true, file: null },
      { id: 'r', label: 'Right', file: null },
    ];
    const screenPos = new Map([
      ['c', { x: 200, y: 90, r: 9 }],
      ['r', { x: 260, y: 90, r: 5 }],
    ]);
    const labels = layoutLabels(ctx, nodes, screenPos, { x: 200, y: 90 }, null, new Set());
    const center = labels.find(l => l.isCenter)!;
    const right = labels.find(l => l.id === 'r')!;
    expect(center.box.y).toBeGreaterThan(90);
    expect(boxesOverlap(center.box, right.box)).toBe(false);
  });
});
