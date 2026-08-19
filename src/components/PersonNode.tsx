import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { PersonData, useRelationshipStore, toArrayValue } from '../store/useRelationshipStore';
import { User, UserRound, UserRoundSearch } from 'lucide-react';
import {
  PhoneIcon,
  EmailIcon,
  AddressIcon,
  CarIcon,
  QQIcon,
  WeChatIcon,
  BilibiliIcon,
  DiscordIcon,
  RedditIcon,
  ThreadsIcon,
  WhatsappIcon,
  DouyinIcon,
  TwitterIcon,
  XiaohongshuIcon,
} from './icons';
import { AutoScrollText } from './AutoScrollText';
import { copyText } from './copyUtils';
import { ContactQRTooltip, QR_SUPPORTED_FIELDS } from './ContactQRTooltip';
import clsx from 'clsx';
import { t, useLang } from '../i18n';

function calculateAge(birthDate: string, deathDate?: string): number | null {
  if (!birthDate) return null;
  // birthDate format: YYYY-MM
  const parts = birthDate.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return null;

  // 若有离世日期，年龄截止到离世时
  const ref = deathDate ? new Date(deathDate) : new Date();
  const refTime = ref.getTime();
  if (isNaN(refTime)) return null;
  let age = ref.getFullYear() - year;
  const refMonth = ref.getMonth() + 1;
  if (refMonth < month) {
    age--;
  } else if (refMonth === month) {
    // 同月时按日精确比较（若有日）
    const day = parts[2] ? parseInt(parts[2], 10) : 1;
    const refDay = ref.getDate();
    if (refDay < day) age--;
  }
  return age;
}

function formatBirthDate(birthDate: string, lang: string): string {
  if (!birthDate) return '';
  const parts = birthDate.split('-');
  if (parts.length < 2) return birthDate;
  if (lang === 'en') return `${parts[0]}-${parts[1]}`;
  return `${parts[0]}年${parts[1]}月`;
}

// 格式化离世日期：含日则显示"年月日"，否则"年月"
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

function GenderSymbol({ gender }: { gender: PersonData['gender'] }) {
  if (gender === 'male') return <span className="text-blue-500 text-sm leading-none" aria-label={t('male')} role="img">♂</span>;
  if (gender === 'female') return <span className="text-pink-500 text-sm leading-none" aria-label={t('female')} role="img">♀</span>;
  return null;
}

// 可拖拽内置字段的标签
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

// 使用图标（不显示属性名）的字段
const ICON_FIELDS = {
  phone: PhoneIcon,
  email: EmailIcon,
  address: AddressIcon,
  licensePlate: CarIcon,
  qq: QQIcon,
  wechat: WeChatIcon,
  bilibili: BilibiliIcon,
  discord: DiscordIcon,
  reddit: RedditIcon,
  threads: ThreadsIcon,
  whatsapp: WhatsappIcon,
  douyin: DouyinIcon,
  twitter: TwitterIcon,
  xiaohongshu: XiaohongshuIcon,
};

// 用 memo 包裹：组件仅在 props（id/data/selected）或内部订阅的 store 切片变化时才重渲染，
// 避免父级（画布）无关重渲染波及所有节点；配合 React Flow 内部的节点 memo 进一步减少重渲染。
export const PersonNodeComponent = memo(function PersonNodeComponent({ id, data }: { id: string; data: PersonData }) {
  const isEn = useLang() === 'en';
  const displaySettings = useRelationshipStore((state) => state.displaySettings);
  const isGrayed = useRelationshipStore((state) => state.grayedNodeIds.has(id));
  // 选中高亮完全由 store 控制，脱离 React Flow 受控的 selected：
  // 8eaffb7 引入的 memo 化使 React Flow 传入的 selected prop 在受控模式下经常不更新，
  // 因此高亮一律由 selectedNodeId（单选）与 multiSelectedIds（长按多选）驱动，memo 下仍可靠。
  const selectedNodeId = useRelationshipStore((state) => state.selectedNodeId);
  const multiSelectedIds = useRelationshipStore((state) => state.multiSelectedIds);
  // 订阅 edges 以正确计算关系统计；拖动节点时 edges 引用不变，因此不会触发重渲染，
  // 与原行为一致（仅真正的连线增删改才会重算 stats）。
  const edges = useRelationshipStore((state) => state.edges);

  // 选中态：单选来自 selectedNodeId；多选来自 multiSelectedIds。
  const isSelected = selectedNodeId === id || multiSelectedIds.has(id);

  // 关系统计：根据徽章维度（family / hierarchy）分别计算
  const stats = (() => {
    let parents = 0, children = 0, spouse = 0, others = 0, superior = 0, subordinate = 0;
    for (const e of edges) {
      if (e.source !== id && e.target !== id) continue;
      const t = (e.data as { type?: string })?.type;
      if (t === 'parent-child') {
        if (e.target === id) parents++;
        else if (e.source === id) children++;
      } else if (t === 'spouse') {
        spouse++;
      } else if (t === 'custom') {
        others++;
      } else if (t === 'superior-subordinate') {
        if (e.source === id) subordinate++; // 我方为上级 → 下级数
        else if (e.target === id) superior++; // 我方为下级 → 上级数
      }
    }
    const mode = displaySettings.statsBadgeMode;
    if (mode === 'hierarchy') {
      // 层级维度：上级 / 下级 / 其他（父母子女爱人归入其他）
      return { parents: superior, children: subordinate, spouse: 0, others: parents + children + spouse + others };
    }
    // 家庭维度：父母 / 子女 / 爱人 / 其他（上下级归入其他）
    return { parents, children, spouse, others: others + superior + subordinate };
  })();
  const formatCount = (n: number) => (n > 99 ? '*' : n > 9 ? '9+' : String(n));

  const age = displaySettings.showAge ? calculateAge(data.birthDate, data.deathDate) : null;
  const showAgeNum = age !== null && age >= 0;
  const birthStr = displaySettings.showBirthDate && data.birthDate ? formatBirthDate(data.birthDate, isEn ? 'en' : 'zh') : '';
  // 离世者且开启"离世日期代替出生日期"：显示"年龄·死亡年月"；否则"出生年月·年龄"
  const useDeathReplace = data.deceased && data.deathDate && displaySettings.deathDateReplaceBirth;
  const deathStr = useDeathReplace ? formatDeathDate(data.deathDate!, isEn ? 'en' : 'zh') : '';
  // 合并为一行
  const ageUnit = isEn ? ' yrs' : '岁';
  const infoLine = useDeathReplace
    ? [showAgeNum ? `${age}${ageUnit}` : '', deathStr].filter(Boolean).join(' · ')
    : [birthStr, showAgeNum ? `${age}${ageUnit}` : ''].filter(Boolean).join(' · ');

  // 获取可拖拽字段的值（返回数组：内置多值字段为数组，自定义字段包装为单元素数组）
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

  // 判断可拖拽字段是否可见（个人设置优先于全局）
  const isFieldVisible = (key: string): boolean => {
    // 个人级覆盖优先
    if (data.fieldVisibility && key in data.fieldVisibility) {
      return data.fieldVisibility[key];
    }
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

  // 基本信息字段可见性（个人设置优先于全局）
  const isBasicVisible = (key: string, globalVisible: boolean): boolean => {
    if (data.fieldVisibility && key in data.fieldVisibility) {
      return data.fieldVisibility[key];
    }
    return globalVisible;
  };

  const getLabel = (key: string): string => {
    const labels = isEn ? BUILTIN_LABELS_EN : BUILTIN_LABELS;
    return labels[key] ?? displaySettings.customFields.find((f) => f.id === key)?.label ?? key;
  };

  // 仅渲染可见且有值的可拖拽字段
  const visibleDraggable = displaySettings.fieldOrder.filter(
    (key) => isFieldVisible(key) && getFieldValues(key).length > 0
  );

  // 个人自定义属性：跳过与全局自定义属性同名的（全局优先）
  const globalCustomLabels = displaySettings.customFields.map((f) => f.label);
  const personalAttrs = (data.customAttributes || []).filter(
    (attr) => attr.key && attr.value && !attr.hidden && !globalCustomLabels.includes(attr.key)
  );

  const totalAttrs = visibleDraggable.length + personalAttrs.length;

  // 超过 6 个可排序属性时加宽节点
  const useWideNode = totalAttrs > 6;
  const useTwoCols = useWideNode;

  return (
    <div
      className={clsx(
        'relative flex flex-col items-center p-3 border-2 rounded-xl shadow-sm z-10 transition-all',
        useWideNode ? 'w-[300px]' : 'w-[160px]',
        data.deceased
          ? 'bg-gray-300 border-gray-500 border-dashed [&_*]:text-gray-700 grayscale'
          : isGrayed
            ? 'bg-gray-100 border-gray-300 grayscale'
            : 'bg-white',
        isSelected ? 'border-blue-500 shadow-md' : (isGrayed ? '' : data.deceased ? 'border-gray-500 border-dashed' : 'border-gray-200'),
        data.isSelf ? 'ring-2 ring-blue-300' : ''
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="opacity-0 pointer-events-none"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />

      <div className="text-center relative z-20 w-full flex flex-col items-center">
        {/* 1. 姓名拼音（字号小一点，双击复制） */}
        {isBasicVisible('namePinyin', displaySettings.showNamePinyin) && data.namePinyin && (
          <div
            className="text-[10px] text-gray-400 leading-tight cursor-pointer select-none"
            onDoubleClick={(e) => copyText(data.namePinyin!, e)}
            title={t('doubleClickCopy')}
          >
            {data.namePinyin}
          </div>
        )}

        {/* 2. 姓名（双击复制） + 性别符号（无反应） */}
        <div className="flex items-center justify-center gap-1 w-full px-1">
          <span
            className="font-bold text-sm text-gray-800 truncate cursor-pointer select-none"
            onDoubleClick={(e) => copyText(data.name, e)}
            title={t('doubleClickCopy')}
          >
            {data.name}
          </span>
          <GenderSymbol gender={data.gender} />
        </div>

        {/* 3. 曾用名（多值逗号连接，双击复制全部） */}
        {isBasicVisible('formerName', displaySettings.showFormerName) && (() => {
          const names = toArrayValue(data.formerName) || [];
          if (names.length === 0) return null;
          const joined = names.join('，');
          return (
            <div
              className="text-[10px] text-gray-400 mt-0.5 cursor-pointer select-none"
              onDoubleClick={(e) => copyText(joined, e)}
              title={t('doubleClickCopy')}
            >
              {t('formerNames')}：{joined}
            </div>
          );
        })()}

        {/* 4. 称谓（双击复制称谓） / 称谓俗称（多值逗号连接，双击复制全部） */}
        {(() => {
          const showRel = isBasicVisible('relationship', displaySettings.showRelationship);
          const popNames = toArrayValue(data.popularName) || [];
          const showPop = isBasicVisible('popularName', displaySettings.showPopularName) && popNames.length > 0;
          if (!showRel && !showPop) return null;
          const popJoined = popNames.join('，');
          return (
            <div className="mt-0.5 flex items-center justify-center gap-1 flex-wrap">
              {showRel && (
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full cursor-pointer select-none transition-colors',
                    data.relationshipOverridden
                      ? 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'
                      : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                  )}
                  onDoubleClick={(e) => copyText(data.relationship, e)}
                  title={data.relationshipOverridden ? t('manualTerm') : t('autoCalculatedTerm')}
                >
                  {data.relationship}
                  {data.relationshipOverridden && <span className="ml-0.5 text-amber-500">✎</span>}
                </span>
              )}
              {showPop && (
                <span
                  className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full cursor-pointer select-none hover:bg-gray-200 transition-colors"
                  onDoubleClick={(e) => copyText(popJoined, e)}
                  title={t('copyPopular')}
                >
                  （{popJoined}）
                </span>
              )}
            </div>
          );
        })()}

        {/* 5. 头像（双击复制 base64/URL） */}
        {isBasicVisible('avatar', displaySettings.showAvatar) && (
          <div
            className="overflow-hidden bg-gray-100 flex items-center justify-center mt-2 border border-gray-300 cursor-pointer select-none"
            style={{ width: '49px', height: '63px', borderRadius: '4px' }}
            onDoubleClick={(e) => data.avatar && copyText(data.avatar, e)}
            title={data.avatar ? t('copyAvatar') : undefined}
          >
            {data.avatar ? (
              <img
                src={data.avatar.startsWith('data:') || data.avatar.startsWith('http')
                  ? data.avatar
                  : `data:image/jpeg;base64,${data.avatar}`}
                alt={data.name}
                className="w-full h-full object-cover pointer-events-none"
              />
            ) : data.gender === 'male' ? (
              <User className="w-7 h-7 text-blue-500" aria-hidden="true" />
            ) : data.gender === 'female' ? (
              <UserRound className="w-7 h-7 text-pink-500" aria-hidden="true" />
            ) : (
              <UserRoundSearch className="w-7 h-7 text-gray-400" aria-hidden="true" />
            )}
          </div>
        )}

        {/* 6. 出生年月 · 年龄（双击复制） */}
        {isBasicVisible('birthDate', true) && infoLine && (
          <div
            className="mt-2 text-[11px] text-gray-500 cursor-pointer select-none"
            onDoubleClick={(e) => copyText(infoLine, e)}
            title={t('doubleClickCopy')}
          >
            {infoLine}
          </div>
        )}

        {/* 7. 文化程度（双击复制） */}
        {isBasicVisible('education', displaySettings.showEducation) && data.education && (
          <div
            className="mt-1 text-[11px] text-gray-600 cursor-pointer select-none"
            onDoubleClick={(e) => copyText(data.education!, e)}
            title={t('doubleClickCopy')}
          >
            {data.education}
          </div>
        )}

        {/* 8+. 可排序属性（手机号/QQ/微信/邮箱/住址/车牌号/全局自定义/个人自定义） */}
        {(visibleDraggable.length > 0 || personalAttrs.length > 0) && (
          <div
            className={clsx(
              'mt-2 w-full border-t border-gray-100 pt-1 gap-0.5',
              useTwoCols ? 'grid grid-cols-2' : 'flex flex-col items-center'
            )}
          >
            {visibleDraggable.map((key) => {
              const values = getFieldValues(key);
              if (values.length === 0) return null;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const IconComp: any = (ICON_FIELDS as any)[key];
              const isIcon = !!IconComp;
              // 多值时整组展示：图标垂直居中，每个值独立一行并支持双击复制
              return (
                <div
                  key={key}
                  className={clsx(
                    'flex items-start gap-1 min-w-0 text-[10px] text-gray-600 select-none',
                    useTwoCols ? 'justify-start px-1' : 'justify-center w-full'
                  )}
                >
                  {isIcon ? (
                    <IconComp className="w-3 h-3 mt-0.5 text-gray-400 shrink-0 pointer-events-none" aria-hidden="true" />
                  ) : (
                    <span className="text-gray-400 shrink-0 pointer-events-none mt-0.5">{getLabel(key)}:</span>
                  )}
                  <div className={clsx('flex flex-col min-w-0', useTwoCols ? 'flex-1' : 'items-center')}>
                    {values.map((value, idx) => {
                      const valueSpan = (
                        <span
                          key={idx}
                          className="cursor-pointer hover:text-gray-800 break-all leading-tight"
                          aria-label={`${getLabel(key)}：${value}${QR_SUPPORTED_FIELDS.has(key) ? t('showQr') : ''}`}
                          title={`${getLabel(key)}: ${value}${QR_SUPPORTED_FIELDS.has(key) ? t('showQrLongPress') : t('doubleClickCopy')}`}
                          onDoubleClick={(e) => copyText(value, e)}
                        >
                          <AutoScrollText value={value} />
                        </span>
                      );
                      // 联系方式字段支持长按悬浮二维码
                      if (QR_SUPPORTED_FIELDS.has(key)) {
                        return (
                          <ContactQRTooltip key={idx} fieldKey={key} value={value}>
                            {valueSpan}
                          </ContactQRTooltip>
                        );
                      }
                      return valueSpan;
                    })}
                  </div>
                </div>
              );
            })}
            {/* 个人自定义属性（与全局同名的已被过滤掉） */}
            {personalAttrs.map((attr) => (
              <div
                key={`personal-${attr.key}`}
                className={clsx(
                  'flex items-center gap-1 min-w-0 text-[10px] text-gray-600 cursor-pointer select-none',
                  useTwoCols ? 'justify-start px-1' : 'justify-center w-full'
                )}
                title={`${attr.key}: ${attr.value}${t('doubleClickCopy')}`}
                onDoubleClick={(e) => copyText(attr.value, e)}
              >
                <span className="text-gray-400 shrink-0 pointer-events-none">{attr.key}:</span>
                <AutoScrollText value={attr.value} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 关系统计徽章：统计信息已包含在节点 aria-label 中，此处仅作视觉装饰，避免屏幕阅读器重复朗读 */}
      {displaySettings.showStatsBadge && (
        <div className="mt-1.5 flex justify-center" aria-hidden="true">
          <div className="inline-flex items-center gap-px px-1 py-[1px] rounded-md bg-gray-100/80 border border-gray-200/70 text-[8px] leading-none text-gray-500 select-none">
            {displaySettings.statsBadgeMode === 'hierarchy' ? (
              <>
                <span>{t('statSuperior')}{formatCount(stats.parents)}</span>
                <span className="text-gray-300 text-[6px]">·</span>
                <span>{t('statSubordinate')}{formatCount(stats.children)}</span>
                <span className="text-gray-300 text-[6px]">·</span>
                <span>{t('statOthers')}{formatCount(stats.others)}</span>
              </>
            ) : (
              <>
                <span>{t('statParents')}{formatCount(stats.parents)}</span>
                <span className="text-gray-300 text-[6px]">·</span>
                <span>{t('statChildren')}{formatCount(stats.children)}</span>
                <span className="text-gray-300 text-[6px]">·</span>
                <span>{t('statSpouse')}{formatCount(stats.spouse)}</span>
                <span className="text-gray-300 text-[6px]">·</span>
                <span>{t('statOthers')}{formatCount(stats.others)}</span>
              </>
            )}
          </div>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="opacity-0 pointer-events-none"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
});
