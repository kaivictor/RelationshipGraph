import { useRef, useState, useEffect } from 'react';
import clsx from 'clsx';

/**
 * 文本溢出时自动水平来回滚动，不溢出时正常显示。
 */
export function AutoScrollText({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const check = () => {
      const c = containerRef.current;
      const t = textRef.current;
      if (c && t) {
        setOverflows(t.scrollWidth > c.clientWidth + 1);
      }
    };
    check();
    // 容器尺寸可能变化，用 ResizeObserver 监听
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={clsx('flex-1 min-w-0 overflow-hidden whitespace-nowrap', className)}
    >
      <span
        ref={textRef}
        className={clsx('inline-block whitespace-nowrap font-medium', overflows && 'auto-scroll-text')}
        style={
          overflows
            ? ({ '--scroll-width': `${containerRef.current?.clientWidth ?? 0}px` } as Record<string, string>)
            : undefined
        }
      >
        {value}
      </span>
    </div>
  );
}
