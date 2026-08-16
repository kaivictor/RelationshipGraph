import { BaseEdge, EdgeLabelRenderer, getStraightPath, EdgeProps } from '@xyflow/react';
import { Heart, HeartCrack } from 'lucide-react';

export default function SpouseEdge({
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
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan bg-white rounded-full p-0.5 shadow-sm border flex items-center justify-center"
        >
          {disconnected ? (
            <HeartCrack className="w-4 h-4 text-gray-400" />
          ) : (
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
