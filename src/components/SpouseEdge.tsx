import { BaseEdge, EdgeLabelRenderer, getStraightPath, EdgeProps } from '@xyflow/react';
import { Heart } from 'lucide-react';

export default function SpouseEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <>
      <BaseEdge path={edgePath} style={{ ...style, strokeWidth: 2, stroke: '#ff4d4f' }} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan bg-white rounded-full p-0.5 shadow-sm border border-red-100 flex items-center justify-center"
        >
          <Heart className="w-4 h-4 text-red-500 fill-red-500" />
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
