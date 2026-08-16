/**
 * 复制文本到剪贴板，复制成功后给出视觉反馈。
 * 双击触发，避免与节点的单击选中冲突。
 */
export async function copyText(text: string, e?: { stopPropagation: () => void; currentTarget?: HTMLElement }) {
  e?.stopPropagation();
  try {
    await navigator.clipboard.writeText(text);
    // 简单的视觉反馈：闪一下绿色
    if (e?.currentTarget) {
      const el = e.currentTarget;
      const original = el.style.backgroundColor;
      el.style.backgroundColor = 'rgba(34, 197, 94, 0.25)';
      setTimeout(() => {
        el.style.backgroundColor = original;
      }, 400);
    }
  } catch (err) {
    console.error('复制失败', err);
  }
}
