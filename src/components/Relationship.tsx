import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useRelationshipStore, computeInvisibleNodes } from '../store/useRelationshipStore';
import { PersonNodeComponent } from './PersonNode';
import SpouseEdge from './SpouseEdge';
import ParentChildEdge from './ParentChildEdge';
import CustomEdge from './CustomEdge';
import { toPng, toSvg } from 'html-to-image';
import { Download, Upload, Image as ImageIcon, ChevronDown, Undo2, HelpCircle, Spline, X } from 'lucide-react';
import { parseXlsxFile } from '../utils/xlsxTemplate';
import { exportFile, exportImageFile } from '../utils/nativeExport';
import clsx from 'clsx';

const nodeTypes = {
  person: PersonNodeComponent,
};

const edgeTypes = {
  spouse: SpouseEdge,
  'parent-child': ParentChildEdge,
  custom: CustomEdge,
};

export default function Relationship() {
  const {
    nodes,
    edges,
    selectedNodeId,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setSelectedNodeId,
    setSelectedEdgeId,
    toggleNodeSelected,
    applyMultiSelect,
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
  } = useRelationshipStore();

  const showCanvasHint = useRelationshipStore((s) => s.displaySettings.showCanvasHint);
  const hiddenNodeIds = useRelationshipStore((s) => s.hiddenNodeIds);

  // 不可见集合 = 隐藏边（桥语义）+ 隐藏节点（割点语义）共同作用下，从"自己"不可达的节点
  const invisibleNodeIds = useMemo(() => {
    const invisible = computeInvisibleNodes(nodes, edges, hiddenNodeIds);
    return invisible.size > 0 ? invisible : null;
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

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, setViewport: setRFViewport } = useReactFlow();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportDataMenu, setShowExportDataMenu] = useState(false);
  // PNG 自定义清晰度
  const [pngQuality, setPngQuality] = useState(2);
  // 导出图片时显示全屏遮罩，遮住 wrapper 尺寸变化的视觉闪烁
  const [isExporting, setIsExporting] = useState(false);
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
  const longPressSavedIdsRef = useRef<string[]>([]);

  const { viewport: savedViewport, setViewport } = useRelationshipStore();
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

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: any) => {
      // 连线模式下：点击节点建立关系，不打开详情面板
      if (connectionMode !== 'off') {
        const result = clickNodeInConnectMode(node.id);
        if (result.connected) {
          setConnectToast(`已建立关系：${result.reason || ''}`);
          setTimeout(() => setConnectToast(null), 1800);
        } else if (result.reason && result.reason !== '取消选择') {
          // 静默
        } else if (result.reason === '取消选择') {
          setConnectToast('已取消选择');
          setTimeout(() => setConnectToast(null), 1200);
        } else {
          setConnectToast('已选择起点，再点击一个人物完成连线');
          setTimeout(() => setConnectToast(null), 1800);
        }
        return;
      }
      // 长按多选：恢复被单击覆盖的多选状态
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        const ids = [...longPressSavedIdsRef.current, node.id];
        applyMultiSelect(ids);
        longPressSavedIdsRef.current = [];
        return;
      }
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId, connectionMode, clickNodeInConnectMode, applyMultiSelect]
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
    longPressSavedIdsRef.current = [];

    longPressTimerRef.current = window.setTimeout(() => {
      // 长按触发：保存当前已选中的节点 ID，然后切换该节点选中状态
      longPressTriggeredRef.current = true;
      const state = useRelationshipStore.getState();
      longPressSavedIdsRef.current = state.nodes.filter(n => n.selected).map(n => n.id);
      state.toggleNodeSelected(nodeId);
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
          alert(`导入失败：未找到可用数据。\n${result.errors.join('\n')}`);
        } else {
          const added = importPersonsIncremental(result.persons);
          let msg = `成功导入 ${added} 个独立人物（无关系）。`;
          if (result.skipped > 0) msg += `\n跳过 ${result.skipped} 行无效数据。`;
          if (result.errors.length > 0) msg += `\n\n详情：\n${result.errors.join('\n')}`;
          if (result.detectedCustomColumns.length > 0) {
            msg += `\n\n检测到自定义列：${result.detectedCustomColumns.map((c) => c.label).join('、')}`;
          }
          alert(msg);
          setTimeout(() => fitView({ padding: 0.2 }), 100);
        }
      } catch (err) {
        console.error('xlsx 导入失败', err);
        alert('xlsx 文件解析失败，请检查文件格式。');
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
        nodes={connectFirstNodeId
          ? visibleNodes.map((n) => n.id === connectFirstNodeId
            ? { ...n, style: { ...n.style, boxShadow: '0 0 0 3px #2563eb, 0 4px 12px rgba(37,99,235,0.4)' } }
            : n)
          : visibleNodes}
        edges={visibleEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        onMoveEnd={onMoveEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ style: { stroke: '#94a3b8', strokeWidth: 2 } }}
        fitView
        minZoom={0.1}
      >
        <Background color="#ccc" gap={16} />
        <Controls />
        <MiniMap zoomable pannable />
        
        <Panel position="top-right" className="flex gap-2">
          <button
            onClick={() => undo()}
            disabled={undoStack.length === 0}
            title={undoStack.length > 0 ? `撤销：${lastUndoLabel}` : '没有可撤销的操作'}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Undo2 className="w-4 h-4" />
            撤销
            {undoStack.length > 0 && (
              <span className="text-[10px] text-gray-400">({undoStack.length})</span>
            )}
          </button>
          <button
            onClick={() => {
              layoutGraph();
              setTimeout(() => fitView({ padding: 0.2 }), 100);
            }}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
          >
            整理布局
          </button>
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
              title="连线模式：点击两个节点建立关系"
            >
              <Spline className="w-4 h-4" />
              连线模式
              {connectionMode !== 'off' && (
                <span className="text-[10px] bg-white/20 px-1 rounded">
                  {connectionMode === 'auto' ? '自动' : connectionMode === 'parent-child' ? '父母子女' : connectionMode === 'spouse' ? '爱人' : (connectionCustomLabel || '其他')}
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {showConnectMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-gray-400">选择连线模式</div>
                {([
                  { key: 'off', label: '关闭连线模式', desc: '正常点击查看详情' },
                  { key: 'auto', label: '自动', desc: '年龄差>15 父母子女，否则爱人' },
                  { key: 'parent-child', label: '父母子女', desc: 'A为长辈，B为晚辈' },
                  { key: 'spouse', label: '爱人', desc: '不限年龄性别' },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setConnectionMode(opt.key);
                      setShowConnectMenu(false);
                      setConnectToast(opt.key === 'off' ? '已退出连线模式' : `已进入「${opt.label}」连线模式，点击两个节点连线`);
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
                  <div className="text-[11px] font-medium text-gray-500 mb-1.5">其他（填写关系称谓）</div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customLabelDraft}
                      onChange={(e) => setCustomLabelDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customLabelDraft.trim()) {
                          setConnectionMode('custom', customLabelDraft.trim());
                          setShowConnectMenu(false);
                          setConnectToast(`已进入「其他：${customLabelDraft.trim()}」连线模式`);
                          setTimeout(() => setConnectToast(null), 1800);
                        }
                      }}
                      placeholder="如：同学、同事、朋友"
                      className="flex-1 min-w-0 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => {
                        if (!customLabelDraft.trim()) return;
                        setConnectionMode('custom', customLabelDraft.trim());
                        setShowConnectMenu(false);
                        setConnectToast(`已进入「其他：${customLabelDraft.trim()}」连线模式`);
                        setTimeout(() => setConnectToast(null), 1800);
                      }}
                      disabled={!customLabelDraft.trim()}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      确定
                    </button>
                  </div>
                </div>
                {connectionMode !== 'off' && (
                  <div className="border-t border-gray-100">
                    <button
                      onClick={() => {
                        setConnectionMode('off');
                        setShowConnectMenu(false);
                        setConnectToast('已退出连线模式');
                        setTimeout(() => setConnectToast(null), 1500);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <X className="w-3.5 h-3.5" />
                      退出连线模式
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowExportMenu(!showExportMenu); setShowExportDataMenu(false); }}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              <ImageIcon className="w-4 h-4" />
              导出图片
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-gray-400">PNG 清晰度</div>
                <div className="px-3 pb-2 space-y-1.5">
                  {[
                    { label: '标清', value: 1, hint: '1x' },
                    { label: '高清', value: 2, hint: '2x' },
                    { label: '超清', value: 4, hint: '4x' },
                    { label: '极清', value: 6, hint: '6x' },
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
                    <span className="text-xs text-gray-500 shrink-0">自定义</span>
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
                    >
                      导出
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">数值越大越清晰，文件也越大。建议 1-6，过大可能卡顿。</p>
                </div>
                <div className="border-t border-gray-100">
                  <button onClick={() => handleExportImage('svg')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">SVG (矢量图)</button>
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowExportDataMenu(!showExportDataMenu); setShowExportMenu(false); }}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
            >
              <Download className="w-4 h-4" />
              导出数据
              <ChevronDown className="w-3 h-3 text-gray-500" />
            </button>
            {showExportDataMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
                <button onClick={() => handleExportData('json')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">JSON (完整)</button>
                <button onClick={() => handleExportData('xml')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">XML (完整)</button>
                <button onClick={() => handleExportData('csv')} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">CSV (仅人物+关系)</button>
              </div>
            )}
          </div>
          <div className="relative">
            <label className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700 cursor-pointer">
              <Upload className="w-4 h-4" />
              导入数据
              <input type="file" accept=".json,.xml,.xlsx" className="hidden" onChange={(e) => { handleImportData(e); }} />
            </label>
          </div>
          <button
            onClick={() => setShowHelpPage(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
            title="打开帮助页面，下载 Excel 导入模板"
          >
            <HelpCircle className="w-4 h-4" />
            帮助
          </button>
        </Panel>
      </ReactFlow>

      {showCanvasHint && !selectedNodeId && connectionMode === 'off' && (
        <div className="export-hide absolute top-4 left-4 bg-white/80 backdrop-blur-sm px-4 py-3 rounded-lg border border-gray-200 shadow-sm text-sm text-gray-600 pointer-events-none z-10">
          点击节点查看详情并添加亲属
        </div>
      )}

      {/* 连线模式状态条 */}
      {showCanvasHint && connectionMode !== 'off' && (
        <div className="export-hide absolute top-4 left-4 bg-blue-600/95 backdrop-blur-sm px-4 py-3 rounded-lg border border-blue-500 shadow-lg text-sm text-white z-10 pointer-events-none">
          <div className="flex items-center gap-2 font-medium">
            <Spline className="w-4 h-4" />
            连线模式：
            {connectionMode === 'auto' ? '自动' : connectionMode === 'parent-child' ? '父母子女' : connectionMode === 'spouse' ? '爱人' : `其他（${connectionCustomLabel}）`}
          </div>
          <div className="text-[11px] text-blue-100 mt-0.5">
            {connectFirstNodeId ? '已选择起点，再点击一个人物完成连线（点击空白取消）' : '点击第一个人物作为起点'}
          </div>
        </div>
      )}

      {/* 连线模式 toast 提示 */}
      {connectToast && (
        <div className="export-hide fixed top-20 left-1/2 -translate-x-1/2 bg-gray-900/90 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-[60] pointer-events-none">
          {connectToast}
        </div>
      )}

      {/* 连线模式：高亮起点节点（通过节点样式无法直接控制，这里用提示） */}

      {isExporting && (
        <div className="export-hide fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <div className="text-sm text-gray-600">正在生成图片，请稍候...</div>
          </div>
        </div>
      )}
    </div>
  );
}
