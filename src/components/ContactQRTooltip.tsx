import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// 支持二维码的字段及其二维码内容生成规则
const QR_CONTENT_BUILDERS: Record<string, (value: string) => string> = {
  phone: (v) => `tel:${v}`,
  email: (v) => `mailto:${v}`,
};

// 仅电话和邮箱支持二维码（可扫码直接拨号/发邮件）
export const QR_SUPPORTED_FIELDS = new Set<string>(['phone', 'email']);

// 字段对应中文标签（用于二维码下方说明）
const QR_FIELD_LABELS: Record<string, string> = {
  phone: '手机号',
  email: '邮箱',
};

interface ContactQRTooltipProps {
  fieldKey: string;
  value: string;
  children: ReactNode;
  /** 长按延迟（毫秒），默认 3000 */
  delay?: number;
}

/**
 * 联系方式长按悬浮二维码提示
 * - 鼠标悬浮超过 delay 毫秒后弹出二维码
 * - 二维码内容根据字段类型生成（tel:/mailto:）
 * - 离开或快速点击时取消
 */
export function ContactQRTooltip({ fieldKey, value, children, delay = 3000 }: ContactQRTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLSpanElement | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleEnter = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setVisible(true);
    }, delay);
  }, [delay, clearTimer]);

  const handleLeave = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  // 卸载时清理定时器
  useEffect(() => () => clearTimer(), [clearTimer]);

  const buildQrContent = (key: string, v: string): string => {
    const builder = QR_CONTENT_BUILDERS[key];
    return builder ? builder(v) : v;
  };

  const label = QR_FIELD_LABELS[fieldKey] ?? fieldKey;
  const qrValue = buildQrContent(fieldKey, value);

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex min-w-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {visible && (
        <span
          // 定位在元素上方，水平居中；超出节点边界也允许溢出展示
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 pointer-events-none"
          style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
        >
          <span className="flex flex-col items-center bg-white rounded-md p-1.5 border border-gray-200">
            <span className="bg-white p-1 rounded">
              <QRCodeSVG value={qrValue} size={96} level="M" includeMargin={false} />
            </span>
            <span className="mt-1 text-[10px] text-gray-500 leading-none whitespace-nowrap">
              {label} · 长按扫码
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
