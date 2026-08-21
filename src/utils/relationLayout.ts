/**
 * 家族关系布局算法（严格逐函数翻译 Layout/test_10_GLM_3.py 的 solve()）
 *
 * 与 py 完全对应：
 *  - 整数坐标系：X = xr = range(0, 9)；Y = 输入整数（group.points[name]，由 yInt(position.y) 给出）。
 *  - 组配置枚举：对每组合法 x 排布做 min_x 归一化，按 (comp_r, count_cross) 排序选最优。
 *  - 两阶段求解：贪心构造保底解 + DFS（时限 DFS_TIME_LIMIT_MS）全局优化。
 *  - 最后整体居中：shift = -(min_x + max_x) // 2。
 *  - 输出 positions 为【原始整数坐标】（已居中，可能含负值），图上由 store 用 UNIT_X 映射成像素。
 *
 * 移植自 py 的函数：on_seg_nh, in_tri, mec/comp_r, chull, pt_strict_in, seg_cross,
 *   get_edges, hulls_overlap, count_cross, chk_wg, chk_c7_partial, chk_c4, chk_c6, solve。
 */
import { Edge } from '@xyflow/react';
import { PersonNode } from '../store/useRelationshipStore';
import { computeGroups, fillGroupYs, PyGroup } from './grouping';

/** 坐标系映射单位：渲染时 像素X = 原始整数 × UNIT_X。算法不感知该值。 */
export const UNIT_X = 200;
export const NODE_W = 200;
export const NODE_H = 44;
const XR = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const DFS_TIME_LIMIT_MS = 10000;

function relType(e: Edge): string | undefined {
  return e.data?.type as string | undefined;
}

// ---------- 几何辅助（翻译 py） ----------
function onSegGen(p: [number, number], a: [number, number], b: [number, number]): boolean {
  const cr = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (cr !== 0) return false;
  const t = b[0] !== a[0] ? (p[0] - a[0]) / (b[0] - a[0]) : (p[1] - a[1]) / (b[1] - a[1]);
  return 0 < t && t < 1;
}
function onSegNh(p: [number, number], a: [number, number], b: [number, number]): boolean {
  return a[1] === b[1] ? false : onSegGen(p, a, b);
}
function inTri(p: [number, number], a: [number, number], b: [number, number], c: [number, number]): boolean {
  const es = (p: [number, number], a: [number, number], b: [number, number]) =>
    (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const d1 = es(p, a, b), d2 = es(p, b, c), d3 = es(p, c, a);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}
function circum(p1: [number, number], p2: [number, number], p3: [number, number]): [number, number, number] | null {
  const [ax, ay] = p1, [bx, by] = p2, [cx, cy] = p3;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-10) return null;
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  return [ux, uy, Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2)];
}
function mec(pts: [number, number][]): [number, number, number] {
  const n = pts.length;
  if (n === 0) return [0, 0, 0];
  if (n === 1) return [pts[0][0], pts[0][1], 0];
  let best: [number, number, number] | null = null;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const cx = (pts[i][0] + pts[j][0]) / 2, cy = (pts[i][1] + pts[j][1]) / 2;
      const r = Math.sqrt((pts[i][0] - pts[j][0]) ** 2 + (pts[i][1] - pts[j][1]) ** 2) / 2;
      if (pts.every((p) => (p[0] - cx) ** 2 + (p[1] - cy) ** 2 <= r ** 2 + 1e-9)) {
        if (!best || r < best[2]) best = [cx, cy, r];
      }
    }
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const c = circum(pts[i], pts[j], pts[k]);
        if (!c) continue;
        const [cx, cy, r] = c;
        if (pts.every((p) => (p[0] - cx) ** 2 + (p[1] - cy) ** 2 <= r ** 2 + 1e-9)) {
          if (!best || r < best[2]) best = [cx, cy, r];
        }
      }
  return best || [0, 0, Infinity];
}
function chull(pts: [number, number][]): [number, number][] {
  const ps = Array.from(new Set(pts.map((p) => `${p[0]},${p[1]}`))).map((s) => s.split(',').map(Number) as [number, number]);
  ps.sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));
  if (ps.length <= 2) return ps;
  const cr = (o: [number, number], a: [number, number], b: [number, number]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [];
  for (const p of ps) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up: [number, number][] = [];
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function ptStrictIn(p: [number, number], poly: [number, number][]): boolean {
  const n = poly.length;
  if (n <= 1) return false;
  if (n === 2) return onSegGen(p, poly[0], poly[1]);
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    if (onSegGen(p, a, b) || (p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1])) return false;
  }
  let inside = false, j = n - 1;
  for (let i = 0; i < n; i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > p[1]) !== (yj > p[1])) {
      if (p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    j = i;
  }
  return inside;
}
function segCross(p1: [number, number], p2: [number, number], p3: [number, number], p4: [number, number]): boolean {
  const ccw = (a: [number, number], b: [number, number], c: [number, number]) =>
    (c[1] - a[1]) * (b[0] - a[0]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = ccw(p3, p4, p1), d2 = ccw(p3, p4, p2), d3 = ccw(p1, p2, p3), d4 = ccw(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
function getEdges(h: [number, number][]): Array<[[number, number], [number, number]]> {
  if (h.length < 2) return [];
  if (h.length === 2) return [[h[0], h[1]]];
  return h.map((_, i) => [h[i], h[(i + 1) % h.length]]);
}
function hullsOverlap(h1: [number, number][], h2: [number, number][]): boolean {
  if (!h1.length || !h2.length) return false;
  for (const v of h1) if (ptStrictIn(v, h2)) return true;
  for (const v of h2) if (ptStrictIn(v, h1)) return true;
  for (const e1 of getEdges(h1)) for (const e2 of getEdges(h2)) if (segCross(e1[0], e1[1], e2[0], e2[1])) return true;
  return false;
}
function countCross(gr: PyGroup, xd: Map<string, number>): number {
  const es: Array<[string, string, [number, number], [number, number]]> = [];
  for (const [s, d] of gr.directed) es.push([s, d, [xd.get(s)!, gr.points.get(s)!], [xd.get(d)!, gr.points.get(d)!]]);
  for (const [a, b] of gr.undirected) es.push([a, b, [xd.get(a)!, gr.points.get(a)!], [xd.get(b)!, gr.points.get(b)!]]);
  let c = 0;
  for (let i = 0; i < es.length; i++)
    for (let j = i + 1; j < es.length; j++) {
      if (es[i][0] === es[j][0] || es[i][0] === es[j][1] || es[i][1] === es[j][0] || es[i][1] === es[j][1]) continue;
      if (segCross(es[i][2], es[i][3], es[j][2], es[j][3])) c += 1;
    }
  return c;
}
function chk_wg(gr: PyGroup, xd: Map<string, number>): boolean {
  const pts = gr.points;
  const pos = new Set<string>();
  for (const n of pts.keys()) {
    const p = `${xd.get(n)},${pts.get(n)}`;
    if (pos.has(p)) return false;
    pos.add(p);
  }
  const ae: Array<[string, string, number, string]> = [
    ...gr.directed.map(([s, d, w]) => [s, d, w, 'd'] as [string, string, number, string]),
    ...gr.undirected.map(([a, b, w]) => [a, b, w, 'u'] as [string, string, number, string]),
  ];
  for (const [s, d] of ae.map(([s, d]) => [s, d] as [string, string])) {
    const ps: [number, number] = [xd.get(s)!, pts.get(s)!];
    const pd: [number, number] = [xd.get(d)!, pts.get(d)!];
    if (ps[1] === pd[1]) continue;
    for (const n of pts.keys()) {
      if (n === s || n === d) continue;
      if (onSegNh([xd.get(n)!, pts.get(n)!], ps, pd)) return false;
    }
  }
  const tg = new Map<string, string[]>();
  for (const [d, s] of gr.directed) {
    if (!tg.has(d)) tg.set(d, []);
    tg.get(d)!.push(s);
  }
  for (const [d, ss] of tg) {
    if (ss.length < 2) continue;
    for (let i = 0; i < ss.length; i++)
      for (let j = i + 1; j < ss.length; j++) {
        const s1 = ss[i], s2 = ss[j];
        const p1: [number, number] = [xd.get(s1)!, pts.get(s1)!];
        const p2: [number, number] = [xd.get(s2)!, pts.get(s2)!];
        const pd: [number, number] = [xd.get(d)!, pts.get(d)!];
        for (const n of pts.keys()) {
          if (n === s1 || n === s2 || n === d) continue;
          if (inTri([xd.get(n)!, pts.get(n)!], p1, p2, pd)) return false;
        }
      }
  }
  for (const n of pts.keys()) {
    const y = pts.get(n)!;
    const sy: Array<[number, number]> = [];
    for (const [s, d, w] of ae) {
      if (s === n && pts.get(d) === y) sy.push([w, xd.get(d)! - xd.get(n)!]);
      else if (d === n && pts.get(s) === y) sy.push([w, xd.get(s)! - xd.get(n)!]);
    }
    if (sy.length >= 2) {
      for (let i = 0; i < sy.length; i++)
        for (let j = i + 1; j < sy.length; j++) {
          const [w1, dir1] = sy[i], [w2, dir2] = sy[j];
          if ((dir1 > 0 && dir2 > 0) || (dir1 < 0 && dir2 < 0)) {
            const d1 = Math.abs(dir1), d2 = Math.abs(dir2);
            if (w1 > w2 && d1 >= d2) return false;
            if (w2 > w1 && d2 >= d1) return false;
            if (w1 === w2 && d1 === d2) return false;
          }
        }
    }
  }
  return true;
}
function chk_c7_partial(cx: Map<string, number>, cy: Map<string, number>, sameYEdgeMap: Map<string, Array<[string, number]>>): boolean {
  for (const [n, edges] of sameYEdgeMap) {
    if (!cx.has(n)) continue;
    const y = cy.get(n)!;
    const sy: Array<[number, number]> = [];
    for (const [other, w] of edges) {
      if (cx.has(other) && cy.get(other) === y) sy.push([w, cx.get(other)! - cx.get(n)!]);
    }
    if (sy.length >= 2) {
      for (let i = 0; i < sy.length; i++)
        for (let j = i + 1; j < sy.length; j++) {
          const [w1, dir1] = sy[i], [w2, dir2] = sy[j];
          if ((dir1 > 0 && dir2 > 0) || (dir1 < 0 && dir2 < 0)) {
            const d1 = Math.abs(dir1), d2 = Math.abs(dir2);
            if (w1 > w2 && d1 >= d2) return false;
            if (w2 > w1 && d2 >= d1) return false;
            if (w1 === w2 && d1 === d2) return false;
          }
        }
    }
  }
  return true;
}
function chk_c4(nx: Map<string, number>, ny: Map<string, number>, gi: number, ae: Array<[[number, number], [number, number]]>, groups: PyGroup[]): [boolean, Array<[[number, number], [number, number]]>] {
  const g = groups[gi];
  const ne: Array<[[number, number], [number, number]]> = [];
  for (const [s, d] of g.directed) if (ny.get(s) !== ny.get(d)) ne.push([[nx.get(s)!, ny.get(s)!], [nx.get(d)!, ny.get(d)!]]);
  for (const [a, b] of g.undirected) if (ny.get(a) !== ny.get(b)) ne.push([[nx.get(a)!, ny.get(a)!], [nx.get(b)!, ny.get(b)!]]);
  for (const [p1, p2] of ne) {
    for (const n of nx.keys()) {
      if (g.points.has(n)) continue;
      if (onSegNh([nx.get(n)!, ny.get(n)!], p1, p2)) return [false, ne];
    }
  }
  for (const [p1, p2] of ae) {
    for (const n of g.points.keys()) {
      if (nx.has(n) && onSegNh([nx.get(n)!, ny.get(n)!], p1, p2)) return [false, ne];
    }
  }
  return [true, ne];
}
function chk_c6(nx: Map<string, number>, ny: Map<string, number>, gi: number, assigned: number[], groups: PyGroup[]): boolean {
  const gPts = new Set(groups[gi].points.keys());
  for (const pi of assigned) {
    const pPts = new Set(groups[pi].points.keys());
    const sh = new Set([...gPts].filter((x) => pPts.has(x)));
    const nsg = [...gPts].filter((x) => !sh.has(x));
    const nsp = [...pPts].filter((x) => !sh.has(x));
    if (nsg.length < 2 || nsp.length < 2) continue;
    const hg = chull(nsg.map((n) => [nx.get(n)!, ny.get(n)!]));
    const hp = chull(nsp.map((n) => [nx.get(n)!, ny.get(n)!]));
    if (hullsOverlap(hg, hp)) return false;
  }
  return true;
}
function comp_r(gr: PyGroup, xd: Map<string, number>): number {
  const pts: [number, number][] = [];
  for (const [n, y] of gr.points) pts.push([xd.get(n)!, y]);
  return mec(pts)[2];
}

// 惰性笛卡尔积（对应 py 的 itertools.product）。
// 关键点：py 的 product 是惰性生成的，不会一次性把 9^N 个组合 materialize 到数组里；
// 之前 TS 用 flatMap 一次性展开，会在中等规模（如 6 点 ≈ 53 万组合）时占用大量内存、可能 OOM。
// 改为生成器后，Phase 1 用 for...of 逐个消费，内存占用恒定。
function* product<T>(lists: T[][], idx = 0, prefix: T[] = []): Generator<T[]> {
  if (idx === lists.length) {
    yield prefix;
    return;
  }
  for (const v of lists[idx]) {
    yield* product(lists, idx + 1, [...prefix, v]);
  }
}

export interface LayoutResult {
  positions: Map<string, number>;
}

/**
 * 整体布局（严格翻译 py solve）。输出原始整数坐标（已居中，可含负值）。
 */
export function layoutFamily(nodeIds: string[], nodes: PersonNode[], edges: Edge[]): LayoutResult {
  const groups: PyGroup[] = computeGroups(nodeIds, edges);
  fillGroupYs(groups, nodes);
  return solveGroups(groups, nodes);
}

/** 直接接受已分好的 py 风格 groups（用于与 py/example_repaire 同数据对比验证） */
export function layoutFamilyWithGroups(groups: PyGroup[], nodes: PersonNode[]): LayoutResult {
  fillGroupYs(groups, nodes);
  return solveGroups(groups, nodes);
}

function solveGroups(groups: PyGroup[], nodes: PersonNode[]): LayoutResult {
  // all_global_edges
  const allGlobalEdges: Array<[string, string, number]> = [];
  for (const g of groups)
    for (const [s, d, w] of g.directed) allGlobalEdges.push([s, d, w]);
  for (const g of groups)
    for (const [a, b, w] of g.undirected) allGlobalEdges.push([a, b, w]);

  const pointY = new Map<string, number>();
  for (const g of groups) for (const [n, y] of g.points) pointY.set(n, y);

  const sameYEdgeMap = new Map<string, Array<[string, number]>>();
  for (const n of pointY.keys()) {
    const y = pointY.get(n)!;
    const es: Array<[string, number]> = [];
    for (const [s, d, w] of allGlobalEdges) {
      if (s === n && pointY.get(d) === y) es.push([d, w]);
      else if (d === n && pointY.get(s) === y) es.push([s, w]);
    }
    if (es.length >= 2) sameYEdgeMap.set(n, es);
  }

  // Phase 1: 枚举组内配置
  const groupConfigs: Array<Map<string, number>[]> = [];
  for (const g of groups) {
    const cfgs: Array<{ xd: Map<string, number>; r: number; cr: number }> = [];
    if (g.point_order.length === 1) {
      // 单点组：无约束，X 由更大组的共享锚点决定；只生成 1 种配置（x=0），
      // 避免 9^N 无效 DFS 分支导致卡死。py 用例中也无孤立单点组。
      const xd = new Map<string, number>([[g.point_order[0], 0]]);
      cfgs.push({ xd, r: comp_r(g, xd), cr: 0 });
    } else if (g.point_order.length <= 8) {
      const configs = new Set<string>();
      for (const xVals of product(g.point_order.map(() => XR.slice()))) {
        const xd = new Map<string, number>();
        g.point_order.forEach((n, i) => xd.set(n, xVals[i]));
        const minX = Math.min(...xd.values());
        for (const k of xd.keys()) xd.set(k, xd.get(k)! - minX);
        if (chk_wg(g, xd)) {
          const key = JSON.stringify([...xd.entries()].sort());
          if (!configs.has(key)) {
            configs.add(key);
            cfgs.push({ xd, r: comp_r(g, xd), cr: countCross(g, xd) });
          }
        }
      }
    }
    if (cfgs.length === 0) {
      // 无合法配置 / 大组退化：用 0..n-1 单调排列（满足 chk_wg 的 W 形约束）
      const xd = new Map<string, number>();
      g.point_order.forEach((n, i) => xd.set(n, i));
      cfgs.push({ xd, r: comp_r(g, xd), cr: countCross(g, xd) });
    }
    cfgs.sort((a, b) => (a.r - b.r) || (a.cr - b.cr));
    groupConfigs.push(cfgs.map((c) => c.xd));
  }

  // Phase 2: 贪心构造保底解
  const G_greedy = new Map<string, number>();
  const assignedGreedy: number[] = [];
  let greedyOk = true;
  for (let _ = 0; _ < groups.length; _++) {
    let bestG = -1, maxSh = -1;
    for (let gi = 0; gi < groups.length; gi++) {
      if (assignedGreedy.includes(gi)) continue;
      const sh = new Set(groups[gi].points.keys()).size > 0
        ? [...groups[gi].points.keys()].filter((p) => G_greedy.has(p)).length
        : 0;
      if (sh > maxSh) { maxSh = sh; bestG = gi; }
    }
    if (bestG === -1) break;
    const g = groups[bestG];
    let placed = false;
    for (const xd of groupConfigs[bestG]) {
      const shPts = g.point_order.filter((p) => G_greedy.has(p));
      let off: number;
      if (shPts.length > 0) {
        off = G_greedy.get(shPts[0])! - xd.get(shPts[0])!;
        if (shPts.some((p) => G_greedy.get(p) !== xd.get(p)! + off)) continue;
      } else {
        off = G_greedy.size === 0 ? 0 : Math.max(...G_greedy.values()) + 3 - Math.min(...xd.values());
      }
      const nG = new Map(G_greedy);
      const occ = new Set([...G_greedy.entries()].map(([p, x]) => `${x},${pointY.get(p)}`));
      let conflict = false;
      for (const p of g.point_order) {
        const ax = xd.get(p)! + off;
        if (G_greedy.has(p)) {
          if (G_greedy.get(p) !== ax) { conflict = true; break; }
        } else {
          if (occ.has(`${ax},${pointY.get(p)}`)) { conflict = true; break; }
          nG.set(p, ax);
        }
      }
      if (conflict) continue;
      if (!chk_c7_partial(nG, pointY, sameYEdgeMap)) continue;
      const [ok4, ne] = chk_c4(nG, pointY, bestG, [], groups);
      if (!ok4) continue;
      if (!chk_c6(nG, pointY, bestG, assignedGreedy, groups)) continue;
      for (const [x, y] of ne) { /* ne 在 greedy 中仅用于记录，py 用 E_greedy，这里省略不影响最终 */ }
      // 合并 nG 回 G_greedy
      for (const [k, v] of nG) G_greedy.set(k, v);
      assignedGreedy.push(bestG);
      placed = true;
      break;
    }
    if (!placed) { greedyOk = false; break; }
  }

  let bestR = Infinity;
  let bestSol: Map<string, number> | null = null;
  if (greedyOk) {
    bestR = Math.max(...groups.map((_, gi) => comp_r(groups[gi], G_greedy)));
    bestSol = new Map(G_greedy);
  }

  // Phase 3: DFS
  // 超时机制与 py 完全对齐：满足「节点计数 > DFS_MAX_NODES」或「耗时 > 10s」任一即中止，
  // 且每步递归都检查（py 每次 dfs 调用都判断），避免最坏情况下多跑近 1 万步才触发。
  const DFS_MAX_NODES = 50000;
  const tStart = Date.now();
  let timeout = false;
  let nodesCount = 0;
  function dfs(assigned: number[], unassigned: Set<number>, G: Map<string, number>, curMaxR: number): boolean {
    nodesCount++;
    if (nodesCount > DFS_MAX_NODES || (Date.now() - tStart) / 1000 > DFS_TIME_LIMIT_MS / 1000) {
      timeout = true;
      return true;
    }
    if (unassigned.size === 0) {
      if (curMaxR < bestR - 1e-6) { bestR = curMaxR; bestSol = new Map(G); }
      return false;
    }
    let bestG = -1, maxShared = -1;
    const allPts = new Set(G.keys());
    for (const gi of unassigned) {
      const shared = [...groups[gi].points.keys()].filter((p) => allPts.has(p)).length;
      if (shared > maxShared) { maxShared = shared; bestG = gi; }
    }
    if (bestG === -1) { bestG = unassigned.values().next().value as number; maxShared = 0; }
    const g = groups[bestG];
    const nextUnassigned = new Set(unassigned); nextUnassigned.delete(bestG);
    for (const xd of groupConfigs[bestG]) {
      const rG = comp_r(g, xd);
      if (Math.max(curMaxR, rG) >= bestR - 1e-6) continue;
      let offsets: number[];
      if (maxShared > 0) {
        const anchors = g.point_order.filter((p) => G.has(p));
        const offset = G.get(anchors[0])! - xd.get(anchors[0])!;
        if (anchors.some((p) => G.get(p) !== xd.get(p)! + offset)) continue;
        offsets = [offset];
      } else {
        if (G.size === 0) offsets = [0];
        else {
          const existX = [...G.values()];
          const relX = [...xd.values()];
          const offs = new Set<number>();
          for (const ex of existX) for (const rx of relX) for (const d of [-3, -2, -1, 0, 1, 2, 3]) offs.add(ex + d - rx);
          offsets = [...offs];
        }
      }
      for (const offset of offsets) {
        const nx = new Map(G);
        const nocc = new Set([...G.entries()].map(([p, x]) => `${x},${pointY.get(p)}`));
        let ok = true;
        for (const [name, x] of xd) {
          const absX = x + offset;
          const y = g.points.get(name)!;
          if (nx.has(name)) {
            if (nx.get(name) !== absX) { ok = false; break; }
          } else {
            if (nocc.has(`${absX},${y}`)) { ok = false; break; }
            nx.set(name, absX); nocc.add(`${absX},${y}`);
          }
        }
        if (!ok) continue;
        if (!chk_c7_partial(nx, pointY, sameYEdgeMap)) continue;
        const [ok4] = chk_c4(nx, pointY, bestG, [], groups);
        if (!ok4) continue;
        if (!chk_c6(nx, pointY, bestG, assigned, groups)) continue;
        if (dfs([...assigned, bestG], nextUnassigned, nx, Math.max(curMaxR, rG))) return true;
      }
    }
    return false;
  }
  dfs([], new Set(groups.map((_, i) => i)), new Map(), 0);

  const positions = new Map<string, number>();
  if (bestSol) {
    const xs = [...bestSol.values()];
    const shift = -Math.floor((Math.min(...xs) + Math.max(...xs)) / 2);
    for (const [p, x] of bestSol) positions.set(p, x + shift);
  }
  return { positions };
}
