export interface LayoutNode { id: string; isCenter?: boolean; }
export interface LayoutLink { source: string; target: string; }

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24); }
  return (h >>> 0) / 0xffffffff;
}

/** Force-directed layout tuned for small inline graphs; center node stays fixed at middle. */
export function computeLayout(
  nodes: LayoutNode[],
  links: LayoutLink[],
  width: number,
  height: number,
): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const n = nodes.length;
  if (n === 0) return pos;

  const cx = width / 2, cy = height / 2;
  const pad = 28;
  const minDim = Math.min(width - pad * 2, height - pad * 2);
  const ringR = Math.max(36, minDim * 0.38);

  nodes.forEach((node, i) => {
    const t = hash(node.id) * Math.PI * 2 + (i / Math.max(1, n)) * Math.PI * 2;
    pos.set(node.id, {
      x: cx + Math.cos(t) * ringR * (0.85 + hash(node.id + 'r') * 0.3),
      y: cy + Math.sin(t) * ringR * (0.85 + hash(node.id + 'y') * 0.3),
    });
  });

  const center = nodes.find(nd => nd.isCenter);
  if (center) pos.set(center.id, { x: cx, y: cy });

  const centerIds = new Set(nodes.filter(nd => nd.isCenter).map(nd => nd.id));

  const idealLen = Math.max(42, minDim / (Math.sqrt(n) + 0.6));
  const repulse = 520 + n * 40;
  const iters = Math.min(160, 55 + n * 8);

  for (let iter = 0; iter < iters; iter++) {
    const alpha = 1 - iter / iters;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pa = pos.get(nodes[i].id)!, pb = pos.get(nodes[j].id)!;
        let dx = pa.x - pb.x, dy = pa.y - pb.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 1) { dx = (hash(nodes[i].id + nodes[j].id) - 0.5) * 2; dy = (hash(nodes[j].id) - 0.5) * 2; dist = Math.hypot(dx, dy) || 1; }
        const minD = nodes[i].isCenter || nodes[j].isCenter ? 26 : 20;
        const force = (repulse * alpha) / (dist * dist);
        const push = dist < minD ? force * 2.2 : force;
        const fx = (dx / dist) * push, fy = (dy / dist) * push;
        if (!nodes[i].isCenter) { pa.x += fx; pa.y += fy; }
        if (!nodes[j].isCenter) { pb.x -= fx; pb.y -= fy; }
      }
    }

    for (const l of links) {
      const pa = pos.get(l.source), pb = pos.get(l.target);
      if (!pa || !pb) continue;
      let dx = pb.x - pa.x, dy = pb.y - pa.y;
      const dist = Math.hypot(dx, dy) || 1;
      const pull = (dist - idealLen) * 0.12 * alpha;
      const fx = (dx / dist) * pull, fy = (dy / dist) * pull;
      if (!centerIds.has(l.source)) { pa.x += fx; pa.y += fy; }
      if (!centerIds.has(l.target)) { pb.x -= fx; pb.y -= fy; }
    }

    for (const node of nodes) {
      if (node.isCenter) { pos.set(node.id, { x: cx, y: cy }); continue; }
      const p = pos.get(node.id)!;
      p.x += (cx - p.x) * 0.04 * alpha;
      p.y += (cy - p.y) * 0.04 * alpha;
      p.x = Math.max(pad, Math.min(width - pad, p.x));
      p.y = Math.max(pad, Math.min(height - pad, p.y));
    }
  }

  // Fit cluster into viewport (center stays at cx,cy)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pos.values()) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
  const target = minDim * 0.82;
  const scale = Math.min(target / spanX, target / spanY, 1.35);
  if (scale < 0.98 || scale > 1.02) {
    for (const node of nodes) {
      const p = pos.get(node.id)!;
      if (node.isCenter) { pos.set(node.id, { x: cx, y: cy }); continue; }
      p.x = cx + (p.x - cx) * scale;
      p.y = cy + (p.y - cy) * scale;
    }
  }

  return pos;
}
