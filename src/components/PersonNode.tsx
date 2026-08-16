import { Handle, Position } from '@xyflow/react';
import { PersonData, useFamilyStore } from '../store/useFamilyStore';
import { User, UserRound, UserRoundSearch } from 'lucide-react';
import { PhoneIcon, EmailIcon, AddressIcon, CarIcon } from './icons';
import { AutoScrollText } from './AutoScrollText';
import { copyText } from './copyUtils';
import clsx from 'clsx';

function calculateAge(birthDate: string): number | null {
  if (!birthDate) return null;
  // birthDate format: YYYY-MM
  const parts = birthDate.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  if (isNaN(year) || isNaN(month)) return null;

  const now = new Date();
  let age = now.getFullYear() - year;
  // Treat birth day as the 1st of the month
  const currentMonth = now.getMonth() + 1;
  if (currentMonth < month) {
    age--;
  }
  return age;
}

function formatBirthDate(birthDate: string): string {
  if (!birthDate) return '';
  const parts = birthDate.split('-');
  if (parts.length < 2) return birthDate;
  return `${parts[0]}年${parts[1]}月`;
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
};

// 使用图标（不显示属性名）的字段
const ICON_FIELDS = {
  phone: PhoneIcon,
  email: EmailIcon,
  address: AddressIcon,
  licensePlate: CarIcon,
};

export function PersonNodeComponent({ data, selected }: { data: PersonData; selected: boolean }) {
  const displaySettings = useFamilyStore((state) => state.displaySettings);

  const age = displaySettings.showAge ? calculateAge(data.birthDate) : null;
  const showAgeNum = age !== null && age >= 0;
  const birthStr = displaySettings.showBirthDate && data.birthDate ? formatBirthDate(data.birthDate) : '';
  // 合并为一行：出生年月 · 年龄
  const infoLine = [birthStr, showAgeNum ? `${age}岁` : ''].filter(Boolean).join(' · ');

  // 获取可拖拽字段的值
  const getFieldValue = (key: string): string | undefined => {
    if (key === 'phone') return data.phone;
    if (key === 'qq') return data.qq;
    if (key === 'wechat') return data.wechat;
    if (key === 'email') return data.email;
    if (key === 'address') return data.address;
    if (key === 'licensePlate') return data.licensePlate;
    return data.customFieldValues?.[key];
  };

  // 判断可拖拽字段是否可见
  const isFieldVisible = (key: string): boolean => {
    const toggleMap: Record<string, boolean> = {
      phone: displaySettings.showPhone,
      qq: displaySettings.showQq,
      wechat: displaySettings.showWechat,
      email: displaySettings.showEmail,
      address: displaySettings.showAddress,
      licensePlate: displaySettings.showLicensePlate,
    };
    if (key in toggleMap) return toggleMap[key];
    return displaySettings.customFieldVisibility[key] ?? true;
  };

  const getLabel = (key: string): string => {
    return BUILTIN_LABELS[key] ?? displaySettings.customFields.find((f) => f.id === key)?.label ?? key;
  };

  // 仅渲染可见且有值的可拖拽字段
  const visibleDraggable = displaySettings.fieldOrder.filter(
    (key) => isFieldVisible(key) && getFieldValue(key)
  );

  // 个人自定义属性：跳过与全局自定义属性同名的（全局优先）
  const globalCustomLabels = displaySettings.customFields.map((f) => f.label);
  const personalAttrs = (data.customAttributes || []).filter(
    (attr) => attr.key && attr.value && !globalCustomLabels.includes(attr.key)
  );

  const totalAttrs = visibleDraggable.length + personalAttrs.length;

  // 超过 6 个可排序属性时加宽节点
  const useWideNode = totalAttrs > 6;
  const useTwoCols = useWideNode;

  return (
    <div
      className={clsx(
        'relative flex flex-col items-center p-3 bg-white border-2 rounded-xl shadow-sm z-10',
        useWideNode ? 'w-[300px]' : 'w-[160px]',
        selected ? 'border-blue-500 shadow-md' : 'border-gray-200',
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
        {displaySettings.showNamePinyin && data.namePinyin && (
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

        {/* 3. 曾用名（双击复制） */}
        {displaySettings.showFormerName && data.formerName && (
          <div
            className="text-[10px] text-gray-400 mt-0.5 cursor-pointer select-none"
            onDoubleClick={(e) => copyText(data.formerName!, e)}
            title="双击复制"
          >
            曾用名：{data.formerName}
          </div>
        )}

        {/* 4. 称谓（双击复制称谓） / 称谓俗称（双击复制俗称） */}
        {(() => {
          const showRel = displaySettings.showRelationship;
          const showPop = displaySettings.showPopularName && !!data.popularName;
          if (!showRel && !showPop) return null;
          return (
            <div className="mt-0.5 flex items-center justify-center gap-1 flex-wrap">
              {showRel && (
                <span
                  className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full cursor-pointer select-none hover:bg-gray-200 transition-colors"
                  onDoubleClick={(e) => copyText(data.relationship, e)}
                  title="双击复制称谓"
                >
                  {data.relationship}
                </span>
              )}
              {showPop && (
                <span
                  className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full cursor-pointer select-none hover:bg-gray-200 transition-colors"
                  onDoubleClick={(e) => copyText(data.popularName!, e)}
                  title="双击复制俗称"
                >
                  （{data.popularName}）
                </span>
              )}
            </div>
          );
        })()}

        {/* 5. 头像（双击复制 base64/URL） */}
        {displaySettings.showAvatar && (
          <div
            className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center mt-2 border border-gray-300 cursor-pointer select-none"
            onDoubleClick={(e) => data.avatar && copyText(data.avatar, e)}
            title={data.avatar ? '双击复制头像' : undefined}
          >
            {data.avatar ? (
              <img src={data.avatar} alt={data.name} className="w-full h-full object-cover pointer-events-none" />
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
        {infoLine && (
          <div
            className="mt-2 text-[11px] text-gray-500 cursor-pointer select-none"
            onDoubleClick={(e) => copyText(infoLine, e)}
            title="双击复制"
          >
            {infoLine}
          </div>
        )}

        {/* 7. 文化程度（双击复制） */}
        {displaySettings.showEducation && data.education && (
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
              const value = getFieldValue(key);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const IconComp: any = (ICON_FIELDS as any)[key];
              const isIcon = !!IconComp;
              return (
                <div
                  key={key}
                  className={clsx(
                    'flex items-center gap-1 min-w-0 text-[10px] text-gray-600 cursor-pointer select-none',
                    useTwoCols ? 'justify-start px-1' : 'justify-center w-full'
                  )}
                  title={`${getLabel(key)}: ${value}（双击复制）`}
                  onDoubleClick={(e) => copyText(value!, e)}
                >
                  {isIcon ? (
                    <IconComp className="w-3 h-3 text-gray-400 shrink-0 pointer-events-none" />
                  ) : (
                    <span className="text-gray-400 shrink-0 pointer-events-none">{getLabel(key)}:</span>
                  )}
                  <AutoScrollText value={value} />
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
