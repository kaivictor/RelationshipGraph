import { Handle, Position } from '@xyflow/react';
import { PersonData, useFamilyStore, toArrayValue } from '../store/useFamilyStore';
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

function formatBirthDate(birthDate: string): string {
  if (!birthDate) return '';
  const parts = birthDate.split('-');
  if (parts.length < 2) return birthDate;
  return `${parts[0]}年${parts[1]}月`;
}

// 格式化离世日期：含日则显示"年月日"，否则"年月"
function formatDeathDate(deathDate: string): string {
  if (!deathDate) return '';
  const parts = deathDate.split('-');
  if (parts.length >= 3) return `${parts[0]}年${parts[1]}月${parts[2]}日`;
  if (parts.length === 2) return `${parts[0]}年${parts[1]}月`;
  return deathDate;
}

function GenderSymbol({ gender }: { gender: PersonData['gender'] }) {
  if (gender === 'male') return <span className="text-blue-500 text-sm leading-none">♂</span>;
  if (gender === 'female') return <span className="text-pink-500 text-sm leading-none">♀</span>;
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

export function PersonNodeComponent({ id, data, selected }: { id: string; data: PersonData; selected: boolean }) {
  const displaySettings = useFamilyStore((state) => state.displaySettings);
  const isGrayed = useFamilyStore((state) => state.grayedNodeIds.has(id));

  const age = displaySettings.showAge ? calculateAge(data.birthDate, data.deathDate) : null;
  const showAgeNum = age !== null && age >= 0;
  const birthStr = displaySettings.showBirthDate && data.birthDate ? formatBirthDate(data.birthDate) : '';
  // 离世者且开启"离世日期代替出生日期"：显示"年龄·死亡年月"；否则"出生年月·年龄"
  const useDeathReplace = data.deceased && data.deathDate && displaySettings.deathDateReplaceBirth;
  const deathStr = useDeathReplace ? formatDeathDate(data.deathDate!) : '';
  // 合并为一行
  const infoLine = useDeathReplace
    ? [showAgeNum ? `${age}岁` : '', deathStr].filter(Boolean).join(' · ')
    : [birthStr, showAgeNum ? `${age}岁` : ''].filter(Boolean).join(' · ');

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
    return BUILTIN_LABELS[key] ?? displaySettings.customFields.find((f) => f.id === key)?.label ?? key;
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
        selected ? 'border-blue-500 shadow-md' : (isGrayed ? '' : data.deceased ? 'border-gray-500 border-dashed' : 'border-gray-200'),
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
            title="双击复制"
          >
            {data.namePinyin}
          </div>
        )}

        {/* 2. 姓名（双击复制） + 性别符号（无反应） */}
        <div className="flex items-center justify-center gap-1 w-full px-1">
          <span
            className="font-bold text-sm text-gray-800 truncate cursor-pointer select-none"
            onDoubleClick={(e) => copyText(data.name, e)}
            title="双击复制"
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
              title="双击复制"
            >
              曾用名：{joined}
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
                  title={data.relationshipOverridden ? '手动设置的称谓，双击复制' : '系统自动计算的称谓，双击复制'}
                >
                  {data.relationship}
                  {data.relationshipOverridden && <span className="ml-0.5 text-amber-500">✎</span>}
                </span>
              )}
              {showPop && (
                <span
                  className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full cursor-pointer select-none hover:bg-gray-200 transition-colors"
                  onDoubleClick={(e) => copyText(popJoined, e)}
                  title="双击复制俗称"
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
            title={data.avatar ? '双击复制头像' : undefined}
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
              <User className="w-7 h-7 text-blue-500" />
            ) : data.gender === 'female' ? (
              <UserRound className="w-7 h-7 text-pink-500" />
            ) : (
              <UserRoundSearch className="w-7 h-7 text-gray-400" />
            )}
          </div>
        )}

        {/* 6. 出生年月 · 年龄（双击复制） */}
        {isBasicVisible('birthDate', true) && infoLine && (
          <div
            className="mt-2 text-[11px] text-gray-500 cursor-pointer select-none"
            onDoubleClick={(e) => copyText(infoLine, e)}
            title="双击复制"
          >
            {infoLine}
          </div>
        )}

        {/* 7. 文化程度（双击复制） */}
        {isBasicVisible('education', displaySettings.showEducation) && data.education && (
          <div
            className="mt-1 text-[11px] text-gray-600 cursor-pointer select-none"
            onDoubleClick={(e) => copyText(data.education!, e)}
            title="双击复制"
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
                    <IconComp className="w-3 h-3 mt-0.5 text-gray-400 shrink-0 pointer-events-none" />
                  ) : (
                    <span className="text-gray-400 shrink-0 pointer-events-none mt-0.5">{getLabel(key)}:</span>
                  )}
                  <div className={clsx('flex flex-col min-w-0', useTwoCols ? 'flex-1' : 'items-center')}>
                    {values.map((value, idx) => {
                      const valueSpan = (
                        <span
                          key={idx}
                          className="cursor-pointer hover:text-gray-800 break-all leading-tight"
                          title={`${getLabel(key)}: ${value}（双击复制${QR_SUPPORTED_FIELDS.has(key) ? '，长按显示二维码' : ''}）`}
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
                title={`${attr.key}: ${attr.value}（双击复制）`}
                onDoubleClick={(e) => copyText(attr.value, e)}
              >
                <span className="text-gray-400 shrink-0 pointer-events-none">{attr.key}:</span>
                <AutoScrollText value={attr.value} />
              </div>
            ))}
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="opacity-0 pointer-events-none"
        style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      />
    </div>
  );
}
