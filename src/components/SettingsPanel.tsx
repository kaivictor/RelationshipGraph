import { useState } from 'react';
import { useFamilyStore, DisplaySettings } from '../store/useFamilyStore';
import { Settings, ChevronRight, ChevronLeft, GripVertical, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';

type ToggleKey = keyof DisplaySettings;

// 固定区字段（文化程度及以上，不可拖动排序）
const FIXED_FIELDS: { key: string; label: string; toggleKey: ToggleKey | null; hint?: string }[] = [
  { key: 'namePinyin', label: '姓名拼音', toggleKey: 'showNamePinyin' },
  { key: 'name', label: '姓名', toggleKey: null, hint: '始终显示' },
  { key: 'formerName', label: '曾用名', toggleKey: 'showFormerName' },
  { key: 'relationship', label: '称谓', toggleKey: 'showRelationship' },
  { key: 'popularName', label: '称谓俗称', toggleKey: 'showPopularName' },
  { key: 'avatar', label: '头像', toggleKey: 'showAvatar' },
  { key: 'birthDate', label: '出生年月', toggleKey: 'showBirthDate' },
  { key: 'age', label: '年龄', toggleKey: 'showAge' },
  { key: 'education', label: '文化程度', toggleKey: 'showEducation' },
];

// 可拖拽区内置字段（文化程度以下）
const BUILTIN_DRAGGABLE: { key: string; label: string; toggleKey: ToggleKey }[] = [
  { key: 'phone', label: '手机号', toggleKey: 'showPhone' },
  { key: 'qq', label: 'QQ号', toggleKey: 'showQq' },
  { key: 'wechat', label: '微信号', toggleKey: 'showWechat' },
  { key: 'email', label: '邮箱号', toggleKey: 'showEmail' },
  { key: 'address', label: '住址', toggleKey: 'showAddress' },
  { key: 'licensePlate', label: '车牌号', toggleKey: 'showLicensePlate' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
        checked ? 'bg-blue-600' : 'bg-gray-300'
      )}
    >
      <span
        className={clsx(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

export function SettingsPanel() {
  const { displaySettings, updateDisplaySettings } = useFamilyStore();
  const [collapsed, setCollapsed] = useState(false);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const { fieldOrder, customFields, customFieldVisibility } = displaySettings;

  // 获取可拖拽字段的元信息
  const getFieldMeta = (key: string): { label: string; toggleKey?: ToggleKey; isCustom: boolean; id?: string } => {
    const builtIn = BUILTIN_DRAGGABLE.find((f) => f.key === key);
    if (builtIn) return { label: builtIn.label, toggleKey: builtIn.toggleKey, isCustom: false };
    const custom = customFields.find((f) => f.id === key);
    if (custom) return { label: custom.label, isCustom: true, id: custom.id };
    return { label: key, isCustom: false };
  };

  const isFieldVisible = (key: string): boolean => {
    const meta = getFieldMeta(key);
    if (meta.isCustom && meta.id) return customFieldVisibility[meta.id] ?? true;
    if (meta.toggleKey) return displaySettings[meta.toggleKey] as boolean;
    return true;
  };

  const setFieldVisible = (key: string, visible: boolean) => {
    const meta = getFieldMeta(key);
    if (meta.isCustom && meta.id) {
      updateDisplaySettings({ customFieldVisibility: { ...customFieldVisibility, [meta.id]: visible } });
    } else if (meta.toggleKey) {
      updateDisplaySettings({ [meta.toggleKey]: visible } as Partial<DisplaySettings>);
    }
  };

  const handleAddField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    const id = `custom_${Date.now()}`;
    updateDisplaySettings({
      customFields: [...customFields, { id, label }],
      fieldOrder: [...fieldOrder, id],
      customFieldVisibility: { ...customFieldVisibility, [id]: true },
    });
    setNewFieldLabel('');
    setIsAddingField(false);
  };

  const handleRemoveField = (id: string) => {
    const newVisibility = { ...customFieldVisibility };
    delete newVisibility[id];
    updateDisplaySettings({
      customFields: customFields.filter((f) => f.id !== id),
      fieldOrder: fieldOrder.filter((k) => k !== id),
      customFieldVisibility: newVisibility,
    });
  };

  const onDragStart = (i: number) => setDraggedIndex(i);
  const onDrop = (i: number) => {
    if (draggedIndex !== null && draggedIndex !== i) {
      const newOrder = [...fieldOrder];
      const [moved] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(i, 0, moved);
      updateDisplaySettings({ fieldOrder: newOrder });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  const onDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-16 right-4 z-20 flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
        title="展开设置面板"
      >
        <Settings className="w-4 h-4" />
        <ChevronLeft className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute top-16 right-4 w-72 bg-white shadow-xl rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-5rem)] z-20">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-600" />
          <h2 className="font-semibold text-gray-800">全局设置</h2>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
          title="收起设置面板"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        <p className="text-xs text-gray-400 mb-3">控制族谱节点的显示内容，更改即时生效。</p>

        {/* 固定区：基本信息 */}
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">基本信息</div>
        <ul className="space-y-0.5 mb-4">
          {FIXED_FIELDS.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-800">{item.label}</div>
                {item.hint && <div className="text-[10px] text-gray-400">{item.hint}</div>}
              </div>
              {item.toggleKey ? (
                <Toggle
                  checked={displaySettings[item.toggleKey] as boolean}
                  onChange={(v) =>
                    updateDisplaySettings({ [item.toggleKey!]: v } as Partial<DisplaySettings>)
                  }
                />
              ) : (
                <span className="text-[10px] text-gray-300">始终显示</span>
              )}
            </li>
          ))}
        </ul>

        {/* 可拖拽区：联系方式等 */}
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          可排序属性
          <span className="font-normal normal-case text-gray-300 ml-1">（拖动排序）</span>
        </div>
        <ul className="space-y-0.5">
          {fieldOrder.map((key, i) => {
            const meta = getFieldMeta(key);
            return (
              <li
                key={key}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => { e.preventDefault(); setDragOverIndex(i); }}
                onDrop={() => onDrop(i)}
                onDragEnd={onDragEnd}
                className={clsx(
                  'flex items-center justify-between gap-2 p-2 rounded-md hover:bg-gray-50 transition-colors',
                  dragOverIndex === i && draggedIndex !== i && 'border-t-2 border-blue-400',
                  draggedIndex === i && 'opacity-40'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0" />
                  <span className="text-sm font-medium text-gray-800 truncate">{meta.label}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {meta.isCustom && (
                    <button
                      onClick={() => handleRemoveField(meta.id!)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                      title="删除属性"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <Toggle
                    checked={isFieldVisible(key)}
                    onChange={(v) => setFieldVisible(key, v)}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        {/* 添加自定义属性 */}
        <div className="mt-3">
          {!isAddingField ? (
            <button
              onClick={() => setIsAddingField(true)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              添加自定义属性
            </button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddField();
                  if (e.key === 'Escape') {
                    setIsAddingField(false);
                    setNewFieldLabel('');
                  }
                }}
                placeholder="属性名称（如：车牌号）"
                className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleAddField}
                disabled={!newFieldLabel.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                添加
              </button>
              <button
                onClick={() => {
                  setIsAddingField(false);
                  setNewFieldLabel('');
                }}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 shrink-0"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {/* 垂直间距比例 */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">垂直间距比例</span>
            <span className="text-xs font-medium text-blue-600 tabular-nums">
              {displaySettings.verticalGapScale.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={3}
            step={0.1}
            value={displaySettings.verticalGapScale}
            onChange={(e) =>
              updateDisplaySettings({ verticalGapScale: parseFloat(e.target.value) })
            }
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>0.1x</span>
            <span>1.0x</span>
            <span>3.0x</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">在系统自动计算的高度差基础上进行比例缩放。</p>
        </div>
      </div>
    </div>
  );
}
