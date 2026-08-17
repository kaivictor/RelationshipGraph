/**
 * 平台感知的文件导出工具
 *
 * 问题背景：PC 浏览器中可用「Blob + <a download> + click()」触发下载，
 * 但 Android WebView 没有连接系统 DownloadManager，这种方式不生效，
 * 即便生效文件也会存到用户找不到的位置。
 *
 * 解决方案（Capacitor 标准做法）：
 * - 原生环境（Capacitor）：先用 Filesystem 把文件写入应用缓存目录，
 *   再调起系统分享面板（Share），用户可自由选择保存到"文件"、微信、邮件等；
 *   分享/取消后自动清理缓存文件。
 * - Web 环境：保持原来的浏览器下载逻辑。
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** 是否运行在 Capacitor 原生容器（Android/iOS）中 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

/** 浏览器端触发下载（旧逻辑，保留给 Web 环境） */
export function downloadInBrowser(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 浏览器端用 data URL 触发下载 */
export function downloadDataUrlInBrowser(filename: string, dataUrl: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * 原生端：写入缓存并调起系统分享面板。
 *
 * @param filename  文件名（含扩展名）
 * @param content   文件内容：纯文本（如 JSON/XML/CSV）或 data URL（图片/xlsx 等二进制）
 * @returns 是否成功完成（用户可能取消分享，返回 false）
 */
/** 判断是否为「用户主动取消分享面板」：Capacitor Share 在用户关闭/返回面板时会 reject 含 "cancel" 的错误 */
function isUserCancelled(err: unknown): boolean {
  const msg = (err as Error)?.message ?? String(err);
  return /cancel/i.test(msg);
}

export async function shareFileOnNative(filename: string, content: string): Promise<boolean> {
  // data URL（如 base64 图片/xlsx）由 Filesystem 自动解码，无需指定 encoding；
  // 纯文本内容显式指定 UTF-8 编码，避免中文乱码
  const isDataUrl = content.startsWith('data:');
  const rawText = isDataUrl ? undefined : content;

  // 清理缓存文件（无论成功与否）
  const cleanup = async () => {
    try {
      await Filesystem.deleteFile({ path: filename, directory: Directory.Cache });
    } catch {
      // 清理失败不阻塞主流程
    }
  };

  try {
    // 1. 写入应用缓存目录
    //    - 二进制内容（图片/xlsx）使用 data URL，由 Filesystem 自动解码
    //    - 文本内容（JSON/XML/CSV）直接传 UTF-8 字符串，避免桥层对 data URL 的校验问题
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: isDataUrl ? undefined : Encoding.UTF8,
    });

    // 2. 获取文件的 file:// URI（Share 插件 Android 端需要）
    const uriResult = await Filesystem.getUri({
      path: filename,
      directory: Directory.Cache,
    });

    // 3. 调起系统分享面板
    const shareResult = await Share.share({
      title: filename,
      dialogTitle: '保存或分享文件',
      url: uriResult.uri,
    });
    await cleanup();
    return shareResult.activityType !== undefined || shareResult.completed;
  } catch (err) {
    console.error('原生文件分享失败', err);
    await cleanup();

    // 4. 用户在分享面板点"返回"（取消）：属正常行为，静默返回，
    //    不再弹兜底面板、不弹报错提示
    if (isUserCancelled(err)) {
      return false;
    }

    // 5. 兜底：部分机型对某些文件类型无法调起分享面板，
    //    文本内容（JSON/XML/CSV/SVG）改用纯文本方式分享
    if (rawText !== undefined) {
      try {
        const result = await Share.share({ title: filename, text: rawText });
        return result.activityType !== undefined || result.completed;
      } catch (textErr) {
        console.error('文本分享也失败', textErr);
        // 兜底面板同样可能被用户"返回"取消，静默处理
        if (isUserCancelled(textErr)) return false;
        alert(`导出失败：${(textErr as Error)?.message ?? textErr}`);
        return false;
      }
    }

    // 图片/xlsx 等二进制内容无法用文本兜底，直接提示错误
    alert(`导出失败：${(err as Error)?.message ?? err}`);
    return false;
  }
}

/**
 * 二进制数据（ArrayBuffer，如 xlsx）→ base64 data URL
 */
export function arrayBufferToDataUrl(buf: ArrayBuffer, mimeType: string): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000; // 分块拼接避免调用栈溢出
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

/**
 * 统一导出入口（推荐业务代码调用此函数）：
 * - 原生环境：Filesystem + Share
 * - Web 环境：浏览器下载
 *
 * @param filename  文件名（含扩展名）
 * @param content   文本内容（JSON/XML/CSV/SVG 等）
 * @param mimeType  MIME 类型
 * @param fallbackBlob 可选：Web 环境优先使用此 Blob（二进制场景，如 xlsx）
 * @returns 原生环境返回是否成功分享；Web 环境恒为 true
 */
export async function exportFile(
  filename: string,
  content: string,
  mimeType: string,
  fallbackBlob?: Blob
): Promise<boolean> {
  if (isNativePlatform()) {
    // 文本内容直接以 UTF-8 字符串写入，避免 data URL 桥层校验问题
    return shareFileOnNative(filename, content);
  }
  downloadInBrowser(filename, fallbackBlob ?? new Blob([content], { type: mimeType }));
  return true;
}

/**
 * 导出图片（data URL）的统一入口
 *
 * @param filename  文件名（含扩展名）
 * @param dataUrl   html-to-image 生成的 data URL（如 data:image/png;base64,...）
 */
export async function exportImageFile(filename: string, dataUrl: string): Promise<boolean> {
  if (isNativePlatform()) {
    return shareFileOnNative(filename, dataUrl);
  }
  downloadDataUrlInBrowser(filename, dataUrl);
  return true;
}
