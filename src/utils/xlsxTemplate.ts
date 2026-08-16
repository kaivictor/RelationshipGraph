/**
 * XLSX 模板生成与导入解析
 * - 模板：姓名（必填）+ 内置可选属性 + 用户可增删自定义列
 * - 导入：校验后仅加载可用数据，作为独立人物增量添加（不带关系）
 */
import * as XLSX from 'xlsx';
import type { PersonData, Gender } from '../store/useFamilyStore';

// 模板列定义（顺序即模板表头顺序）
// label: 表头显示文字；key: PersonData 字段名或自定义属性 key
export type TemplateColumn = {
  label: string;
  key: string; // 对应 PersonData 字段，或 customAttributes 的 key
  required?: boolean;
  isCustom?: boolean; // 是否为自定义属性
  isArray?: boolean; // 是否为多值字段（用 | 分隔）
};

// 内置列（与 PersonData 字段对应）
export const BUILTIN_COLUMNS: TemplateColumn[] = [
  { label: '姓名', key: 'name', required: true },
  { label: '姓名拼音', key: 'namePinyin' },
  { label: '曾用名', key: 'formerName', isArray: true },
  { label: '称谓', key: 'relationship' },
  { label: '称谓俗称', key: 'popularName', isArray: true },
  { label: '出生年月', key: 'birthDate' },
  { label: '性别', key: 'gender' },
  { label: '文化程度', key: 'education' },
  { label: '手机号', key: 'phone', isArray: true },
  { label: 'QQ号', key: 'qq', isArray: true },
  { label: '微信号', key: 'wechat', isArray: true },
  { label: '邮箱号', key: 'email', isArray: true },
  { label: '住址', key: 'address', isArray: true },
  { label: '车牌号', key: 'licensePlate', isArray: true },
  { label: '哔哩哔哩', key: 'bilibili', isArray: true },
  { label: 'Discord', key: 'discord', isArray: true },
  { label: 'Reddit', key: 'reddit', isArray: true },
  { label: 'Threads', key: 'threads', isArray: true },
  { label: 'WhatsApp', key: 'whatsapp', isArray: true },
  { label: '抖音', key: 'douyin', isArray: true },
  { label: '推特', key: 'twitter', isArray: true },
  { label: '小红书', key: 'xiaohongshu', isArray: true },
  { label: '已离世', key: 'deceased' },
  { label: '离世原因', key: 'deathReason' },
  { label: '死亡日期', key: 'deathDate' },
];

// 性别文字 → 枚举
function parseGender(s: string): Gender {
  const t = String(s || '').trim().toLowerCase();
  if (t === '男' || t === 'male' || t === 'm') return 'male';
  if (t === '女' || t === 'female' || t === 'f') return 'female';
  return 'unknown';
}

// 布尔文字 → boolean
function parseBoolean(s: unknown): boolean {
  const t = String(s ?? '').trim().toLowerCase();
  return t === '是' || t === 'true' || t === '1' || t === 'yes' || t === 'y';
}

// 多值字段：用 | 或换行分隔
function parseArray(s: unknown): string[] | undefined {
  if (s === undefined || s === null) return undefined;
  const str = String(s).trim();
  if (str === '') return undefined;
  // 优先 | 分隔，其次换行，最后逗号
  let parts: string[];
  if (str.includes('|')) {
    parts = str.split('|');
  } else if (str.includes('\n')) {
    parts = str.split('\n');
  } else if (str.includes('，') || str.includes(',')) {
    // 仅对联系方式类用逗号分隔可能误拆，保守起见用 | 和换行
    parts = [str];
  } else {
    parts = [str];
  }
  const arr = parts.map((p) => p.trim()).filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

// 生成模板 xlsx 文件（ArrayBuffer）
export function generateTemplateXlsx(customColumns: { label: string; key: string }[] = []): ArrayBuffer {
  // 合并列：内置列 + 用户自定义列
  const allColumns: TemplateColumn[] = [
    ...BUILTIN_COLUMNS,
    ...customColumns.map((c) => ({ ...c, isCustom: true })),
  ];

  // 表头
  const headers = allColumns.map((c) => c.label);

  // 示例行（帮助理解）
  const sampleRow = allColumns.map((c) => {
    switch (c.key) {
      case 'name': return '张三';
      case 'namePinyin': return 'Zhang San';
      case 'formerName': return '旧名|曾用名';
      case 'relationship': return '父亲';
      case 'popularName': return '老张';
      case 'birthDate': return '1980-05';
      case 'gender': return '男';
      case 'education': return '本科';
      case 'phone': return '13800000000|13900000000';
      case 'deceased': return '';
      case 'deathReason': return '';
      case 'deathDate': return '';
      default: return '';
    }
  });

  // 第二行：必填提示
  const hintRow = allColumns.map((c) => (c.required ? '必填' : '选填'));

  // 构造 worksheet
  const wsData = [headers, hintRow, sampleRow];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // 列宽
  ws['!cols'] = allColumns.map((c) => ({ wch: Math.max(10, c.label.length * 2 + 4) }));

  // 构造 workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '人物信息');

  // 输出为 ArrayBuffer（xlsx 格式）
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

// 触发浏览器下载模板
export function downloadTemplateXlsx(customColumns: { label: string; key: string }[] = []) {
  const buf = generateTemplateXlsx(customColumns);
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '族谱人物导入模板.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 解析导入的 xlsx 文件，返回可用的人物数据数组（独立人物，无关系）
export type ImportXlsxResult = {
  persons: PersonData[];
  skipped: number; // 跳过的无效行数
  errors: string[]; // 错误信息
  detectedCustomColumns: { label: string; key: string }[]; // 检测到的自定义列
};

// 内置字段 label → column 映射（用于识别表头）
const BUILTIN_LABEL_MAP: Record<string, TemplateColumn> = BUILTIN_COLUMNS.reduce((acc, c) => {
  acc[c.label] = c;
  return acc;
}, {} as Record<string, TemplateColumn>);

export function parseXlsxFile(file: File): Promise<ImportXlsxResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const wsName = wb.SheetNames[0];
        if (!wsName) {
          resolve({ persons: [], skipped: 0, errors: ['工作簿中没有工作表'], detectedCustomColumns: [] });
          return;
        }
        const ws = wb.Sheets[wsName];
        // 用 header:1 获取二维数组，便于精确匹配表头
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
        if (rows.length === 0) {
          resolve({ persons: [], skipped: 0, errors: ['工作表为空'], detectedCustomColumns: [] });
          return;
        }

        // 第一行作为表头
        const headerRow = rows[0].map((h) => String(h ?? '').trim());
        // 建立 列索引 → TemplateColumn 映射；识别自定义列
        const colMap: { index: number; col: TemplateColumn }[] = [];
        const detectedCustomColumns: { label: string; key: string }[] = [];
        headerRow.forEach((label, idx) => {
          if (!label) return;
          // 跳过提示行（"必填"/"选填"）误判：仅当 label 命中内置或为非提示文字时才纳入
          if (label === '必填' || label === '选填') return;
          const builtin = BUILTIN_LABEL_MAP[label];
          if (builtin) {
            colMap.push({ index: idx, col: builtin });
          } else {
            // 自定义列：label 作为 key（去重）
            const key = label;
            detectedCustomColumns.push({ label, key });
            colMap.push({ index: idx, col: { label, key, isCustom: true } });
          }
        });

        // 校验：必须有"姓名"列
        const nameCol = colMap.find((c) => c.col.key === 'name');
        if (!nameCol) {
          resolve({ persons: [], skipped: 0, errors: ['未找到"姓名"列（必填）'], detectedCustomColumns });
          return;
        }

        // 找到数据起始行：跳过表头行和可能的"必填/选填"提示行
        let dataStartRow = 1;
        // 如果第 1 行（index=1）的所有值都是"必填"/"选填"，则跳过
        if (rows.length > 1) {
          const secondRow = rows[1];
          const isHintRow = secondRow.every((v, i) => {
            const s = String(v ?? '').trim();
            // 该列在 colMap 中，且值为必填/选填
            return s === '' || s === '必填' || s === '选填';
          });
          if (isHintRow) dataStartRow = 2;
        }

        const persons: PersonData[] = [];
        let skipped = 0;
        const errors: string[] = [];

        for (let r = dataStartRow; r < rows.length; r++) {
          const row = rows[r];
          if (!row) continue;
          // 跳过完全空白的行
          const isEmpty = row.every((v) => String(v ?? '').trim() === '');
          if (isEmpty) continue;

          // 姓名（必填）
          const nameVal = String(row[nameCol.index] ?? '').trim();
          if (!nameVal) {
            skipped++;
            if (errors.length < 5) errors.push(`第 ${r + 1} 行：姓名为空，已跳过`);
            continue;
          }

          const person: PersonData = {
            name: nameVal,
            avatar: '',
            birthDate: '',
            gender: 'unknown',
            relationship: '',
          };
          const customAttrs: { key: string; value: string }[] = [];

          for (const { index, col } of colMap) {
            if (col.key === 'name') continue; // 已处理
            const rawVal = row[index];
            const strVal = String(rawVal ?? '').trim();
            if (strVal === '') continue;

            // 内置字段
            if (!col.isCustom) {
              switch (col.key) {
                case 'gender':
                  person.gender = parseGender(strVal);
                  break;
                case 'deceased':
                  person.deceased = parseBoolean(rawVal);
                  break;
                case 'relationshipOverridden':
                  person.relationshipOverridden = parseBoolean(rawVal);
                  break;
                case 'birthDate':
                case 'deathDate':
                  // 尝试解析日期单元格
                  if (rawVal instanceof Date) {
                    const d = rawVal;
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    if (col.key === 'birthDate') person.birthDate = `${y}-${m}`;
                    else person.deathDate = `${y}-${m}-${String(d.getDate()).padStart(2, '0')}`;
                  } else {
                    // 字符串：尝试 YYYY-MM-DD 或 YYYY-MM 或 YYYY
                    const matched = strVal.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/) || strVal.match(/^(\d{4})$/);
                    if (matched) {
                      const y = matched[1];
                      const m = matched[2] ? String(parseInt(matched[2], 10)).padStart(2, '0') : '01';
                      if (col.key === 'birthDate') {
                        person.birthDate = `${y}-${m}`;
                      } else {
                        const d = matched[3] ? String(parseInt(matched[3], 10)).padStart(2, '0') : '';
                        person.deathDate = d ? `${y}-${m}-${d}` : `${y}-${m}`;
                      }
                    } else {
                      // 无法解析，原样保留
                      if (col.key === 'birthDate') person.birthDate = strVal;
                      else person.deathDate = strVal;
                    }
                  }
                  break;
                case 'formerName':
                case 'popularName':
                case 'phone':
                case 'qq':
                case 'wechat':
                case 'email':
                case 'address':
                case 'licensePlate':
                case 'bilibili':
                case 'discord':
                case 'reddit':
                case 'threads':
                case 'whatsapp':
                case 'douyin':
                case 'twitter':
                case 'xiaohongshu': {
                  const arr = parseArray(rawVal);
                  if (arr) (person as unknown as Record<string, unknown>)[col.key] = arr;
                  break;
                }
                case 'namePinyin':
                case 'relationship':
                case 'education':
                case 'deathReason':
                  (person as unknown as Record<string, unknown>)[col.key] = strVal;
                  break;
                default:
                  break;
              }
            } else {
              // 自定义属性
              customAttrs.push({ key: col.key, value: strVal });
            }
          }

          if (customAttrs.length > 0) {
            person.customAttributes = customAttrs;
          }

          persons.push(person);
        }

        resolve({ persons, skipped, errors, detectedCustomColumns });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}
