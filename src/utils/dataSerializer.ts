/**
 * 数据序列化工具：JSON / XML / CSV 导出与导入
 * - JSON / XML：完整数据（含设置、viewport）
 * - CSV：仅人物信息 + 关系（父亲ID/母亲ID/配偶ID），不包含设置
 */
import type { Edge } from '@xyflow/react';
import type { PersonNode, DisplaySettings, ViewportState, EdgeData, PersonData } from '../store/useFamilyStore';

// 本地数组归一化（避免与 useFamilyStore 的循环依赖）
function toArrayValueLocal(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return (v as unknown[]).map((x) => String(x));
  const s = String(v).trim();
  if (s === '') return undefined;
  return s.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
}

export type ExportData = {
  nodes: PersonNode[];
  edges: Edge[];
  displaySettings: DisplaySettings;
  viewport: ViewportState;
};

/* ============ JSON ============ */

export function exportToJSON(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function importFromJSON(text: string): ExportData {
  const parsed = JSON.parse(text);
  if (!parsed.nodes || !parsed.edges) throw new Error('JSON 缺少 nodes 或 edges 字段');
  return parsed as ExportData;
}

/* ============ XML ============ */

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// 人物数据字段（排除 isSelf，它由导出时的"自己"决定，但导入时需保留）
const PERSON_FIELDS: (keyof PersonData)[] = [
  'name', 'namePinyin', 'formerName', 'relationship', 'popularName',
  'avatar', 'birthDate', 'gender', 'education',
  'phone', 'qq', 'wechat', 'email', 'address', 'licensePlate',
  'bilibili', 'discord', 'reddit', 'threads', 'whatsapp', 'douyin', 'twitter', 'xiaohongshu',
  'customFieldValues', 'isSelf', 'deceased', 'deathReason', 'deathDate', 'relationshipOverridden',
  'customAttributes', 'fieldVisibility',
];

export function exportToXML(data: ExportData): string {
  const { nodes, edges, displaySettings, viewport } = data;
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<familyTree>');

  // 节点
  lines.push('  <nodes>');
  for (const node of nodes) {
    lines.push(`    <node id="${escapeXml(node.id)}" type="${escapeXml(node.type || 'person')}">`);
    lines.push(`      <position x="${node.position.x}" y="${node.position.y}" />`);
    lines.push('      <data>');
    for (const key of PERSON_FIELDS) {
      const val = node.data[key];
      if (val === undefined || val === null || val === '') continue;
      if (key === 'customFieldValues' && typeof val === 'object') {
        lines.push('        <customFieldValues>');
        for (const [k, v] of Object.entries(val as Record<string, string>)) {
          lines.push(`          <item key="${escapeXml(k)}" value="${escapeXml(v)}" />`);
        }
        lines.push('        </customFieldValues>');
      } else if (key === 'customAttributes' && Array.isArray(val)) {
        lines.push('        <customAttributes>');
        for (const attr of val as { key: string; value: string; hidden?: boolean }[]) {
          lines.push(`          <item key="${escapeXml(attr.key)}" value="${escapeXml(attr.value)}"${attr.hidden ? ' hidden="true"' : ''} />`);
        }
        lines.push('        </customAttributes>');
      } else if (key === 'fieldVisibility' && typeof val === 'object') {
        lines.push('        <fieldVisibility>');
        for (const [k, v] of Object.entries(val as Record<string, boolean>)) {
          lines.push(`          <item key="${escapeXml(k)}" value="${v}" />`);
        }
        lines.push('        </fieldVisibility>');
      } else if (Array.isArray(val)) {
        // 多值数组字段：用 | 分隔
        lines.push(`        <${key}>${escapeXml((val as string[]).join('|'))}</${key}>`);
      } else {
        lines.push(`        <${key}>${escapeXml(String(val))}</${key}>`);
      }
    }
    lines.push('      </data>');
    lines.push('    </node>');
  }
  lines.push('  </nodes>');

  // 边
  lines.push('  <edges>');
  for (const edge of edges) {
    const d = edge.data as EdgeData | undefined;
    const attrs = [
      `id="${escapeXml(edge.id)}"`,
      `source="${escapeXml(edge.source)}"`,
      `target="${escapeXml(edge.target)}"`,
      `type="${escapeXml(edge.type || '')}"`,
    ].join(' ');
    const inner: string[] = [];
    if (d) {
      inner.push(`      <edgeData type="${escapeXml(d.type)}"${d.disconnected ? ` disconnected="true"` : ''}${d.customLabel ? ` customLabel="${escapeXml(d.customLabel)}"` : ''} />`);
    }
    lines.push(`    <edge ${attrs}>`);
    lines.push(...inner);
    lines.push('    </edge>');
  }
  lines.push('  </edges>');

  // 设置
  lines.push('  <displaySettings>');
  for (const [k, v] of Object.entries(displaySettings)) {
    if (k === 'fieldOrder' || k === 'customFields' || k === 'customFieldVisibility' || k === 'removedBuiltinFields') continue;
    lines.push(`    <${k}>${escapeXml(String(v))}</${k}>`);
  }
  // fieldOrder
  lines.push('    <fieldOrder>');
  for (const f of displaySettings.fieldOrder) {
    lines.push(`      <item>${escapeXml(f)}</item>`);
  }
  lines.push('    </fieldOrder>');
  // customFields
  lines.push('    <customFields>');
  for (const cf of displaySettings.customFields) {
    lines.push(`      <item id="${escapeXml(cf.id)}" label="${escapeXml(cf.label)}" />`);
  }
  lines.push('    </customFields>');
  // customFieldVisibility
  lines.push('    <customFieldVisibility>');
  for (const [k, v] of Object.entries(displaySettings.customFieldVisibility)) {
    lines.push(`      <item key="${escapeXml(k)}" value="${escapeXml(String(v))}" />`);
  }
  lines.push('    </customFieldVisibility>');
  // removedBuiltinFields
  lines.push('    <removedBuiltinFields>');
  for (const f of displaySettings.removedBuiltinFields) {
    lines.push(`      <item>${escapeXml(f)}</item>`);
  }
  lines.push('    </removedBuiltinFields>');
  lines.push('  </displaySettings>');

  // viewport
  lines.push(`  <viewport x="${viewport.x}" y="${viewport.y}" zoom="${viewport.zoom}" />`);

  lines.push('</familyTree>');
  return lines.join('\n');
}

export function importFromXML(text: string): ExportData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('XML 解析失败');

  const root = doc.querySelector('familyTree');
  if (!root) throw new Error('XML 缺少 familyTree 根节点');

  // 解析节点
  const nodes: PersonNode[] = [];
  root.querySelectorAll(':scope > nodes > node').forEach((nodeEl) => {
    const id = nodeEl.getAttribute('id') || '';
    const type = nodeEl.getAttribute('type') || 'person';
    const posEl = nodeEl.querySelector(':scope > position');
    const position = {
      x: Number(posEl?.getAttribute('x') || 0),
      y: Number(posEl?.getAttribute('y') || 0),
    };
    const data: Partial<PersonData> = {};
    const dataEl = nodeEl.querySelector(':scope > data');
    if (dataEl) {
      dataEl.querySelectorAll(':scope > *').forEach((field) => {
        const tagName = field.tagName;
        if (tagName === 'customFieldValues') {
          const obj: Record<string, string> = {};
          field.querySelectorAll(':scope > item').forEach((item) => {
            obj[item.getAttribute('key') || ''] = item.getAttribute('value') || '';
          });
          data.customFieldValues = obj;
        } else if (tagName === 'customAttributes') {
          const arr: { key: string; value: string; hidden?: boolean }[] = [];
          field.querySelectorAll(':scope > item').forEach((item) => {
            const attr: { key: string; value: string; hidden?: boolean } = {
              key: item.getAttribute('key') || '',
              value: item.getAttribute('value') || '',
            };
            if (item.getAttribute('hidden') === 'true') attr.hidden = true;
            arr.push(attr);
          });
          data.customAttributes = arr;
        } else if (tagName === 'fieldVisibility') {
          const obj: Record<string, boolean> = {};
          field.querySelectorAll(':scope > item').forEach((item) => {
            obj[item.getAttribute('key') || ''] = item.getAttribute('value') === 'true';
          });
          data.fieldVisibility = obj;
        } else if (tagName in data || PERSON_FIELDS.includes(tagName as keyof PersonData)) {
          (data as Record<string, unknown>)[tagName] = field.textContent || '';
        }
      });
    }
    // 类型转换：布尔字段从字符串还原
    const raw = data as Record<string, unknown>;
    if (raw.isSelf === 'true') data.isSelf = true;
    else if (raw.isSelf === 'false') data.isSelf = false;
    if (raw.deceased === 'true') data.deceased = true;
    else if (raw.deceased === 'false') data.deceased = false;
    if (raw.relationshipOverridden === 'true') data.relationshipOverridden = true;
    else if (raw.relationshipOverridden === 'false') data.relationshipOverridden = false;
    if (data.gender) data.gender = data.gender as PersonData['gender'];
    // 多值数组字段：从 | 分隔字符串还原
    const arrayFields: (keyof PersonData)[] = [
      'formerName', 'popularName', 'phone', 'qq', 'wechat', 'email', 'address', 'licensePlate',
      'bilibili', 'discord', 'reddit', 'threads', 'whatsapp', 'douyin', 'twitter', 'xiaohongshu',
    ];
    for (const af of arrayFields) {
      const v = raw[af as string];
      if (typeof v === 'string' && v !== '') {
        raw[af as string] = v.split('|').map((s) => s.trim()).filter(Boolean);
      }
    }
    nodes.push({ id, type, position, data: data as PersonData });
  });

  // 解析边
  const edges: Edge[] = [];
  root.querySelectorAll(':scope > edges > edge').forEach((edgeEl) => {
    const id = edgeEl.getAttribute('id') || '';
    const source = edgeEl.getAttribute('source') || '';
    const target = edgeEl.getAttribute('target') || '';
    const type = edgeEl.getAttribute('type') || undefined;
    const edEl = edgeEl.querySelector(':scope > edgeData');
    const data: EdgeData | undefined = edEl
      ? {
          type: (edEl.getAttribute('type') as EdgeData['type']) || 'parent-child',
          disconnected: edEl.getAttribute('disconnected') === 'true' || undefined,
          customLabel: edEl.getAttribute('customLabel') || undefined,
        }
      : undefined;
    edges.push({ id, source, target, type, data });
  });

  // 解析 displaySettings（基本字段）
  const dsEl = root.querySelector(':scope > displaySettings');
  const displaySettings = {} as Partial<DisplaySettings>;
  if (dsEl) {
    dsEl.querySelectorAll(':scope > *').forEach((field) => {
      const tag = field.tagName;
      if (tag === 'fieldOrder') {
        displaySettings.fieldOrder = Array.from(field.querySelectorAll(':scope > item')).map((i) => i.textContent || '');
      } else if (tag === 'customFields') {
        displaySettings.customFields = Array.from(field.querySelectorAll(':scope > item')).map((i) => ({
          id: i.getAttribute('id') || '',
          label: i.getAttribute('label') || '',
        }));
      } else if (tag === 'customFieldVisibility') {
        const obj: Record<string, boolean> = {};
        field.querySelectorAll(':scope > item').forEach((item) => {
          obj[item.getAttribute('key') || ''] = item.getAttribute('value') === 'true';
        });
        displaySettings.customFieldVisibility = obj;
      } else if (tag === 'removedBuiltinFields') {
        displaySettings.removedBuiltinFields = Array.from(field.querySelectorAll(':scope > item')).map((i) => i.textContent || '');
      } else {
        const val = field.textContent || '';
        // 布尔字段
        if (['showNamePinyin','showFormerName','showRelationship','showPopularName','showAvatar','showBirthDate','showAge','showEducation','showPhone','showQq','showWechat','showEmail','showAddress','showLicensePlate','showBilibili','showDiscord','showReddit','showThreads','showWhatsapp','showDouyin','showTwitter','showXiaohongshu','showGrayOnDisconnect','showEdgeRelationship','persistToBrowser','deathDateReplaceBirth','showCanvasHint'].includes(tag)) {
          (displaySettings as Record<string, unknown>)[tag] = val === 'true';
        } else if (tag === 'verticalGapScale') {
          (displaySettings as Record<string, unknown>)[tag] = Number(val);
        }
      }
    });
  }

  // 解析 viewport
  const vpEl = root.querySelector(':scope > viewport');
  const viewport: ViewportState = vpEl
    ? {
        x: Number(vpEl.getAttribute('x') || 0),
        y: Number(vpEl.getAttribute('y') || 0),
        zoom: Number(vpEl.getAttribute('zoom') || 1),
      }
    : { x: 0, y: 0, zoom: 1 };

  return { nodes, edges, displaySettings: displaySettings as DisplaySettings, viewport };
}

/* ============ CSV ============ */

// CSV 转义：含逗号、引号、换行的字段用双引号包裹，内部双引号转义为两个双引号
function escapeCsv(s: string): string {
  const str = String(s ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// 多值字段分隔符：使用 | 避免与 CSV 逗号分隔符冲突
const MULTI_VALUE_SEP = '|';

// 将数组字段转换为 CSV 单元格字符串（用 | 分隔）
function arrayToCsvCell(v: unknown): string {
  const arr = toArrayValueLocal(v);
  if (!arr || arr.length === 0) return '';
  return arr.join(MULTI_VALUE_SEP);
}

export function exportToCSV(data: ExportData): string {
  const { nodes, edges } = data;
  // 构建关系映射（支持多个父/母/配偶）
  const fatherMap = new Map<string, string[]>(); // childId -> fatherId[]
  const motherMap = new Map<string, string[]>(); // childId -> motherId[]
  const spouseMap = new Map<string, string[]>(); // personId -> spouseId[]

  const pushTo = (map: Map<string, string[]>, key: string, val: string) => {
    const arr = map.get(key) || [];
    if (!arr.includes(val)) arr.push(val);
    map.set(key, arr);
  };

  for (const edge of edges) {
    const d = edge.data as EdgeData | undefined;
    if (!d) continue;
    if (d.type === 'parent-child') {
      // source = 父母, target = 子女
      const childId = edge.target;
      const parent = nodes.find((n) => n.id === edge.source);
      if (parent?.data.gender === 'male') pushTo(fatherMap, childId, edge.source);
      else if (parent?.data.gender === 'female') pushTo(motherMap, childId, edge.source);
      else {
        // 性别未知：优先填父位，父位已有则填母位
        const fathers = fatherMap.get(childId) || [];
        if (fathers.length === 0) pushTo(fatherMap, childId, edge.source);
        else pushTo(motherMap, childId, edge.source);
      }
    } else if (d.type === 'spouse') {
      pushTo(spouseMap, edge.source, edge.target);
      pushTo(spouseMap, edge.target, edge.source);
    }
  }

  const headers = [
    'ID', '姓名', '姓名拼音', '曾用名', '称谓', '称谓俗称',
    '出生年月', '性别', '文化程度', '手机号', 'QQ号', '微信号', '邮箱号', '住址', '车牌号',
    '哔哩哔哩', 'Discord', 'Reddit', 'Threads', 'WhatsApp', '抖音', '推特', '小红书',
    '已离世', '离世原因', '死亡日期',
    '父亲ID', '母亲ID', '配偶ID',
  ];
  const lines: string[] = [headers.join(',')];

  for (const node of nodes) {
    const d = node.data;
    const fathers = (fatherMap.get(node.id) || []).join(MULTI_VALUE_SEP);
    const mothers = (motherMap.get(node.id) || []).join(MULTI_VALUE_SEP);
    const spouses = (spouseMap.get(node.id) || []).join(MULTI_VALUE_SEP);
    const genderText = d.gender === 'male' ? '男' : d.gender === 'female' ? '女' : '';
    const row = [
      node.id,
      d.name || '',
      d.namePinyin || '',
      arrayToCsvCell(d.formerName), // 曾用名：| 分隔
      d.relationship || '',
      arrayToCsvCell(d.popularName), // 称谓俗称：| 分隔
      d.birthDate || '',
      genderText,
      d.education || '',
      arrayToCsvCell(d.phone), // 手机号：| 分隔（换行展示的字段统一用 |）
      arrayToCsvCell(d.qq),
      arrayToCsvCell(d.wechat),
      arrayToCsvCell(d.email),
      arrayToCsvCell(d.address),
      arrayToCsvCell(d.licensePlate),
      arrayToCsvCell(d.bilibili),
      arrayToCsvCell(d.discord),
      arrayToCsvCell(d.reddit),
      arrayToCsvCell(d.threads),
      arrayToCsvCell(d.whatsapp),
      arrayToCsvCell(d.douyin),
      arrayToCsvCell(d.twitter),
      arrayToCsvCell(d.xiaohongshu),
      d.deceased ? '是' : '',
      d.deathReason || '',
      d.deathDate || '',
      fathers,
      mothers,
      spouses,
    ].map(escapeCsv);
    lines.push(row.join(','));
  }

  return '\uFEFF' + lines.join('\n'); // BOM 确保 Excel 正确识别 UTF-8
}

// CSV 不支持导入（关系重建复杂，建议用 JSON/XML 导入）
