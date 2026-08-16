import { BaseEdge, EdgeLabelRenderer, EdgeProps } from '@xyflow/react';
import { useFamilyStore } from '../store/useFamilyStore';

export default function ParentChildEdge({
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
  const disconnected = (data as { disconnected?: boolean })?.disconnected;
  const showEdgeRelationship = useFamilyStore((s) => s.displaySettings.showEdgeRelationship);
  const nodes = useFamilyStore((s) => s.nodes);

  // 查找父子两端节点的性别：source=父母，target=子女
  const parentNode = nodes.find((n) => n.id === source);
  const childNode = nodes.find((n) => n.id === target);
  // source端字符（父母），target端字符（子女）
  const sourceChar = parentNode?.data.gender === 'female' ? '母' : '父';
  const targetChar = childNode?.data.gender === 'female' ? '女' : '子';

  // 几何方向
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const absDx = Math.abs(dx);

  // 线长度
  const len = Math.sqrt(dx * dx + dy * dy);
  // 线角度（度），范围 (-180, 180]
  const rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;

  // 几乎纯垂直时使用三行竖排，不旋转
  const isSteepVertical = absDx < 5;
  // 父母端是否在上方（仅用于纯垂直时决定上下字符）
  const parentOnTop = sourceY <= targetY;

  // 翻转判定：线方向超出 [-90, 90] 时文字倒立，需旋转 180°
  const isFlipped = !isSteepVertical && (rawAngle > 90 || rawAngle < -90);
  const angleDeg = isFlipped ? rawAngle + 180 : rawAngle;

  // 字符顺序：基于翻转状态，保证旋转后字符与节点位置对应
  // 不翻转：左字符=source端，右字符=target端
  // 翻转(旋转180°)：左字符=target端，右字符=source端
  let displayStart: string;
  let displayEnd: string;
  if (isSteepVertical) {
    // 纯垂直三行：上字符=上端节点，下字符=下端节点
    displayStart = parentOnTop ? sourceChar : targetChar;
    displayEnd = parentOnTop ? targetChar : sourceChar;
  } else {
    displayStart = isFlipped ? targetChar : sourceChar;
    displayEnd = isFlipped ? sourceChar : targetChar;
  }
  // 短线时减小间距，避免重叠
  const short = len < 80;
  const fontSize = 10;

  // 中点
  const midX = sourceX + dx / 2;
  const midY = sourceY + dy / 2;

  return (
    <>
      <BaseEdge
        path={`M ${sourceX},${sourceY} L ${targetX},${targetY}`}
        style={{
          ...style,
          stroke: disconnected ? '#d1d5db' : '#94a3b8',
          strokeWidth: 2,
          strokeDasharray: disconnected ? '6 4' : undefined,
        }}
        markerEnd={markerEnd}
      />
      {showEdgeRelationship && !disconnected && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              transform: isSteepVertical
                ? `translate(${midX}px, ${midY}px) translate(-50%, -50%)`
                : `translate(${midX}px, ${midY}px) translate(-50%, -50%) rotate(${angleDeg}deg)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan bg-white rounded px-1 shadow-sm border border-gray-200 flex items-center justify-center"
          >
            {isSteepVertical ? (
              // 纯垂直线：文字竖排（每字一行）
              <div className="flex flex-col items-center leading-[1.1] py-0.5">
                <span className="text-[10px] text-gray-600">{displayStart}</span>
                <span className="text-[10px] text-gray-300">·</span>
                <span className="text-[10px] text-gray-600">{displayEnd}</span>
              </div>
            ) : (
              // 水平/斜线：文字横排并沿线旋转
              <div className="flex items-center px-0.5" style={{ gap: short ? 0 : 1 }}>
                <span className="text-[10px] text-gray-600 leading-none">{displayStart}</span>
                <span className="text-[10px] text-gray-300 leading-none">·</span>
                <span className="text-[10px] text-gray-600 leading-none">{displayEnd}</span>
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
