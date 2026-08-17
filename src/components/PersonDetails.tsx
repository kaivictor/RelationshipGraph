import { useState, useEffect } from 'react';
import { useRelationshipStore, PersonData, Gender, toArrayValue } from '../store/useRelationshipStore';
import { X, Plus, Trash2, Save, UserCheck, Heart, Upload, Loader2, Eye, EyeOff } from 'lucide-react';
import { compressImageToBase64 } from '../utils/imageCompress';
import { CollapsibleSection } from './CollapsibleSection';
import clsx from 'clsx';

// 字段标签 + 显隐切换
function FieldLabel({
  label,
  visible,
  onToggleVisible,
}: {
  label: string;
  visible?: boolean;
  onToggleVisible?: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      {onToggleVisible !== undefined && visible !== undefined && (
        <button
          type="button"
          onClick={onToggleVisible}
          className={clsx(
            'p-0.5 transition-colors',
            visible ? 'text-blue-500 hover:text-blue-700' : 'text-gray-300 hover:text-blue-500'
          )}
          title={visible ? '在节点上显示此字段' : '在节点上隐藏此字段'}
        >
          {visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

// 多值字段（换行分隔）：每行一个值，支持增删
function MultiField({
  label,
  values,
  onChange,
  placeholder,
  visible,
  onToggleVisible,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  visible?: boolean;
  onToggleVisible?: () => void;
}) {
  const items = values.length > 0 ? values : [''];
  return (
    <div>
      <FieldLabel label={label} visible={visible} onToggleVisible={onToggleVisible} />
      <div className="space-y-1">
        {items.map((v, i) => (
          <div key={i} className="flex gap-1">
            <input
              type="text"
              value={v}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const next = items.filter((_, idx) => idx !== i);
                  onChange(next.length > 0 ? next : ['']);
                }}
                className="px-2 text-gray-300 hover:text-red-500 transition-colors"
                title="删除此值"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="mt-1 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
      >
        <Plus className="w-3 h-3" />
        添加
      </button>
    </div>
  );
}

// 通用文本输入字段
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  visible,
  onToggleVisible,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  visible?: boolean;
  onToggleVisible?: () => void;
}) {
  return (
    <div>
      <FieldLabel label={label} visible={visible} onToggleVisible={onToggleVisible} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export function PersonDetails() {
  const { nodes, selectedNodeId, setSelectedNodeId, updatePerson, updatePersonLive, deletePerson, addRelative, connectExisting, setAsSelf, getDescendantsForCascade } =
    useRelationshipStore();
  const customFields = useRelationshipStore((s) => s.displaySettings.customFields);
  const displaySettings = useRelationshipStore((s) => s.displaySettings);
  const removedBuiltinFields = useRelationshipStore((s) => s.displaySettings.removedBuiltinFields);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const [formData, setFormData] = useState<PersonData | null>(null);
  const [isAddingRelative, setIsAddingRelative] = useState(false);
  const [relativeType, setRelativeType] = useState<'parent' | 'child' | 'spouse' | 'custom'>('child');
  const [customRelLabel, setCustomRelLabel] = useState('');
  const [useExistingPerson, setUseExistingPerson] = useState(false);
  const [existingPersonId, setExistingPersonId] = useState('');
  const [newRelativeData, setNewRelativeData] = useState<PersonData>({
    name: '',
    avatar: '',
    relationship: '',
    birthDate: '',
    gender: 'male',
  });
  const [isAddingPersonalAttr, setIsAddingPersonalAttr] = useState(false);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrValue, setNewAttrValue] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  useEffect(() => {
    if (selectedNode) {
      setFormData({ ...selectedNode.data });
      setIsAddingRelative(false);
      setUseExistingPerson(false);
      setExistingPersonId('');
    } else {
      setFormData(null);
    }
  }, [selectedNode]);

  if (!selectedNode || !formData) return null;

  // 头像预览：base64 时加 data: 前缀，URL 时直接用
  const avatarPreview = formData.avatar
    ? (formData.avatar.startsWith('data:') || formData.avatar.startsWith('http')
      ? formData.avatar
      : `data:image/jpeg;base64,${formData.avatar}`)
    : '';

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const base64 = await compressImageToBase64(file);
      liveUpdate({avatar: base64 });
    } catch (err) {
      console.error('头像压缩失败', err);
      alert('图片处理失败，请更换图片或填写 URL。');
    } finally {
      setIsUploadingAvatar(false);
      // 清空 input，便于重复选择同一文件
      e.target.value = '';
    }
  };

  const handleSave = () => {
    // 清理多值字段中的空字符串，并 push undo + 重算称谓
    const cleaned = { ...formData };
    const multiKeys: (keyof PersonData)[] = [
      'formerName', 'popularName', 'phone', 'qq', 'wechat', 'email', 'address', 'licensePlate',
      'bilibili', 'discord', 'reddit', 'threads', 'whatsapp', 'douyin', 'twitter', 'xiaohongshu',
    ];
    for (const k of multiKeys) {
      const val = cleaned[k];
      if (Array.isArray(val)) {
        const filtered = val.filter((s) => s && s.trim());
        (cleaned as Record<string, unknown>)[k as string] = filtered.length > 0 ? filtered : undefined;
      }
    }
    updatePerson(selectedNode.id, cleaned);
  };

  // 实时更新：同时更新 formData 和 store（不 push undo，不重算称谓）
  const liveUpdate = (data: Partial<PersonData>) => {
    setFormData((prev) => prev ? { ...prev, ...data } : prev);
    updatePersonLive(selectedNode.id, data);
  };

  // 删除当前人物：若有可级联的晚辈，询问是否一并删除
  const handleDelete = () => {
    const cascadeIds = getDescendantsForCascade(selectedNode.id);
    if (cascadeIds.length > 0) {
      const names = cascadeIds
        .map((cid) => nodes.find((n) => n.id === cid)?.data.name || '未命名')
        .slice(0, 5)
        .join('、');
      const more = cascadeIds.length > 5 ? ` 等 ${cascadeIds.length} 人` : '';
      const ok = confirm(
        `是否一并删除此人的晚辈（${names}${more}）？\n\n点击「确定」将一并删除这些仅通过此人连接的晚辈；\n点击「取消」仅删除此人，保留晚辈（它们将失去这一父/母线）。`
      );
      deletePerson(selectedNode.id, ok);
    } else {
      if (confirm(`确定删除「${formData.name || '此人'}」吗？`)) {
        deletePerson(selectedNode.id, false);
      }
    }
  };

  const handleRelativeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as 'parent' | 'child' | 'spouse' | 'custom';
    setRelativeType(val);
    // 父母/儿女/爱人/自定义均不强制改性别，保留用户选择
  };

  const handleAddRelative = () => {
    if (useExistingPerson) {
      if (!existingPersonId) return;
      if (relativeType === 'custom') {
        connectExisting(selectedNode.id, existingPersonId, 'custom', customRelLabel.trim() || '自定义');
      } else {
        connectExisting(selectedNode.id, existingPersonId, relativeType);
      }
    } else {
      if (relativeType === 'custom') {
        addRelative(selectedNode.id, 'custom', newRelativeData, customRelLabel.trim() || '自定义');
      } else {
        addRelative(selectedNode.id, relativeType, newRelativeData);
      }
    }
    setIsAddingRelative(false);
    setNewRelativeData({
      name: '',
      avatar: '',
      relationship: '',
      birthDate: '',
      gender: 'male',
    });
    setCustomRelLabel('');
    setRelativeType('child');
    setUseExistingPerson(false);
    setExistingPersonId('');
  };

  const updateCustomFieldValue = (id: string, value: string) => {
    const current = formData.customFieldValues || {};
    liveUpdate({customFieldValues: { ...current, [id]: value } });
  };

  // 个人自定义属性操作
  const personalAttrs = formData.customAttributes || [];

  const handleAddPersonalAttr = () => {
    const key = newAttrKey.trim();
    if (!key) return;
    const newAttrs = [...personalAttrs, { key, value: newAttrValue }];
    liveUpdate({customAttributes: newAttrs });
    setNewAttrKey('');
    setNewAttrValue('');
    setIsAddingPersonalAttr(false);
  };

  const handleUpdatePersonalAttr = (index: number, value: string) => {
    const newAttrs = personalAttrs.map((attr, i) =>
      i === index ? { ...attr, value } : attr
    );
    liveUpdate({customAttributes: newAttrs });
  };

  const handleRemovePersonalAttr = (index: number) => {
    const newAttrs = personalAttrs.filter((_, i) => i !== index);
    liveUpdate({customAttributes: newAttrs });
  };

  // 切换个人自定义属性的显示/隐藏
  const handleTogglePersonalAttrHidden = (index: number) => {
    const newAttrs = personalAttrs.map((attr, i) =>
      i === index ? { ...attr, hidden: !attr.hidden } : attr
    );
    liveUpdate({customAttributes: newAttrs });
  };

  // 判断个人属性是否被全局同名属性覆盖
  const isOverriddenByGlobal = (key: string): boolean =>
    customFields.some((cf) => cf.label === key);

  // 字段显隐：个人设置优先于全局
  const getFieldVisible = (key: string, globalDefault: boolean): boolean => {
    if (formData.fieldVisibility && key in formData.fieldVisibility) {
      return formData.fieldVisibility[key];
    }
    return globalDefault;
  };

  const toggleFieldVisible = (key: string, globalDefault: boolean) => {
    const current = formData.fieldVisibility || {};
    const currentlyVisible = key in current ? current[key] : globalDefault;
    liveUpdate({ fieldVisibility: { ...current, [key]: !currentlyVisible } });
  };

  return (
    <div
      className="absolute top-16 right-4 w-72 bg-white shadow-xl rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-5rem)] z-50"
      onPointerDownCapture={() => useRelationshipStore.getState().setEdgeMenu(null)}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-gray-800">详细信息</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
            title="确认编辑：保存撤销快照并重新计算称谓"
          >
            <Save className="w-3.5 h-3.5" />
            确认
          </button>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
            title="返回全局设置"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        <CollapsibleSection title="基本信息" defaultOpen={true} className="!mt-0 !pt-0 !border-t-0" storageKey="details:basic">
        <div className="space-y-4">
          <Field
            label="姓名拼音"
            value={formData.namePinyin || ''}
            onChange={(v) => liveUpdate({namePinyin: v })}
            placeholder="如：Zhang San"
            visible={getFieldVisible('namePinyin', displaySettings.showNamePinyin)}
            onToggleVisible={() => toggleFieldVisible('namePinyin', displaySettings.showNamePinyin)}
          />
          <Field
            label="姓名"
            value={formData.name}
            onChange={(v) => liveUpdate({name: v })}
          />

          <Field
            label="曾用名（多个用逗号分隔）"
            value={(toArrayValue(formData.formerName) || []).join('，')}
            onChange={(v) => liveUpdate({formerName: v ? v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : undefined })}
            placeholder="如：旧张三，旧李四"
            visible={getFieldVisible('formerName', displaySettings.showFormerName)}
            onToggleVisible={() => toggleFieldVisible('formerName', displaySettings.showFormerName)}
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-gray-500">
                  称谓
                  {formData.relationshipOverridden && (
                    <span className="ml-1 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      已手动设置
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={() => toggleFieldVisible('relationship', displaySettings.showRelationship)}
                  className={clsx(
                    'p-0.5 transition-colors',
                    getFieldVisible('relationship', displaySettings.showRelationship) ? 'text-blue-500 hover:text-blue-700' : 'text-gray-300 hover:text-blue-500'
                  )}
                  title={getFieldVisible('relationship', displaySettings.showRelationship) ? '在节点上显示' : '在节点上隐藏'}
                >
                  {getFieldVisible('relationship', displaySettings.showRelationship) ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
              </div>
              {formData.relationshipOverridden && (
                <button
                  type="button"
                  onClick={() => {
                    // 恢复自动计算：清除覆盖标志，重新计算称谓
                    liveUpdate({relationshipOverridden: false });
                    // 立即重新计算
                    setTimeout(() => {
                      useRelationshipStore.getState().recalculateRelationships();
                      const updatedNode = useRelationshipStore.getState().nodes.find(n => n.id === selectedNode?.id);
                      if (updatedNode) setFormData({ ...updatedNode.data, relationshipOverridden: false });
                    }, 50);
                  }}
                  className="text-[10px] text-blue-600 hover:text-blue-700"
                >
                  恢复自动计算
                </button>
              )}
            </div>
            <input
              type="text"
              value={formData.relationship}
              onChange={(e) => {
                const val = e.target.value;
                // 用户修改时标记为手动覆盖
                liveUpdate({relationship: val, relationshipOverridden: true });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="系统自动计算，可手动修改"
            />
          </div>

          <Field
            label="称谓俗称（多个用逗号分隔）"
            value={(toArrayValue(formData.popularName) || []).join('，')}
            onChange={(v) => liveUpdate({popularName: v ? v.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : undefined })}
            placeholder="如：小三"
            visible={getFieldVisible('popularName', displaySettings.showPopularName)}
            onToggleVisible={() => toggleFieldVisible('popularName', displaySettings.showPopularName)}
          />

          <div>
            <FieldLabel
              label="出生年月"
              visible={getFieldVisible('birthDate', true)}
              onToggleVisible={() => toggleFieldVisible('birthDate', true)}
            />
            <input
              type="month"
              value={formData.birthDate}
              onChange={(e) => liveUpdate({birthDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">性别</label>
            <select
              value={formData.gender}
              onChange={(e) => liveUpdate({gender: e.target.value as Gender })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="unknown">未知</option>
              <option value="male">男</option>
              <option value="female">女</option>
            </select>
          </div>

          <Field
            label="文化程度"
            value={formData.education || ''}
            onChange={(v) => liveUpdate({education: v })}
            placeholder="如：本科"
            visible={getFieldVisible('education', displaySettings.showEducation)}
            onToggleVisible={() => toggleFieldVisible('education', displaySettings.showEducation)}
          />

          {/* 头像：支持上传图片（自动压缩到 300KB 左右转 base64）或填写 URL */}
          <div>
            <FieldLabel
              label="头像"
              visible={getFieldVisible('avatar', displaySettings.showAvatar)}
              onToggleVisible={() => toggleFieldVisible('avatar', displaySettings.showAvatar)}
            />
            <div className="flex items-center gap-3">
              <div className="overflow-hidden bg-gray-100 border border-gray-300 flex items-center justify-center shrink-0" style={{ width: '42px', height: '54px', borderRadius: '4px' }}>
                {avatarPreview ? (
                  <img src={avatarPreview} alt="头像预览" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] text-gray-400">无</span>
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <label className="flex items-center justify-center gap-1.5 border border-dashed border-gray-300 text-gray-600 px-3 py-1.5 rounded-md text-xs hover:border-blue-500 hover:text-blue-600 transition-colors cursor-pointer">
                  {isUploadingAvatar ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      压缩中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      上传图片
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={isUploadingAvatar}
                  />
                </label>
                <input
                  type="text"
                  value={(() => {
                    const av = formData.avatar || '';
                    // base64 或超长字符串不在 URL 输入框显示
                    if (av.startsWith('data:') || (!av.includes('://') && av.length > 100)) return '';
                    return av;
                  })()}
                  onChange={(e) => liveUpdate({avatar: e.target.value })}
                  placeholder="或填写图片 URL"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
        </CollapsibleSection>

        <CollapsibleSection title="联系方式" defaultOpen={false} storageKey="details:contact">
        <div className="space-y-4">
          {([
            { key: 'phone', label: '手机号', placeholder: '如：13800138000', global: displaySettings.showPhone },
            { key: 'qq', label: 'QQ号', placeholder: undefined, global: displaySettings.showQq },
            { key: 'wechat', label: '微信号', placeholder: undefined, global: displaySettings.showWechat },
            { key: 'email', label: '邮箱号', placeholder: '如：name@example.com', global: displaySettings.showEmail },
            { key: 'address', label: '住址', placeholder: undefined, global: displaySettings.showAddress },
            { key: 'licensePlate', label: '车牌号', placeholder: '如：京A88888', global: displaySettings.showLicensePlate },
            { key: 'bilibili', label: '哔哩哔哩', placeholder: '如：UID 或主页链接', global: displaySettings.showBilibili },
            { key: 'discord', label: 'Discord', placeholder: '如：用户名#0000', global: displaySettings.showDiscord },
            { key: 'reddit', label: 'Reddit', placeholder: '如：u/用户名', global: displaySettings.showReddit },
            { key: 'threads', label: 'Threads', placeholder: '如：@用户名', global: displaySettings.showThreads },
            { key: 'whatsapp', label: 'WhatsApp', placeholder: '如：+86 13800138000', global: displaySettings.showWhatsapp },
            { key: 'douyin', label: '抖音', placeholder: '如：抖音号或主页链接', global: displaySettings.showDouyin },
            { key: 'twitter', label: '推特', placeholder: '如：@username', global: displaySettings.showTwitter },
            { key: 'xiaohongshu', label: '小红书', placeholder: '如：小红书号或主页链接', global: displaySettings.showXiaohongshu },
          ] as const).filter((f) => !removedBuiltinFields.includes(f.key)).map((f) => (
            <MultiField
              key={f.key}
              label={f.label}
              values={toArrayValue(formData[f.key as keyof PersonData] as string[]) || []}
              onChange={(v) => liveUpdate({ [f.key]: v } as Partial<PersonData>)}
              placeholder={f.placeholder}
              visible={getFieldVisible(f.key, f.global)}
              onToggleVisible={() => toggleFieldVisible(f.key, f.global)}
            />
          ))}
        </div>
        </CollapsibleSection>

        {/* 自定义属性（默认折叠） */}
        <CollapsibleSection title="自定义属性" defaultOpen={false} storageKey="details:custom">
          {/* 全局自定义属性 */}
          {customFields.length > 0 && (
            <div className="mb-3">
              <h3 className="font-medium text-gray-800 text-sm mb-2">全局自定义属性</h3>
              <div className="space-y-2">
                {customFields.map((cf) => (
                  <div key={cf.id}>
                    <Field
                      label={cf.label}
                      value={formData.customFieldValues?.[cf.id] || ''}
                      onChange={(v) => updateCustomFieldValue(cf.id, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 个人自定义属性 */}
          <div>
            <h3 className="font-medium text-gray-800 text-sm mb-2">个人自定义属性</h3>
            <p className="text-[10px] text-gray-400 mb-2">
              仅对此人生效。若与全局自定义属性同名，则全局优先。
            </p>
            <div className="space-y-2">
              {personalAttrs.map((attr, index) => {
                const overridden = isOverriddenByGlobal(attr.key);
                const isHidden = !!attr.hidden;
                return (
                  <div key={`personal-${index}`} className={clsx('flex gap-1 items-center', overridden && 'opacity-50', isHidden && 'opacity-60')}>
                    <input
                      type="text"
                      value={attr.key}
                      disabled
                      className="w-20 shrink-0 px-2 py-1.5 border border-gray-200 bg-gray-50 rounded text-xs text-gray-500 cursor-not-allowed"
                      title={overridden ? '被全局同名属性覆盖' : undefined}
                    />
                    <input
                      type="text"
                      value={attr.value}
                      onChange={(e) => handleUpdatePersonalAttr(index, e.target.value)}
                      placeholder="值"
                      disabled={overridden}
                      className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => handleTogglePersonalAttrHidden(index)}
                      className={clsx(
                        'p-1.5 transition-colors shrink-0',
                        isHidden ? 'text-gray-400 hover:text-blue-500' : 'text-blue-500 hover:text-blue-700'
                      )}
                      title={isHidden ? '在节点上显示此属性' : '在节点上隐藏此属性'}
                    >
                      {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => handleRemovePersonalAttr(index)}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors shrink-0"
                      title="删除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}

              {!isAddingPersonalAttr ? (
                <button
                  onClick={() => setIsAddingPersonalAttr(true)}
                  className="w-full flex items-center justify-center gap-1 border border-dashed border-gray-300 text-gray-500 px-3 py-1.5 rounded text-xs hover:border-blue-500 hover:text-blue-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加个人属性
                </button>
              ) : (
                <div className="flex gap-1">
                  <input
                    type="text"
                    autoFocus
                    value={newAttrKey}
                    onChange={(e) => setNewAttrKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddPersonalAttr();
                      if (e.key === 'Escape') {
                        setIsAddingPersonalAttr(false);
                        setNewAttrKey('');
                        setNewAttrValue('');
                      }
                    }}
                    placeholder="属性名"
                    className="w-20 shrink-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={newAttrValue}
                    onChange={(e) => setNewAttrValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddPersonalAttr();
                      if (e.key === 'Escape') {
                        setIsAddingPersonalAttr(false);
                        setNewAttrKey('');
                        setNewAttrValue('');
                      }
                    }}
                    placeholder="属性值"
                    className="flex-1 min-w-0 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddPersonalAttr}
                    disabled={!newAttrKey.trim()}
                    className="px-2 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50 shrink-0"
                  >
                    确定
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingPersonalAttr(false);
                      setNewAttrKey('');
                      setNewAttrValue('');
                    }}
                    className="px-2 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-xs hover:bg-gray-50 shrink-0"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* 添加关系（默认折叠） */}
        <CollapsibleSection title="添加关系" defaultOpen={false} storageKey="details:addRel">
        <div>
          {!isAddingRelative ? (
            <button
              onClick={() => setIsAddingRelative(true)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-600 px-4 py-3 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              添加新关系
            </button>
          ) : (
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">关系类型</label>
                <select
                  value={relativeType}
                  onChange={handleRelativeTypeChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="parent">父母</option>
                  <option value="child">儿女</option>
                  <option value="spouse">爱人</option>
                  <option value="custom">自定义（同学、同事、朋友等）</option>
                </select>
                {relativeType === 'parent' && (
                  <p className="text-[10px] text-gray-400 mt-1">系统会根据性别推断父亲/母亲。</p>
                )}
                {relativeType === 'child' && (
                  <p className="text-[10px] text-gray-400 mt-1">系统会根据性别推断儿子/女儿。</p>
                )}
              </div>

              {relativeType === 'custom' && (
                <Field
                  label="关系称谓"
                  value={customRelLabel}
                  onChange={setCustomRelLabel}
                  placeholder="如：同学、同事、朋友"
                />
              )}

              {/* 新建人物 / 从现有人物添加 切换 */}
              <div className="flex gap-1 bg-white border border-gray-300 rounded-md p-0.5">
                <button
                  type="button"
                  onClick={() => setUseExistingPerson(false)}
                  className={
                    'flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ' +
                    (!useExistingPerson ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50')
                  }
                >
                  新建人物
                </button>
                <button
                  type="button"
                  onClick={() => setUseExistingPerson(true)}
                  className={
                    'flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ' +
                    (useExistingPerson ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50')
                  }
                >
                  从现有人物添加
                </button>
              </div>

              {useExistingPerson ? (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    选择人物（已排除当前人物）
                  </label>
                  <select
                    value={existingPersonId}
                    onChange={(e) => setExistingPersonId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">请选择…</option>
                    {nodes
                      .filter((n) => n.id !== selectedNode.id)
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.data.name || '未命名'}
                          {n.data.relationship ? `（${n.data.relationship}）` : ''}
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">
                    将选中的人物作为当前人物的{relativeType === 'parent' ? '父母' : relativeType === 'child' ? '子女' : relativeType === 'spouse' ? '配偶' : '自定义关系'}。已存在的关系不会重复创建。
                  </p>
                </div>
              ) : (
                <>
                  <Field
                    label="姓名"
                    value={newRelativeData.name}
                    onChange={(v) => setNewRelativeData({ ...newRelativeData, name: v })}
                    placeholder="例如：张三"
                  />

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">性别</label>
                    <select
                      value={newRelativeData.gender}
                      onChange={(e) =>
                        setNewRelativeData({ ...newRelativeData, gender: e.target.value as Gender })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="unknown">未知</option>
                      <option value="male">男</option>
                      <option value="female">女</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">出生年月</label>
                    <input
                      type="month"
                      value={newRelativeData.birthDate}
                      onChange={(e) =>
                        setNewRelativeData({ ...newRelativeData, birthDate: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddRelative}
                  disabled={
                    useExistingPerson
                      ? !existingPersonId || (relativeType === 'custom' && !customRelLabel.trim())
                      : !newRelativeData.name || (relativeType === 'custom' && !customRelLabel.trim())
                  }
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  确认添加
                </button>
                <button
                  onClick={() => setIsAddingRelative(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
        </CollapsibleSection>

        {/* 底部操作区：设为我自己 + 离世设置（常驻可见） */}
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
          {/* 设为我自己 */}
          {!formData.isSelf && (
            <button
              onClick={() => setAsSelf(selectedNode.id)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors"
              title={'将此人设为「自己」，便于族谱分享给他人时切换角色'}
            >
              <UserCheck className="w-4 h-4" />
              把这个人设置为我
            </button>
          )}

          {/* 离世设置 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Heart className="w-4 h-4 text-gray-400" />
                已离世
              </span>
              <input
                type="checkbox"
                checked={!!formData.deceased}
                onChange={(e) => liveUpdate({deceased: e.target.checked })}
                className="w-4 h-4 accent-gray-600"
              />
            </label>
            {formData.deceased && (
              <>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">离世日期（可选，精确到日）</label>
                  <input
                    type="date"
                    value={formData.deathDate || ''}
                    onChange={(e) => liveUpdate({deathDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                  />
                </div>
                <input
                  type="text"
                  value={formData.deathReason || ''}
                  onChange={(e) => liveUpdate({deathReason: e.target.value })}
                  placeholder="离世原因（可选）"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </>
            )}
            <p className="text-[10px] text-gray-400">
              离世的人会显示为灰黑色，并标注 ✝ 符号。年龄将截止到离世日期。
            </p>
          </div>
        </div>

        {/* 删除此人记录（末尾独立一行，自己不可删） */}
        {!formData.isSelf && (
          <button
            onClick={handleDelete}
            className="mt-6 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
            title="删除此人记录"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除此人记录
          </button>
        )}
      </div>
    </div>
  );
}
