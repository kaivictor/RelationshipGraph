import { useState, useCallback, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

type Props = {
  title: string;
  /** 默认是否展开，默认 true */
  defaultOpen?: boolean;
  /** 标题右侧的辅助文本（如"拖动排序"） */
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * 持久化 key：传入后，隐藏状态会保存到 localStorage，
   * key 建议格式 "panel:sectionName"（如 "settings:basic"）。
   * 不传则仅使用内存状态（刷新后回到 defaultOpen）。
   */
  storageKey?: string;
};

function loadOpenState(storageKey: string | undefined, defaultOpen: boolean): boolean {
  if (!storageKey) return defaultOpen;
  try {
    const raw = localStorage.getItem(`collapse:${storageKey}`);
    if (raw === null) return defaultOpen;
    return raw === '1';
  } catch {
    return defaultOpen;
  }
}

function saveOpenState(storageKey: string | undefined, open: boolean) {
  if (!storageKey) return;
  try {
    localStorage.setItem(`collapse:${storageKey}`, open ? '1' : '0');
  } catch {
    // 忽略写入失败
  }
}

export function CollapsibleSection({ title, defaultOpen = true, hint, children, className = '', storageKey }: Props) {
  const [open, setOpen] = useState(() => loadOpenState(storageKey, defaultOpen));

  const toggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      saveOpenState(storageKey, next);
      return next;
    });
  }, [storageKey]);

  return (
    <div className={'mt-4 pt-4 border-t border-gray-200 first:mt-0 first:pt-0 first:border-t-0 ' + className}>
      <button
        type="button"
        onClick={toggle}
        className="flex items-center gap-1 w-full text-left group"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600" />
        )}
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</span>
        {hint && <span className="font-normal normal-case text-gray-300 text-xs ml-1">{hint}</span>}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
