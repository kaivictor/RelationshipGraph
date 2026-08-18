import { BaseEdge, EdgeLabelRenderer, getStraightPath, EdgeProps } from '@xyflow/react';
import { useRelationshipStore, buildEdgeAriaLabel } from '../store/useRelationshipStore';

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
  const nodes = useRelationshipStore((s) => s.nodes);
  const ariaText = buildEdgeAriaLabel(
    { id, source, target, data } as Parameters<typeof buildEdgeAriaLabel>[0],
    nodes
  );

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          ...style,
          stroke: disconnected ? '#d1d5db' : '#a78bfa',
          strokeWidth: 2,
          strokeDasharray: '2 4',
        }}
        markerEnd={markerEnd}
      />
      {customLabel && (
        <EdgeLabelRenderer>
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan bg-white rounded-full px-2 py-0.5 shadow-sm border border-purple-200 text-[10px] text-purple-600 max-w-[80px] truncate"
          >
            <span>{customLabel}</span>
          </div>
        </EdgeLabelRenderer>
      )}
      {/* 屏幕阅读器：React Flow 不读取 edge.ariaLabel，这里用 sr-only 文本承载「两端+关系+方向」 */}
      <EdgeLabelRenderer>
        <span className="sr-only">{ariaText}</span>
      </EdgeLabelRenderer>
    </>
  );
}
