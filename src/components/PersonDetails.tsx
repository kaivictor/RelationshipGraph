import { useState, useEffect } from 'react';
import { useFamilyStore, PersonData, Gender } from '../store/useFamilyStore';
import { X, Plus, Trash2, Save } from 'lucide-react';
import clsx from 'clsx';

// 通用文本输入字段
function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
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
  const { nodes, selectedNodeId, setSelectedNodeId, updatePerson, deletePerson, addRelative } =
    useFamilyStore();
  const customFields = useFamilyStore((s) => s.displaySettings.customFields);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const [formData, setFormData] = useState<PersonData | null>(null);
  const [isAddingRelative, setIsAddingRelative] = useState(false);
  const [relativeType, setRelativeType] = useState<'father' | 'mother' | 'son' | 'daughter' | 'spouse'>('son');
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

  useEffect(() => {
    if (selectedNode) {
      setFormData({ ...selectedNode.data });
      setIsAddingRelative(false);
    } else {
      setFormData(null);
    }
  }, [selectedNode]);

  if (!selectedNode || !formData) return null;

  const handleSave = () => {
    updatePerson(selectedNode.id, formData);
  };

  const handleRelativeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as any;
    setRelativeType(val);
    let gender: Gender = newRelativeData.gender;
    if (val === 'father' || val === 'son') gender = 'male';
    if (val === 'mother' || val === 'daughter') gender = 'female';
    setNewRelativeData({ ...newRelativeData, gender });
  };

  const handleAddRelative = () => {
    addRelative(selectedNode.id, relativeType, newRelativeData);
    setIsAddingRelative(false);
    setNewRelativeData({
      name: '',
      avatar: '',
      relationship: '',
      birthDate: '',
      gender: 'male',
    });
    setRelativeType('son');
  };

  const updateCustomFieldValue = (id: string, value: string) => {
    const current = formData.customFieldValues || {};
    setFormData({ ...formData, customFieldValues: { ...current, [id]: value } });
  };

  // 个人自定义属性操作
  const personalAttrs = formData.customAttributes || [];

  const handleAddPersonalAttr = () => {
    const key = newAttrKey.trim();
    if (!key) return;
    const newAttrs = [...personalAttrs, { key, value: newAttrValue }];
    setFormData({ ...formData, customAttributes: newAttrs });
    setNewAttrKey('');
    setNewAttrValue('');
    setIsAddingPersonalAttr(false);
  };

  const handleUpdatePersonalAttr = (index: number, value: string) => {
    const newAttrs = personalAttrs.map((attr, i) =>
      i === index ? { ...attr, value } : attr
    );
    setFormData({ ...formData, customAttributes: newAttrs });
  };

  const handleRemovePersonalAttr = (index: number) => {
    const newAttrs = personalAttrs.filter((_, i) => i !== index);
    setFormData({ ...formData, customAttributes: newAttrs });
  };

  // 判断个人属性是否被全局同名属性覆盖
  const isOverriddenByGlobal = (key: string): boolean =>
    customFields.some((cf) => cf.label === key);

  return (
    <div className="absolute top-16 right-4 w-72 bg-white shadow-xl rounded-xl border border-gray-200 flex flex-col overflow-hidden max-h-[calc(100vh-5rem)] z-20">
      <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
        <h2 className="font-semibold text-gray-800">详细信息</h2>
        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
          title="返回全局设置"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex-1">
        <div className="space-y-4">
          <Field
            label="姓名拼音"
            value={formData.namePinyin || ''}
            onChange={(v) => setFormData({ ...formData, namePinyin: v })}
            placeholder="如：Zhang San"
          />
          <Field
            label="姓名"
            value={formData.name}
            onChange={(v) => setFormData({ ...formData, name: v })}
          />

          <Field
            label="曾用名"
            value={formData.formerName || ''}
            onChange={(v) => setFormData({ ...formData, formerName: v })}
            placeholder="（可选）"
          />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              称谓（系统自动计算）
            </label>
            <input
              type="text"
              value={formData.relationship}
              disabled
              className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-md text-sm text-gray-500 cursor-not-allowed"
            />
          </div>

          <Field
            label="称谓俗称"
            value={formData.popularName || ''}
            onChange={(v) => setFormData({ ...formData, popularName: v })}
            placeholder="如：小三"
          />

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">出生年月</label>
            <input
              type="month"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">性别</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
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
            onChange={(v) => setFormData({ ...formData, education: v })}
            placeholder="如：本科"
          />

          <Field
            label="头像 URL（可选）"
            value={formData.avatar}
            onChange={(v) => setFormData({ ...formData, avatar: v })}
            placeholder="https://..."
          />

          <Field
            label="手机号"
            value={formData.phone || ''}
            onChange={(v) => setFormData({ ...formData, phone: v })}
            placeholder="如：13800138000"
          />
          <Field
            label="QQ号"
            value={formData.qq || ''}
            onChange={(v) => setFormData({ ...formData, qq: v })}
          />
          <Field
            label="微信号"
            value={formData.wechat || ''}
            onChange={(v) => setFormData({ ...formData, wechat: v })}
          />
          <Field
            label="邮箱号"
            value={formData.email || ''}
            onChange={(v) => setFormData({ ...formData, email: v })}
            placeholder="如：name@example.com"
          />
          <Field
            label="住址"
            value={formData.address || ''}
            onChange={(v) => setFormData({ ...formData, address: v })}
          />
          <Field
            label="车牌号"
            value={formData.licensePlate || ''}
            onChange={(v) => setFormData({ ...formData, licensePlate: v })}
            placeholder="如：京A88888"
          />

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              保存修改
            </button>
            {!formData.isSelf && (
              <button
                onClick={() => deletePerson(selectedNode.id)}
                className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
                title="删除节点"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 全局自定义属性 */}
          {customFields.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
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
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="font-medium text-gray-800 text-sm mb-2">个人自定义属性</h3>
            <p className="text-[10px] text-gray-400 mb-2">
              仅对此人生效。若与全局自定义属性同名，则全局优先。
            </p>
            <div className="space-y-2">
              {personalAttrs.map((attr, index) => {
                const overridden = isOverriddenByGlobal(attr.key);
                return (
                  <div key={`personal-${index}`} className={clsx('flex gap-1 items-center', overridden && 'opacity-50')}>
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
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="font-medium text-gray-800 mb-4">添加亲属</h3>

          {!isAddingRelative ? (
            <button
              onClick={() => setIsAddingRelative(true)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 text-gray-600 px-4 py-3 rounded-lg hover:border-blue-500 hover:text-blue-600 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              添加新亲属
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
                  <option value="father">父亲</option>
                  <option value="mother">母亲</option>
                  <option value="son">儿子</option>
                  <option value="daughter">女儿</option>
                  <option value="spouse">爱人</option>
                </select>
              </div>

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

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAddRelative}
                  disabled={!newRelativeData.name}
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
      </div>
    </div>
  );
}
