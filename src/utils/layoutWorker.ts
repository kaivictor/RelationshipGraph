/// <reference lib="webworker" />
// 布局计算 Worker：把开销大的分组 + 枚举/DFS 求解移出主线程，
// 避免大图谱下 DFS 指数搜索阻塞 UI 导致浏览器"卡死"。
import { layoutFamily } from './relationLayout';
import type { Edge } from '@xyflow/react';
import type { PersonNode } from '../store/useRelationshipStore';

export interface LayoutRequest {
  nodeIds: string[];
  nodes: PersonNode[];
  edges: Edge[];
}
export interface LayoutResponse {
  positions: [string, number][]; // [id, x]
}

self.onmessage = (ev: MessageEvent<LayoutRequest>) => {
  const { nodeIds, nodes, edges } = ev.data;
  try {
    if (nodeIds.length === 0) {
      (self as unknown as Worker).postMessage({ positions: [] } as LayoutResponse);
      return;
    }
    const res = layoutFamily(nodeIds, nodes, edges);
    const positions: [string, number][] = [];
    res.positions.forEach((v, k) => positions.push([k, v]));
    (self as unknown as Worker).postMessage({ positions } as LayoutResponse);
  } catch (e) {
    // 计算异常时回传空，主线程保留原布局，避免白屏
    (self as unknown as Worker).postMessage({ positions: [] } as LayoutResponse);
    console.error('[layoutWorker] 计算异常', e);
  }
};
