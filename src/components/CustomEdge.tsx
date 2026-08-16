import { BaseEdge, EdgeLabelRenderer, getStraightPath, EdgeProps } from '@xyflow/react';

export default function CustomEdge({
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
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan bg-white rounded-full px-2 py-0.5 shadow-sm border border-purple-200 text-[10px] text-purple-600 max-w-[80px] truncate"
            title={customLabel}
          >
            {customLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
