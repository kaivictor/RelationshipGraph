import { BaseEdge, EdgeLabelRenderer, getStraightPath, EdgeProps } from '@xyflow/react';
import { buildEdgeAriaLabel } from '../store/useRelationshipStore';

export default function CustomEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const disconnected = (data as { disconnected?: boolean })?.disconnected;
  const customLabel = (data as { customLabel?: string })?.customLabel;
  const isSuperior = (data as { type?: string })?.type === 'superior-subordinate';
  const isEn = (typeof navigator !== 'undefined' && document.documentElement.lang === 'en');
  // 不再订阅整个 nodes 数组，避免拖动任意节点时所有边重渲染；
  // 名称/性别改为由 buildEdgeAriaLabel 内部按需（带缓存）读取。
  const ariaText = buildEdgeAriaLabel(
    { id, source, target, data } as Parameters<typeof buildEdgeAriaLabel>[0]
  );

  const strokeColor = disconnected
    ? '#d1d5db'
    : isSuperior
      ? '#f59e0b' // 上下级：琥珀色
      : '#a78bfa'; // 其他/自定义：紫色

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth: 2,
          strokeDasharray: '2 4',
        }}
        markerEnd={markerEnd}
      />
      {/* 自定义关系：中部显示自定义称谓（上下级有向时也支持） */}
      {customLabel && (
        <EdgeLabelRenderer>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={
              isSuperior
                ? 'nodrag nopan bg-white rounded-full px-2 py-0.5 shadow-sm border border-amber-200 text-[10px] text-amber-600 max-w-[80px] truncate'
                : 'nodrag nopan bg-white rounded-full px-2 py-0.5 shadow-sm border border-purple-200 text-[10px] text-purple-600 max-w-[80px] truncate'
            }
          >
            <span>{customLabel}</span>
          </div>
        </EdgeLabelRenderer>
      )}
      {/* 上下级：两端分别标注「上级」「下级」（有向） */}
      {isSuperior && (
        <>
          <EdgeLabelRenderer>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${sourceX}px, ${sourceY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan bg-white rounded-full px-1.5 py-0.5 shadow-sm border border-amber-200 text-[9px] text-amber-600"
            >
              <span>{isEn ? 'Superior' : '上级'}</span>
            </div>
          </EdgeLabelRenderer>
          <EdgeLabelRenderer>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${targetX}px, ${targetY}px)`,
                pointerEvents: 'all',
              }}
              className="nodrag nopan bg-white rounded-full px-1.5 py-0.5 shadow-sm border border-amber-200 text-[9px] text-amber-600"
            >
              <span>{isEn ? 'Subordinate' : '下级'}</span>
            </div>
          </EdgeLabelRenderer>
        </>
      )}
      {/* 屏幕阅读器：React Flow 不读取 edge.ariaLabel，这里用 sr-only 文本承载「两端+关系+方向」 */}
      <EdgeLabelRenderer>
        <span className="sr-only">{ariaText}</span>
      </EdgeLabelRenderer>
    </>
  );
}
