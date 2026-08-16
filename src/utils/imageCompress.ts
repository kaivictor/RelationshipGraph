/**
 * 图片压缩工具：将图片文件压缩到指定大小（默认 300KB）并转为 base64
 * 支持自动调整尺寸和质量，优先保证体积达标
 */

const TARGET_SIZE = 300 * 1024; // 300KB
const MIN_QUALITY = 0.3; // 最低质量，避免无限压缩
// 证件照规格：宽:高 = 7:9
const AVATAR_RATIO = 7 / 9;
// 头像最大高度（px），按 7:9 比例换算宽度
const MAX_HEIGHT = 630; // 宽 = 630 * 7/9 = 490

/**
 * 读取 File 为 base64 字符串（不带 data: 前缀的纯 base64）
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 去掉 "data:image/xxx;base64," 前缀
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 将图片按 7:9 证件照比例居中裁剪，并按指定高度/质量导出 base64
 */
function compressToCanvas(
  img: HTMLImageElement,
  targetHeight: number,
  quality: number,
  mimeType: string
): string {
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  // 目标宽高（7:9）
  const targetWidth = Math.round(targetHeight * AVATAR_RATIO);

  // 从原图中裁剪出 7:9 区域（居中裁剪）
  const srcRatio = srcW / srcH;
  const targetRatio = AVATAR_RATIO;
  let cropX = 0, cropY = 0, cropW = srcW, cropH = srcH;
  if (srcRatio > targetRatio) {
    // 原图更宽：裁掉左右
    cropW = srcH * targetRatio;
    cropX = (srcW - cropW) / 2;
  } else {
    // 原图更高：裁掉上下
    cropH = srcW / targetRatio;
    cropY = (srcH - cropH) / 2;
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 canvas 上下文');
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetWidth, targetHeight);
  const dataUrl = canvas.toDataURL(mimeType, quality);
  return dataUrl.split(',')[1];
}

/**
 * 加载图片 File 为 HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * 计算纯 base64 字符串的近似字节大小
 * base64 编码后每 4 字符表示 3 字节
 */
function base64ByteSize(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * 压缩图片到目标大小，返回纯 base64（不含 data: 前缀）
 * 策略：先用最大尺寸+高质量，若超限则逐步降低尺寸和质量
 */
export async function compressImageToBase64(file: File): Promise<string> {
  // 非图片直接读取
  if (!file.type.startsWith('image/')) {
    return fileToBase64(file);
  }

  const img = await loadImage(file);
  // 统一输出 jpeg（照片类压缩率更好；透明背景会丢失，但头像场景可接受）
  const mimeType = 'image/jpeg';

  // 起始参数：按高度缩放（7:9 比例下宽 = height * 7/9）
  let targetHeight = MAX_HEIGHT;
  let quality = 0.85;

  // 第一轮：尝试当前尺寸+质量
  let base64 = compressToCanvas(img, targetHeight, quality, mimeType);

  // 若已达标直接返回
  if (base64ByteSize(base64) <= TARGET_SIZE) return base64;

  // 逐步降低质量
  while (base64ByteSize(base64) > TARGET_SIZE && quality > MIN_QUALITY) {
    quality -= 0.1;
    if (quality < MIN_QUALITY) quality = MIN_QUALITY;
    base64 = compressToCanvas(img, targetHeight, quality, mimeType);
  }

  // 若仍超限，降低尺寸再来一轮
  while (base64ByteSize(base64) > TARGET_SIZE && targetHeight > 160) {
    targetHeight = Math.round(targetHeight * 0.8);
    quality = 0.85;
    while (base64ByteSize(base64) > TARGET_SIZE && quality > MIN_QUALITY) {
      quality -= 0.1;
      if (quality < MIN_QUALITY) quality = MIN_QUALITY;
      base64 = compressToCanvas(img, targetHeight, quality, mimeType);
    }
  }

  return base64;
}
