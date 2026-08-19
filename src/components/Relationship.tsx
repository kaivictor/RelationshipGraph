import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  Panel,
  useReactFlow,
  useViewport,
  useStore,
  useStoreApi,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useShallow } from 'zustand/react/shallow';
import { useRelationshipStore, computeInvisibleNodes, computeCoordinateLines, buildNodeAriaLabelVisible, buildEdgeAriaLabel } from '../store/useRelationshipStore';
import { PersonNodeComponent } from './PersonNode';
import SpouseEdge from './SpouseEdge';
import ParentChildEdge from './ParentChildEdge';
import CustomEdge from './CustomEdge';
import { toPng, toSvg } from 'html-to-image';

// 比较两个 Set<string> 是否含有相同元素（用于拖动期间复用不可见集合引用）
function setEquals(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) {
    if (!b.has(v)) return false;
  }
  return true;
}
import { Download, Upload, Image as ImageIcon, ChevronDown, Undo2, HelpCircle, Spline, X, Plus, Minus, Maximize, Lock, Unlock } from 'lucide-react';
import { parseXlsxFile } from '../utils/xlsxTemplate';
import { exportFile, exportImageFile } from '../utils/nativeExport';
import clsx from 'clsx';
import { tt, useLang } from '../i18n';

const nodeTypes = {
  person: PersonNodeComponent,
};

const edgeTypes = {
  spouse: SpouseEdge,
  'parent-child': ParentChildEdge,
  custom: CustomEdge,
  'superior-subordinate': CustomEdge,
};

export default function Relationship() {
  useLang();
  // 性能优化：原先使用 useRelationshipStore()（无 selector）会订阅整个 store，
  // 导致 viewport / decryptPassword / isDecrypted 等任何状态变化都引发整个画布组件重渲染。
  // 改用 useShallow 精确选取所需字段：仅当这些字段引用变化时才重渲染。
  const {
    nodes,
    edges,
    selectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    setSelectedEdgeId,
    layoutGraph,
    exportData,
    importData,
    importPersonsIncremental,
    connectionMode,
    connectionCustomLabel,
    connectFirstNodeId,
    setConnectionMode,
    clickNodeInConnectMode,
    resetConnectSelection,
    setShowHelpPage,
    setEdgeMenu,
  } = useRelationshipStore(
    useShallow((s) => ({
      nodes: s.nodes,
      edges: s.edges,
      selectedNodeId: s.selectedNodeId,
      onNodesChange: s.onNodesChange,
      onEdgesChange: s.onEdgesChange,
      onConnect: s.onConnect,
      setSelectedNodeId: s.setSelectedNodeId,
      setSelectedEdgeId: s.setSelectedEdgeId,
      layoutGraph: s.layoutGraph,
      exportData: s.exportData,
      importData: s.importData,
      importPersonsIncremental: s.importPersonsIncremental,
      connectionMode: s.connectionMode,
      connectionCustomLabel: s.connectionCustomLabel,
      connectFirstNodeId: s.connectFirstNodeId,
      setConnectionMode: s.setConnectionMode,
      clickNodeInConnectMode: s.clickNodeInConnectMode,
      resetConnectSelection: s.resetConnectSelection,
      setShowHelpPage: s.setShowHelpPage,
      setEdgeMenu: s.setEdgeMenu,
    }))
  );

  const showCanvasHint = useRelationshipStore((s) => s.displaySettings.showCanvasHint);
  const showCoordinateSystem = useRelationshipStore((s) => s.displaySettings.showCoordinateSystem);
  const verticalGapScale = useRelationshipStore((s) => s.displaySettings.verticalGapScale);
  const coordinateLineStep = useRelationshipStore((s) => s.displaySettings.coordinateLineStep);
  const hiddenNodeIds = useRelationshipStore((s) => s.hiddenNodeIds);
  const displaySettings = useRelationshipStore((s) => s.displaySettings);

  // 坐标系横线：与 viewport 同步变换
  const viewport = useViewport();
  const coordinateLines = useMemo(
    () => showCoordinateSystem ? computeCoordinateLines(nodes, verticalGapScale, coordinateLineStep) : [],
    [showCoordinateSystem, nodes, verticalGapScale, coordinateLineStep]
  );

  // 不可见集合 = 隐藏边（桥语义）+ 隐藏节点（割点语义）共同作用下，从"自己"不可达的节点
  // 性能优化：拖动节点时 nodes 引用每帧变化，但「不可见集合」只由拓扑（edges）与
  // hiddenNodeIds 决定，与节点坐标无关。因此这里复用上一次的 Set 引用（内容相等时），
  // 从而让下方 visibleNodes / visibleEdges 在拖动期保持同一数组引用——React Flow 内部对
  // 节点对象做浅比较，坐标未变（或仅被拖节点变化）的节点不会被重复重渲染。
  // 用 ref 保存上一次不可见集合，避免无关变化（如单纯拖动）导致的下游重计算/重渲染
  const prevInvisibleRef = useRef<Set<string> | null>(null);
  const invisibleNodeIds = useMemo(() => {
    const invisible = computeInvisibleNodes(nodes, edges, hiddenNodeIds);
    if (invisible.size === 0) return null;
    // 与上次结果比较，相等则复用旧引用
    if (prevInvisibleRef.current && setEquals(prevInvisibleRef.current, invisible)) {
      return prevInvisibleRef.current;
    }
    prevInvisibleRef.current = invisible;
    return invisible;
  }, [nodes, edges, hiddenNodeIds]);

  // 过滤被隐藏/隐藏的节点和边；已隐藏的边线也不可见
  const visibleNodes = invisibleNodeIds
    ? nodes.filter((n) => !invisibleNodeIds.has(n.id))
    : nodes;
  const visibleEdges = edges.filter(
    (e) =>
      !((e.data as { collapsed?: boolean })?.collapsed) &&
      (!invisibleNodeIds || (!invisibleNodeIds.has(e.source) && !invisibleNodeIds.has(e.target)))
  );

  // 屏幕阅读器标签：为连线生成「两端姓名 + 关系 + 方向」的中文描述，
  // 覆盖 React Flow 默认的英文 "Edge from X to Y"。
  // 性能优化：边在拖动期间引用不变（edges 不变），这里用引用复用：若某条边的
  // id/source/target/data 与上一次完全一致，直接复用上一帧已带 ariaLabel 的对象，
  // 避免每帧 spread 出全新对象导致所有连线重渲染；名字/性别查表走带引用缓存的全局 Map。
  const prevAriaEdgesRef = useRef<Map<string, Edge> | null>(null);
  const visibleEdgesWithAria = useMemo(() => {
    const prev = prevAriaEdgesRef.current;
    const next = visibleEdges.map((e) => {
      const p = prev?.get(e.id);
      if (p && p.source === e.source && p.target === e.target && p.data === e.data) {
        return p; // 完全复用（含 ariaLabel），不重渲染该连线
      }
      return { ...e, ariaLabel: buildEdgeAriaLabel(e) };
    });
    prevAriaEdgesRef.current = new Map(next.map((e) => [e.id, e]));
    return next;
  }, [visibleEdges]);

  // 屏幕阅读器标签：依据「显示开关 + 连线」上下文生成，做到「显示的讲、隐藏的不讲」，并介绍直接关联的人。
  // 同时保留 normalizeNodeData 注入的 ariaRole/domAttributes（覆盖英文 "node" 角色描述）。
  // 关联人中也排除被隐藏（含间接隐藏）的人物，避免读出不可见对象。
  // 性能优化（关键，解决原本 O(V·E) 全量重算卡顿）：
  //   1) 名字/性别查表走带引用缓存的全局 Map（getNodeNameMap / getNodeGenderMap，O(V) 一次构建）。
  //   2) 引用复用：拖动期间只有被拖节点的 position 变化，其余节点的 id/data 引用不变，
  //      因此完全复用上一帧已带 ariaLabel 的节点对象（不重渲染、不重算）；
  //      仅被拖节点用新的 position + 上一帧算好的 ariaLabel（其 data 没变，aria 不变）。
  //      这样把每帧重算成本从「所有节点各遍历全部边 = O(V·E)」降到「仅被拖节点 O(E)」。
  //   3) 仅在真正影响内容的输入（节点集合 / data / displaySettings / 不可见集合）变化时，才全量重算。
  const prevAriaNodesRef = useRef<Map<string, Node<PersonData, string>> | null>(null);
  const visibleNodesWithAria = useMemo(() => {
    const prev = prevAriaNodesRef.current;
    const next = visibleNodes.map((n) => {
      const p = prev?.get(n.id);
      const dataSame = !!p && p.data === n.data;
      const posSame =
        !!p &&
        p.position?.x === n.position?.x &&
        p.position?.y === n.position?.y;
      if (dataSame && posSame) {
        return p; // 完全复用（含 ariaLabel），不重渲染该节点
      }
      if (dataSame && p) {
        // 仅位置变化（被拖动）：复用上一帧已算好的 ariaLabel，仅更新 position
        return { ...n, ariaLabel: (p as Node<PersonData, string> & { ariaLabel?: string }).ariaLabel };
      }
      // 数据/显示/隐藏变化，或首次：完整计算 aria
      return {
        ...n,
        ariaLabel: buildNodeAriaLabelVisible(n.id, n.data, displaySettings, undefined, undefined, invisibleNodeIds),
      };
    });
    prevAriaNodesRef.current = new Map(next.map((n) => [n.id, n]));
    return next;
  }, [visibleNodes, displaySettings, invisibleNodeIds]);



  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlow = useReactFlow();
  const { fitView, setViewport: setRFViewport, zoomIn, zoomOut } = reactFlow;
  // ReactFlow 内部 store：用于感知/切换「Toggle Interactivity」锁状态（不改按钮本身）
  const rfStore = useStoreApi();
  // 画布是否锁定：与 Controls 的锁按钮保持一致（nodesDraggable/nodesConnectable/elementsSelectable 全为 false 即锁定）
  const isCanvasLocked = useStore(
    (s) => !(s.nodesDraggable || s.nodesConnectable || s.elementsSelectable)
  );
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportDataMenu, setShowExportDataMenu] = useState(false);
  // PNG 自定义清晰度
  const [pngQuality, setPngQuality] = useState(2);
  // 导出图片时显示全屏遮罩，遮住 wrapper 尺寸变化的视觉闪烁
  const [isExporting, setIsExporting] = useState(false);
  // 画布容器尺寸（用于坐标系横线覆盖范围）
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = reactFlowWrapper.current;
    if (!el) return;
    const update = () => setWrapperSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // 连线模式：自定义关系称谓输入
  const [customLabelDraft, setCustomLabelDraft] = useState('');
  // 连线模式：下拉菜单显隐
  const [showConnectMenu, setShowConnectMenu] = useState(false);
  // 连线模式：toast 提示
  const [connectToast, setConnectToast] = useState<string | null>(null);
  // 长按多选：计时器与状态
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const { viewport: savedViewport, setViewport } = useRelationshipStore(
    useShallow((s) => ({ viewport: s.viewport, setViewport: s.setViewport }))
  );
  const undo = useRelationshipStore((s) => s.undo);
  const undoStack = useRelationshipStore((s) => s.undoStack);
  const lastUndoLabel = undoStack.length > 0 ? undoStack[undoStack.length - 1].label : '';

  // Initial: 若有持久化的 viewport 则恢复，否则 fitView
  useEffect(() => {
    // 仅在没有持久化 viewport（初始默认 0,0,1）时重新布局
    const hasSavedViewport = savedViewport.x !== 0 || savedViewport.y !== 0 || savedViewport.zoom !== 1;
    if (!hasSavedViewport) {
      layoutGraph();
      setTimeout(() => {
        fitView({ padding: 0.2 });
      }, 100);
    } else {
      setTimeout(() => {
        setRFViewport(savedViewport);
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 监听 viewport 变化（缩放/平移），保存到 store
  const onMoveEnd = useCallback((evt: unknown, vp: { x: number; y: number; zoom: number }) => {
    setViewport(vp);
  }, [setViewport]);

  // 锁定/解锁画布：与 Controls 锁按钮使用同一组内部状态
  const toggleLock = useCallback(() => {
    const s = rfStore.getState();
    const interactive = s.nodesDraggable || s.nodesConnectable || s.elementsSelectable;
    const next = !interactive;
    rfStore.setState({ nodesDraggable: next, nodesConnectable: next, elementsSelectable: next });
  }, [rfStore]);

  // Ctrl/Cmd + Z 撤销（在输入框内不拦截，保留原生撤销）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
        const stack = useRelationshipStore.getState().undoStack;
        if (stack.length === 0) return;
        e.preventDefault();
        useRelationshipStore.getState().undo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // 方向键：画布锁定时选择相邻人物；Ctrl/Cmd+L：锁定/解锁画布
  // （「Toggle Interactivity」锁按钮保持原样，此处仅新增键盘能力，并复用同一内部锁定状态）
  useEffect(() => {
    // 在给定方向上挑选「最正对且最近」的人物节点（基于画布坐标）
    const selectAdjacent = (dir: 'up' | 'down' | 'left' | 'right') => {
      const state = useRelationshipStore.getState();
      const allNodes = state.nodes;
      if (allNodes.length === 0) return;
      // 当前人物：优先使用已选中的节点；否则从「自己」开始
      const currentId =
        state.selectedNodeId ?? allNodes.find((n) => n.data.isSelf)?.id;
      const current = allNodes.find((n) => n.id === currentId);
      if (!current) return;
      const cx = current.position.x;
      const cy = current.position.y;

      let best: (typeof allNodes)[number] | null = null;
      let bestScore = Infinity;
      for (const n of allNodes) {
        if (n.id === currentId) continue;
        const dx = n.position.x - cx;
        const dy = n.position.y - cy;
        let ok = false;
        let main = 0;
        let cross = 0;
        if (dir === 'up') { ok = dy < 0; main = -dy; cross = Math.abs(dx); }
        else if (dir === 'down') { ok = dy > 0; main = dy; cross = Math.abs(dx); }
        else if (dir === 'left') { ok = dx < 0; main = -dx; cross = Math.abs(dy); }
        else { ok = dx > 0; main = dx; cross = Math.abs(dy); }
        if (!ok) continue;
        // 偏好「正对」且「近」的节点：横向偏差权重更高
        const score = cross * 3 + main;
        if (score < bestScore) { bestScore = score; best = n; }
      }
      if (!best) return;

      // 同步选中：更新详情面板 + 高亮节点 + 居中显示（保持当前缩放，仅平移）
      state.setSelectedNodeId(best.id);
      reactFlow.setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === best!.id })));
      const internal = reactFlow.getInternalNode(best.id);
      const nodeW = internal?.measured?.width ?? 200;
      const nodeH = internal?.measured?.height ?? 120;
      const centerX = best.position.x + nodeW / 2;
      const centerY = best.position.y + nodeH / 2;
      const currentZoom = reactFlow.getViewport().zoom;
      reactFlow.setCenter(centerX, centerY, { zoom: currentZoom, duration: 300 });
    };

    // 锁定/解锁画布：复用组件顶层的 toggleLock
    const handler = (e: KeyboardEvent) => {
      // 在输入框/文本域/下拉/可编辑区中不拦截，保留原生行为
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;

      // Ctrl/Cmd + L：锁定 / 解锁画布
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleLock();
        return;
      }

      // Ctrl/Cmd + ↑ / ↓：放大 / 缩小画布
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowUp') { e.preventDefault(); reactFlow.zoomIn({ duration: 200 }); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); reactFlow.zoomOut({ duration: 200 }); return; }
      }

      // 方向键：锁定时用于在人物间导航选择；未锁定时用于微调当前选中节点位置。
      // 未锁定微调完全由 store 的 nudgeSelectedNodes 实现（基于 selectedNodeId + multiSelectedIds），
      // 不再依赖 React Flow 受控的 selected，避免受控场景下「按几下就没变化」。
      // 监听在捕获阶段（capture）执行，未锁定时 stopPropagation 阻止 React Flow 默认 nudge，避免双重移动。
      const s = rfStore.getState();
      const locked = !(s.nodesDraggable || s.nodesConnectable || s.elementsSelectable);

      let dir: 'up' | 'down' | 'left' | 'right' | null = null;
      if (e.key === 'ArrowUp') dir = 'up';
      else if (e.key === 'ArrowDown') dir = 'down';
      else if (e.key === 'ArrowLeft') dir = 'left';
      else if (e.key === 'ArrowRight') dir = 'right';
      if (!dir) return;
      e.preventDefault();

      if (locked) {
        selectAdjacent(dir);
      } else {
        const step = e.shiftKey ? 25 : 5;
        const dx = dir === 'left' ? -step : dir === 'right' ? step : 0;
        const dy = dir === 'up' ? -step : dir === 'down' ? step : 0;
        useRelationshipStore.getState().nudgeSelectedNodes(dx, dy);
        e.stopPropagation();
      }
    };

    // 捕获阶段监听：未锁定微调时可在 React Flow 的 document 监听器之前拦截，避免双重移动。
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [reactFlow, rfStore]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      // 连线模式下：点击节点建立关系，不打开详情面板
      if (connectionMode !== 'off') {
        const result = clickNodeInConnectMode(node.id);
        if (result.connected) {
          setConnectToast(`${tt('已建立关系：')}${result.reason || ''}`);
          setTimeout(() => setConnectToast(null), 1800);
        } else if (result.reason && result.reason !== '取消选择') {
          // 静默
        } else if (result.reason === '取消选择') {
          setConnectToast(tt('已取消选择'));
          setTimeout(() => setConnectToast(null), 1200);
        } else {
          setConnectToast(tt('已选择起点，再点击一个人物完成连线'));
          setTimeout(() => setConnectToast(null), 1800);
        }
        return;
      }
      // 长按多选：长按已在定时器内定稿（toggle + applyMultiSelect），此处忽略随之而来的 click
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        return;
      }
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId, connectionMode, clickNodeInConnectMode]
  );

  // 长按多选：pointerdown 检测
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (connectionMode !== 'off') return; // 连线模式下不触发长按多选
    const target = e.target as HTMLElement;
    const nodeEl = target.closest('.react-flow__node') as HTMLElement | null;
    if (!nodeEl) return;
    const nodeId = nodeEl.getAttribute('data-id');
    if (!nodeId) return;

    longPressStartRef.current = { x: e.clientX, y: e.clientY };
    longPressTriggeredRef.current = false;

    longPressTimerRef.current = window.setTimeout(() => {
      // 长按触发：切换该节点的多选状态（驱动 multiSelectedIds），高亮由 store 直接渲染，
      // 不再依赖 React Flow 的 selected，避免受控场景下多选失效。
      const state = useRelationshipStore.getState();
      state.toggleMultiSelect(nodeId);
      longPressTriggeredRef.current = true;
    }, 500);
  }, [connectionMode]);

  const onPointerUp = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (longPressTimerRef.current !== null && longPressStartRef.current) {
      const dx = e.clientX - longPressStartRef.current.x;
      const dy = e.clientY - longPressStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  const onPaneClick = useCallback(() => {
    // 连线模式下点击空白：取消当前起点
    if (connectionMode !== 'off' && connectFirstNodeId) {
      resetConnectSelection();
      return;
    }
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setEdgeMenu(null);
  }, [setSelectedNodeId, setSelectedEdgeId, connectionMode, connectFirstNodeId, resetConnectSelection]);

  const onEdgeClick = useCallback((event: { stopPropagation: () => void; clientX: number; clientY: number }, edge: { id: string }) => {
    event.stopPropagation();
    // 只打开"关系编辑"面板，不再弹出悬浮菜单。
    // 面板内已包含"断开/恢复/删除关系"按钮，悬浮菜单+遮罩在触屏下会阻挡面板首次滑动。
    setSelectedEdgeId(edge.id);
    setEdgeMenu(null);
  }, [setSelectedEdgeId]);

  // 生成时间戳后缀：YYYYMMDDhhmmss + 4位更精细单位（十分之一秒）
  const timestampSuffix = useCallback(() => {
    const d = new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, '0');
    const base = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    // 4位精细单位：用毫秒补零到4位
    const fine = pad(d.getMilliseconds(), 3) + '0';
    return `${base}${fine}`;
  }, []);

  const handleExportImage = useCallback(async (format: 'png' | 'svg', quality?: number) => {
    setShowExportMenu(false);
    if (reactFlowWrapper.current === null) {
      return;
    }

    setIsExporting(true);
    // 让遮罩先渲染一帧
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    try {
    const filter = (node: HTMLElement) => {
      if (
        node?.classList?.contains('react-flow__minimap') ||
        node?.classList?.contains('react-flow__controls') ||
        node?.classList?.contains('react-flow__panel') ||
        node?.classList?.contains('export-hide')
      ) {
        return false;
      }
      return true;
    };

    const wrapper = reactFlowWrapper.current;

    // 从 store 读取节点位置，计算包围盒（ReactFlow 坐标系）
    const allNodes = useRelationshipStore.getState().nodes;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of allNodes) {
      const w = n.measured?.width ?? n.width ?? 180;
      const h = n.measured?.height ?? n.height ?? 120;
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }

    const padding = 40;
    const hasNodes = allNodes.length > 0 && Number.isFinite(minX);

    if (!hasNodes) {
      // 无节点时直接截图当前视口
      const options = { filter, backgroundColor: '#f9fafb' };
      try {
        const dataUrl = format === 'svg' ? await toSvg(wrapper, options) : await toPng(wrapper, { ...options, pixelRatio: quality ?? 2 });
        const filename = `relationship-${format === 'svg' ? '' : `${quality ?? 2}x-`}${timestampSuffix()}.${format}`;
        await exportImageFile(filename, dataUrl);
      } catch (err) { console.error('Failed to export', err); }
      return;
    }

    const exportWidth = Math.ceil(maxX - minX) + padding * 2;
    const exportHeight = Math.ceil(maxY - minY) + padding * 2;
    // 计算目标 viewport：让包围盒左上角对齐到 (padding, padding)，zoom=1
    const tx = -minX + padding;
    const ty = -minY + padding;

    // 保存当前 viewport 用于恢复
    const prevViewport = useRelationshipStore.getState().viewport;

    // 通过 ReactFlow API 设置 viewport（同步内部状态 + DOM transform）
    setRFViewport({ x: tx, y: ty, zoom: 1 });
    // 等待 React 重渲染完成（viewport 变化触发节点和边的重新计算）
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    // 临时修改 wrapper 真实样式：让容器尺寸=完整画幅，overflow 可见
    // html-to-image 克隆时会复制这些样式，否则 wrapper 的固定尺寸+overflow:hidden 会裁剪内容
    const wrapperStyleBackup = {
      width: wrapper.style.width,
      height: wrapper.style.height,
      minWidth: wrapper.style.minWidth,
      minHeight: wrapper.style.minHeight,
      maxWidth: wrapper.style.maxWidth,
      maxHeight: wrapper.style.maxHeight,
      overflow: wrapper.style.overflow,
      position: wrapper.style.position,
    };
    wrapper.style.width = `${exportWidth}px`;
    wrapper.style.height = `${exportHeight}px`;
    wrapper.style.minWidth = `${exportWidth}px`;
    wrapper.style.minHeight = `${exportHeight}px`;
    wrapper.style.maxWidth = 'none';
    wrapper.style.maxHeight = 'none';
    wrapper.style.overflow = 'visible';
    // inline style 同步生效，不等待 rAF 以避免 ReactFlow ResizeObserver 调整 viewport

    const options = {
      filter,
      backgroundColor: '#f9fafb',
      width: exportWidth,
      height: exportHeight,
      style: {
        width: `${exportWidth}px`,
        height: `${exportHeight}px`,
        overflow: 'visible' as const,
      },
    };

    const restoreAll = () => {
      // 恢复 wrapper 样式
      wrapper.style.width = wrapperStyleBackup.width;
      wrapper.style.height = wrapperStyleBackup.height;
      wrapper.style.minWidth = wrapperStyleBackup.minWidth;
      wrapper.style.minHeight = wrapperStyleBackup.minHeight;
      wrapper.style.maxWidth = wrapperStyleBackup.maxWidth;
      wrapper.style.maxHeight = wrapperStyleBackup.maxHeight;
      wrapper.style.overflow = wrapperStyleBackup.overflow;
      wrapper.style.position = wrapperStyleBackup.position;
      // 恢复原 viewport
      setRFViewport({ x: prevViewport.x, y: prevViewport.y, zoom: prevViewport.zoom });
    };

    try {
      let dataUrl: string;
      if (format === 'svg') {
        dataUrl = await toSvg(wrapper, options);
        await exportImageFile(`relationship-${timestampSuffix()}.svg`, dataUrl);
      } else {
        const pixelRatio = quality && quality > 0 ? quality : 2;
        dataUrl = await toPng(wrapper, { ...options, pixelRatio });
        await exportImageFile(`relationship-${pixelRatio}x-${timestampSuffix()}.png`, dataUrl);
      }
    } catch (err) {
      console.error('Failed to export image', err);
    } finally {
      restoreAll();
    }
    } finally {
      setIsExporting(false);
    }
  }, [setRFViewport, timestampSuffix]);

  const handleExportData = async (format: 'json' | 'xml' | 'csv') => {
    setShowExportDataMenu(false);
    const data = exportData(format);
    const mime = format === 'json' ? 'application/json' : format === 'xml' ? 'application/xml' : 'text/csv';
    const filename = `relationship-data-${timestampSuffix()}.${format}`;
    await exportFile(filename, data, mime);
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    // xlsx 单独处理（增量导入独立人物）
    if (name.endsWith('.xlsx')) {
      try {
        const result = await parseXlsxFile(file);
        if (result.persons.length === 0) {
          alert(`${tt('导入失败：未找到可用数据。')}\n${result.errors.join('\n')}`);
        } else {
          const added = importPersonsIncremental(result.persons);
          let msg = `${tt('成功导入 ')}${added}${tt(' 个独立人物（无关系）。')}`;
          if (result.skipped > 0) msg += `\n${tt('跳过 ')}${result.skipped}${tt(' 行无效数据。')}`;
          if (result.errors.length > 0) msg += `\n\n${tt('详情：')}\n${result.errors.join('\n')}`;
          if (result.detectedCustomColumns.length > 0) {
            msg += `\n\n${tt('检测到自定义列：')}${result.detectedCustomColumns.map((c) => c.label).join(tt('、'))}`;
          }
          alert(msg);
          setTimeout(() => fitView({ padding: 0.2 }), 100);
        }
      } catch (err) {
        console.error('xlsx 导入失败', err);
        alert(tt('xlsx 文件解析失败，请检查文件格式。'));
      }
      event.target.value = '';
      return;
    }

    // json / xml：作为完整数据导入
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        // 自动识别格式：优先扩展名，其次内容首字符
        let format: 'json' | 'xml';
        if (name.endsWith('.xml')) {
          format = 'xml';
        } else if (name.endsWith('.json')) {
          format = 'json';
        } else {
          // 内容嗅探：XML 以 < 开头，JSON 以 { 或 [ 开头
          const trimmed = content.trimStart();
          format = trimmed.startsWith('<') ? 'xml' : 'json';
        }
        importData(content, format);
        setTimeout(() => {
          // 导入数据中可能包含 viewport，恢复它；否则 fitView
          const vp = useRelationshipStore.getState().viewport;
          const hasVp = vp.x !== 0 || vp.y !== 0 || vp.zoom !== 1;
          if (hasVp) setRFViewport(vp);
          else fitView({ padding: 0.2 });
        }, 100);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  return (
    <div
      className="w-full h-full relative"
      ref={reactFlowWrapper}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerUp}
    >
      <ReactFlow
        aria-label={tt('人际关系图谱画布，包含人物节点与亲属关系连线。按 Tab 可在人物间移动，按 Enter 查看详情。')}
        nodes={connectFirstNodeId
          ? visibleNodesWithAria.map((n) => n.id === connectFirstNodeId
            ? { ...n, style: { ...n.style, boxShadow: '0 0 0 3px #2563eb, 0 4px 12px rgba(37,99,235,0.4)' } }
            : n)
          : visibleNodesWithAria}
        edges={visibleEdgesWithAria}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        onMoveEnd={onMoveEnd}
        onInit={() => {
          // 平移层（.react-flow__pane）仅用于鼠标拖拽画布，对屏幕阅读器无意义。
          // 它与节点层（.react-flow__nodes）是兄弟节点，将其隐藏不会影响人物节点被朗读。
          const pane = reactFlowWrapper.current?.querySelector('.react-flow__pane');
          if (pane) {
            pane.setAttribute('aria-hidden', 'true');
            pane.removeAttribute('aria-roledescription');
          }
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 2 } }}
        fitView
        minZoom={0.1}
      >
        <Background color="#ccc" gap={16} />
        <Controls showZoom={false} showFitView={false} showInteractive={false}>
          <ControlButton
            onClick={() => zoomIn({ duration: 200 })}
            title={tt('放大')}
            aria-label={tt('放大')}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </ControlButton>
          <ControlButton
            onClick={() => zoomOut({ duration: 200 })}
            title={tt('缩小')}
            aria-label={tt('缩小')}
          >
            <Minus className="w-3.5 h-3.5" aria-hidden="true" />
          </ControlButton>
          <ControlButton
            onClick={() => fitView({ padding: 0.2 })}
            title={tt('适配视图')}
            aria-label={tt('适配视图')}
          >
            <Maximize className="w-3.5 h-3.5" aria-hidden="true" />
          </ControlButton>
          <ControlButton
            onClick={toggleLock}
            title={isCanvasLocked ? tt('解锁画布') : tt('锁定画布')}
            aria-label={isCanvasLocked ? tt('解锁画布') : tt('锁定画布')}
          >
            {isCanvasLocked ? <Unlock className="w-3.5 h-3.5" aria-hidden="true" /> : <Lock className="w-3.5 h-3.5" aria-hidden="true" />}
          </ControlButton>
          <ControlButton
            onClick={() => useRelationshipStore.getState().updateDisplaySettings({ showCoordinateSystem: !showCoordinateSystem })}
            title={showCoordinateSystem ? tt('隐藏坐标系（按10年为单位显示横线）') : tt('显示坐标系（按10年为单位显示横线）')}
            aria-label={showCoordinateSystem ? tt('隐藏坐标系（按10年为单位显示横线）') : tt('显示坐标系（按10年为单位显示横线）')}
            className={showCoordinateSystem ? 'bg-blue-50 text-blue-600' : ''}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </ControlButton>
        </Controls>
        <MiniMap zoomable pannable aria-hidden="true" />
        
        <Panel position="top-right" className="flex gap-2" role="toolbar" aria-label={tt('画布工具：撤销、整理布局、连线、导出、导入')}>
          <button
            onClick={() => undo()}
            disabled={undoStack.length === 0}
            title={undoStack.length > 0 ? `${tt('撤销：')}${lastUndoLabel}` : tt('没有可撤销的操作')}
            aria-label={undoStack.length > 0 ? `${tt('撤销：')}${lastUndoLabel}` : tt('没有可撤销的操作')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4" aria-hidden="true" />{tt('撤销')}{undoStack.length > 0 && (
              <span className="text-[10px] text-gray-400">({undoStack.length})</span>
            )}
          </button>
          <button
            onClick={() => {
              layoutGraph();
              setTimeout(() => fitView({ padding: 0.2 }), 100);
            }}
            aria-label={tt('整理布局：自动排布所有人物节点')}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
          >{tt('整理布局')}</button>
          {/* 连线模式 */}
          <div className="relative">
            <button
              onClick={() => { setShowConnectMenu(!showConnectMenu); setShowExportMenu(false); setShowExportDataMenu(false); }}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 border rounded-md shadow-sm text-sm font-medium transition-colors',
                connectionMode !== 'off'
                  ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              )}
              title={tt('连线模式：点击两个节点建立关系')}
              aria-label={tt('连线模式：点击两个节点建立关系')}
            >
              <Spline className="w-4 h-4" aria-hidden="true" />{tt('连线模式')}{connectionMode !== 'off' && (
                <span className="text-[10px] bg-white/20 px-1 rounded">
                  {connectionMode === 'auto' ? tt('自动') : connectionMode === 'parent-child' ? tt('父母子女') : connectionMode === 'spouse' ? tt('爱人') : (connectionCustomLabel || tt('其他'))}
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-70" aria-hidden="true" />
            </button>
            {showConnectMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-gray-400">{tt('选择连线模式')}</div>
                {([
                  { key: 'off', label: tt('关闭连线模式'), desc: tt('正常点击查看详情') },
                  { key: 'auto', label: tt('自动'), desc: tt('年龄差>15 父母子女，否则爱人') },
                  { key: 'parent-child', label: tt('父母子女'), desc: tt('A为长辈，B为晚辈') },
                  { key: 'spouse', label: tt('爱人'), desc: tt('不限年龄性别') },
                  { key: 'superior-subordinate', label: tt('上下级'), desc: tt('A为上级，B为下级（有向）') },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setConnectionMode(opt.key);
                      setShowConnectMenu(false);
                      setConnectToast(opt.key === 'off' ? tt('已退出连线模式') : `${tt('已进入「')}${opt.label}${tt('」连线模式，点击两个节点连线')}`);
                      setTimeout(() => setConnectToast(null), 1800);
                    }}
                    className={clsx(
                      'w-full flex flex-col items-start px-3 py-1.5 text-sm transition-colors',
                      connectionMode === opt.key ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[10px] text-gray-400">{opt.desc}</span>
                  </button>
                ))}
                {/* 其他（填写） */}
                <div className="border-t border-gray-100 px-3 py-2">
                  <div className="text-[11px] font-medium text-gray-500 mb-1.5">{tt('其他（填写关系称谓）')}</div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customLabelDraft}
                      onChange={(e) => setCustomLabelDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customLabelDraft.trim()) {
                          setConnectionMode('custom', customLabelDraft.trim());
                          setShowConnectMenu(false);
                          setConnectToast(`${tt('已进入「其他：')}${customLabelDraft.trim()}${tt('」连线模式')}`);
                          setTimeout(() => setConnectToast(null), 1800);
                        }
                      }}
                      placeholder={tt('如：同学、同事、朋友')}
                      className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        if (!customLabelDraft.trim()) return;
                        setConnectionMode('custom', customLabelDraft.trim());
                        setShowConnectMenu(false);
                        setConnectToast(`${tt('已进入「其他：')}${customLabelDraft.trim()}${tt('」连线模式')}`);
                        setTimeout(() => setConnectToast(null), 1800);
                      }}
                      disabled={!customLabelDraft.trim()}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >{tt('确定')}</button>
                  </div>
                </div>
                {connectionMode !== 'off' && (
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => {
                        setConnectionMode('off');
                        setShowConnectMenu(false);
                        setConnectToast(tt('已退出连线模式'));
                        setTimeout(() => setConnectToast(null), 1500);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />{tt('退出连线模式')}</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowExportMenu(!showExportMenu); setShowExportDataMenu(false); }}
              aria-label={tt('导出图片')}
              aria-expanded={showExportMenu}
              aria-haspopup="menu"
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              <ImageIcon className="w-4 h-4" aria-hidden="true" />{tt('导出图片')}<ChevronDown className="w-3 h-3 text-gray-500" aria-hidden="true" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-gray-400">{tt('PNG 清晰度')}</div>
                <div className="px-3 pb-2 space-y-1.5">
                  {[
                    { label: tt('标清'), value: 1, hint: '1x' },
                    { label: tt('高清'), value: 2, hint: '2x' },
                    { label: tt('超清'), value: 4, hint: '4x' },
                    { label: tt('极清'), value: 6, hint: '6x' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleExportImage('png', opt.value)}
                      className={clsx(
                        'w-full flex items-center justify-between px-2 py-1.5 text-sm rounded transition-colors',
                        pngQuality === opt.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <span>{opt.label}</span>
                      <span className="text-xs text-gray-400">{opt.hint}</span>
                    </button>
                  ))}
                  {/* 自定义清晰度输入 */}
                  <div className="flex items-center gap-1 pt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-500 shrink-0">{tt('自定义')}</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      step={1}
                      value={pngQuality}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        if (!isNaN(v) && v >= 1 && v <= 20) setPngQuality(v);
                      }}
                      className="flex-1 w-12 px-1.5 py-1 border border-gray-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">x</span>
                    <button
                      onClick={() => handleExportImage('png', pngQuality)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >{tt('导出')}</button>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">{tt('数值越大越清晰，文件也越大。建议 1-6，过大可能卡顿。')}</p>
                </div>
                <div className="border-t border-gray-100">
                  <button onClick={() => handleExportImage('svg')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{tt('SVG (矢量图)')}</button>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowExportDataMenu(!showExportDataMenu); setShowExportMenu(false); }}
              aria-label={tt('导出数据')}
              aria-expanded={showExportDataMenu}
              aria-haspopup="menu"
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              <Download className="w-4 h-4" aria-hidden="true" />{tt('导出数据')}<ChevronDown className="w-3 h-3 text-gray-500" aria-hidden="true" />
            </button>
            {showExportDataMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                <button onClick={() => handleExportData('json')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{tt('JSON (完整)')}</button>
                <button onClick={() => handleExportData('xml')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{tt('XML (完整)')}</button>
                <button onClick={() => handleExportData('csv')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{tt('CSV (仅人物+关系)')}</button>
              </div>
            )}
          </div>
          <div className="relative">
            <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer">
              <Upload className="w-4 h-4" aria-hidden="true" />{tt('导入数据')}<input type="file" accept=".json,.xml,.xlsx" className="hidden" aria-label={tt('导入数据：选择 JSON、XML 或 Excel 文件')} onChange={(e) => { handleImportData(e); }} />
            </label>
          </div>
          <button
            onClick={() => setShowHelpPage(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
            aria-label={tt('打开帮助页面：查看使用说明、下载 Excel 导入模板')}
            title={tt('打开帮助页面，下载 Excel 导入模板')}
          >
            <HelpCircle className="w-4 h-4" aria-hidden="true" />{tt('帮助')}</button>
        </Panel>
      </ReactFlow>

      {showCoordinateSystem && coordinateLines.length > 0 && wrapperSize.width > 0 && (
        <svg
          aria-hidden="true"
          className="export-hide absolute inset-0 pointer-events-none"
          width={wrapperSize.width}
          height={wrapperSize.height}
          style={{ zIndex: 0 }}
        >
          {coordinateLines.map((line, idx) => {
            // 流坐标系 Y → 屏幕坐标 Y
            const screenY = viewport.y + line.y * viewport.zoom;
            // 跳出可视范围则不渲染（留少量缓冲）
            if (screenY < -50 || screenY > wrapperSize.height + 50) return null;
            return (
              <g key={idx}>
                <line
                  x1={0}
                  y1={screenY}
                  x2={wrapperSize.width}
                  y2={screenY}
                  stroke="#9ca3af"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                />
                <text
                  x={6}
                  y={screenY - 3}
                  fill="#6b7280"
                  fillOpacity={0.6}
                  fontSize={11}
                  style={{ userSelect: 'none' }}
                >
                  {line.year}{tt('年')}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {showCanvasHint && !selectedNodeId && connectionMode === 'off' && (
        <div className="export-hide absolute top-4 left-4 bg-white/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-200 shadow-sm text-sm text-gray-600 pointer-events-none z-10" aria-hidden="true">
          {isCanvasLocked
            ? tt('画布已锁定：用方向键选择旁边的人物，Ctrl/Cmd+L 解锁，Ctrl/Cmd+↑/↓ 缩放')
            : tt('点击节点查看详情并添加角色')}
        </div>
      )}

      {/* 连线模式状态条 */}
      {showCanvasHint && connectionMode !== 'off' && (
        <div className="export-hide absolute top-4 left-4 bg-blue-600/95 backdrop-blur-sm px-4 py-3 rounded-lg border border-blue-500 shadow-lg text-sm text-white z-10 pointer-events-none" aria-hidden="true">
          <div className="flex items-center gap-2 font-medium">
            <Spline className="w-4 h-4" aria-hidden="true" />{tt('连线模式：')}{connectionMode === 'auto' ? tt('自动') : connectionMode === 'parent-child' ? tt('父母子女') : connectionMode === 'spouse' ? tt('爱人') : `${tt('其他（')}${connectionCustomLabel}${tt('）')}`}
          </div>
          <div className="text-[11px] text-blue-100 mt-0.5">
            {connectFirstNodeId ? tt('已选择起点，再点击一个人物完成连线（点击空白取消）') : tt('点击第一个人物作为起点')}
          </div>
        </div>
      )}

      {/* 连线模式 toast 提示 */}
      {connectToast && (
        <div className="export-hide fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[60] pointer-events-none" aria-hidden="true">
          {connectToast}
        </div>
      )}

      {/* 连线模式：高亮起点节点（通过节点样式无法直接控制，这里用提示） */}

      {isExporting && (
        <div className="export-hide fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[9999]" aria-hidden="true">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <div className="text-sm text-gray-600">{tt('正在生成图片，请稍候...')}</div>
          </div>
        </div>
      )}
    </div>
  );
}
