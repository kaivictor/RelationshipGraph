import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import dagre from 'dagre';
import { calculateRelationships, type Lang } from '../utils/relationship';
import {
  exportToJSON,
  exportToXML,
  exportToCSV,
  importFromJSON,
  importFromXML,
  type ExportData,
} from '../utils/dataSerializer';
import { type Language } from '../i18n';

// 从 URL 参数 ?lang=zh|en 读取初始语言；缺省时读取浏览器偏好
export function getInitialLanguage(): Language {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const langParam = params.get('lang');
      if (langParam === 'en' || langParam === 'zh') return langParam;
    } catch {
      /* ignore */
    }
    const navLang = window.navigator?.language?.toLowerCase() || '';
    if (navLang.startsWith('zh')) return 'zh';
    if (navLang.startsWith('en')) return 'en';
  }
  return 'zh';
}

// 同步语言到 URL（仅更新 ?lang 参数，不刷新页面）与 <html lang>
export function syncLanguageToUrl(lang: Language) {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('lang') !== lang) {
      url.searchParams.set('lang', lang);
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh';
}

// 格式分发：导出
function exportToFormat(data: ExportData, format: 'json' | 'xml' | 'csv'): string {
  if (format === 'xml') return exportToXML(data);
  if (format === 'csv') return exportToCSV(data);
  return exportToJSON(data);
}

// 格式分发：导入（CSV 不支持导入）
function importFromFormat(text: string, format: 'json' | 'xml'): ExportData {
  if (format === 'xml') return importFromXML(text);
  return importFromJSON(text);
}

export type Gender = 'male' | 'female' | 'unknown';

export type PersonData = {
  name: string;
  namePinyin?: string;
  formerName?: string[]; // 多值，逗号连接展示
  relationship: string; // 保持单值（系统计算/手动覆盖），但允许用“，”分隔多个
  popularName?: string[]; // 多值，逗号连接展示
  avatar: string;
  birthDate: string;
  gender: Gender;
  education?: string;
  phone?: string[]; // 多值，换行展示
  qq?: string[];
  wechat?: string[];
  email?: string[];
  address?: string[];
  licensePlate?: string[];
  // 社交媒体（多值，换行展示）
  bilibili?: string[];
  discord?: string[];
  reddit?: string[];
  threads?: string[];
  whatsapp?: string[];
  douyin?: string[];
  twitter?: string[];
  xiaohongshu?: string[];
  customFieldValues?: Record<string, string>;
  isSelf?: boolean;
  customAttributes?: { key: string; value: string; hidden?: boolean }[];
  // 个人级字段显隐覆盖：key 为字段名，value 为是否显示。未设置时使用全局设置
  fieldVisibility?: Record<string, boolean>;
  deceased?: boolean;
  deathReason?: string;
  deathDate?: string; // 格式 YYYY-MM-DD 或 YYYY-MM 或空
  relationshipOverridden?: boolean;
  // 用户是否手动垂直拖动过该节点：true 时布局重算会保留其 Y
  yOverridden?: boolean;
};

// 多值字段名集合
export const MULTI_VALUE_FIELDS: (keyof PersonData)[] = [
  'formerName', 'popularName', 'phone', 'qq', 'wechat', 'email', 'address', 'licensePlate',
  'bilibili', 'discord', 'reddit', 'threads', 'whatsapp', 'douyin', 'twitter', 'xiaohongshu',
];

// 将任意值归一化为数组（兼容旧版字符串数据）
export function toArrayValue(v: unknown): string[] | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return (v as unknown[]).map((x) => String(x));
  const s = String(v).trim();
  if (s === '') return undefined;
  // 旧字符串按逗号分隔
  return s.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
}

// 取首个值用于单值展示场景
export function firstValue(v: unknown): string {
  const arr = toArrayValue(v);
  return arr && arr.length > 0 ? arr[0] : '';
}

export type PersonNode = Node<PersonData>;

// 内置字段中文标签（与 PersonNode 中定义保持一致）
const BUILTIN_LABELS: Record<string, string> = {
  phone: '手机号',
  qq: 'QQ号',
  wechat: '微信号',
  email: '邮箱号',
  address: '住址',
  licensePlate: '车牌号',
  bilibili: '哔哩哔哩',
  discord: 'Discord',
  reddit: 'Reddit',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
  douyin: '抖音',
  twitter: '推特',
  xiaohongshu: '小红书',
};

// 英文字段标签（用于英文朗读/界面）
const BUILTIN_LABELS_EN: Record<string, string> = {
  phone: 'Phone',
  qq: 'QQ',
  wechat: 'WeChat',
  email: 'Email',
  address: 'Address',
  licensePlate: 'License plate',
  bilibili: 'Bilibili',
  discord: 'Discord',
  reddit: 'Reddit',
  threads: 'Threads',
  whatsapp: 'WhatsApp',
  douyin: 'Douyin',
  twitter: 'Twitter',
  xiaohongshu: 'Xiaohongshu',
};

function formatBirthDate(birthDate: string, lang: string): string {
  if (!birthDate) return '';
  const parts = birthDate.split('-');
  if (parts.length < 2) return birthDate;
  if (lang === 'en') return `${parts[0]}-${parts[1]}`;
  return `${parts[0]}年${parts[1]}月`;
}

function formatDeathDate(deathDate: string, lang: string): string {
  if (!deathDate) return '';
  const parts = deathDate.split('-');
  if (lang === 'en') {
    if (parts.length >= 3) return `${parts[0]}-${parts[1]}-${parts[2]}`;
    if (parts.length === 2) return `${parts[0]}-${parts[1]}`;
    return deathDate;
  }
  if (parts.length >= 3) return `${parts[0]}年${parts[1]}月${parts[2]}日`;
  if (parts.length === 2) return `${parts[0]}年${parts[1]}月`;
  return deathDate;
}

function calculateAge(birthDate: string, deathDate?: string): number | null {
  if (!birthDate) return null;
  const parts = birthDate.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return null;
  const ref = deathDate ? new Date(deathDate) : new Date();
  if (isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - year;
  const refMonth = ref.getMonth() + 1;
  if (refMonth < month) {
    age--;
  } else if (refMonth === month) {
    const day = parts[2] ? parseInt(parts[2], 10) : 1;
    if (ref.getDate() < day) age--;
  }
  return age;
}

/**
 * 为屏幕阅读器生成「所见即所读」的节点描述。
 * 仅描述当前显示开关下可见的字段，并简要介绍与此人有直接关联的人。
 * 该函数在渲染层（持有 displaySettings 与 edges 上下文）调用，确保与卡片显示一致。
 */
export function buildNodeAriaLabelVisible(
  id: string,
  data: PersonData,
  displaySettings: DisplaySettings,
  nodes?: PersonNode[],
  edges?: Edge[],
  hiddenNodeIds?: Set<string>
): string {
  const lang = useRelationshipStore.getState().language;
  const A = (zh: string, en: string) => (lang === 'en' ? en : zh);
  const join = lang === 'en' ? ', ' : '、';
  const parts: string[] = [];

  // 姓名 + 性别
  const genderText =
    data.gender === 'male' ? A('男', 'male') : data.gender === 'female' ? A('女', 'female') : A('性别未知', 'unknown gender');
  const namePrefix = data.isSelf ? A('本人', 'self') : '';
  const namePart = `${data.name || A('未命名', 'unnamed')}${namePrefix ? `（${namePrefix}）` : ''}`;
  parts.push(`${namePart}，${A('性别', 'gender')}${genderText}`);

  // 个人级字段可见性覆盖（与 PersonNode 逻辑一致）
  const isBasicVisible = (key: string, globalVisible: boolean): boolean => {
    if (data.fieldVisibility && key in data.fieldVisibility) return data.fieldVisibility[key];
    return globalVisible;
  };

  // 称谓
  if (isBasicVisible('relationship', displaySettings.showRelationship) && data.relationship) {
    parts.push(`${A('称谓', 'kin term')}：${data.relationship}`);
  }
  // 俗称
  const popNames = toArrayValue(data.popularName) || [];
  if (isBasicVisible('popularName', displaySettings.showPopularName) && popNames.length > 0) {
    parts.push(`${A('俗称', 'colloquial name')}：${popNames.join(join)}`);
  }
  // 曾用名
  const formerNames = toArrayValue(data.formerName) || [];
  if (isBasicVisible('formerName', displaySettings.showFormerName) && formerNames.length > 0) {
    parts.push(`${A('曾用名', 'former name')}：${formerNames.join(join)}`);
  }
  // 出生/离世信息行（与卡片 infoLine 一致）
  if (isBasicVisible('birthDate', true)) {
    const age = displaySettings.showAge ? calculateAge(data.birthDate, data.deathDate) : null;
    const showAgeNum = age !== null && age >= 0;
    const birthStr = displaySettings.showBirthDate && data.birthDate ? formatBirthDate(data.birthDate, lang) : '';
    const useDeathReplace = data.deceased && data.deathDate && displaySettings.deathDateReplaceBirth;
    const deathStr = useDeathReplace ? formatDeathDate(data.deathDate!, lang) : '';
    const ageUnit = A('岁', ' yrs');
    const infoLine = useDeathReplace
      ? [showAgeNum ? `${age}${ageUnit}` : '', deathStr].filter(Boolean).join(' · ')
      : [birthStr, showAgeNum ? `${age}${ageUnit}` : ''].filter(Boolean).join(' · ');
    if (infoLine) parts.push(`${A('出生', 'birth')}/${useDeathReplace ? A('离世', 'death') : A('年龄', 'age')}：${infoLine}`);
  }
  // 文化程度
  if (isBasicVisible('education', displaySettings.showEducation) && data.education) {
    parts.push(`${A('学历', 'education')}：${data.education}`);
  }

  // 可拖拽字段（可见且有值才读）
  const getFieldValues = (key: string): string[] => {
    let raw: unknown;
    if (key === 'phone') raw = data.phone;
    else if (key === 'qq') raw = data.qq;
    else if (key === 'wechat') raw = data.wechat;
    else if (key === 'email') raw = data.email;
    else if (key === 'address') raw = data.address;
    else if (key === 'licensePlate') raw = data.licensePlate;
    else if (key === 'bilibili') raw = data.bilibili;
    else if (key === 'discord') raw = data.discord;
    else if (key === 'reddit') raw = data.reddit;
    else if (key === 'threads') raw = data.threads;
    else if (key === 'whatsapp') raw = data.whatsapp;
    else if (key === 'douyin') raw = data.douyin;
    else if (key === 'twitter') raw = data.twitter;
    else if (key === 'xiaohongshu') raw = data.xiaohongshu;
    else raw = data.customFieldValues?.[key];
    return toArrayValue(raw) || [];
  };
  const isFieldVisible = (key: string): boolean => {
    if (data.fieldVisibility && key in data.fieldVisibility) return data.fieldVisibility[key];
    const toggleMap: Record<string, boolean> = {
      phone: displaySettings.showPhone,
      qq: displaySettings.showQq,
      wechat: displaySettings.showWechat,
      email: displaySettings.showEmail,
      address: displaySettings.showAddress,
      licensePlate: displaySettings.showLicensePlate,
      bilibili: displaySettings.showBilibili,
      discord: displaySettings.showDiscord,
      reddit: displaySettings.showReddit,
      threads: displaySettings.showThreads,
      whatsapp: displaySettings.showWhatsapp,
      douyin: displaySettings.showDouyin,
      twitter: displaySettings.showTwitter,
      xiaohongshu: displaySettings.showXiaohongshu,
    };
    if (key in toggleMap) return toggleMap[key];
    return displaySettings.customFieldVisibility[key] ?? true;
  };
  const getLabel = (key: string): string =>
    (lang === 'en' && BUILTIN_LABELS_EN[key] ? BUILTIN_LABELS_EN[key] : BUILTIN_LABELS[key]) ??
    displaySettings.customFields.find((f) => f.id === key)?.label ??
    key;

  for (const key of displaySettings.fieldOrder) {
    if (!isFieldVisible(key)) continue;
    const values = getFieldValues(key);
    if (values.length === 0) continue;
    // 联系方式字段标注「可显示二维码」
    const qrNote = QR_VISIBLE_FIELDS.has(key) ? A('（可显示二维码）', ' (QR available)') : '';
    parts.push(`${getLabel(key)}：${values.join(join)}${qrNote}`);
  }
  // 个人自定义属性（与全局同名的已被全局优先，故跳过）
  const globalCustomLabels = displaySettings.customFields.map((f) => f.label);
  for (const attr of data.customAttributes || []) {
    if (attr.key && attr.value && !attr.hidden && !globalCustomLabels.includes(attr.key)) {
      parts.push(`${attr.key}：${attr.value}`);
    }
  }

  // 直接关联的人（与卡片显示一致：父母/子女/爱人/其他）
  // 注意：被隐藏（含间接隐藏）的人物不再朗读，避免读出不可见对象。
  const related: { role: string; names: string[] }[] = [];
  // 优先使用带引用缓存的全局 Map，避免每节点重复重建整张 Map（O(V²) → O(V)）
  const nameById = nodes ? new Map(nodes.map((n) => [n.id, n.data?.name])) : getNodeNameMap();
  const edgeList = edges ?? useRelationshipStore.getState().edges;
  const isVisiblePerson = (nid: string): boolean => !hiddenNodeIds || !hiddenNodeIds.has(nid);
  const parents: string[] = [];
  const children: string[] = [];
  const spouses: string[] = [];
  const others: string[] = [];
  for (const e of edgeList) {
    if (e.source !== id && e.target !== id) continue;
    const t = (e.data as EdgeData | undefined)?.type;
    if (t === 'parent-child') {
      if (e.target === id) {
        if (isVisiblePerson(e.source)) parents.push(nameById.get(e.source) || A('未知', 'unknown'));
      } else if (e.source === id) {
        if (isVisiblePerson(e.target)) children.push(nameById.get(e.target) || A('未知', 'unknown'));
      }
    } else if (t === 'spouse') {
      const other = e.source === id ? e.target : e.source;
      if (isVisiblePerson(other)) spouses.push(nameById.get(other) || A('未知', 'unknown'));
    } else if (t === 'custom') {
      const other = e.source === id ? e.target : e.source;
      if (isVisiblePerson(other)) {
        const label = (e.data as EdgeData | undefined)?.customLabel;
        others.push(label ? `${nameById.get(other) || A('未知', 'unknown')}（${label}）` : (nameById.get(other) || A('未知', 'unknown')));
      }
    }
  }
  if (parents.length) related.push({ role: A('父母', 'Parents'), names: parents });
  if (children.length) related.push({ role: A('子女', 'Children'), names: children });
  if (spouses.length) related.push({ role: A('爱人', 'Spouse'), names: spouses });
  if (others.length) related.push({ role: A('其他', 'Other'), names: others });
  if (related.length) {
    const relatedText = related
      .map((r) => `${r.role}：${r.names.join(join)}`)
      .join(lang === 'en' ? '; ' : '；');
    parts.push(`${A('关联', 'Related')}：${relatedText}`);
  }

  return parts.join(lang === 'en' ? ', ' : '，');
}

// 联系方式字段（支持长按显示二维码）：在描述中标注，与卡片一致
const QR_VISIBLE_FIELDS = new Set<string>([
  'phone',
  'qq',
  'wechat',
  'email',
  'address',
  'licensePlate',
]);

/**
 * 为屏幕阅读器生成「边（连线）」的可读描述。
 * 包含连线两端的姓名、关系类型，以及方向（如「父→子 / 夫→妻 / 本人→同学」）。
 */
export function buildEdgeAriaLabel(
  edge: Edge,
  nodes?: PersonNode[]
): string {
  const lang = useRelationshipStore.getState().language;
  const A = (zh: string, en: string) => (lang === 'en' ? en : zh);
  // 优先使用带引用缓存的全局 Map（避免每条边都重建一遍整张 Map）；
  // 若调用方显式传入了 nodes（旧路径）则回退为该次局部构建，行为保持一致。
  const nameById = nodes
    ? new Map(nodes.map((n) => [n.id, n.data?.name || A('未命名', 'unnamed')]))
    : getNodeNameMap();
  const genderById = nodes
    ? new Map(nodes.map((n) => [n.id, (n.data as { gender?: string })?.gender]))
    : getNodeGenderMap();
  const sourceName = nameById.get(edge.source) || A('未命名', 'unnamed');
  const targetName = nameById.get(edge.target) || A('未命名', 'unnamed');
  const sourceGender = genderById.get(edge.source);
  const targetGender = genderById.get(edge.target);
  const data = edge.data as EdgeData | undefined;
  const type = data?.type;
  let relation = A('关系', 'relation');
  let direction = '';

  if (type === 'parent-child') {
    if (edge.source === edge.target) {
      relation = sourceGender === 'female' ? A('母女关系', 'mother-daughter') : A('父子关系', 'father-son');
    } else {
      // source=父母，target=子女；根据双方性别说出具体称谓
      const parentWord = sourceGender === 'female' ? A('母亲', 'mother') : sourceGender === 'male' ? A('父亲', 'father') : A('家长', 'parent');
      direction = `（${sourceName} ${A('是', 'is the')} ${targetName} ${A('的', '')}${parentWord}）`;
    }
  } else if (type === 'spouse') {
    relation = data?.disconnected ? A('爱人关系（已断开）', 'spouse (disconnected)') : A('爱人关系', 'spouse');
    // 爱人关系无方向（互为爱人），不使用「配偶」称呼
    direction = `（${sourceName} ${A('与', 'and')} ${targetName} ${A('互为爱人', 'are spouses')}）`;
  } else if (type === 'custom') {
    // 「其他」类型关系无方向，仅描述关系称谓
    const customLabel = data?.customLabel || A('自定义关系', 'custom relation');
    relation = `${A('关系', 'relation')}：${customLabel}`;
    direction = '';
  } else {
    direction = '';
  }

  return `${A('连线', 'Link')}：${sourceName} ${relation} ${targetName}${direction}`;
}

export type CustomFieldDef = { id: string; label: string };

export type DisplaySettings = {
  showNamePinyin: boolean;
  showFormerName: boolean;
  showRelationship: boolean;
  showPopularName: boolean;
  showAvatar: boolean;
  showBirthDate: boolean;
  showAge: boolean;
  showEducation: boolean;
  showPhone: boolean;
  showQq: boolean;
  showWechat: boolean;
  showEmail: boolean;
  showAddress: boolean;
  showLicensePlate: boolean;
  // 社交媒体显示开关
  showBilibili: boolean;
  showDiscord: boolean;
  showReddit: boolean;
  showThreads: boolean;
  showWhatsapp: boolean;
  showDouyin: boolean;
  showTwitter: boolean;
  showXiaohongshu: boolean;
  fieldOrder: string[];
  customFields: CustomFieldDef[];
  customFieldVisibility: Record<string, boolean>;
  // 已删除的内置字段（从详情面板和节点中移除，可恢复）
  removedBuiltinFields: string[];
  verticalGapScale: number;
  showGrayOnDisconnect: boolean;
  showEdgeRelationship: boolean;
  persistToBrowser: boolean;
  deathDateReplaceBirth: boolean; // 离世日期代替出生日期
  showCanvasHint: boolean; // 是否显示画布左上角提示
  showStatsBadge: boolean; // 是否在节点底部显示关系统计徽章
  showCoordinateSystem: boolean; // 是否显示坐标系（以10年为单位显示浅色横线）
  allowVerticalMove: boolean; // 是否允许垂直拖动节点（开启后调整的角色将脱离年龄坐标系）
  coordinateLineStep: number; // 坐标系横线稀疏度：每 N 年一条（5年起步）
};

export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

// 边的数据类型
export type EdgeData = {
  type: 'spouse' | 'parent-child' | 'custom';
  disconnected?: boolean;
  collapsed?: boolean; // 隐藏状态（桥语义：概念上断开该边）
  customLabel?: string; // 自定义关系称谓（如同学、同事、朋友），相对于 source 端
};

// 撤销快照：记录某次「大操作」前的完整状态
export type UndoSnapshot = {
  label: string;
  nodes: PersonNode[];
  edges: Edge[];
  grayedNodeIds: Set<string>;
  hiddenNodeIds: Set<string>;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  displaySettings: DisplaySettings;
  focusNodeId: string | null; // 聚焦分析模式：以该人物为可见性中心（本身被隐藏）
  // force 模式（第二次点击"全部"）额外隐藏的节点记录：key=`${nodeId}:${category}`，value=额外隐藏的节点 id 集合
  // "无"恢复时据此还原全部被级联隐藏的节点（含"自己"）
  forceHiddenMap: Map<string, Set<string>>;
};

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showNamePinyin: false,
  showFormerName: false,
  showRelationship: true,
  showPopularName: false,
  showAvatar: true,
  showBirthDate: true,
  showAge: true,
  showEducation: false,
  showPhone: false,
  showQq: false,
  showWechat: false,
  showEmail: false,
  showAddress: false,
  showLicensePlate: false,
  // 社交媒体默认隐藏
  showBilibili: false,
  showDiscord: false,
  showReddit: false,
  showThreads: false,
  showWhatsapp: false,
  showDouyin: false,
  showTwitter: false,
  showXiaohongshu: false,
  fieldOrder: ['phone', 'qq', 'wechat', 'email', 'address', 'licensePlate', 'bilibili', 'discord', 'reddit', 'threads', 'whatsapp', 'douyin', 'twitter', 'xiaohongshu'],
  customFields: [],
  customFieldVisibility: {},
  removedBuiltinFields: [],
  verticalGapScale: 1,
  showGrayOnDisconnect: true,
  showEdgeRelationship: true,
  persistToBrowser: true,
  deathDateReplaceBirth: true,
  showCanvasHint: true,
  showStatsBadge: true,
  showCoordinateSystem: false,
  allowVerticalMove: false,
  coordinateLineStep: 10,
};

interface RelationshipState {
  nodes: PersonNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  displaySettings: DisplaySettings;
  grayedNodeIds: Set<string>;
  hiddenNodeIds: Set<string>; // 手动隐藏的节点集合（"隐藏此人"），自己不可隐藏
  focusNodeId: string | null; // 聚焦分析模式：以该人物为可见性中心（本身被隐藏），与其不连通的人（含"自己"）一并隐藏
  // force 模式（第二次点击"全部"）额外隐藏的节点记录：key=`${nodeId}:${category}`，value=额外隐藏的节点 id 集合
  forceHiddenMap: Map<string, Set<string>>;
  viewport: ViewportState;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addPerson: (data: PersonData, position: { x: number; y: number }) => string;
  updatePerson: (id: string, data: Partial<PersonData>) => void;
  /** 实时更新：仅更新节点数据，不push undo、不重算称谓，用于详情面板编辑即时生效 */
  updatePersonLive: (id: string, data: Partial<PersonData>) => void;
  deletePerson: (id: string, cascadeDescendants?: boolean) => void;
  /**
   * 计算删除某人时，可级联删除的晚辈集合。
   * 规则：从该人出发向下遍历 parent-child 边，仅保留「只有这一条父辈线、且无其它长辈/同辈/爱人/自定义关系」的晚辈。
   * 即：若某晚辈还有另一个父/母（未被删除）、或有爱人/兄弟/自定义关系，则不删。
   * 返回的集合不含传入的 id 本身。
   */
  getDescendantsForCascade: (id: string) => string[];
  addRelative: (sourceId: string, type: 'parent' | 'child' | 'spouse' | 'custom', data: PersonData, customLabel?: string) => void;
  connectExisting: (sourceId: string, targetId: string, type: 'parent' | 'child' | 'spouse' | 'custom', customLabel?: string) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;
  // 全局设置面板的收起状态（提升到 store，避免组件卸载/重挂时丢失）
  settingsPanelCollapsed: boolean;
  setSettingsPanelCollapsed: (v: boolean) => void;
  // 连线点击悬浮菜单（提升到 store，便于跨组件关闭）
  edgeMenu: { edgeId: string; x: number; y: number } | null;
  setEdgeMenu: (v: { edgeId: string; x: number; y: number } | null) => void;
  /** 切换某节点的选中状态（累加选择，不清除其他节点） */
  toggleNodeSelected: (id: string) => void;
  /** 设置多选：仅给定 ID 的节点为选中，同时更新 selectedNodeId 为最后一个 */
  applyMultiSelect: (ids: string[]) => void;
  updateDisplaySettings: (patch: Partial<DisplaySettings>) => void;
  disconnectEdge: (edgeId: string) => void;
  reconnectEdge: (edgeId: string) => void;
  /** 修改边的关系类型（parent-child/spouse/custom） */
  updateEdgeType: (edgeId: string, newType: 'parent-child' | 'spouse' | 'custom', customLabel?: string) => void;
  /** 修改边的某一端节点（'source' 或 'target'） */
  updateEdgeEndpoint: (edgeId: string, end: 'source' | 'target', newNodeId: string) => void;
  /** 交换边的两端（source<->target），用于反转方向 */
  swapEdgeDirection: (edgeId: string) => void;
  /** 删除边（彻底删除，区别于断开） */
  deleteEdge: (edgeId: string) => void;
  /** 隐藏单条关系（隐藏该关系及其携带的其他关系） */
  collapseEdge: (edgeId: string) => void;
  /** 展开单条关系（仅内部使用：取消隐藏某条边） */
  expandEdge: (edgeId: string) => void;
  /** 按类别批量隐藏/展开某节点的所有同类关系。返回是否成功（守卫失败时返回原因） */
  setCategoryFold: (
    nodeId: string,
    category: 'parents' | 'children' | 'spouse' | 'other' | string,
    state: 'all' | 'none',
    options?: { force?: boolean }
  ) => { ok: true } | { ok: false; reason: string };
  /** 隐藏此人（自己不可隐藏）：该人及缺失该人（割点）后从"自己"不可达的人一并隐藏 */
  hidePerson: (id: string) => void;
  /** 取消隐藏某人（其携带隐藏的人自动恢复显示） */
  unhidePerson: (id: string) => void;
  /** 全部取消隐藏：清空 hiddenNodeIds + 取消所有边的 collapsed 标记 */
  unhideAll: () => void;
  /** 聚焦分析：隐藏所选人物，并隐藏与其不连通的所有人（含"自己"）。用于分析某人的人际关系 */
  focusOnPerson: (id: string) => void;
  /** 退出聚焦分析：恢复所选人物显示，返回以"自己"为可见性中心的视图 */
  clearFocusMode: () => void;
  setAsSelf: (id: string) => void;
  setViewport: (vp: ViewportState) => void;
  // 界面语言（中/英），与 URL ?lang= 参数及 <html lang> 同步
  language: Language;
  setLanguage: (lang: Language) => void;
  clearBrowserData: () => void;
  layoutGraph: () => void;
  recalculateRelationships: () => void;
  exportData: (format?: 'json' | 'xml' | 'csv') => string;
  importData: (text: string, format?: 'json' | 'xml') => void;
  /** 增量导入人物（独立人物，无关系），返回新增节点数 */
  importPersonsIncremental: (persons: PersonData[]) => number;
  // 连线模式
  connectionMode: 'off' | 'auto' | 'parent-child' | 'spouse' | 'custom';
  connectionCustomLabel: string;
  connectFirstNodeId: string | null;
  setConnectionMode: (mode: 'off' | 'auto' | 'parent-child' | 'spouse' | 'custom', customLabel?: string) => void;
  /** 连线模式：点击节点。若已有起点则建立关系并重置；否则记录起点。返回是否完成一次连线 */
  clickNodeInConnectMode: (nodeId: string) => { connected: boolean; edgeType?: string; reason?: string };
  resetConnectSelection: () => void;
  // 帮助页面
  showHelpPage: boolean;
  setShowHelpPage: (v: boolean) => void;
  undoStack: UndoSnapshot[];
  undo: () => void;
  canUndo: () => boolean;
  clearUndo: () => void;
}

const initialNodes: PersonNode[] = [
  { id: 'n1', type: 'person', position: { x: 0, y: 0 }, data: { name: '曾祖父', avatar: '', relationship: '曾祖父', birthDate: '1930-01', gender: 'male' } },
  { id: 'n2', type: 'person', position: { x: 0, y: 0 }, data: { name: '曾祖母', avatar: '', relationship: '曾祖母', birthDate: '1932-05', gender: 'female' } },
  { id: 'n3', type: 'person', position: { x: 0, y: 0 }, data: { name: '爷爷', avatar: '', relationship: '爷爷', birthDate: '1955-03', gender: 'male' } },
  { id: 'n4', type: 'person', position: { x: 0, y: 0 }, data: { name: '奶奶', avatar: '', relationship: '奶奶', birthDate: '1958-07', gender: 'female' } },
  { id: 'n5', type: 'person', position: { x: 0, y: 0 }, data: { name: '爸爸', namePinyin: 'Zhang Wei', avatar: '', relationship: '爸爸', birthDate: '1980-02', gender: 'male', education: '硕士', phone: ['13900139000'], qq: ['12345678'] } },
  { id: 'n6', type: 'person', position: { x: 0, y: 0 }, data: { name: '妈妈', avatar: '', relationship: '妈妈', birthDate: '1982-09', gender: 'female' } },
  { id: 'n7', type: 'person', position: { x: 0, y: 0 }, data: { name: '叔叔', avatar: '', relationship: '叔叔', birthDate: '1985-11', gender: 'male' } },
  { id: 'self', type: 'person', position: { x: 0, y: 0 }, data: { name: '自己', namePinyin: 'Zhang San', formerName: ['张小三'], avatar: '', relationship: '自己', popularName: ['小三'], birthDate: '2005-06', gender: 'male', education: '本科', phone: ['13800138000'], wechat: ['zhangsan_wx'], email: ['zhangsan@example.com'], address: ['北京市朝阳区'], licensePlate: ['京A88888'], isSelf: true } },
  { id: 'n9', type: 'person', position: { x: 0, y: 0 }, data: { name: '妹妹', avatar: '', relationship: '妹妹', birthDate: '2008-08', gender: 'female' } },
  { id: 'n10', type: 'person', position: { x: 0, y: 0 }, data: { name: '爱人', avatar: '', relationship: '爱人', birthDate: '2006-04', gender: 'female' } },
  { id: 'n11', type: 'person', position: { x: 0, y: 0 }, data: { name: '儿子', avatar: '', relationship: '儿子', birthDate: '2030-01', gender: 'male' } },
  { id: 'n12', type: 'person', position: { x: 0, y: 0 }, data: { name: '女儿', avatar: '', relationship: '女儿', birthDate: '2032-03', gender: 'female' } },
];

const initialEdges: Edge[] = [
  { id: 'e-n1-n2', source: 'n1', target: 'n2', data: { type: 'spouse' }, type: 'spouse' },
  { id: 'e-n1-n3', source: 'n1', target: 'n3', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n2-n3', source: 'n2', target: 'n3', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n3-n4', source: 'n3', target: 'n4', data: { type: 'spouse' }, type: 'spouse' },
  { id: 'e-n3-n5', source: 'n3', target: 'n5', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n4-n5', source: 'n4', target: 'n5', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n3-n7', source: 'n3', target: 'n7', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n4-n7', source: 'n4', target: 'n7', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n5-n6', source: 'n5', target: 'n6', data: { type: 'spouse' }, type: 'spouse' },
  { id: 'e-n5-self', source: 'n5', target: 'self', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n6-self', source: 'n6', target: 'self', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n5-n9', source: 'n5', target: 'n9', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n6-n9', source: 'n6', target: 'n9', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-self-n10', source: 'self', target: 'n10', data: { type: 'spouse' }, type: 'spouse' },
  { id: 'e-self-n11', source: 'self', target: 'n11', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n10-n11', source: 'n10', target: 'n11', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-self-n12', source: 'self', target: 'n12', data: { type: 'parent-child' }, type: 'parent-child' },
  { id: 'e-n10-n12', source: 'n10', target: 'n12', data: { type: 'parent-child' }, type: 'parent-child' },
];

// 浏览器持久化 key
const STORAGE_KEY = 'relationship-state-v1';
// 旧版 key（FamilyTree 时期），用于自动迁移旧数据
const LEGACY_STORAGE_KEY = 'family-tree-state-v1';

type PersistedState = {
  nodes: PersonNode[];
  edges: Edge[];
  displaySettings: DisplaySettings;
  viewport: ViewportState;
  hiddenNodeIds?: string[]; // 手动隐藏的节点（"隐藏此人"）
  focusNodeId?: string | null; // 聚焦分析模式中心人物
};

/**
 * 从 localStorage 加载持久化状态
 */
function loadPersistedState(): PersistedState | null {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    // 兼容旧版数据：新 key 无数据时尝试旧 key，并迁移到新 key
    if (!raw) {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        raw = legacyRaw;
        try {
          localStorage.setItem(STORAGE_KEY, legacyRaw);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (e) {
          console.error('迁移旧版数据失败', e);
        }
      }
    }
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.nodes || !data.edges) return null;
    const displaySettings = { ...DEFAULT_DISPLAY_SETTINGS, ...(data.displaySettings || {}) };
    // 补全 fieldOrder 中缺失的内置字段（新版本新增的内置字段自动加入末尾）
    const ALL_BUILTIN_KEYS = ['phone', 'qq', 'wechat', 'email', 'address', 'licensePlate', 'bilibili', 'discord', 'reddit', 'threads', 'whatsapp', 'douyin', 'twitter', 'xiaohongshu'];
    const removedSet = new Set(displaySettings.removedBuiltinFields || []);
    for (const k of ALL_BUILTIN_KEYS) {
      if (!displaySettings.fieldOrder.includes(k) && !removedSet.has(k)) {
        displaySettings.fieldOrder.push(k);
      }
    }
    // 若上次关闭了"在浏览器中保存数据"，不加载持久化数据，使用示例数据
    if (!displaySettings.persistToBrowser) return null;
    return {
      nodes: data.nodes,
      edges: data.edges,
      displaySettings,
      viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
      hiddenNodeIds: Array.isArray(data.hiddenNodeIds) ? data.hiddenNodeIds : undefined,
      focusNodeId: typeof data.focusNodeId === 'string' ? data.focusNodeId : null,
    };
  } catch (e) {
    console.error('加载浏览器数据失败', e);
    return null;
  }
}

/**
 * 保存状态到 localStorage（仅当 persistToBrowser 开启时）
 */
function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('保存浏览器数据失败', e);
  }
}

// 将单个节点的多值字段归一化为数组（兼容旧版字符串数据）
function normalizeNodeData(node: PersonNode): PersonNode {
  const data = { ...node.data } as Record<string, unknown>;
  let changed = false;
  for (const f of MULTI_VALUE_FIELDS) {
    const v = data[f as string];
    const arr = toArrayValue(v);
    if (arr !== undefined) {
      data[f as string] = arr;
      changed = true;
    } else if (v !== undefined && v !== null) {
      // 空字符串等清空为 undefined
      data[f as string] = undefined;
      changed = true;
    }
  }
  // 无障碍：覆盖库默认的英文 "node" 角色描述（ariaLabel 在渲染层依据显示开关与连线生成）
  return {
    ...node,
    data: data as PersonData,
    ariaRole: 'group',
    domAttributes: { ...(node.domAttributes ?? {}), 'aria-roledescription': '人物' },
  };
}

function normalizeNodes(nodes: PersonNode[]): PersonNode[] {
  return nodes.map(normalizeNodeData);
}

// 根据出生年月计算年龄（用于连线模式自动判断）
// birthDate 格式：YYYY-MM 或 YYYY-MM-DD；deathDate 同上（若有则截止到离世时）
function calcAgeFromBirth(birthDate: string, deathDate?: string): number | null {
  if (!birthDate) return null;
  const parts = birthDate.split('-');
  const year = parseInt(parts[0], 10);
  const month = parts[1] ? parseInt(parts[1], 10) : 1;
  if (isNaN(year) || isNaN(month)) return null;
  const ref = deathDate ? new Date(deathDate) : new Date();
  if (isNaN(ref.getTime())) return null;
  let age = ref.getFullYear() - year;
  const refMonth = ref.getMonth() + 1;
  if (refMonth < month || (refMonth === month && ref.getDate() < 1)) {
    age--;
  }
  return age < 0 ? null : age;
}

// 初始：尝试从浏览器加载，否则用默认数据
const persisted = loadPersistedState();
const initialNodesResolved = persisted ? normalizeNodes(persisted.nodes) : applyRelativeYPositions(normalizeNodes(initialNodes));
const initialEdgesResolved = persisted ? persisted.edges : initialEdges;
const initialDisplaySettings = persisted ? persisted.displaySettings : DEFAULT_DISPLAY_SETTINGS;
const initialViewport = persisted ? persisted.viewport : { x: 0, y: 0, zoom: 1 };
// 手动隐藏节点：过滤掉已不存在的 id
const initialHiddenNodeIds = new Set<string>(
  (persisted?.hiddenNodeIds || []).filter((id) => initialNodesResolved.some((n) => n.id === id))
);
// 聚焦分析中心人物：仅当该节点仍存在且处于隐藏集合中时生效
const initialFocusNodeId =
  persisted?.focusNodeId &&
  initialHiddenNodeIds.has(persisted.focusNodeId) &&
  initialNodesResolved.some((n) => n.id === persisted.focusNodeId)
    ? persisted.focusNodeId
    : null;
// 首次加载（无持久化数据）时需要标记重新计算灰色节点
const hasPersistedData = !!persisted;

function resolveOverlaps(nodes: PersonNode[]): PersonNode[] {
  const NODE_WIDTH = 200; // 160 width + 40 gap
  const NODE_HEIGHT = 220; // accommodates name/gender + relationship + avatar + info + attrs
  
  let hasOverlap = true;
  let iterations = 0;
  const result = nodes.map(n => ({ ...n, position: { ...n.position } }));

  while (hasOverlap && iterations < 100) {
    hasOverlap = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const n1 = result[i];
        const n2 = result[j];
        const dx = n1.position.x - n2.position.x;
        const dy = n1.position.y - n2.position.y;

        if (Math.abs(dx) < NODE_WIDTH && Math.abs(dy) < NODE_HEIGHT) {
          hasOverlap = true;
          const pushDist = (NODE_WIDTH - Math.abs(dx)) / 2 + 5;
          if (n1.position.x >= n2.position.x) {
            n1.position.x += pushDist;
            n2.position.x -= pushDist;
          } else {
            n1.position.x -= pushDist;
            n2.position.x += pushDist;
          }
        }
      }
    }
    iterations++;
  }
  return result;
}

function applyRelativeYPositions(nodes: PersonNode[], gapScale: number = 1): PersonNode[] {
  if (nodes.length === 0) return nodes;

  const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;
  const scale = gapScale > 0 ? gapScale : 1;

  function getGapPixels(years: number) {
    // 线性均匀：每年固定像素值，使坐标系均匀分布
    if (years <= 0) return 0;
    return years * 10 * scale; // 10px per year
  }

  // Group nodes by birthDate to ensure people with EXACT same birthDate have EXACT same Y
  const uniqueDates = Array.from(new Set(nodes.map(n => n.data.birthDate || '1990-01'))).sort((a, b) => {
    const timeA = new Date(a).getTime();
    const timeB = new Date(b).getTime();
    return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
  });

  const dateToY = new Map<string, number>();
  let currentY = 0;
  let previousTime = new Date(uniqueDates[0]).getTime();
  if (isNaN(previousTime)) previousTime = 0;

  dateToY.set(uniqueDates[0], currentY);

  for (let i = 1; i < uniqueDates.length; i++) {
    let currentTime = new Date(uniqueDates[i]).getTime();
    if (isNaN(currentTime)) currentTime = previousTime;

    const yearsDiff = (currentTime - previousTime) / MS_PER_YEAR;
    currentY += getGapPixels(yearsDiff);
    
    dateToY.set(uniqueDates[i], currentY);
    previousTime = currentTime;
  }

  const nodesWithY = nodes.map(node => {
    // 用户手动垂直拖动过的节点：保留其 Y，不重新计算
    if (node.data.yOverridden) {
      return node;
    }
    return {
      ...node,
      position: {
        ...node.position,
        y: dateToY.get(node.data.birthDate || '1990-01') || 0
      }
    };
  });

  return resolveOverlaps(nodesWithY);
}

/**
 * 计算坐标系横线：从根出生年份（最早节点）起，每 step 年一条横线。
 * 横线在 Y 轴上等距均匀分布（线性：每年固定像素值），形成年份刻度尺。
 * 节点按相同的线性公式分布，因此横线与同年份节点行严格对齐。
 * 上限自动取：最大年龄差向上取 step 的倍数。
 * 返回 [{ year, y }]，y 为与节点 Y 同坐标系的偏移。
 */
export function computeCoordinateLines(
  nodes: PersonNode[],
  gapScale: number = 1,
  step: number = 10
): { year: number; y: number }[] {
  if (nodes.length === 0) return [];
  const scale = gapScale > 0 ? gapScale : 1;
  // 防御：step 至少 5
  const safeStep = step >= 5 ? Math.round(step) : 5;

  // 取最早与最晚出生年份（含月份浮点，与节点 Y 基准一致）
  let minYearFloat = Infinity;
  let maxYearFloat = -Infinity;
  let minYearInt = Infinity;
  let maxYearInt = -Infinity;
  for (const n of nodes) {
    if (n.data.birthDate) {
      const parts = n.data.birthDate.split('-');
      const yi = parseInt(parts[0], 10);
      if (isNaN(yi)) continue;
      const mi = parts[1] ? parseInt(parts[1], 10) : 1;
      const yf = yi + (isNaN(mi) ? 0 : (mi - 1) / 12);
      if (yf < minYearFloat) { minYearFloat = yf; minYearInt = yi; }
      if (yf > maxYearFloat) { maxYearFloat = yf; maxYearInt = yi; }
    }
  }
  if (!isFinite(minYearFloat)) return [];
  if (!isFinite(maxYearFloat)) { maxYearFloat = minYearFloat; maxYearInt = minYearInt; }

  // 起始年份：向下取整到 step 的倍数（如 step=10、最早1989 → 1980）
  // 结束年份：向上取整到 step 的倍数（如 step=10、最晚2012 → 2020）
  const startYear = Math.floor(minYearInt / safeStep) * safeStep;
  const endYear = Math.ceil(maxYearInt / safeStep) * safeStep;

  // 每年固定像素值（线性均匀：10px/年）
  const PX_PER_YEAR = 10 * scale;

  const lines: { year: number; y: number }[] = [];
  // Y 坐标系以"最早节点 birthDate（含月份）"为 Y=0 基准（与 applyRelativeYPositions 一致），
  // 因此横线 Y = (lineYearFloat - minYearFloat) * PX_PER_YEAR，横线与节点行严格对齐，
  // 横线年份标签按 step 倍数对齐（如 1980、1990、2000...）。
  for (let year = startYear; year <= endYear; year += safeStep) {
    const yearFloat = year; // 横线对应整年 1月1日（year-01）
    lines.push({ year, y: (yearFloat - minYearFloat) * PX_PER_YEAR });
  }
  return lines;
}

/**
 * 计算因"断开关系"而需要变灰的节点。
 *
 * 自己（isSelf）通过 data.isSelf 标记动态确定，支持"把这个人设为我"功能。
 *
 * 核心问题：自己和爱人共享子女时，仅靠连通性无法判断爱人是否"被切断"
 * （爱人仍可通过子女从自己到达）。因此按边类型做定向遍历：
 *
 * - 爱人边断开：far = 非自己一侧的爱人。从 far 向上（父母）和 sideways（其他爱人）遍历，
 *   不向下（不遍历子女，因为子女是共享的、不变灰）。
 * - 父子边断开（source=父母，target=子女）：far = 子女。从 far 向下（子女）和 sideways（爱人）遍历，
 *   不向上（不遍历父母，因为另一位父母可能仍与自己有关系）。
 *
 * "同事例外"：若某节点与自己存在不经过 far 的其他路径（例如前妻父亲同时是自己的同事），
 * 则该节点及其长辈不变灰。通过计算 selfComponentWithoutFar（从自己出发、不经过 far 的可达集）来实现。
 */
function computeGrayedNodes(
  nodes: PersonNode[],
  edges: Edge[],
  showGray: boolean
): Set<string> {
  if (!showGray) return new Set();
  const selfNode = nodes.find((n) => n.data.isSelf);
  if (!selfNode) return new Set();
  const selfId = selfNode.id;

  const disconnectedEdges = edges.filter((e) => (e.data as EdgeData)?.disconnected);
  if (disconnectedEdges.length === 0) return new Set();

  const isActive = (e: Edge) => !((e.data as EdgeData)?.disconnected);

  // 阶段1：从 self 出发，通过所有 active 边双向 BFS，得到"self 可达集"
  // 该集合中的节点无论如何都不应变灰（self 与它们仍有 active 路径）
  const selfReachable = new Set<string>();
  {
    selfReachable.add(selfId);
    const queue: string[] = [selfId];
    while (queue.length > 0) {
      const node = queue.shift()!;
      for (const e of edges) {
        if (!isActive(e)) continue;
        let next: string | null = null;
        if (e.source === node) next = e.target;
        else if (e.target === node) next = e.source;
        if (!next) continue;
        if (!selfReachable.has(next)) {
          selfReachable.add(next);
          queue.push(next);
        }
      }
    }
  }

  const graySet = new Set<string>();

  // 阶段2：对每条断开边，选择"远离 self"的端点作为 far，从 far 全方向 BFS 标记候选灰色节点
  for (const edge of disconnectedEdges) {
    const sIn = selfReachable.has(edge.source);
    const tIn = selfReachable.has(edge.target);
    // 两端都可达 self：此边断开不影响连通性，跳过
    if (sIn && tIn) continue;
    // 选择 far：不在 selfReachable 的端点；若两端都不在则都处理
    const farCandidates: string[] = [];
    if (!sIn) farCandidates.push(edge.source);
    if (!tIn) farCandidates.push(edge.target);

    for (const far of farCandidates) {
      if (far === selfId) continue;
      // 从 far 出发全方向 BFS（仅 active edges），收集所有可达节点为候选灰色
      const visited = new Set<string>();
      const queue: string[] = [far];
      visited.add(far);
      while (queue.length > 0) {
        const node = queue.shift()!;
        graySet.add(node);
        for (const e of edges) {
          if (!isActive(e)) continue;
          let next: string | null = null;
          if (e.source === node) next = e.target;
          else if (e.target === node) next = e.source;
          if (!next) continue;
          if (visited.has(next)) continue;
          visited.add(next);
          queue.push(next);
        }
      }
    }
  }

  // 阶段3：修复——从 graySet 中移除所有 selfReachable 中的节点
  // 这一步保证任何能通过 active 路径回到 self 的节点（含同事例外、共同祖先等）都不会被误置灰
  for (const id of selfReachable) {
    graySet.delete(id);
  }

  return graySet;
}

/**
 * 统一计算所有不可见节点（同时考虑隐藏边和隐藏节点）。
 *
 * 隐藏语义：隐藏一条边 = 概念上从图中移除该边（桥/割边）。
 * 隐藏语义：隐藏一个节点 = 从图中移除该节点（割点）。
 * 两者交互：如父亲被隐藏 + 妈妈-妹妹边被隐藏 → 妹妹不可达（两种机制共同作用）。
 *
 * BFS 从"自己"出发，跳过隐藏边和隐藏节点，凡不可达的节点全部不可见。
 * "自己"永不被隐藏。直接隐藏的节点本身也不可达（被跳过）。
 */
export function computeInvisibleNodes(
  nodes: PersonNode[],
  edges: Edge[],
  hiddenNodeIds: Set<string>,
  focusNodeId?: string | null
): Set<string> {
  const selfNode = nodes.find((n) => n.data.isSelf);
  const selfHidden = selfNode ? hiddenNodeIds.has(selfNode.id) : false;
  // 聚焦分析：以所选人物为可见性中心（即使无"自己"节点也生效）
  const focus = focusNodeId && nodes.some((n) => n.id === focusNodeId) ? focusNodeId : null;
  // 根节点优先级：聚焦人物 > "自己"（仅当未手动隐藏）> 无根节点
  const rootId = focus ?? (selfNode && !selfHidden ? selfNode.id : null);
  if (!rootId) {
    // 无根节点（"自己"被隐藏且无聚焦）：仅隐藏手动隐藏的节点
    return new Set(hiddenNodeIds);
  }
  const hasCollapsed = edges.some((e) => (e.data as EdgeData)?.collapsed);
  if (!focus && !hasCollapsed && hiddenNodeIds.size === 0) return new Set<string>();

  const reachable = new Set<string>([rootId]);
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const e of edges) {
      if ((e.data as EdgeData)?.collapsed) continue; // 跳过隐藏边
      let next: string | null = null;
      if (e.source === cur) next = e.target;
      else if (e.target === cur) next = e.source;
      if (!next || reachable.has(next)) continue;
      // 根节点即使被手动隐藏也作为起点，其余隐藏节点跳过（割点缺失）
      if (hiddenNodeIds.has(next) && next !== rootId) continue;
      reachable.add(next);
      queue.push(next);
    }
  }

  if (focus) {
    // 聚焦模式：所选人物本身被隐藏；"自己"不特殊保护，与所选人物不连通则一并隐藏
    return new Set(nodes.filter((n) => !reachable.has(n.id) || n.id === rootId).map((n) => n.id));
  }
  if (selfHidden) {
    // "自己"被手动隐藏（如强制隐藏含"自己"的类别）：不可达的节点 + 手动隐藏的节点全部不可见（含"自己"）
    return new Set(nodes.filter((n) => !reachable.has(n.id)).map((n) => n.id));
  }
  // 正常模式：不可达 = 不可见（含直接隐藏者本身，因它们被跳过故不可达）；"自己"永不被隐藏
  return new Set(nodes.filter((n) => n.id !== selfNode!.id && !reachable.has(n.id)).map((n) => n.id));
}

/**
 * 以指定人物为根节点做 BFS（忽略边的 collapsed 状态，但跳过 hiddenNodeIds 中的节点），
 * 返回与根节点不连通的所有节点（含"自己"）。用于 force 模式下计算级联隐藏集。
 */
export function computeDisconnectedNodes(
  nodes: PersonNode[],
  edges: Edge[],
  rootId: string,
  hiddenNodeIds: Set<string>
): Set<string> {
  const reachable = new Set<string>([rootId]);
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const e of edges) {
      let next: string | null = null;
      if (e.source === cur) next = e.target;
      else if (e.target === cur) next = e.source;
      if (!next || reachable.has(next)) continue;
      if (hiddenNodeIds.has(next) && next !== rootId) continue;
      reachable.add(next);
      queue.push(next);
    }
  }
  return new Set(nodes.filter((n) => !reachable.has(n.id)).map((n) => n.id));
}

export const useRelationshipStore = create<RelationshipState>((set, get) => {
  const MAX_UNDO = 30;
  // 在「大操作」前调用：将当前状态压入撤销栈
  const pushUndo = (label: string) => {
    const { nodes, edges, grayedNodeIds, hiddenNodeIds, selectedNodeId, selectedEdgeId, displaySettings, focusNodeId, forceHiddenMap, undoStack } = get();
    set({
      undoStack: [
        ...undoStack,
        { label, nodes, edges, grayedNodeIds, hiddenNodeIds, selectedNodeId, selectedEdgeId, displaySettings, focusNodeId, forceHiddenMap: new Map(forceHiddenMap) },
      ].slice(-MAX_UNDO),
    });
  };
  return {
  nodes: initialNodesResolved,
  edges: initialEdgesResolved,
  selectedNodeId: null,
  selectedEdgeId: null,
  displaySettings: initialDisplaySettings,
  grayedNodeIds: hasPersistedData
    ? computeGrayedNodes(initialNodesResolved, initialEdgesResolved, initialDisplaySettings.showGrayOnDisconnect)
    : new Set<string>(),
  hiddenNodeIds: initialHiddenNodeIds,
  focusNodeId: initialFocusNodeId,
  forceHiddenMap: new Map<string, Set<string>>(),
  viewport: initialViewport,
  undoStack: [],
  connectionMode: 'off',
  connectionCustomLabel: '',
  connectFirstNodeId: null,
  showHelpPage: false,
  settingsPanelCollapsed: false,
  edgeMenu: null,
  language: getInitialLanguage(),

  onNodesChange: (changes) => {
    const currentNodes = get().nodes;
    const allowVerticalMove = get().displaySettings.allowVerticalMove;
    // 关闭垂直移动时：强制锁定 Y，仅允许水平拖动
    // 开启垂直移动时：自由拖动，拖动时标记节点 Y 已被覆盖，后续 applyRelativeYPositions 跳过
    const modifiedChanges = changes.map(change => {
      if (change.type === 'position' && change.position) {
        const node = currentNodes.find(n => n.id === change.id);
        if (node && !allowVerticalMove) {
          // 锁定 Y 到原值
          return {
            ...change,
            position: { x: change.position.x, y: node.position.y },
            positionAbsolute: change.positionAbsolute
              ? { x: change.positionAbsolute.x, y: node.position.y }
              : undefined,
          };
        }
      }
      return change;
    });
    const applied = applyNodeChanges(modifiedChanges, currentNodes) as PersonNode[];
    // 收集本次拖动的节点 id（仅开启垂直移动时才标记）
    if (allowVerticalMove) {
      const draggedIds = new Set<string>();
      for (const c of changes) {
        if (c.type === 'position' && c.dragging && c.id) draggedIds.add(c.id);
      }
      const finalNodes = draggedIds.size > 0
        ? applied.map(n => draggedIds.has(n.id) ? { ...n, data: { ...n.data, yOverridden: true } } : n)
        : applied;
      set({ nodes: finalNodes });
    } else {
      set({ nodes: applied });
    }
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(connection, get().edges),
    });
  },

  addPerson: (data, position) => {
    const id = uuidv4();
    const newNode: PersonNode = {
      id,
      type: 'person',
      position,
      data,
    };
    set({ nodes: applyRelativeYPositions([...get().nodes, newNode], get().displaySettings.verticalGapScale) });
    return id;
  },

  updatePerson: (id, data) => {
    pushUndo('修改属性');
    const updatedNodes = get().nodes.map((node) => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    });
    set({ nodes: applyRelativeYPositions(updatedNodes, get().displaySettings.verticalGapScale) });
    get().recalculateRelationships();
  },

  updatePersonLive: (id, data) => {
    const updatedNodes = get().nodes.map((node) => {
      if (node.id === id) {
        return { ...node, data: { ...node.data, ...data } };
      }
      return node;
    });
    set({ nodes: applyRelativeYPositions(updatedNodes, get().displaySettings.verticalGapScale) });
  },

  deletePerson: (id, cascadeDescendants) => {
    // 不能删除"自己"（通过 isSelf 标记判断，而非固定 ID）
    const selfNode = get().nodes.find((n) => n.data.isSelf);
    if (selfNode && selfNode.id === id) return;
    pushUndo('删除人物');

    // 计算需要删除的节点集合：自身 + （若级联）可级联的晚辈
    const toDelete = new Set<string>([id]);
    if (cascadeDescendants) {
      get().getDescendantsForCascade(id).forEach((d) => toDelete.add(d));
    }

    const filteredNodes = get().nodes.filter((node) => !toDelete.has(node.id));
    const newEdges = get().edges.filter(
      (edge) => !toDelete.has(edge.source) && !toDelete.has(edge.target)
    );
    const { displaySettings, hiddenNodeIds: prevHidden, focusNodeId: prevFocus, forceHiddenMap: prevForceMap } = get();
    // 清理被删除者的隐藏标记
    const hiddenNodeIds = new Set(prevHidden);
    for (const id of toDelete) hiddenNodeIds.delete(id);
    // 清理 forceHiddenMap 中引用被删除节点的条目
    const forceHiddenMap = new Map<string, Set<string>>();
    for (const [key, set] of prevForceMap) {
      const [kNodeId] = key.split(':');
      if (toDelete.has(kNodeId)) continue; // key 的 nodeId 被删除则丢弃
      const cleaned = new Set<string>();
      for (const id of set) if (!toDelete.has(id)) cleaned.add(id);
      if (cleaned.size > 0) forceHiddenMap.set(key, cleaned);
    }
    set({
      nodes: applyRelativeYPositions(filteredNodes, displaySettings.verticalGapScale),
      edges: newEdges,
      selectedNodeId: toDelete.has(get().selectedNodeId || '') ? null : get().selectedNodeId,
      grayedNodeIds: computeGrayedNodes(filteredNodes, newEdges, displaySettings.showGrayOnDisconnect),
      hiddenNodeIds,
      forceHiddenMap,
      // 删除聚焦分析中心人物时退出聚焦模式
      focusNodeId: prevFocus && toDelete.has(prevFocus) ? null : prevFocus,
    });
    get().recalculateRelationships();
  },

  getDescendantsForCascade: (id) => {
    const { edges } = get();
    // 仅考虑 parent-child 边：source=父母, target=子女
    const childrenOf = (pid: string): string[] =>
      edges
        .filter((e) => e.data?.type === 'parent-child' && e.source === pid)
        .map((e) => e.target);

    // 某节点的「其它关系」：除来自 id 这一支的父辈外，是否还有别的连接
    // otherEdgesOf(nodeId, excludedParentId): 该节点是否存在非「从 excludedParentId 指向它的 parent-child」的任何边
    const hasOtherConnection = (nodeId: string, allowedParentId: string): boolean => {
      return edges.some((e) => {
        if (e.source === nodeId || e.target === nodeId) {
          // 允许的唯一连接：parent-child 且 source=allowedParentId 且 target=nodeId
          const isAllowedParentLink =
            e.data?.type === 'parent-child' && e.source === allowedParentId && e.target === nodeId;
          if (isAllowedParentLink) return false;
          // 其它任何边（另一个父/母、爱人、兄弟、自定义、或作为别人的父母）都算「其它关系」
          return true;
        }
        return false;
      });
    };

    const result = new Set<string>();
    // BFS 向下：仅延伸「只通过 id 这一系连接」的子女
    const queue: { pid: string; viaParent: string }[] = childrenOf(id).map((c) => ({ pid: c, viaParent: id }));
    const visited = new Set<string>([id]);
    while (queue.length > 0) {
      const { pid, viaParent } = queue.shift()!;
      if (visited.has(pid)) continue;
      visited.add(pid);
      // 若该晚辈存在除「来自 viaParent 的父子边」之外的任何关系，则不删、也不继续向下
      if (hasOtherConnection(pid, viaParent)) continue;
      result.add(pid);
      // 继续向下延伸其子女（同样规则）
      childrenOf(pid).forEach((c) => queue.push({ pid: c, viaParent: pid }));
    }
    return Array.from(result);
  },

  addRelative: (sourceId, type, data, customLabel) => {
    const newId = uuidv4();
    const sourceNode = get().nodes.find((n) => n.id === sourceId);
    if (!sourceNode) return;
    pushUndo('添加关系');

    const isParent = type === 'parent';
    const isChild = type === 'child';
    const isSpouse = type === 'spouse';
    const isCustom = type === 'custom';

    // Calculate position: Y is strictly based on birthDate, X is relative to source
    const position = {
      x: sourceNode.position.x + (isSpouse ? 220 : (Math.random() * 100 - 50)),
      y: 0, // Will be updated by applyRelativeYPositions
    };

    const newNode: PersonNode = {
      id: newId,
      type: 'person',
      position,
      data,
    };

    let newEdges: Edge[] = [];

    if (isParent) {
      newEdges.push({ id: `e-${newId}-${sourceId}`, source: newId, target: sourceId, data: { type: 'parent-child' }, type: 'parent-child' });

      // If source already has a parent, link the new parent to the existing parent as spouse
      const existingParentEdges = get().edges.filter(e => e.target === sourceId && e.data?.type === 'parent-child');
      existingParentEdges.forEach(e => {
        newEdges.push({
          id: `e-spouse-${newId}-${e.source}`,
          source: newId,
          target: e.source,
          data: { type: 'spouse' },
          type: 'spouse',
        });
      });

    } else if (isChild) {
      newEdges.push({ id: `e-${sourceId}-${newId}`, source: sourceId, target: newId, data: { type: 'parent-child' }, type: 'parent-child' });

      // If source has spouses, link them to the new child too
      const spouseEdges = get().edges.filter(e => e.data?.type === 'spouse' && (e.source === sourceId || e.target === sourceId));
      spouseEdges.forEach(e => {
        const spouseId = e.source === sourceId ? e.target : e.source;
        newEdges.push({
          id: `e-${spouseId}-${newId}`,
          source: spouseId,
          target: newId,
          data: { type: 'parent-child' },
          type: 'parent-child'
        });
      });

    } else if (isSpouse) {
      newEdges.push({ id: `e-spouse-${sourceId}-${newId}`, source: sourceId, target: newId, data: { type: 'spouse' }, type: 'spouse' });

      // If source has children, link the new spouse to the children
      const childEdges = get().edges.filter(e => e.source === sourceId && e.data?.type === 'parent-child');
      childEdges.forEach(e => {
        newEdges.push({
          id: `e-${newId}-${e.target}`,
          source: newId,
          target: e.target,
          data: { type: 'parent-child' },
          type: 'parent-child'
        });
      });

    } else if (isCustom) {
      // 自定义关系（同学、同事、朋友等）：仅建立一条 custom 边，不传递血缘
      newEdges.push({
        id: `e-custom-${sourceId}-${newId}`,
        source: sourceId,
        target: newId,
        data: { type: 'custom', customLabel: customLabel || '自定义' },
        type: 'custom',
      });
    }

    const newNodes = applyRelativeYPositions([...get().nodes, newNode], get().displaySettings.verticalGapScale);
    const finalEdges = [...get().edges, ...newEdges];
    set({
      nodes: newNodes,
      edges: finalEdges,
    });

    get().recalculateRelationships();
  },

  // 从现有人物中添加关系：在两个已有节点之间建立边（逻辑同 addRelative，但不新建人物）
  connectExisting: (sourceId, targetId, type, customLabel) => {
    if (sourceId === targetId) return;
    const sourceNode = get().nodes.find(n => n.id === sourceId);
    const targetNode = get().nodes.find(n => n.id === targetId);
    if (!sourceNode || !targetNode) return;

    const edges = get().edges;
    const exists = (a: string, b: string, edgeType: string) =>
      edges.some(e =>
        e.data?.type === edgeType &&
        ((e.source === a && e.target === b) || (e.source === b && e.target === a))
      );

    let newEdges: Edge[] = [];

    if (type === 'parent') {
      // target 成为 source 的父母（parent -> child）
      if (!exists(targetId, sourceId, 'parent-child')) {
        newEdges.push({ id: `e-${targetId}-${sourceId}`, source: targetId, target: sourceId, data: { type: 'parent-child' }, type: 'parent-child' });
      }
      // 若 source 已有父母，将新父母与已有父母连接为爱人
      const existingParents = edges.filter(e => e.target === sourceId && e.data?.type === 'parent-child');
      existingParents.forEach(e => {
        if (e.source !== targetId && !exists(e.source, targetId, 'spouse')) {
          newEdges.push({ id: `e-spouse-${e.source}-${targetId}`, source: e.source, target: targetId, data: { type: 'spouse' }, type: 'spouse' });
        }
      });
    } else if (type === 'child') {
      // target 成为 source 的子女（parent -> child）
      if (!exists(sourceId, targetId, 'parent-child')) {
        newEdges.push({ id: `e-${sourceId}-${targetId}`, source: sourceId, target: targetId, data: { type: 'parent-child' }, type: 'parent-child' });
      }
      // source 的爱人也成为 target 的父母
      const spouses = edges.filter(e => e.data?.type === 'spouse' && (e.source === sourceId || e.target === sourceId));
      spouses.forEach(e => {
        const spouseId = e.source === sourceId ? e.target : e.source;
        if (spouseId !== targetId && !exists(spouseId, targetId, 'parent-child')) {
          newEdges.push({ id: `e-${spouseId}-${targetId}`, source: spouseId, target: targetId, data: { type: 'parent-child' }, type: 'parent-child' });
        }
      });
    } else if (type === 'spouse') {
      if (!exists(sourceId, targetId, 'spouse')) {
        newEdges.push({ id: `e-spouse-${sourceId}-${targetId}`, source: sourceId, target: targetId, data: { type: 'spouse' }, type: 'spouse' });
      }
      // source 的子女也成为 target 的子女
      const children = edges.filter(e => e.source === sourceId && e.data?.type === 'parent-child');
      children.forEach(e => {
        if (e.target !== targetId && !exists(targetId, e.target, 'parent-child')) {
          newEdges.push({ id: `e-${targetId}-${e.target}`, source: targetId, target: e.target, data: { type: 'parent-child' }, type: 'parent-child' });
        }
      });
    } else if (type === 'custom') {
      if (!exists(sourceId, targetId, 'custom')) {
        newEdges.push({ id: `e-custom-${sourceId}-${targetId}`, source: sourceId, target: targetId, data: { type: 'custom', customLabel: customLabel || '自定义' }, type: 'custom' });
      }
    }

    if (newEdges.length === 0) return;
    pushUndo('连接现有关系');
    const finalEdges = [...get().edges, ...newEdges];
    const { nodes: curNodes } = get();
    set({
      edges: finalEdges,
    });
    get().recalculateRelationships();
  },

  recalculateRelationships: () => {
    const { nodes, edges } = get();
    // 收集用户手动覆盖的称谓
    const overrides = new Map<string, string>();
    nodes.forEach(node => {
      if (node.data.relationshipOverridden && node.data.relationship) {
        overrides.set(node.id, node.data.relationship);
      }
    });
    const relationships = calculateRelationships(nodes, edges, overrides, get().language);

    const newNodes = nodes.map(node => {
      const rel = relationships.get(node.id);
      // 如果用户手动覆盖了称谓，保留用户的设置，不改变 relationshipOverridden 标志
      if (node.data.relationshipOverridden) {
        return node;
      }
      if (rel && rel !== node.data.relationship) {
        return { ...node, data: { ...node.data, relationship: rel } };
      }
      return node;
    });

    set({ nodes: newNodes });
  },

  setSelectedNodeId: (id) => {
    if (id === null) {
      // 关闭面板/取消选中：同步清除节点的蓝色边框（selected 视觉状态）
      set({
        selectedNodeId: null,
        nodes: get().nodes.map(n => ({ ...n, selected: false })),
      });
    } else {
      // 选中节点：清除边的选中，避免两个面板同时显示
      set({
        selectedNodeId: id,
        selectedEdgeId: null,
        edges: get().edges.map(e => ({ ...e, selected: false })),
      });
    }
  },
  setSelectedEdgeId: (id) => {
    if (id === null) {
      // 关闭面板/取消选中：同步清除边的选中状态
      set({
        selectedEdgeId: null,
        edges: get().edges.map(e => ({ ...e, selected: false })),
      });
    } else {
      // 选中边：清除节点的选中，避免两个面板同时显示
      set({
        selectedEdgeId: id,
        selectedNodeId: null,
        nodes: get().nodes.map(n => ({ ...n, selected: false })),
      });
    }
  },

  setSettingsPanelCollapsed: (v) => set({ settingsPanelCollapsed: v }),

  setEdgeMenu: (v) => set({ edgeMenu: v }),

  // 长按多选：切换某节点选中状态（不影响其他节点）
  toggleNodeSelected: (id) => {
    set({
      nodes: get().nodes.map(n => n.id === id ? { ...n, selected: !n.selected } : n),
      selectedEdgeId: null,
      edges: get().edges.map(e => ({ ...e, selected: false })),
    });
  },

  // 长按多选完成后：恢复多选状态（被 ReactFlow 单击覆盖后重新应用）
  applyMultiSelect: (ids) => {
    const idSet = new Set(ids);
    set({
      nodes: get().nodes.map(n => ({ ...n, selected: idSet.has(n.id) })),
      selectedNodeId: ids.length > 0 ? ids[ids.length - 1] : null,
      selectedEdgeId: null,
      edges: get().edges.map(e => ({ ...e, selected: false })),
    });
  },

  updateDisplaySettings: (patch) => {
    const oldSettings = get().displaySettings;
    const newSettings = { ...oldSettings, ...patch };
    set({ displaySettings: newSettings });
    // 垂直间距比例变化时重新应用 Y 布局
    if (patch.verticalGapScale !== undefined && patch.verticalGapScale !== oldSettings.verticalGapScale) {
      const oldScale = oldSettings.verticalGapScale || 1;
      const newScale = newSettings.verticalGapScale || 1;
      const ratio = newScale / oldScale;
      // 对用户手动垂直拖动过的节点，按比例缩放其 Y，保持相对位置关系（等比例调整）
      const scaledNodes = get().nodes.map(n =>
        n.data.yOverridden
          ? { ...n, position: { ...n.position, y: n.position.y * ratio } }
          : n
      );
      set({ nodes: applyRelativeYPositions(scaledNodes, newScale) });
    }
    // 变灰设置变化时重新计算灰色节点
    if (patch.showGrayOnDisconnect !== undefined) {
      const { nodes, edges } = get();
      set({ grayedNodeIds: computeGrayedNodes(nodes, edges, patch.showGrayOnDisconnect) });
    }
  },

  disconnectEdge: (edgeId) => {
    pushUndo('断开关系');
    const edges = get().edges.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, disconnected: true } } : e
    );
    const { nodes, displaySettings } = get();
    set({
      edges,
      grayedNodeIds: computeGrayedNodes(nodes, edges, displaySettings.showGrayOnDisconnect),
    });
  },

  reconnectEdge: (edgeId) => {
    pushUndo('恢复关系');
    const edges = get().edges.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, disconnected: false } } : e
    );
    const { nodes, displaySettings } = get();
    set({
      edges,
      grayedNodeIds: computeGrayedNodes(nodes, edges, displaySettings.showGrayOnDisconnect),
    });
  },

  updateEdgeType: (edgeId, newType, customLabel) => {
    pushUndo('修改关系类型');
    const edges = get().edges.map((e) => {
      if (e.id !== edgeId) return e;
      const newData: EdgeData = { ...(e.data as EdgeData), type: newType };
      if (newType === 'custom') {
        newData.customLabel = customLabel || '自定义';
      } else {
        delete newData.customLabel;
      }
      return { ...e, data: newData, type: newType };
    });
    const { nodes, displaySettings } = get();
    set({
      edges,
      grayedNodeIds: computeGrayedNodes(nodes, edges, displaySettings.showGrayOnDisconnect),
    });
    get().recalculateRelationships();
  },

  updateEdgeEndpoint: (edgeId, end, newNodeId) => {
    const edge = get().edges.find((e) => e.id === edgeId);
    if (!edge) return;
    // 不能与现有端点相同
    const otherEndId = end === 'source' ? edge.target : edge.source;
    if (newNodeId === otherEndId) return;
    pushUndo('修改连线端点');
    const updatedEdge = {
      ...edge,
      source: end === 'source' ? newNodeId : edge.source,
      target: end === 'target' ? newNodeId : edge.target,
      id: `e-${end === 'source' ? newNodeId : edge.source}-${end === 'target' ? newNodeId : edge.target}`,
    };
    // 去重：若新端点组合已存在同类型边，则删除当前边
    const newSourceId = updatedEdge.source;
    const newTargetId = updatedEdge.target;
    const newType = (updatedEdge.data as EdgeData)?.type;
    const duplicateExists = get().edges.some(
      (e) => e.id !== edgeId && e.source === newSourceId && e.target === newTargetId && (e.data as EdgeData)?.type === newType
    );
    const finalEdges = duplicateExists
      ? get().edges.filter((e) => e.id !== edgeId)
      : get().edges.map((e) => (e.id === edgeId ? updatedEdge : e));
    const { nodes, displaySettings } = get();
    set({
      edges: finalEdges,
      grayedNodeIds: computeGrayedNodes(nodes, finalEdges, displaySettings.showGrayOnDisconnect),
      selectedEdgeId: duplicateExists ? null : updatedEdge.id,
    });
    get().recalculateRelationships();
  },

  swapEdgeDirection: (edgeId) => {
    pushUndo('反转连线方向');
    const edges = get().edges.map((e) => {
      if (e.id !== edgeId) return e;
      return {
        ...e,
        source: e.target,
        target: e.source,
        id: `e-${e.target}-${e.source}`,
      };
    });
    const { nodes, displaySettings } = get();
    set({
      edges,
      grayedNodeIds: computeGrayedNodes(nodes, edges, displaySettings.showGrayOnDisconnect),
    });
    get().recalculateRelationships();
  },

  deleteEdge: (edgeId) => {
    pushUndo('删除关系');
    const edges = get().edges.filter((e) => e.id !== edgeId);
    const { nodes, displaySettings } = get();
    set({
      edges,
      grayedNodeIds: computeGrayedNodes(nodes, edges, displaySettings.showGrayOnDisconnect),
      selectedEdgeId: null,
    });
    get().recalculateRelationships();
  },

  collapseEdge: (edgeId) => {
    pushUndo('隐藏关系');
    const { edges: curEdges } = get();
    const edges = curEdges.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, collapsed: true } } : e
    );
    set({
      edges,
    });
  },

  expandEdge: (edgeId) => {
    pushUndo('展开关系');
    const edges = get().edges.map((e) =>
      e.id === edgeId ? { ...e, data: { ...e.data, collapsed: false } } : e
    );
    set({
      edges,
    });
  },

  setCategoryFold: (nodeId, category, state, options) => {
    const { edges, nodes, hiddenNodeIds } = get();
    const selfId = nodes.find((n) => n.data.isSelf)?.id;
    const force = options?.force === true; // 第二次点击"全部"：绕过"自己"守卫，强制隐藏类别成员（含"自己"），仍保护所选人物
    // 选出该节点对应类别的所有边
    const matchedEdgeIds = new Set<string>();
    for (const e of edges) {
      const data = e.data as EdgeData;
      if (!data) continue;
      const involvesNode = e.source === nodeId || e.target === nodeId;
      if (!involvesNode) continue;
      let matched = false;
      if (category === 'parents') {
        // 父母：parent-child 边且该节点为 target（子女端）
        matched = data.type === 'parent-child' && e.target === nodeId;
      } else if (category === 'children') {
        // 子女：parent-child 边且该节点为 source（父母端）
        matched = data.type === 'parent-child' && e.source === nodeId;
      } else if (category === 'spouse') {
        matched = data.type === 'spouse';
      } else if (category === 'other') {
        // 其他：所有自定义关系
        matched = data.type === 'custom';
      } else {
        // 子类别：customLabel 匹配
        matched = data.type === 'custom' && data.customLabel === category;
      }
      if (matched) matchedEdgeIds.add(e.id);
    }
    if (matchedEdgeIds.size === 0) return { ok: false, reason: '该角色没有此类别的关系' };
    const matchedEdges = edges.filter((e) => matchedEdgeIds.has(e.id));

    if (state === 'all') {
      // 收集类别成员（对端节点）
      const categoryMembers = new Set<string>();
      for (const e of matchedEdges) {
        const far = e.source === nodeId ? e.target : e.source;
        categoryMembers.add(far);
      }
      // 守卫1：类别成员包含"自己"（如隐藏妈妈的子女、儿子的父母）→ 整个动作无效
      // 但 force=true（第二次点击"全部"）时绕过此守卫，允许隐藏"自己"
      if (!force && selfId && categoryMembers.has(selfId)) {
        return { ok: false, reason: '该类别包含"自己"，无法隐藏' };
      }
      // 试算隐藏后的不可见集：隐藏类别成员后，与可见性中心（聚焦人物或"自己"）不连通的全部隐藏
      const tentativeHidden = new Set(hiddenNodeIds);
      for (const id of categoryMembers) tentativeHidden.add(id);

      if (force) {
        // 第二次点击"全部"：以所选人物为根，隐藏类别成员 + 与所选人物不连通的所有人（含"自己"）
        // 所选人物本身不被隐藏
        const disconnected = computeDisconnectedNodes(nodes, edges, nodeId, tentativeHidden);
        for (const id of disconnected) tentativeHidden.add(id);
        // 记录额外隐藏的节点（类别成员 + 不连通者），"无"恢复时据此全部还原
        const mapKey = `${nodeId}:${category}`;
        const extraHidden = new Set<string>([...categoryMembers, ...disconnected]);
        pushUndo('强制隐藏类别关系');
        set({
          hiddenNodeIds: tentativeHidden,
          forceHiddenMap: new Map(get().forceHiddenMap).set(mapKey, extraHidden),
        });
        return { ok: true } as const;
      }

      const wouldHide = computeInvisibleNodes(nodes, edges, tentativeHidden, get().focusNodeId);
      // 守卫2：隐藏会导致当前选中者被级联隐藏 → 不隐藏
      if (wouldHide.has(nodeId)) {
        return { ok: false, reason: '该操作会导致当前角色被隐藏，已取消' };
      }
      // 隐藏类别成员 → computeInvisibleNodes 自然级联隐藏与"自己"不连通的人物
      pushUndo('隐藏类别关系');
      set({
        hiddenNodeIds: tentativeHidden,
      });
      return { ok: true } as const;
    }

    // 无：取消该类别隐藏 + 取消隐藏该类别边（含"隐藏此人"直接隐藏的）+ 还原 force 模式额外隐藏的节点
    pushUndo('展开类别关系');
    const newEdges = edges.map((e) =>
      matchedEdgeIds.has(e.id) ? { ...e, data: { ...e.data, collapsed: false } } : e
    );
    const newHidden = new Set(hiddenNodeIds);
    for (const e of matchedEdges) {
      newHidden.delete(e.source === nodeId ? e.target : e.source);
    }
    // 还原 force 模式下额外隐藏的节点（含"自己"和级联隐藏的不连通者）
    const mapKey = `${nodeId}:${category}`;
    const forceExtra = get().forceHiddenMap.get(mapKey);
    if (forceExtra) {
      for (const id of forceExtra) newHidden.delete(id);
    }
    const newForceHiddenMap = new Map(get().forceHiddenMap);
    newForceHiddenMap.delete(mapKey);
    const prevFocus = get().focusNodeId;
    set({
      edges: newEdges,
      hiddenNodeIds: newHidden,
      forceHiddenMap: newForceHiddenMap,
      // 若展开操作使聚焦中心人物恢复显示，则退出聚焦模式
      focusNodeId: prevFocus && !newHidden.has(prevFocus) ? null : prevFocus,
    });
    return { ok: true } as const;
  },

  hidePerson: (id) => {
    const node = get().nodes.find((n) => n.id === id);
    if (!node || node.data.isSelf) return; // 自己不可隐藏
    pushUndo('隐藏此人');
    const hiddenNodeIds = new Set(get().hiddenNodeIds);
    hiddenNodeIds.add(id);
    set({
      hiddenNodeIds,
      selectedNodeId: null, // 隐藏后关闭详情面板
    });
  },

  unhidePerson: (id) => {
    if (!get().hiddenNodeIds.has(id)) return;
    pushUndo('取消隐藏');
    const hiddenNodeIds = new Set(get().hiddenNodeIds);
    hiddenNodeIds.delete(id);
    // 取消隐藏聚焦中心人物时退出聚焦模式
    const prevFocus = get().focusNodeId;
    set({
      hiddenNodeIds,
      focusNodeId: prevFocus === id ? null : prevFocus,
    });
  },

  unhideAll: () => {
    const { hiddenNodeIds, edges } = get();
    if (hiddenNodeIds.size === 0 && !edges.some((e) => (e.data as EdgeData)?.collapsed)) return;
    pushUndo('全部取消隐藏');
    set({
      hiddenNodeIds: new Set<string>(),
      focusNodeId: null, // 退出聚焦分析模式
      forceHiddenMap: new Map(),
      edges: edges.map((e) =>
        (e.data as EdgeData)?.collapsed
          ? { ...e, data: { ...e.data, collapsed: false } }
          : e
      ),
    });
  },

  focusOnPerson: (id) => {
    const { nodes, edges, hiddenNodeIds } = get();
    if (!nodes.some((n) => n.id === id)) return;
    pushUndo('聚焦分析');
    // 1. 先隐藏所选人物
    const newHidden = new Set(hiddenNodeIds);
    newHidden.add(id);
    // 2. 再隐藏与所选人物不连通的所有人（基于全部关系边，忽略当前折叠/隐藏状态；包含"自己"）
    const connected = new Set<string>([id]);
    const queue: string[] = [id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const e of edges) {
        let next: string | null = null;
        if (e.source === cur) next = e.target;
        else if (e.target === cur) next = e.source;
        if (!next || connected.has(next)) continue;
        connected.add(next);
        queue.push(next);
      }
    }
    for (const n of nodes) {
      if (!connected.has(n.id)) newHidden.add(n.id);
    }
    set({
      hiddenNodeIds: newHidden,
      focusNodeId: id,
      selectedNodeId: null, // 隐藏后关闭详情面板
    });
  },

  clearFocusMode: () => {
    const { focusNodeId, hiddenNodeIds } = get();
    if (!focusNodeId) return;
    pushUndo('退出聚焦分析');
    const newHidden = new Set(hiddenNodeIds);
    newHidden.delete(focusNodeId); // 恢复所选人物的显示
    set({
      hiddenNodeIds: newHidden,
      focusNodeId: null,
    });
  },

  setAsSelf: (id) => {
    pushUndo('设为自己');
    // 切换"自己"：移除其他节点的 isSelf，标记目标节点为 isSelf，并重新计算灰色节点
    const nodes = get().nodes.map((n) => ({
      ...n,
      data: { ...n.data, isSelf: n.id === id },
    }));
    const { displaySettings, edges } = get();
    set({
      nodes,
      grayedNodeIds: computeGrayedNodes(nodes, edges, displaySettings.showGrayOnDisconnect),
      focusNodeId: null, // 切换"自己"后退出聚焦分析模式
    });
    get().recalculateRelationships();
  },

  setViewport: (vp) => {
    set({ viewport: vp });
  },

  setLanguage: (lang) => {
    syncLanguageToUrl(lang);
    set({ language: lang });
    // 切换语言时同步网页标题
    document.title = 'Relationship Graph-人际关系图谱';
    // 语言改变后重新计算称谓，使节点上的称呼同步更新
    get().recalculateRelationships();
  },

  clearBrowserData: () => {
    pushUndo('清除数据');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('清除浏览器数据失败', e);
    }
    // 清除后只保留一个"自己"节点，无示例数据、无默认性别（避免性别预设）
    const selfOnly: PersonNode[] = [
      {
        id: 'self',
        type: 'person',
        position: { x: 0, y: 0 },
        data: {
          name: '我',
          avatar: '',
          relationship: get().language === 'en' ? 'myself' : '自己',
          birthDate: '',
          gender: 'unknown',
          isSelf: true,
        },
      },
    ];
    set({
      nodes: selfOnly,
      edges: [],
      selectedNodeId: null,
      displaySettings: { ...DEFAULT_DISPLAY_SETTINGS, persistToBrowser: true },
      grayedNodeIds: new Set<string>(),
      hiddenNodeIds: new Set<string>(),
      focusNodeId: null,
      forceHiddenMap: new Map(),
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  },

  layoutGraph: () => {
    const { nodes, edges } = get();
    if (nodes.length === 0) return;

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 120 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: 160, height: 120 });
    });

    edges.forEach((edge) => {
      if (edge.data?.type === 'spouse') {
        dagreGraph.setEdge(edge.source, edge.target, { minlen: 0, weight: 10 });
      } else if (edge.data?.type === 'custom') {
        // 自定义关系权重低，不影响血缘层级布局
        dagreGraph.setEdge(edge.source, edge.target, { minlen: 1, weight: 0 });
      } else {
        dagreGraph.setEdge(edge.source, edge.target, { minlen: 1, weight: 1 });
      }
    });

    dagre.layout(dagreGraph);

    // 整理布局时清除所有 yOverridden 标记，让 Y 重新按出生年月计算
    const clearedNodes = nodes.map((node) => {
      if (node.data.yOverridden) {
        const { yOverridden, ...rest } = node.data;
        return { ...node, data: rest };
      }
      return node;
    });

    const newNodes = clearedNodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          ...node.position,
          x: nodeWithPosition.x - 80,
        },
      };
    });

    set({ nodes: applyRelativeYPositions(newNodes, get().displaySettings.verticalGapScale) });
  },

  exportData: (format) => {
    const { nodes, edges, displaySettings, viewport, hiddenNodeIds } = get();
    return exportToFormat({ nodes, edges, displaySettings, viewport, hiddenNodeIds: Array.from(hiddenNodeIds) }, format || 'json');
  },

  importData: (text, format) => {
    try {
      const data = importFromFormat(text, format || 'json');
      pushUndo('导入数据');
      const newNodes = normalizeNodes(data.nodes);
      const newEdges = data.edges;
      const newDisplaySettings = { ...DEFAULT_DISPLAY_SETTINGS, ...(data.displaySettings || {}) };
      const newHiddenNodeIds = new Set<string>(
        (data.hiddenNodeIds || []).filter((id) => newNodes.some((n) => n.id === id))
      );
      set({
        nodes: newNodes,
        edges: newEdges,
        selectedNodeId: null,
        displaySettings: newDisplaySettings,
        grayedNodeIds: computeGrayedNodes(newNodes, newEdges, newDisplaySettings.showGrayOnDisconnect),
        hiddenNodeIds: newHiddenNodeIds,
        focusNodeId: null, // 导入数据后退出聚焦分析模式
        forceHiddenMap: new Map(),
        viewport: data.viewport || { x: 0, y: 0, zoom: 1 },
      });
      get().recalculateRelationships();
    } catch (e) {
      console.error('Failed to import data', e);
      alert('导入失败，请检查文件格式是否正确。');
    }
  },

  // 增量导入人物：作为独立节点添加（无关系），保留现有数据
  importPersonsIncremental: (persons) => {
    if (!persons || persons.length === 0) return 0;
    pushUndo('增量导入人物');
    const existing = get().nodes;
    // 计算放置位置：在现有节点最大 x+y 附近散开
    let maxX = 0, maxY = 0;
    for (const n of existing) {
      const w = (n.measured?.width ?? n.width ?? 180) as number;
      const h = (n.measured?.height ?? n.height ?? 120) as number;
      maxX = Math.max(maxX, n.position.x + w);
      maxY = Math.max(maxY, n.position.y + h);
    }
    const startX = maxX + 60;
    const startY = maxY + 60;
    const newNodes: PersonNode[] = persons.map((p, i) => ({
      id: `imp-${uuidv4()}`,
      type: 'person',
      position: { x: startX + (i % 5) * 220, y: startY + Math.floor(i / 5) * 160 },
      data: { ...p },
    }));
    set({ nodes: [...existing, ...newNodes] });
    get().recalculateRelationships();
    return newNodes.length;
  },

  setConnectionMode: (mode, customLabel) => {
    set({
      connectionMode: mode,
      connectionCustomLabel: customLabel || '',
      connectFirstNodeId: null,
      // 进入/退出连线模式时清除选中节点/边，避免面板干扰
      selectedNodeId: mode === 'off' ? get().selectedNodeId : null,
      selectedEdgeId: mode === 'off' ? get().selectedEdgeId : null,
    });
  },

  resetConnectSelection: () => set({ connectFirstNodeId: null }),

  // 连线模式下点击节点
  clickNodeInConnectMode: (nodeId) => {
    const state = get();
    const mode = state.connectionMode;
    if (mode === 'off') return { connected: false };

    // 第一次点击：记录起点
    if (!state.connectFirstNodeId) {
      set({ connectFirstNodeId: nodeId });
      return { connected: false };
    }

    // 再次点击同一节点：取消选择
    if (state.connectFirstNodeId === nodeId) {
      set({ connectFirstNodeId: null });
      return { connected: false, reason: '取消选择' };
    }

    const aId = state.connectFirstNodeId;
    const bId = nodeId;
    const aNode = state.nodes.find((n) => n.id === aId);
    const bNode = state.nodes.find((n) => n.id === bId);
    if (!aNode || !bNode) {
      set({ connectFirstNodeId: null });
      return { connected: false, reason: '节点不存在' };
    }

    // 根据模式决定关系类型
    let edgeType: 'parent' | 'child' | 'spouse' | 'custom';
    let resultEdgeType = '';
    let reason = '';

    if (mode === 'parent-child') {
      // A 为长辈，B 为晚辈：A -> B 父子
      edgeType = 'child'; // connectExisting(sourceId=A, targetId=B, 'child') 表示 B 是 A 的子女
      resultEdgeType = 'parent-child';
      reason = '父子/母子';
    } else if (mode === 'spouse') {
      edgeType = 'spouse';
      resultEdgeType = 'spouse';
      reason = '爱人';
    } else if (mode === 'custom') {
      edgeType = 'custom';
      resultEdgeType = 'custom';
      reason = state.connectionCustomLabel || '自定义';
    } else {
      // auto：根据年龄差判断
      const ageA = calcAgeFromBirth(aNode.data.birthDate, aNode.data.deathDate);
      const ageB = calcAgeFromBirth(bNode.data.birthDate, bNode.data.deathDate);
      if (ageA === null || ageB === null) {
        // 年龄未知，无法自动判断，回退为爱人
        edgeType = 'spouse';
        resultEdgeType = 'spouse';
        reason = '年龄未知，按爱人处理';
      } else {
        const diff = Math.abs(ageA - ageB);
        if (diff > 15) {
          // 年龄差>15：年长者为父母
          if (ageA >= ageB) {
            edgeType = 'child'; // A 是父母，B 是子女
          } else {
            edgeType = 'parent'; // B 是父母，A 是子女
          }
          resultEdgeType = 'parent-child';
          reason = `年龄差${diff}，父母子女`;
        } else {
          edgeType = 'spouse';
          resultEdgeType = 'spouse';
          reason = `年龄差${diff}，爱人`;
        }
      }
    }

    // 建立关系
    get().connectExisting(aId, bId, edgeType, mode === 'custom' ? state.connectionCustomLabel : undefined);

    // 完成一次连线后重置起点（保持在连线模式，便于连续连线）
    set({ connectFirstNodeId: null });
    return { connected: true, edgeType: resultEdgeType, reason };
  },

  setShowHelpPage: (v) => set({ showHelpPage: v }),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    set({
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      grayedNodeIds: snapshot.grayedNodeIds,
      hiddenNodeIds: snapshot.hiddenNodeIds,
      selectedNodeId: snapshot.selectedNodeId,
      selectedEdgeId: snapshot.selectedEdgeId,
      displaySettings: snapshot.displaySettings,
      focusNodeId: snapshot.focusNodeId,
      forceHiddenMap: new Map(snapshot.forceHiddenMap),
      undoStack: undoStack.slice(0, -1),
    });
  },

  canUndo: () => get().undoStack.length > 0,

  clearUndo: () => set({ undoStack: [] }),
  };
});

// ───────────────────────────────────────────────────────────────────────────
// 轻量、带引用缓存的辅助查询（供节点/边组件按需「非订阅」读取）
//
// 性能说明：PersonNode 与边组件在计算 aria-label / 关系统计时原本会订阅整个
// nodes / edges 数组，导致任意节点拖动都触发所有节点与所有边重渲染。这里改为
// 组件仅在「自身被 React Flow 重渲染」时，通过 getState() 一次性读取以下带缓存
// 的 Map。缓存基于 nodes 数组引用，仅在 nodes 真正变化时才重建，避免每条边都
// 重建一遍 Map 的 O(edges × nodes) 浪费。
// ───────────────────────────────────────────────────────────────────────────
let _cachedNodesRef: Node<PersonData, string>[] | null = null;
let _cachedNameById: Map<string, string> | null = null;
let _cachedGenderById: Map<string, string> | null = null;

export function getNodeNameMap(): Map<string, string> {
  const nodes = useRelationshipStore.getState().nodes;
  if (_cachedNodesRef !== nodes) {
    _cachedNodesRef = nodes;
    _cachedNameById = new Map(nodes.map((n) => [n.id, (n.data as PersonData).name || '']));
    _cachedGenderById = new Map(nodes.map((n) => [n.id, (n.data as PersonData).gender || '']));
  }
  return _cachedNameById!;
}

export function getNodeGenderMap(): Map<string, string> {
  // 确保与 name 缓存同步刷新
  getNodeNameMap();
  return _cachedGenderById!;
}

// 浏览器持久化：监听 nodes/edges/displaySettings/viewport 变化，自动保存
// （仅当 displaySettings.persistToBrowser 开启时）
//
// 性能优化：拖拽节点时 onNodesChange 会以很高频触发本订阅，若每次都 JSON.stringify
// 整个 nodes+edges 并同步写入 localStorage，会造成明显卡顿。这里用「微任务/rAF 合并 +
// 节流」策略：
//  - 收集最新 state，最多每 PERSIST_INTERVAL 毫秒执行一次真正的写入；
//  - 若处于拖拽中（dragging），则推迟到拖拽结束后再落盘，避免拖动过程中的高频写盘；
//  - 非拖拽的常规变更（增删改、设置切换等）仍会在下一个 rAF 合并后尽快落盘。
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistRaf: number | null = null;
let persistPending: ReturnType<typeof useRelationshipStore.getState> | null = null;
const PERSIST_INTERVAL = 500;

function schedulePersist(state: ReturnType<typeof useRelationshipStore.getState>) {
  // 关闭了浏览器保存：清除已保存的数据，刷新后会加载示例数据
  if (!state.displaySettings.persistToBrowser) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('清除浏览器数据失败', e);
    }
    return;
  }
  persistPending = state;
  // 拖拽进行中：延迟落盘，待拖拽停止后由下一次状态变化或超时触发
  const isDragging = state.nodes.some((n) => n.dragging);
  if (isDragging) return;
  if (persistTimer) return; // 已安排节流写入
  persistTimer = setTimeout(flushPersist, PERSIST_INTERVAL);
  // 用 rAF 把「同步写盘」延后到浏览器空闲，避免阻塞当前帧渲染
  if (persistRaf === null) {
    persistRaf = requestAnimationFrame(() => {
      persistRaf = null;
    });
  }
}

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const state = persistPending;
  persistPending = null;
  if (!state) return;
  // 再次确认：若此时仍在拖拽，推迟到拖拽结束
  if (state.nodes.some((n) => n.dragging)) return;
  savePersistedState({
    nodes: state.nodes,
    edges: state.edges,
    displaySettings: state.displaySettings,
    viewport: state.viewport,
    hiddenNodeIds: Array.from(state.hiddenNodeIds),
    focusNodeId: state.focusNodeId,
  });
}

useRelationshipStore.subscribe((state) => {
  schedulePersist(state);
});

// 页面隐藏/卸载前确保最后一次变更落盘（拖拽中可能被推迟，这里强制写入）
if (typeof window !== 'undefined') {
  const flushOnExit = () => flushPersist();
  window.addEventListener('beforeunload', flushOnExit);
  window.addEventListener('pagehide', flushOnExit);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersist();
  });
}

// 初始化：同步 <html lang> 与 URL，并确保初始称谓匹配当前语言
(function initLanguage() {
  const lang = useRelationshipStore.getState().language;
  syncLanguageToUrl(lang);
  // 初始化网页标题
  document.title = 'Relationship Graph-人际关系图谱';
  // 若持久化数据中的称谓是另一种语言，重算为当前语言
  useRelationshipStore.getState().recalculateRelationships();
})();
