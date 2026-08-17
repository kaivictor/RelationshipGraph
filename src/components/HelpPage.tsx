import { useState } from 'react';
import { useRelationshipStore } from '../store/useRelationshipStore';
import { downloadTemplateXlsx, BUILTIN_COLUMNS } from '../utils/xlsxTemplate';
import {
  X,
  Download,
  Plus,
  Trash2,
  FileSpreadsheet,
  HelpCircle,
  CheckCircle2,
  Move,
  Spline,
  Settings2,
  Database,
  Info,
  UserRound,
  Link2,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

// GIF 演示占位组件：预留图像位置，录制 GIF 后放入 public/help/ 即可自动显示；
// 资源不存在（如 APK 未打包 help 目录）或加载失败时自动隐藏，不显示破损图
function GifDemo({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className="mt-3">
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        className="rounded-lg border border-gray-200 shadow-sm max-h-80 w-full object-contain bg-white"
      />
    </div>
  );
}

// 小标题组件
function SectionTitle({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        {title}
      </h2>
      {desc && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{desc}</p>}
    </div>
  );
}

export function HelpPage() {
  const setShowHelpPage = useRelationshipStore((s) => s.setShowHelpPage);
  // 自定义列编辑
  const [customCols, setCustomCols] = useState<{ label: string; key: string }[]>([]);
  const [newLabel, setNewLabel] = useState('');

  const handleAddCustom = () => {
    const label = newLabel.trim();
    if (!label) return;
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

  // 内置列分组展示
  const basicCols = BUILTIN_COLUMNS.filter((c) => !['phone', 'qq', 'wechat', 'email', 'address', 'licensePlate', 'bilibili', 'discord', 'reddit', 'threads', 'whatsapp', 'douyin', 'twitter', 'xiaohongshu'].includes(c.key));
  const contactCols = BUILTIN_COLUMNS.filter((c) => ['phone', 'qq', 'wechat', 'email', 'address', 'licensePlate'].includes(c.key));
  const socialCols = BUILTIN_COLUMNS.filter((c) => ['bilibili', 'discord', 'reddit', 'threads', 'whatsapp', 'douyin', 'twitter', 'xiaohongshu'].includes(c.key));

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-800">帮助中心 - 使用指南</h1>
        </div>
        <button
          onClick={handleClose}
          className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
          title="返回图谱"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* 1. 快速上手 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionTitle icon={<Sparkles className="w-4 h-4" />} title="快速上手" desc="以自己为中心建立关系网络：添加人物、建立关系、导出分享。" />
            <ol className="space-y-2 text-sm text-gray-600 leading-relaxed list-decimal pl-5">
              <li>首次进入会自动生成一个「我」节点，点击节点打开<b className="text-gray-800">人物详情</b>面板。</li>
              <li>在详情面板中填写个人信息，并点击「添加关系」建立<b className="text-gray-800">父母 / 儿女 / 爱人 / 自定义</b>关系。</li>
              <li>人物多时，使用工具栏「<b className="text-blue-600">整理布局</b>」自动排列，或「<b className="text-blue-600">连线模式</b>」快速连线。</li>
              <li>完成后使用「<b className="text-blue-600">导出图片</b>」或「<b className="text-blue-600">导出数据</b>」保存 / 分享。</li>
            </ol>
            <GifDemo src="/help/quickstart.gif" alt="快速上手演示" />
          </section>

          {/* 2. 画布操作 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionTitle icon={<Move className="w-4 h-4" />} title="画布操作" desc="图谱画布支持拖拽、缩放、多选等操作，全部数据自动保存。" />
            <ul className="space-y-2 text-sm text-gray-600 leading-relaxed list-disc pl-5">
              <li><b className="text-gray-800">缩放：</b>鼠标滚轮 / 双指捏合缩放；右侧控制面板（+/-/适配视图）也可操作。</li>
              <li><b className="text-gray-800">平移：</b>拖拽画布空白区域移动视角。</li>
              <li><b className="text-gray-800">移动节点：</b>直接拖拽人物卡片到任意位置，位置会自动保存。</li>
              <li><b className="text-gray-800">多选节点：</b>长按一个节点约 0.5 秒即可切换其选中状态，配合逐个长按可同时选中多人。</li>
              <li><b className="text-gray-800">取消选择：</b>点击画布空白处关闭详情面板。</li>
              <li><b className="text-gray-800">小地图：</b>右下角小地图可快速跳转与预览整体结构。</li>
              <li><b className="text-gray-800">整理布局：</b>工具栏「整理布局」一键按树状结构自动排列所有节点。</li>
            </ul>
          </section>

          {/* 3. 人物管理 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionTitle icon={<UserRound className="w-4 h-4" />} title="人物管理" desc="点击任意节点打开详情面板，可编辑基础信息、联系方式、社交账号与自定义属性。" />
            <ul className="space-y-2 text-sm text-gray-600 leading-relaxed list-disc pl-5">
              <li><b className="text-gray-800">基础信息：</b>姓名（必填）、拼音、曾用名、称谓、性别、出生年月、已离世 / 离世原因 / 死亡日期、文化程度等。</li>
              <li><b className="text-gray-800">联系方式：</b>手机号、QQ、微信、邮箱、住址、车牌号（支持多个，用「|」分隔）。</li>
              <li><b className="text-gray-800">社交账号：</b>哔哩哔哩、抖音、小红书、推特、WhatsApp、Discord、Reddit、Threads。</li>
              <li><b className="text-gray-800">自定义属性：</b>可自由添加任意键值对（如：职业、爱好、备注）。</li>
              <li><b className="text-gray-800">头像：</b>点击头像区域上传图片，自动压缩后保存。</li>
              <li><b className="text-gray-800">二维码：</b>联系方式（手机 / QQ / 微信等）可一键生成二维码，方便快速添加好友。</li>
              <li><b className="text-gray-800">字段显示：</b>在「显示设置」中可开关、排序节点卡片上显示的字段。</li>
            </ul>
            <GifDemo src="/help/person-edit.gif" alt="人物编辑演示" />
          </section>

          {/* 4. 关系管理 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionTitle icon={<Link2 className="w-4 h-4" />} title="关系管理" desc="支持父母、儿女、爱人、自定义四种关系；称谓会随血缘 / 姻亲路径自动推算。" />
            <ul className="space-y-2 text-sm text-gray-600 leading-relaxed list-disc pl-5">
              <li><b className="text-gray-800">添加关系：</b>在人物详情面板的「关系」区，选择关系类型后，可「新建人物」或「从现有人员选择」。</li>
              <li><b className="text-gray-800">四种关系类型：</b>父母（父 / 母）、儿女（儿子 / 女儿）、爱人、自定义（同学、同事、朋友等）。</li>
              <li><b className="text-gray-800">自动称谓：</b>系统根据两人在关系网络中的路径自动计算称谓（如：母亲的哥哥 → 舅舅）。</li>
              <li><b className="text-gray-800">编辑关系：</b>点击两个节点之间的连线，可「断开关系」；断开后的虚线可通过再点连线「恢复关系」。</li>
              <li><b className="text-gray-800">删除关系：</b>在人物详情的关系列表中点删除即可，人物本身不会删除。</li>
              <li><b className="text-gray-800">关系类型显示：</b>父母子女关系显示为实线（绿=父系、红=母系），爱人为粉色实线，自定义为灰色虚线。</li>
            </ul>
          </section>

          {/* 5. 连线模式 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionTitle icon={<Spline className="w-4 h-4" />} title="连线模式（批量建立关系）" desc="人物导入较多时，用连线模式逐个点击即可快速建立关系。" />
            <ul className="space-y-2 text-sm text-gray-600 leading-relaxed list-disc pl-5">
              <li>点击工具栏「<b className="text-blue-600">连线模式</b>」，选择一种模式：</li>
              <li className="pl-4"><b className="text-gray-800">自动：</b>根据年龄差自动判断（年龄差 &gt; 15 岁 → 父母子女，否则 → 爱人）。</li>
              <li className="pl-4"><b className="text-gray-800">父母子女：</b>先点长辈，再点晚辈。</li>
              <li className="pl-4"><b className="text-gray-800">爱人：</b>不限年龄与性别。</li>
              <li className="pl-4"><b className="text-gray-800">其他：</b>输入关系称谓（如：同学、同事、朋友）。</li>
              <li>依次点击两个人物节点即可完成连线；起点节点会有蓝色高亮，点击画布空白可取消。</li>
            </ul>
          </section>

          {/* 6. 导入导出 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionTitle icon={<Database className="w-4 h-4" />} title="导入 / 导出" desc="支持导出图片与数据文件，也可从 JSON / XML / XLSX 恢复数据。" />
            <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-400 mb-1">导出</div>
                <ul className="space-y-1.5 list-disc pl-5">
                  <li><b className="text-gray-800">导出图片：</b>PNG（可选 1x / 2x / 4x / 6x 清晰度或自定义倍数）或 SVG 矢量图。</li>
                  <li><b className="text-gray-800">导出数据：</b>JSON / XML（完整数据，含人物 + 关系 + 视图）或 CSV（仅人物 + 关系，可配合 Excel）。</li>
                </ul>
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-400 mb-1">导入</div>
                <ul className="space-y-1.5 list-disc pl-5">
                  <li><b className="text-gray-800">JSON / XML：</b>完整导入（替换当前数据，含视图位置）。</li>
                  <li><b className="text-gray-800">XLSX：</b>增量导入（将表格中的独立人物追加到画布，不带关系，详见下方 Excel 说明）。</li>
                </ul>
              </div>
            </div>
          </section>

          {/* 7. Excel 模板导入（保留原有功能） */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionTitle icon={<FileSpreadsheet className="w-4 h-4" />} title="Excel 批量导入" desc="适合一次性录入大量人物：下载模板 → 填写 → 导入。" />
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


            {/* 自定义列 */}
            <div className="mt-5 pt-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">自定义模板列（可选）</h3>
              <p className="text-xs text-gray-500 mb-4">
                可以在模板中追加自定义属性列。导入时会先识别系统内置属性再识别自定义属性。
              </p>
            </div>
            {/* 底部下载栏 */}
            <div className="px-6 py-0.5 bg-white border-t border-gray-200 flex items-center justify-between shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span>当前模板包含 {BUILTIN_COLUMNS.length} 个内置列 + {customCols.length} 个自定义列</span>
              </div>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
              >
                <Download className="w-4 h-4" />
                下载导入模板
              </button>
            </div>
          </section>

          {/* 8. 显示设置 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionTitle icon={<Settings2 className="w-4 h-4" />} title="显示设置" desc="自定义人物卡片展示字段与节点布局偏好。" />
            <ul className="space-y-2 text-sm text-gray-600 leading-relaxed list-disc pl-5">
              <li><b className="text-gray-800">字段显示：</b>打开「显示设置」面板，勾选要在节点卡片上显示的字段。</li>
              <li><b className="text-gray-800">字段排序：</b>在设置面板中按住拖拽手柄，调整字段在卡片上的显示顺序。</li>
              <li><b className="text-gray-800">自定义字段：</b>新增 / 删除自定义属性字段，或删除内置字段（可随时恢复）。</li>
              <li><b className="text-gray-800">清除浏览器数据：</b>一键清空本机保存的所有数据（谨慎操作，可先用「导出数据」备份）。</li>
              <li><b className="text-gray-800">画布提示：</b>可开关左上角的操作提示。</li>
            </ul>
          </section>

          {/* 9. 数据与备份 */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <SectionTitle icon={<Database className="w-4 h-4" />} title="数据保存与备份" desc="数据保存在本机浏览器中，无需联网。" />
            <ul className="space-y-2 text-sm text-gray-600 leading-relaxed list-disc pl-5">
              <li><b className="text-gray-800">自动保存：</b>所有修改实时自动保存到本机，关闭页面后再次打开数据仍在。</li>
              <li><b className="text-gray-800">撤销：</b>工具栏「撤销」按钮或键盘 <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs">Z</kbd> 可撤销最近操作（输入框中除外）。</li>
              <li><b className="text-gray-800">备份建议：</b>重要数据请定期使用「导出数据」(JSON) 备份到本机或网盘。</li>
              <li><b className="text-gray-800">更换设备：</b>在旧设备导出 JSON，在新设备「导入数据」即可完整迁移。</li>
            </ul>
          </section>

          {/* 常见问题 */}
          <section className="bg-blue-50 rounded-xl border border-blue-200 p-6">
            <SectionTitle icon={<Info className="w-4 h-4" />} title="常见问题" />
            <div className="space-y-4 text-sm text-blue-800 leading-relaxed">
              <div>
                <p className="font-semibold mb-1">Q：如何称呼某个亲戚？</p>
                <p className="text-blue-700">选中两人的连线，系统会自动计算称谓；也可在人物详情的关系列表中查看当前关系的称谓。</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Q：导入 Excel 后为什么没有关系？</p>
                <p className="text-blue-700">Excel 模板只导入独立人物，不包含关系。导入后请使用「连线模式」或逐个打开详情添加关系。</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Q：如何迁移数据到新设备？</p>
                <p className="text-blue-700">旧设备「导出数据」→ JSON，新设备「导入数据」选择该文件即可。图片导出后 PNG / SVG 可直接分享。</p>
              </div>
              <div>
                <p className="font-semibold mb-1">Q：误删了字段或数据怎么办？</p>
                <p className="text-blue-700">内置字段可在「显示设置」中随时恢复；误删人物可用工具栏「撤销」恢复。</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      
    </div>
  );
}
