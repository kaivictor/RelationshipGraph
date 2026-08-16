import { useState } from 'react';
import { useFamilyStore } from '../store/useFamilyStore';
import { downloadTemplateXlsx, BUILTIN_COLUMNS } from '../utils/xlsxTemplate';
import { X, Download, Plus, Trash2, FileSpreadsheet, HelpCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export function HelpPage() {
  const setShowHelpPage = useFamilyStore((s) => s.setShowHelpPage);
  // 自定义列编辑
  const [customCols, setCustomCols] = useState<{ label: string; key: string }[]>([]);
  const [newLabel, setNewLabel] = useState('');

  const handleAddCustom = () => {
    const label = newLabel.trim();
    if (!label) return;
    // 去重
    if (customCols.some((c) => c.label === label || c.key === label)) {
      alert('该列名已存在');
      return;
    }
    setCustomCols([...customCols, { label, key: label }]);
    setNewLabel('');
  };

  const handleRemoveCustom = (idx: number) => {
    setCustomCols(customCols.filter((_, i) => i !== idx));
  };

  const handleDownload = () => {
    downloadTemplateXlsx(customCols);
  };

  const handleClose = () => setShowHelpPage(false);

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-800">帮助 - Excel 导入</h1>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
          title="返回族谱"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {/* 说明 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-green-600" />
              导入说明
            </h2>
            <ul className="space-y-2 text-sm text-gray-600 leading-relaxed list-disc pl-5">
              <li>
                点击下方"<span className="font-medium text-blue-600">下载导入模板</span>"获取 Excel 模板文件。
              </li>
              <li>
                模板中 <span className="font-medium text-red-500">姓名</span> 为必填项，其他属性均为选填，可整列删除。
              </li>
              <li>
                可在模板中添加自定义属性列（列名即属性名），导入后会作为人物的"自定义属性"保存。
              </li>
              <li>
                导入时系统会自动校验：缺少姓名的行将被跳过，只加载可用数据。
              </li>
              <li>
                导入的人物以<span className="font-medium">独立节点</span>形式增量添加到画布，<span className="font-medium">不携带任何关系</span>。
                如需建立关系，导入后可使用"连线模式"逐个连接。
              </li>
              <li>
                多值字段（如手机号、QQ号等）请用 <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">|</code> 分隔多个值。
              </li>
              <li>
                性别可填"男"/"女"，留空则为"未知"。
              </li>
              <li>
                日期格式支持 <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">YYYY-MM</code>、
                <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">YYYY-MM-DD</code> 或
                <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">YYYY</code>。
              </li>
            </ul>
          </section>

          {/* 自定义列 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-3">自定义模板列（可选）</h2>
            <p className="text-xs text-gray-500 mb-4">
              在模板中追加自定义属性列。下载的模板会包含这些列，导入时也会识别。
            </p>

            {/* 内置列预览 */}
            <div className="mb-5">
              <div className="text-xs font-medium text-gray-400 mb-2">内置列（{BUILTIN_COLUMNS.length} 个）</div>
              <div className="flex flex-wrap gap-1.5">
                {BUILTIN_COLUMNS.map((c) => (
                  <span
                    key={c.key}
                    className={clsx(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border',
                      c.required
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-gray-200 bg-gray-50 text-gray-600'
                    )}
                  >
                    {c.label}
                    {c.required && <span className="text-[9px]">必填</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* 自定义列列表 */}
            <div className="mb-3">
              <div className="text-xs font-medium text-gray-400 mb-2">已添加的自定义列</div>
              {customCols.length === 0 ? (
                <div className="text-xs text-gray-400 italic">暂无自定义列</div>
              ) : (
                <div className="space-y-1.5">
                  {customCols.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-md">
                      <span className="text-sm text-gray-700 flex-1">{c.label}</span>
                      <button
                        onClick={() => handleRemoveCustom(i)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="删除该列"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 添加自定义列 */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCustom();
                }}
                placeholder="输入自定义列名，如：职业、爱好、备注"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddCustom}
                disabled={!newLabel.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加列
              </button>
            </div>
          </section>

          {/* 字段说明 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-3">字段填写示例</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-medium text-gray-500">列名</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">示例</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr><td className="py-1.5 px-2 text-red-500 font-medium">姓名</td><td className="py-1.5 px-2">张三</td><td className="py-1.5 px-2 text-gray-500">必填</td></tr>
                  <tr><td className="py-1.5 px-2">姓名拼音</td><td className="py-1.5 px-2">Zhang San</td><td className="py-1.5 px-2 text-gray-500">选填</td></tr>
                  <tr><td className="py-1.5 px-2">曾用名</td><td className="py-1.5 px-2">旧名|曾用名</td><td className="py-1.5 px-2 text-gray-500">多值用 | 分隔</td></tr>
                  <tr><td className="py-1.5 px-2">出生年月</td><td className="py-1.5 px-2">1980-05</td><td className="py-1.5 px-2 text-gray-500">YYYY-MM</td></tr>
                  <tr><td className="py-1.5 px-2">性别</td><td className="py-1.5 px-2">男</td><td className="py-1.5 px-2 text-gray-500">男/女/留空</td></tr>
                  <tr><td className="py-1.5 px-2">手机号</td><td className="py-1.5 px-2">13800000000|13900000000</td><td className="py-1.5 px-2 text-gray-500">多值用 | 分隔</td></tr>
                  <tr><td className="py-1.5 px-2">已离世</td><td className="py-1.5 px-2">是</td><td className="py-1.5 px-2 text-gray-500">是/否/留空</td></tr>
                  <tr><td className="py-1.5 px-2">死亡日期</td><td className="py-1.5 px-2">2020-03-15</td><td className="py-1.5 px-2 text-gray-500">YYYY-MM-DD</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 导入流程提示 */}
          <section className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <h2 className="text-base font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              导入流程
            </h2>
            <ol className="space-y-2 text-sm text-blue-700 leading-relaxed list-decimal pl-5">
              <li>下载模板（可先添加自定义列）</li>
              <li>在 Excel 中填写人物信息，保存</li>
              <li>回到族谱页面，点击"导入数据"按钮，选择 .xlsx 文件</li>
              <li>系统自动校验并增量导入，无效行会被跳过</li>
              <li>导入完成后，使用"连线模式"为人物建立关系</li>
            </ol>
          </section>
        </div>
      </div>

      {/* 底部下载栏 */}
      <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span>当前模板包含 {BUILTIN_COLUMNS.length} 个内置列 + {customCols.length} 个自定义列</span>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
        >
          <Download className="w-4 h-4" />
          下载导入模板
        </button>
      </div>
    </div>
  );
}
