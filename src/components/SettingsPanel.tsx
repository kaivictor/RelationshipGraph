import { useState, useMemo, useId } from 'react';
import { useRelationshipStore, DisplaySettings } from '../store/useRelationshipStore';
import { Settings, ChevronRight, ChevronLeft, GripVertical, Plus, Trash2, EyeOff } from 'lucide-react';
import { CollapsibleSection } from './CollapsibleSection';
import clsx from 'clsx';
import { t, useLang } from '../i18n';

type ToggleKey = keyof DisplaySettings;

// 固定区字段（文化程度及以上，不可拖动排序）—— label 为 i18n 字典键
const FIXED_FIELDS: { key: string; label: string; toggleKey: ToggleKey | null; hintKey?: string }[] = [
  { key: 'namePinyin', label: 'f_namePinyin', toggleKey: 'showNamePinyin' },
  { key: 'name', label: 'f_name', toggleKey: null, hintKey: 'alwaysShow' },
  { key: 'formerName', label: 'f_formerName', toggleKey: 'showFormerName' },
  { key: 'relationship', label: 'f_relationship', toggleKey: 'showRelationship' },
  { key: 'popularName', label: 'f_popularName', toggleKey: 'showPopularName' },
  { key: 'avatar', label: 'f_avatar', toggleKey: 'showAvatar' },
  { key: 'birthDate', label: 'f_birthDate', toggleKey: 'showBirthDate' },
  { key: 'age', label: 'f_age', toggleKey: 'showAge' },
  { key: 'education', label: 'f_education', toggleKey: 'showEducation' },
];

// 可拖拽区内置字段（文化程度以下）—— label 为 i18n 字典键
const BUILTIN_DRAGGABLE: { key: string; label: string; toggleKey: ToggleKey }[] = [
  { key: 'phone', label: 'f_phone', toggleKey: 'showPhone' },
  { key: 'qq', label: 'f_qq', toggleKey: 'showQq' },
  { key: 'wechat', label: 'f_wechat', toggleKey: 'showWechat' },
  { key: 'email', label: 'f_email', toggleKey: 'showEmail' },
  { key: 'address', label: 'f_address', toggleKey: 'showAddress' },
  { key: 'licensePlate', label: 'f_licensePlate', toggleKey: 'showLicensePlate' },
  // 社交媒体
  { key: 'bilibili', label: 'f_bilibili', toggleKey: 'showBilibili' },
  { key: 'discord', label: 'f_discord', toggleKey: 'showDiscord' },
  { key: 'reddit', label: 'f_reddit', toggleKey: 'showReddit' },
  { key: 'threads', label: 'f_threads', toggleKey: 'showThreads' },
  { key: 'whatsapp', label: 'f_whatsapp', toggleKey: 'showWhatsapp' },
  { key: 'douyin', label: 'f_douyin', toggleKey: 'showDouyin' },
  { key: 'twitter', label: 'f_twitter', toggleKey: 'showTwitter' },
  { key: 'xiaohongshu', label: 'f_xiaohongshu', toggleKey: 'showXiaohongshu' },
];

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string }) {
  const labelId = useId();
  const descId = description ? useId() : undefined;

  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? labelId : undefined}
      aria-label={label ? undefined : '切换显示'}
      aria-describedby={descId}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
        checked ? 'bg-blue-600' : 'bg-gray-300'
      )}
    >
      <span
        aria-hidden="true"
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
        <div id={labelId} className="text-sm font-medium text-gray-700">{label}</div>
        {description && <div id={descId} className="text-[10px] text-gray-400 mt-0.5">{description}</div>}
      </div>
      {toggle}
    </div>
  );
}

export function SettingsPanel() {
  useLang();
  const { displaySettings, updateDisplaySettings, clearBrowserData, unhideAll, setLanguage, language } = useRelationshipStore();
  const nodes = useRelationshipStore((s) => s.nodes);
  const collapsed = useRelationshipStore((s) => s.settingsPanelCollapsed);
  const setCollapsed = useRelationshipStore((s) => s.setSettingsPanelCollapsed);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showRemovedFields, setShowRemovedFields] = useState(false);

  const { fieldOrder, customFields, customFieldVisibility, removedBuiltinFields } = displaySettings;

  // 计算坐标系稀疏度滑块的上限：节点最大年龄差向上取5的倍数（最小不小于5）
  const coordinateStepMax = useMemo(() => {
    let minYear = Infinity, maxYear = -Infinity;
    for (const n of nodes) {
      if (n.data.birthDate) {
        const y = parseInt(n.data.birthDate.split('-')[0], 10);
        if (!isNaN(y)) {
          if (y < minYear) minYear = y;
          if (y > maxYear) maxYear = y;
        }
      }
    }
    if (!isFinite(minYear) || !isFinite(maxYear)) return 10;
    const span = Math.max(0, maxYear - minYear);
    const ceil5 = Math.ceil(span / 5) * 5;
    return Math.max(5, ceil5);
  }, [nodes]);

  // 获取可拖拽字段的元信息
  const getFieldMeta = (key: string): { label: string; toggleKey?: ToggleKey; isCustom: boolean; id?: string } => {
    const builtIn = BUILTIN_DRAGGABLE.find((f) => f.key === key);
    if (builtIn) return { label: t(builtIn.label), toggleKey: builtIn.toggleKey, isCustom: false };
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
        aria-label={t('expandSettings')}
      >
        <Settings className="w-4 h-4" aria-hidden="true" />
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label={t('settingsPanelDesc')}
      className="absolute top-16 right-4 w-72 bg-white shadow-xl rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-5rem)] z-50"
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-gray-600" aria-hidden="true" />
          <h2 className="font-semibold text-gray-800">{t('settingsTitle')}</h2>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
          aria-label={t('collapseSettings')}
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        <p className="text-xs text-gray-400 mb-3">{t('settingsPanelDesc')}</p>

        {/* 语言切换滑块（分段滑块：中文 / EN 在同一行，滑块滑动切换） */}
        <div className="mb-2 pl-3 pr-1 pt-1 pb-1 bg-blue-50 rounded-md border border-blue-100">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-gray-800 shrink-0">{t('language')}</div>
            <div
              role="radiogroup"
              aria-label={t('language')}
              className="relative flex rounded-lg bg-gray-200 p-0.5 text-xs font-medium shrink-0 w-40"
            >
            {/* 滑动高亮块 */}
            <span
              aria-hidden="true"
              className={clsx(
                'absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-0.25rem)] rounded-md bg-white shadow transition-transform duration-200',
                language === 'en' ? 'translate-x-[calc(100%+0.25rem)]' : 'translate-x-0'
              )}
            />
            <button
              type="button"
              role="radio"
              aria-checked={language === 'zh'}
              onClick={() => setLanguage('zh')}
              className={clsx(
                'relative z-10 flex-1 rounded-md py-1.5 text-center transition-colors',
                language === 'zh' ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              中文
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={language === 'en'}
              onClick={() => setLanguage('en')}
              className={clsx(
                'relative z-10 flex-1 rounded-md py-1.5 text-center transition-colors',
                language === 'en' ? 'text-blue-600' : 'text-gray-500'
              )}
            >
              EN
            </button>
          </div>
          </div>
        </div>

        {/* 基本信息 */}
        <CollapsibleSection title={t('basicInfo')} defaultOpen={true} className="!mt-0 !pt-0 !border-t-0" storageKey="settings:basic">
          <ul className="space-y-0.5 mb-2">
            {FIXED_FIELDS.map((item) => (
              <li
                key={item.key}
                className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800">{t(item.label)}</div>
                  {item.hintKey && <div className="text-[10px] text-gray-400">{t(item.hintKey)}</div>}
                </div>
                {item.toggleKey ? (
                  <Toggle
                    checked={displaySettings[item.toggleKey] as boolean}
                    onChange={(v) =>
                      updateDisplaySettings({ [item.toggleKey!]: v } as Partial<DisplaySettings>)
                    }
                  />
                ) : (
                  <span className="text-[10px] text-gray-300">{t('alwaysShow')}</span>
                )}
              </li>
            ))}
          </ul>
          <div className="p-2.5 bg-gray-50 rounded-md border border-gray-100">
            <Toggle
              label={t('deathDateReplaceBirth')}
              description={t('deathDateReplaceBirthDesc')}
              checked={displaySettings.deathDateReplaceBirth}
              onChange={(v) => updateDisplaySettings({ deathDateReplaceBirth: v })}
            />
          </div>
        </CollapsibleSection>

        {/* 可排序属性 */}
        <CollapsibleSection title={t('sortableProps')} defaultOpen={true} hint={t('dragHint')} storageKey="settings:sortable">
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
                  aria-label={`${t('sortableProps')}：${meta.label}${isFieldVisible(key) ? t('alwaysShow') : t('hideToggle')}`}
                  className={clsx(
                    'flex items-center justify-between gap-2 p-2 rounded-md hover:bg-gray-50 transition-colors',
                    dragOverIndex === i && draggedIndex !== i && 'border-t-2 border-blue-400',
                    draggedIndex === i && 'opacity-40'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical
                      className="w-4 h-4 text-gray-300 cursor-grab shrink-0"
                      aria-hidden="true"
                      // 拖拽为可选交互，操作说明在 hint 中已提供，此处标记为装饰性
                    />
                    <span className="text-sm font-medium text-gray-800 truncate">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {meta.isCustom ? (
                      <button
                        onClick={() => handleRemoveField(meta.id!)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        aria-label={`删除自定义属性：${meta.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRemoveBuiltinField(key)}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        aria-label={`从详情面板移除内置属性：${meta.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
                aria-label={t('addCustomField')}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-600 px-4 py-2 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                {t('addCustomField')}
              </button>
            ) : (
              <div className="flex gap-2">
                <label htmlFor="new-custom-field" className="sr-only">{t('customFieldName')}</label>
                <input
                  id="new-custom-field"
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
                  placeholder={t('customFieldPlaceholder')}
                  className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleAddField}
                  disabled={!newFieldLabel.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
                >
                  {t('add')}
                </button>
                <button
                  onClick={() => {
                    setIsAddingField(false);
                    setNewFieldLabel('');
                  }}
                  className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 shrink-0"
                >
                  {t('cancel')}
                </button>
              </div>
            )}
          </div>

          {/* 已删除的内置字段（可恢复） */}
          {removedBuiltinFields.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowRemovedFields(!showRemovedFields)}
                aria-expanded={showRemovedFields}
                className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
              >
                <span>{t('removedBuiltinFields')}（{removedBuiltinFields.length}）</span>
                <span aria-hidden="true">{showRemovedFields ? t('collapseSettings') : t('expandSettings')}</span>
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
                        <span className="text-xs text-gray-500 truncate">{meta ? t(meta.label) : key}</span>
                        <button
                          onClick={() => handleRestoreBuiltinField(key)}
                          className="text-xs text-blue-600 hover:text-blue-700 shrink-0"
                        >
                          {t('restore')}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* 关系与显示（默认隐藏） */}
        <CollapsibleSection title={t('relationAndDisplay')} defaultOpen={false} storageKey="settings:relation">
          <Toggle
            label={t('showEdgeRelationship')}
            description={t('showEdgeRelationshipDesc')}
            checked={displaySettings.showEdgeRelationship}
            onChange={(v) => updateDisplaySettings({ showEdgeRelationship: v })}
          />
          <Toggle
            label={t('showGrayOnDisconnect')}
            description={t('showGrayOnDisconnectDesc')}
            checked={displaySettings.showGrayOnDisconnect}
            onChange={(v) => updateDisplaySettings({ showGrayOnDisconnect: v })}
          />
          <Toggle
            label={t('showCanvasHint')}
            description={t('showCanvasHintDesc')}
            checked={displaySettings.showCanvasHint}
            onChange={(v) => updateDisplaySettings({ showCanvasHint: v })}
          />
          <Toggle
            label={t('showStatsBadge')}
            description={t('showStatsBadgeDesc')}
            checked={displaySettings.showStatsBadge}
            onChange={(v) => updateDisplaySettings({ showStatsBadge: v })}
          />
          <Toggle
            label={t('allowVerticalMove')}
            description={t('allowVerticalMoveDesc')}
            checked={displaySettings.allowVerticalMove}
            onChange={(v) => {
              updateDisplaySettings({ allowVerticalMove: v });
              if (v) {
                alert(t('verticalMoveAlert'));
              }
            }}
          />
          <Toggle
            label={t('showCoordinateSystem')}
            description={t('showCoordinateSystemDesc')}
            checked={displaySettings.showCoordinateSystem}
            onChange={(v) => updateDisplaySettings({ showCoordinateSystem: v })}
          />
          {displaySettings.showCoordinateSystem && (
            <div className="mt-2 p-2.5 bg-gray-50 rounded-md border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{t('coordinateDensity')}</span>
                <span className="text-xs font-medium text-blue-600 tabular-nums">
                  {t('everyNYears', { n: displaySettings.coordinateLineStep })}
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={coordinateStepMax}
                step={5}
                value={Math.min(displaySettings.coordinateLineStep, coordinateStepMax)}
                onChange={(e) => updateDisplaySettings({ coordinateLineStep: parseInt(e.target.value, 10) })}
                aria-label={`${t('coordinateDensity')}，${t('everyNYears', { n: displaySettings.coordinateLineStep })}`}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>{`5${t('dense')}`}</span>
                <span>{`${coordinateStepMax}${t('sparse')}`}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{t('coordinateHint')}</p>
            </div>
          )}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">{t('verticalGapScale')}</span>
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
              aria-label={`${t('verticalGapScale')}，${(displaySettings.verticalGapScale.toFixed(2))}x`}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>0.1x</span>
              <span>1.0x</span>
              <span>3.0x</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{t('verticalGapHint')}</p>
          </div>
        </CollapsibleSection>

        {/* 数据存储（不隐藏，含危险操作需常驻可见） */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('dataStorage')}</h3>
          <Toggle
            label={t('persistToBrowser')}
            description={t('persistToBrowserDesc')}
            checked={displaySettings.persistToBrowser}
            onChange={(v) => updateDisplaySettings({ persistToBrowser: v })}
          />
          <button
            onClick={() => unhideAll()}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-amber-600 border border-amber-300 rounded-md hover:bg-amber-50 transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
            {t('unhideAll')}
          </button>
          <button
            onClick={() => {
              if (confirm(t('clearBrowserDataConfirm'))) {
                clearBrowserData();
              }
            }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            {t('clearBrowserData')}
          </button>
        </div>
      </div>
    </div>
  );
}
