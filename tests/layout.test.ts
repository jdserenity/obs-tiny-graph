import { describe, it, expect } from 'vitest';
import { computeLayout } from '../src/layout';

describe('computeLayout', () => {
  it('pins center node at canvas middle', () => {
    const nodes = [
      { id: 'a', isCenter: true },
      { id: 'b' },
      { id: 'c' },
    ];
    const links = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
    ];
    const pos = computeLayout(nodes, links, 400, 180);
    const center = pos.get('a')!;
    expect(center.x).toBeCloseTo(200, 0);
    expect(center.y).toBeCloseTo(90, 0);
    const b = pos.get('b')!, c = pos.get('c')!;
    expect(Math.hypot(b.x - center.x, b.y - center.y)).toBeGreaterThan(20);
    expect(Math.hypot(c.x - center.x, c.y - center.y)).toBeGreaterThan(20);
  });

  it('spreads unlinked nodes instead of collapsing', () => {
    const nodes = [{ id: 'x' }, { id: 'y' }, { id: 'z' }];
    const pos = computeLayout(nodes, [], 320, 180);
    const xs = [...pos.values()].map(p => p.x);
    const spread = Math.max(...xs) - Math.min(...xs);
    expect(spread).toBeGreaterThan(40);
  });
});
