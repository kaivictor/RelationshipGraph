/**
 * 分组算法（严格翻译 Layout/test2.py 的 merge_lists + 1.2 寻找孩子/下级）
 *
 * 与 test2.py 完全对应：
 *  1.1 peer_level：每个节点 + 其所有 spouse（同级），并查集合并 → 若干「同级家庭」分量。
 *  1.2 对每个同级家庭：
 *       - house = 该家庭全体 + 家庭中作为 parent 的子女 → 产出一个 group；
 *       - subordinates = 该家庭全体 + 家庭中作为 siblings 的 other → 产出一个 group。
 *  这样祖父会同时出现在「曾祖组（作为子女）」和「祖父组（作为家长）」，与 example_repaire.md 一致。
 *
 * 另外对 superiors（上下级）关系：test2.py 不处理，但 example_repaire.md 把公司按「每个上级 + 其直接下级」
 * 拆成多个组。为与示例图谱的 py 用例一致，这里也对每个 superior 源点产出「上级 + 直接下级」组。
 *
 * 产出 py 风格 Group：points(name->y整数), point_order[], directed[(a,b,w)], undirected[(a,b,w)]。
 */
import { Edge } from '@xyflow/react';
import { PersonNode } from '../store/useRelationshipStore';

export interface PyGroup {
  points: Map<string, number>; // name -> y 整数
  point_order: string[];
  directed: Array<[string, string, number]>;
  undirected: Array<[string, string, number]>;
}

function relType(e: Edge): string | undefined {
  // 优先 data.type，并回退到顶层 type（兼容旧 persisted 边只有顶层 type 的情况）
  return (e.data?.type as string | undefined) ?? (e.type as string | undefined);
}
function edgeWeight(e: Edge): number {
  const t = relType(e);
  if (t === 'spouse') return 99;
  if (t === 'custom' && e.data?.customLabel === '同学') return 2;
  return 1;
}
/** 与 py 输入一致的 Y 整数：round(position.y / NODE_H) */
const NODE_H = 44;
function yInt(yPx: number): number {
  return Math.round(yPx / NODE_H);
}

class UnionFind {
  parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let r = x;
    while (this.parent.get(r) !== r) r = this.parent.get(r)!;
    let c = x;
    while (this.parent.get(c) !== r) {
      const nxt = this.parent.get(c)!;
      this.parent.set(c, r);
      c = nxt;
    }
    return r;
  }
  union(a: string, b: string): void {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(rb, ra);
  }
}

export function computeGroups(nodeIds: string[], edges: Edge[]): PyGroup[] {
  const yOf = new Map<string, number>();
  // 用节点 position 估算 y（调用方保证已算好 Y）；若缺则 0
  // 注意：yInt 需要 position.y，这里从传入 nodes 获取

  // 收集各关系
  // React 边方向约定（与 py test2.py 的 "from" 字段对应）：
  //   parent-child：source=父母, target=子女
  //   superior-subordinate：默认 source=上级, target=下级；
  //     特例：customLabel="组长" 的边是从自己视角创建的（自己→组长），
  //           此时 source=下级(self), target=上级(组长)，方向需反转。
  const spouses: Edge[] = [];
  const parents: Edge[] = []; // source=父母, target=子女
  const siblings: Edge[] = [];
  const superiors: Array<{ sup: string; sub: string }> = []; // 显式 (上级, 下级)
  const othersUndirected: Edge[] = []; // 同学等无向
  for (const e of edges) {
    const t = relType(e);
    if (t === 'spouse') spouses.push(e);
    else if (t === 'parent-child') parents.push(e);
    else if (t === 'superior-subordinate') {
      // 自己→组长(上级) 为特例：source=下级, target=上级
      const isLeaderEdge = (e.data as any)?.customLabel === '组长';
      const sup = isLeaderEdge ? e.target : e.source;
      const sub = isLeaderEdge ? e.source : e.target;
      superiors.push({ sup, sub });
    }
    else if (t === 'custom' && e.data?.customLabel === '兄弟姐妹') siblings.push(e);
    else if (t === 'custom' && e.data?.customLabel === '同学') othersUndirected.push(e);
  }

  // 1.1 peer_level + 并查集
  const uf = new UnionFind();
  nodeIds.forEach((id) => uf.find(id));
  for (const e of spouses) uf.union(e.source, e.target);

  // peer_level 分量（每个节点 + 其配偶连通后的集合）
  const compOf = new Map<string, string[]>();
  const seenRoot = new Set<string>();
  for (const id of nodeIds) {
    const r = uf.find(id);
    if (!seenRoot.has(r)) {
      seenRoot.add(r);
      compOf.set(r, []);
    }
    compOf.get(r)!.push(id);
  }
  const peerLevels = Array.from(compOf.values());

  const groups: PyGroup[] = [];
  const addGroup = (members: Set<string>, groupEdges: Edge[]) => {
    if (members.size === 0) return;
    const points = new Map<string, number>();
    const point_order: string[] = [];
    for (const id of members) {
      // y 整数在外部设；这里先占位，调用方后续补 y（见 computeGroupsWithY）
      point_order.push(id);
    }
    const directed: Array<[string, string, number]> = [];
    const undirected: Array<[string, string, number]> = [];
    for (const e of groupEdges) {
      const t = relType(e);
      if (t === 'parent-child' || t === 'superior-subordinate') {
        directed.push([e.source, e.target, edgeWeight(e)]);
      } else {
        const a = e.source < e.target ? e.source : e.target;
        const b = e.source < e.target ? e.target : e.source;
        undirected.push([a, b, edgeWeight(e)]);
      }
    }
    groups.push({ points, point_order, directed, undirected });
  };

  // 1.2 每个 peer_level 家庭 → house(含 parent 子女) 组 + subordinates(含 superiors 下级) 组
  // 严格对应 py test2.py：house 用 parent 边、subordinates 用 superiors 边（不再用 siblings 边）
  for (const fam of peerLevels) {
    const famSet = new Set(fam);
    // house：家庭 + 家庭中作为 parent 的子女
    const house = new Set(fam);
    const houseEdges: Edge[] = [];
    for (const e of spouses) if (famSet.has(e.source) && famSet.has(e.target)) houseEdges.push(e);
    for (const e of parents) if (famSet.has(e.source)) { house.add(e.target); houseEdges.push(e); }
    addGroup(house, houseEdges);

    // subordinates：家庭 + 家庭中作为 superiors(上级) 的 directly 下级
    // 只有当前家庭含该【上级 sup】时才把【下级 sub】纳入
    const sub = new Set(fam);
    const subEdges: Edge[] = [];
    for (const e of spouses) if (famSet.has(e.source) && famSet.has(e.target)) subEdges.push(e);
    for (const { sup, sub: subNode } of superiors) {
      if (famSet.has(sup)) {
        sub.add(subNode);
        // 构造有向边（上级→下级），与 py input_src 方向一致
        subEdges.push({ id: `sup-${sup}-${subNode}`, source: sup, target: subNode, data: { type: 'superior-subordinate' } } as Edge);
      }
    }
    // 仅当 superiors 产生新成员才加（避免与 house 重复）
    if (sub.size > famSet.size) addGroup(sub, subEdges);
  }

  return groups;
}

/** 给 groups 补全 y 整数（py 风格） */
export function fillGroupYs(groups: PyGroup[], nodes: PersonNode[]): void {
  // 优先使用 py 代序整数 Y（data.genY），与 Layout/example_repaire.md / test2.py 体系一致；
  // 缺省时回退为按出生年月量化（round(position.y / NODE_H)）。
  const yById = new Map(
    nodes.map((n) => [n.id, typeof (n.data as any)?.genY === 'number' ? (n.data as any).genY : yInt(n.position.y)])
  );
  for (const g of groups) {
    for (const id of g.point_order) {
      if (!g.points.has(id)) g.points.set(id, yById.get(id) ?? 0);
    }
  }
}
