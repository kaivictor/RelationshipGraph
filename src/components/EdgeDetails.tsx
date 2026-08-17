import { useMemo, useState } from 'react';
import { useRelationshipStore, EdgeData, PersonNode } from '../store/useRelationshipStore';
import { X, Unlink, Link2, Trash2, ArrowRight, ArrowLeftRight, User, UserRound, UserRoundSearch, EyeOff, Eye } from 'lucide-react';
import clsx from 'clsx';

// 性别图标
function GenderIcon({ gender, className }: { gender: string; className?: string }) {
  if (gender === 'male') return <User className={className} />;
  if (gender === 'female') return <UserRound className={className} />;
  return <UserRoundSearch className={className} />;
}

// 节点卡片：头像 + 姓名 + 性别
function NodeCard({ node, active }: { node: PersonNode | undefined; active?: boolean }) {
  if (!node) {
    return (
      <div className="flex-1 min-w-0 p-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-400">
        节点不存在
      </div>
    );
  }
  const avatar = node.data.avatar;
  return (
    <div
      className={clsx(
        'flex-1 min-w-0 flex items-center gap-2 p-2 rounded-lg border transition-colors',
        active ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
      )}
    >
      <div className="w-10 h-[52px] rounded overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
        {avatar ? (
          <img src={avatar} alt={node.data.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <GenderIcon gender={node.data.gender} className="w-5 h-5" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-800 truncate">{node.data.name || '未命名'}</div>
        <div className="text-[11px] text-gray-500 truncate">
          {node.data.relationship && <span>{node.data.relationship}</span>}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <GenderIcon
            gender={node.data.gender}
            className={clsx(
              'w-3 h-3',
              node.data.gender === 'male' ? 'text-blue-500' : node.data.gender === 'female' ? 'text-pink-500' : 'text-gray-400'
            )}
          />
          <span className="text-[10px] text-gray-400">
            {node.data.gender === 'male' ? '男' : node.data.gender === 'female' ? '女' : '未知'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function EdgeDetails() {
  const {
    nodes,
    edges,
    selectedEdgeId,
    setSelectedEdgeId,
    setSelectedNodeId,
    updateEdgeType,
    updateEdgeEndpoint,
    swapEdgeDirection,
    disconnectEdge,
    reconnectEdge,
    deleteEdge,
    collapseEdge,
    expandEdge,
  } = useRelationshipStore();

  // 本地编辑状态：当前正在编辑的端（source/target）
  const [editingEnd, setEditingEnd] = useState<'source' | 'target' | null>(null);
  // 自定义关系称谓输入
  const [customLabelDraft, setCustomLabelDraft] = useState('');

  const edge = useMemo(() => edges.find((e) => e.id === selectedEdgeId), [edges, selectedEdgeId]);

  if (!edge) {
    // 边已被删除或不选中：返回 null，由 App 切回默认面板
    return null;
  }

  const data = edge.data as EdgeData;
  const edgeType = data?.type || 'parent-child';
  const isDisconnected = !!data?.disconnected;
  const isCollapsed = !!data?.collapsed;
  const customLabel = data?.customLabel || '';

  const sourceNode = nodes.find((n) => n.id === edge.source);
  const targetNode = nodes.find((n) => n.id === edge.target);

  // 关系类型的中文描述
  const typeLabel = (t: string): string => {
    if (t === 'parent-child') return '父子/母子';
    if (t === 'spouse') return '爱人';
    return '自定义';
  };

  // 关系描述文字（基于 source -> target）
  const relationshipText = (): string => {
    const sName = sourceNode?.data.name || '?';
    const tName = targetNode?.data.name || '?';
    if (edgeType === 'parent-child') {
      return `${sName} 是 ${tName} 的父母`;
    }
    if (edgeType === 'spouse') {
      return `${sName} 与 ${tName} 是爱人`;
    }
    return `${sName} → ${tName}（${customLabel || '自定义关系'}）`;
  };

  const handleClose = () => {
    setSelectedEdgeId(null);
  };

  const handleTypeChange = (newType: 'parent-child' | 'spouse' | 'custom') => {
    if (newType === 'custom') {
      // 切到自定义时使用当前草稿或默认值
      updateEdgeType(edge.id, 'custom', customLabelDraft || customLabel || '自定义');
    } else {
      updateEdgeType(edge.id, newType);
      setCustomLabelDraft('');
    }
  };

  const handleCustomLabelCommit = () => {
    if (edgeType === 'custom' && customLabelDraft.trim()) {
      updateEdgeType(edge.id, 'custom', customLabelDraft.trim());
      setCustomLabelDraft('');
    }
  };

  const handleEndpointChange = (newNodeId: string) => {
    if (!editingEnd) return;
    updateEdgeEndpoint(edge.id, editingEnd, newNodeId);
    setEditingEnd(null);
  };

  const handleSwap = () => {
    swapEdgeDirection(edge.id);
  };

  const handleToggleDisconnect = () => {
    if (isDisconnected) {
      reconnectEdge(edge.id);
    } else {
      disconnectEdge(edge.id);
    }
  };

  const handleDelete = () => {
    if (window.confirm('确定要删除这条关系吗？此操作可通过撤销恢复。')) {
      deleteEdge(edge.id);
    }
  };

  const handleToggleCollapse = () => {
    if (isCollapsed) {
      expandEdge(edge.id);
    } else {
      collapseEdge(edge.id);
    }
  };

  // 候选节点列表（排除当前两端）
  const candidateNodes = nodes.filter((n) => n.id !== edge.source && n.id !== edge.target);

  return (
    <div
      className="absolute top-16 right-4 w-72 bg-white shadow-xl rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-5rem)] z-50 nodrag nopan nowheel"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-gray-800">关系编辑</h2>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
          title="关闭面板"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex-1 space-y-4">
        <p className="text-xs text-gray-400">
          点击连接线后可在此修改两端、关系类型与方向。底部可断开/恢复或删除关系。
        </p>

        {/* 连线两端 */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">连线两端</div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <NodeCard node={sourceNode} active={editingEnd === 'source'} />
              <button
                type="button"
                onClick={() => setEditingEnd(editingEnd === 'source' ? null : 'source')}
                className={clsx(
                  'shrink-0 px-2 py-1 rounded text-[11px] font-medium border transition-colors',
                  editingEnd === 'source'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
                )}
              >
                {editingEnd === 'source' ? '取消' : '改起点'}
              </button>
            </div>

            {/* 中间关系指示 */}
            <div className="flex items-center justify-center py-1">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200">
                  <span className="font-medium">{typeLabel(edgeType)}</span>
                  {isDisconnected && (
                    <span className="text-[10px] text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">已断开</span>
                  )}
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <NodeCard node={targetNode} active={editingEnd === 'target'} />
              <button
                type="button"
                onClick={() => setEditingEnd(editingEnd === 'target' ? null : 'target')}
                className={clsx(
                  'shrink-0 px-2 py-1 rounded text-[11px] font-medium border transition-colors',
                  editingEnd === 'target'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
                )}
              >
                {editingEnd === 'target' ? '取消' : '改终点'}
              </button>
            </div>
          </div>

          {/* 端点选择器：一次只能改一端 */}
          {editingEnd && (
            <div className="mt-3 p-2.5 bg-blue-50/50 border border-blue-100 rounded-md">
              <div className="text-[11px] text-blue-700 mb-1.5">
                选择新的{editingEnd === 'source' ? '起点' : '终点'}（一次只能修改一端）
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) handleEndpointChange(e.target.value);
                }}
                className="w-full px-2 py-1.5 border border-blue-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- 选择节点 --</option>
                {candidateNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.data.name || '未命名'}
                    {n.data.relationship ? `（${n.data.relationship}）` : ''}
                  </option>
                ))}
              </select>
              {candidateNodes.length === 0 && (
                <div className="text-[10px] text-gray-400 mt-1">没有可选的其他节点。</div>
              )}
            </div>
          )}

          {/* 关系描述 */}
          <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded">
            {relationshipText()}
          </div>
        </div>

        {/* 关系类型 */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">关系类型</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(['parent-child', 'spouse', 'custom'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => handleTypeChange(t)}
                className={clsx(
                  'px-2 py-1.5 rounded-md text-xs font-medium border transition-colors',
                  edgeType === t
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                )}
              >
                {typeLabel(t)}
              </button>
            ))}
          </div>
          {edgeType === 'custom' && (
            <div className="mt-2 flex gap-1.5">
              <input
                type="text"
                value={customLabelDraft}
                onChange={(e) => setCustomLabelDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomLabelCommit();
                }}
                placeholder={customLabel ? `当前：${customLabel}` : '如：同学、同事、朋友'}
                className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCustomLabelCommit}
                disabled={!customLabelDraft.trim()}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                保存
              </button>
            </div>
          )}
          {edgeType === 'parent-child' && (
            <div className="text-[10px] text-gray-400 mt-1.5">
              起点是父母，终点是子女。如需反转请使用下方"反转方向"。
            </div>
          )}
        </div>

        {/* 方向 */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-2">方向</div>
          <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-md border border-gray-100">
            <div className="text-[11px] text-gray-600 min-w-0">
              <div className="truncate">
                <span className="font-medium text-gray-800">{sourceNode?.data.name || '?'}</span>
                <span className="mx-1 text-gray-400">→</span>
                <span className="font-medium text-gray-800">{targetNode?.data.name || '?'}</span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                {edgeType === 'parent-child' ? '起点为父母，终点为子女' : edgeType === 'spouse' ? '爱人关系（双向）' : '自定义方向'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSwap}
              className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-100 transition-colors"
              title="交换起点与终点（如父子改为子父）"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              反转
            </button>
          </div>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="p-3 border-t border-gray-100 bg-gray-50 space-y-2">
        <button
          type="button"
          onClick={handleToggleDisconnect}
          className={clsx(
            'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            isDisconnected
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          )}
        >
          {isDisconnected ? (
            <>
              <Link2 className="w-4 h-4" />
              恢复关系
            </>
          ) : (
            <>
              <Unlink className="w-4 h-4" />
              断开关系
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleToggleCollapse}
          className={clsx(
            'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            isCollapsed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
          )}
        >
          {isCollapsed ? (
            <>
              <Eye className="w-4 h-4" />
              展开关系
            </>
          ) : (
            <>
              <EyeOff className="w-4 h-4" />
              隐藏关系
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          删除关系
        </button>
      </div>
    </div>
  );
}
