import { BaseEdge, EdgeLabelRenderer, getStraightPath, EdgeProps } from '@xyflow/react';
import { Heart, HeartCrack } from 'lucide-react';
import { useRelationshipStore, buildEdgeAriaLabel } from '../store/useRelationshipStore';

export default function SpouseEdge({
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
          strokeWidth: 2,
          stroke: disconnected ? '#d1d5db' : '#ff4d4f',
          strokeDasharray: disconnected ? '6 4' : undefined,
        }}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan bg-white rounded-full p-0.5 shadow-sm border flex items-center justify-center"
        >
          {disconnected ? (
            <HeartCrack className="w-4 h-4 text-gray-400" aria-hidden="true" />
          ) : (
            <Heart className="w-4 h-4 text-red-500 fill-red-500" aria-hidden="true" />
          )}
        </div>
      </EdgeLabelRenderer>
      {/* 屏幕阅读器：React Flow 不读取 edge.ariaLabel，这里用 sr-only 文本承载「两端+关系+方向」 */}
      <EdgeLabelRenderer>
      <span className="sr-only">{ariaText}</span>
      </EdgeLabelRenderer>
      </>
      );
      }
