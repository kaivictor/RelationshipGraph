import { useState } from 'react';
import { useRelationshipStore, DisplaySettings } from '../store/useRelationshipStore';
import { Settings, ChevronRight, ChevronLeft, GripVertical, Plus, Trash2 } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
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
  // 社交媒体
  { key: 'bilibili', label: '哔哩哔哩', toggleKey: 'showBilibili' },
  { key: 'discord', label: 'Discord', toggleKey: 'showDiscord' },
  { key: 'reddit', label: 'Reddit', toggleKey: 'showReddit' },
  { key: 'threads', label: 'Threads', toggleKey: 'showThreads' },
  { key: 'whatsapp', label: 'WhatsApp', toggleKey: 'showWhatsapp' },
  { key: 'douyin', label: '抖音', toggleKey: 'showDouyin' },
  { key: 'twitter', label: '推特', toggleKey: 'showTwitter' },
  { key: 'xiaohongshu', label: '小红书', toggleKey: 'showXiaohongshu' },
];

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string }) {
  const toggle = (
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

  if (!label) return toggle;

  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {description && <div className="text-[10px] text-gray-400 mt-0.5">{description}</div>}
      </div>
      {toggle}
    </div>
  );
}

export function SettingsPanel() {
  const { displaySettings, updateDisplaySettings, clearBrowserData } = useRelationshipStore();
  const collapsed = useRelationshipStore((s) => s.settingsPanelCollapsed);
  const setCollapsed = useRelationshipStore((s) => s.setSettingsPanelCollapsed);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showRemovedFields, setShowRemovedFields] = useState(false);

  const { fieldOrder, customFields, customFieldVisibility, removedBuiltinFields } = displaySettings;

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

  // 删除内置字段：从 fieldOrder 移除并加入 removedBuiltinFields
  const handleRemoveBuiltinField = (key: string) => {
    updateDisplaySettings({
      fieldOrder: fieldOrder.filter((k) => k !== key),
      removedBuiltinFields: [...removedBuiltinFields, key],
    });
  };

  // 恢复已删除的内置字段
  const handleRestoreBuiltinField = (key: string) => {
    updateDisplaySettings({
      fieldOrder: [...fieldOrder, key],
      removedBuiltinFields: removedBuiltinFields.filter((k) => k !== key),
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
        className="absolute top-16 right-4 z-50 flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 text-sm font-medium text-gray-700"
        title="展开设置面板"
      >
        <Settings className="w-4 h-4" />
        <ChevronLeft className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute top-16 right-4 w-72 bg-white shadow-xl rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-5rem)] z-50">
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

        {/* 基本信息 */}
        <CollapsibleSection title="基本信息" defaultOpen={true} className="!mt-0 !pt-0 !border-t-0" storageKey="settings:basic">
          <ul className="space-y-0.5 mb-2">
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
          <div className="p-2.5 bg-gray-50 rounded-md border border-gray-100">
            <Toggle
              label="离世日期代替出生日期"
              description="离世者的显示由「出生年月·年龄」变为「年龄·死亡年月」，且年龄截止到离世时"
              checked={displaySettings.deathDateReplaceBirth}
              onChange={(v) => updateDisplaySettings({ deathDateReplaceBirth: v })}
            />
          </div>
        </CollapsibleSection>

        {/* 可排序属性 */}
        <CollapsibleSection title="可排序属性" defaultOpen={true} hint="（拖动排序）" storageKey="settings:sortable">
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
                    {meta.isCustom ? (
                      <button
                        onClick={() => handleRemoveField(meta.id!)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        title="删除自定义属性"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemoveBuiltinField(key)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        title="从详情面板移除此内置属性"
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

          {/* 已删除的内置字段（可恢复） */}
          {removedBuiltinFields.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowRemovedFields(!showRemovedFields)}
                className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                <span>已移除的内置属性（{removedBuiltinFields.length}）</span>
                <span>{showRemovedFields ? '收起' : '展开'}</span>
              </button>
              {showRemovedFields && (
                <ul className="space-y-0.5 mt-1">
                  {removedBuiltinFields.map((key) => {
                    const meta = BUILTIN_DRAGGABLE.find((f) => f.key === key);
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-gray-50"
                      >
                        <span className="text-xs text-gray-500 truncate">{meta?.label || key}</span>
                        <button
                          onClick={() => handleRestoreBuiltinField(key)}
                          className="text-xs text-blue-600 hover:text-blue-700 shrink-0"
                        >
                          恢复
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* 关系与显示（默认折叠） */}
        <CollapsibleSection title="关系与显示" defaultOpen={false} storageKey="settings:relation">
          <Toggle
            label="连线显示亲属关系"
            description="在父子连线上标注关系（父·子 / 子·父 等），便于区分长辈与晚辈"
            checked={displaySettings.showEdgeRelationship}
            onChange={(v) => updateDisplaySettings({ showEdgeRelationship: v })}
          />
          <Toggle
            label="断开关系后变灰"
            description="断开关系后，将断开一侧（含长辈）的方框显示为灰色（连线始终变为虚线）"
            checked={displaySettings.showGrayOnDisconnect}
            onChange={(v) => updateDisplaySettings({ showGrayOnDisconnect: v })}
          />
          <Toggle
            label="显示画布提示"
            description="在画布左上角显示操作提示（如「点击节点查看详情」、连线模式状态等）"
            checked={displaySettings.showCanvasHint}
            onChange={(v) => updateDisplaySettings({ showCanvasHint: v })}
          />
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">垂直间距比例</span>
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
        </CollapsibleSection>

        {/* 数据存储（不折叠，含危险操作需常驻可见） */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">数据存储</h3>
          <Toggle
            label="在浏览器中保存数据"
            description="开启后，所有数据（含缩放、位置、设置）自动保存到浏览器，下次打开自动恢复"
            checked={displaySettings.persistToBrowser}
            onChange={(v) => updateDisplaySettings({ persistToBrowser: v })}
          />
          <button
            onClick={() => {
              if (confirm('确定清除浏览器中保存的所有数据吗？此操作不可恢复，将恢复到默认族谱。')) {
                clearBrowserData();
              }
            }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清除浏览器数据
          </button>
        </div>
      </div>
    </div>
  );
}
