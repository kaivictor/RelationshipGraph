import { useMemo, useState, useEffect } from 'react';
import { useRelationshipStore, EdgeData, PersonNode } from '../store/useRelationshipStore';
import { X, Unlink, Link2, Trash2, ArrowRight, ArrowLeftRight, User, UserRound, UserRoundSearch, EyeOff, Eye } from 'lucide-react';
import clsx from 'clsx';
import { tt, useLang } from '../i18n';

// 性别图标（纯装饰，文字已由邻近 span 表达）
function GenderIcon({ gender, className }: { gender: string; className?: string }) {
  if (gender === 'male') return <User className={className} aria-hidden="true" />;
  if (gender === 'female') return <UserRound className={className} aria-hidden="true" />;
  return <UserRoundSearch className={className} aria-hidden="true" />;
}

// 节点卡片：头像 + 姓名 + 性别
function NodeCard({ node, active }: { node: PersonNode | undefined; active?: boolean }) {
  if (!node) {
    return (
      <div className="flex-1 min-w-0 p-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center text-xs text-gray-400">{tt('节点不存在')}</div>
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
        <div className="w-full h-full flex items-center justify-center text-gray-300" aria-hidden="true">
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
            {node.data.gender === 'male' ? tt('男') : node.data.gender === 'female' ? tt('女') : tt('未知')}
          </span>
        </div>
      </div>
    </div>
  );
}

// 端点行：未编辑显示「卡片 + [修改]」；点击修改后原地展开「<select> + [取消]」
function EndpointRow({
  end,
  node,
  options,
  value,
  editing,
  onEdit,
  onCancel,
  onChange,
}: {
  end: 'source' | 'target';
  node: PersonNode | undefined;
  options: PersonNode[];
  value: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (nodeId: string) => void;
}) {
  const isSource = end === 'source';
  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <>
          <select
            autoFocus
            aria-label={isSource ? tt('修改起点') : tt('修改终点')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.map((n) => (
              <option key={n.id} value={n.id}>
                {n.data.name || tt('未命名')}
                {n.data.relationship ? `（${n.data.relationship}）` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 px-2 py-1 rounded text-[11px] font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            {tt('取消')}
          </button>
        </>
      ) : (
        <>
          <NodeCard node={node} />
          <button
            type="button"
            onClick={onEdit}
            aria-label={isSource ? tt('修改起点（即连线起始人物）') : tt('修改终点（即连线结束人物）')}
            className="shrink-0 px-2 py-1 rounded text-[11px] font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            {tt('修改')}
          </button>
        </>
      )}
    </div>
  );
}

export function EdgeDetails() {
  useLang();
  // 按需订阅，避免全量订阅导致拖动画布时也重渲染本面板
  const nodes = useRelationshipStore((s) => s.nodes);
  const edges = useRelationshipStore((s) => s.edges);
  const selectedEdgeId = useRelationshipStore((s) => s.selectedEdgeId);
  const setSelectedEdgeId = useRelationshipStore((s) => s.setSelectedEdgeId);
  const setSelectedNodeId = useRelationshipStore((s) => s.setSelectedNodeId);
  const updateEdgeType = useRelationshipStore((s) => s.updateEdgeType);
  const updateEdgeEndpoint = useRelationshipStore((s) => s.updateEdgeEndpoint);
  const swapEdgeDirection = useRelationshipStore((s) => s.swapEdgeDirection);
  const disconnectEdge = useRelationshipStore((s) => s.disconnectEdge);
  const reconnectEdge = useRelationshipStore((s) => s.reconnectEdge);
  const deleteEdge = useRelationshipStore((s) => s.deleteEdge);
  const collapseEdge = useRelationshipStore((s) => s.collapseEdge);
  const expandEdge = useRelationshipStore((s) => s.expandEdge);

  // 自定义关系称谓输入
  const [customLabelDraft, setCustomLabelDraft] = useState('');
  // 当前正在「修改」的端点（source/target），点击修改后原地展开 select
  const [editingEnd, setEditingEnd] = useState<'source' | 'target' | null>(null);

  const edge = useMemo(() => edges.find((e) => e.id === selectedEdgeId), [edges, selectedEdgeId]);

  // 切换选中的关系时，重置端点「修改」展开状态，并初始化自定义称谓草稿
  useEffect(() => {
    setEditingEnd(null);
    const e = edges.find((ed) => ed.id === selectedEdgeId);
    setCustomLabelDraft((e?.data as EdgeData | undefined)?.customLabel || '');
  }, [selectedEdgeId, edges]);

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

  // 关系描述文字（基于 source -> target）
  //  - 父子/母子：依据起点性别显示「父亲/母亲」；
  //  - 爱人：xxx与xxx是爱人；
  //  - 其他(自定义)：xxx与xxx是xxx关系。
  const relationshipText = (): string => {
    const sName = sourceNode?.data.name || '?';
    const tName = targetNode?.data.name || '?';
    if (edgeType === 'parent-child') {
      const word = sourceNode?.data.gender === 'male' ? tt('父亲') : tt('母亲');
      return `${sName}  ${tt('是')}  ${tName}  ${tt('的')} ${word}`;
    }
    if (edgeType === 'spouse') {
      return `${sName}  ${tt('与')}  ${tName}  ${tt('是爱人')}`;
    }
    if (edgeType === 'superior-subordinate') {
      // 有向：source=上级，target=下级；支持自定义称谓（如"导师""汇报对象"）
      const word = customLabel || tt('上级');
      return `${sName}  ${tt('是')}  ${tName}  ${tt('的')} ${word}`;
    }
    const label = customLabel || tt('自定义关系');
    return `${sName}${tt('与')}${tName}${tt('是')}${label}${tt('关系')}`;
  };

  const handleClose = () => {
    setSelectedEdgeId(null);
  };

  const handleTypeChange = (newType: 'parent-child' | 'spouse' | 'custom' | 'superior-subordinate') => {
    if (newType === 'custom') {
      // 切到自定义时使用当前草稿或默认值
      updateEdgeType(edge.id, 'custom', customLabelDraft || customLabel || '自定义');
    } else {
      updateEdgeType(edge.id, newType);
      setCustomLabelDraft('');
    }
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
    if (window.confirm(tt('确定要删除这条关系吗？此操作可通过撤销恢复。'))) {
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

  // 端点候选列表：修改起点时排除终点，反之亦然（原地 select 使用）
  const sourceOptions = nodes.filter((n) => n.id !== edge.target);
  const targetOptions = nodes.filter((n) => n.id !== edge.source);

  return (
    <div
      role="region"
      aria-label={tt('关系编辑面板：修改连线两端、关系类型、方向与显示')}
      className="absolute top-16 right-4 w-72 bg-white shadow-xl rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-5rem)] z-50 nodrag nopan nowheel"
    >
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-gray-800">{tt('关系编辑')}</h2>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
          aria-label={tt('关闭关系编辑面板')}
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex-1 space-y-2">
        <p className="text-xs text-gray-400">{tt('点击连接线后可在此修改两端、关系类型与方向。底部可断开/恢复或删除关系。')}</p>

        {/* 起点端点行 */}
        <EndpointRow
          end="source"
          node={sourceNode}
          options={sourceOptions}
          value={edge.source}
          editing={editingEnd === 'source'}
          onEdit={() => setEditingEnd('source')}
          onCancel={() => setEditingEnd(null)}
          onChange={(id) => {
            updateEdgeEndpoint(edge.id, 'source', id);
            setEditingEnd(null);
          }}
        />

        {/* 关系类型选择：选中「自定义」时同行紧跟输入框（<select>其他</select><input>） */}
        <div className="flex items-center justify-center gap-2">
          <select
            aria-label={tt('关系类型')}
            value={edgeType}
            onChange={(e) => handleTypeChange(e.target.value as 'parent-child' | 'spouse' | 'custom' | 'superior-subordinate')}
            className="shrink-0 px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="parent-child">{tt('父子/母子')}</option>
            <option value="spouse">{tt('爱人')}</option>
            <option value="custom">{tt('自定义')}</option>
            <option value="superior-subordinate">{tt('上下级')}</option>
          </select>
          {edgeType === 'custom' && (
            <input
              type="text"
              value={customLabelDraft}
              onChange={(e) => {
                setCustomLabelDraft(e.target.value);
                const v = e.target.value.trim();
                if (v) updateEdgeType(edge.id, 'custom', v);
              }}
              placeholder={customLabel ? `${tt('当前：')}${customLabel}` : tt('如：同学、同事、朋友')}
              className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          {edgeType === 'superior-subordinate' && (
            <input
              type="text"
              value={customLabelDraft}
              onChange={(e) => {
                setCustomLabelDraft(e.target.value);
                const v = e.target.value.trim();
                updateEdgeType(edge.id, 'superior-subordinate', v);
              }}
              placeholder={customLabel ? `${tt('当前：')}${customLabel}` : tt('如：导师、汇报对象')}
              aria-label={tt('自定义上下级称谓')}
              className="flex-1 min-w-0 px-2.5 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>

        {/* 方向箭头：爱人=双向（不可点击），其他=单向（点击反转） */}
        <div className="flex items-center justify-center">
          {edgeType === 'spouse' ? (
            <span
              className="text-gray-300"
              aria-label={tt('爱人关系（双向）')}
              title={tt('爱人关系（双向）')}
            >
              <ArrowLeftRight className="w-5 h-5" aria-hidden="true" />
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSwap}
              aria-label={tt('反转方向')}
              title={tt('方向（点击箭头可反转方向）')}
              className="rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* 终点端点行 */}
        <EndpointRow
          end="target"
          node={targetNode}
          options={targetOptions}
          value={edge.target}
          editing={editingEnd === 'target'}
          onEdit={() => setEditingEnd('target')}
          onCancel={() => setEditingEnd(null)}
          onChange={(id) => {
            updateEdgeEndpoint(edge.id, 'target', id);
            setEditingEnd(null);
          }}
        />

        {/* 关系描述 */}
        <div className="text-[11px] text-gray-500 bg-gray-50 px-0.5 py-1.5 rounded">
          {relationshipText()}
        </div>
      </div>

      {/* 底部操作 */}
      <div className="p-3 border-t border-gray-100 bg-gray-50 space-y-2">
        <button
          type="button"
          onClick={handleToggleDisconnect}
          aria-label={isDisconnected ? tt('恢复关系（重新连接）') : tt('断开关系（保留但标记为已断开）')}
          className={clsx(
            'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            isDisconnected
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          )}
        >
          {isDisconnected ? (
            <>
              <Link2 className="w-4 h-4" aria-hidden="true" />{tt('恢复关系')}</>
          ) : (
            <>
              <Unlink className="w-4 h-4" aria-hidden="true" />{tt('断开关系')}</>
          )}
        </button>
        <button
          type="button"
          onClick={handleToggleCollapse}
          aria-label={isCollapsed ? tt('在画布上展开显示此关系连线') : tt('在画布上隐藏此关系连线')}
          className={clsx(
            'w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            isCollapsed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100'
          )}
        >
          {isCollapsed ? (
            <>
              <Eye className="w-4 h-4" aria-hidden="true" />{tt('展开关系')}</>
          ) : (
            <>
              <EyeOff className="w-4 h-4" aria-hidden="true" />{tt('隐藏关系')}</>
          )}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          aria-label={tt('删除此关系连线')}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />{tt('删除关系')}</button>
      </div>
    </div>
  );
}
