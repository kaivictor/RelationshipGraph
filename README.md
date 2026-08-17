# 关系图谱 Relationship

一个以「自我」为中心、基于 React 和 React Flow 构建的交互式人际/家族关系图谱应用。数据完全保存在本机，无需联网即可使用。

## 目录

- [项目介绍](#项目介绍)
- [面向普通用户：功能与使用](#面向普通用户功能与使用)
- [面向开发者：使用与开发指南](#面向开发者使用与开发指南)
- [致谢开源项目](#致谢开源项目)
- [开源协议](#开源协议)

---

## 项目介绍

### 项目背景

随着城市化进程加快和生活节奏加速，年轻人越来越记不住家族亲属关系。逢年过节聚会时，面对众多亲戚往往不知道该如何称呼；日常生活中，也很难快速识别遇到的亲属身份。这款关系图谱应用旨在帮助用户以「我」为中心，可视化管理家族成员与社交关系信息，轻松维系情感纽带，减轻尴尬。一些长辈仍然注重宗族建设，会要求晚辈维护各系关系，该程序可以在一定程度上减轻压力。
在此基础上，系统进一步扩展了横向关系，可以添加朋友（同事、同学等）等关系。

### 功能特点

- **交互式关系图谱**：拖拽、缩放、平移、多选、小地图、一键自动布局，使用方便
- **人物管理**：基础信息、联系方式、社交账号、自定义属性、头像、联系方式二维码，可以方便的复制、扫码获取信息，对应的信息还可以用于智能化（例如通过车牌号自动识别到访人员、通过人像比对自动识别到访人员等）
- **关系管理**：父母 / 儿女 / 爱人 / 自定义（朋友、同事）四类关系，称谓随血缘 / 姻亲路径自动推算
- **导入导出**：PNG / SVG 图片导出，JSON / XML 数据导出备份，CSV 导出用于其他系统，JSON / XML 导入备份的文件，XLSX 快速地导入角色信息。
- **Excel 批量导入**：下载模板 → 填写 → 导入，支持自定义属性列
- **连线模式**：在使用 XLSX 导入独立的人物后，支持通过点击快速地创建联系，支持按年龄与性别自动判断关系类型
- **显示设置**：自定义节点卡片显示字段、顺序、自定义字段
- **数据安全**：实时自动保存、撤销（Ctrl+Z）、一键导出备份、跨设备迁移，不存储于

### 技术栈

| 类别 | 技术 |
|---|---|
| UI 框架 | **React 19** |
| 构建工具 | **Vite 6** |
| 图可视化 | **React Flow**（@xyflow/react 12） |
| 布局算法 | **Dagre** |
| 状态管理 | **Zustand 5** |
| 样式 | **Tailwind CSS 4** |
| 原生容器 | **Capacitor 8**（Android），**@capacitor/filesystem**、**@capacitor/share**（解决 WebView 无法下载文件） |
| 其他 | html-to-image（导出图片）、qrcode.react（二维码）、xlsx（Excel）、uuid、clsx、tailwind-merge、express |

---

## 面向普通用户：功能与使用

### 快速上手

1. 首次进入会自动加载示例关系图，点击 **全局设置** 中的 **删除数据** 将只保留「我」节点，点击节点打开**人物详情**面板。
2. 在详情面板中填写个人信息，并点击「添加关系」建立 **父母 / 儿女 / 爱人 / 自定义** 关系。
3. 在已有人物上逐渐添加人物，也可以通过 **帮助** 中的 xlsx 填写信息后导入，再通过连线模式创建关系。
4. 完成后使用「导出图片」或「导出数据」保存 / 分享。

![快速上手](public/help/quickstart.gif)

### 画布操作

- **缩放**：鼠标滚轮 / 双指捏合；右侧控制面板（+/-/适配视图）也可操作，点击左下角按钮可以调整为自适应大小。
- **平移**：拖拽画布空白区域移动视角。
- **移动节点**：直接拖拽人物卡片，位置自动保存。
- **多选节点**：长按节点约 0.5 秒切换选中状态，配合逐个长按可同时选中多人。
- **小地图**：右下角小地图快速跳转与预览整体结构。
- **整理布局**：工具栏一键按树状结构自动排列所有节点，但是做不到很好。
- **锁定排布** 左下角可以锁定当前布置，避免误调整。

### 人物管理

- **基础信息**：姓名（必填）、拼音、曾用名、称谓、性别、出生年月、离世信息、文化程度等。
- **联系方式&社交账号**：手机号、QQ、微信、邮箱、住址、车牌号，哔哩哔哩、抖音、小红书、推特、WhatsApp、Discord、Reddit、Threads，支持多个值，多余的内置选项可以删除。
- **自定义属性**：自由添加任意键值对（如职业、爱好、备注）。
- **头像**：点击头像区域上传图片，自动压缩并裁切为7:9后保存。
- **二维码**：在电脑上，在一些联系方式（手机、邮件）上悬浮鼠标可显示二维码，扫码即可获取电话、邮箱。
- **复制**: 大部分信息双击即可复制。

### 关系管理

- **添加关系**：在人物详情面板「关系」区选择类型，可「新建人物」或「从现有人员选择」。
- **四种关系类型**：父母（父 / 母）、儿女（儿子 / 女儿）、爱人、自定义（同学、同事、朋友等）。
- **自动称谓**：根据两人在关系网络中的路径自动计算称谓（如：母亲的哥哥 → 舅舅）。
- **编辑关系**：点击两个节点之间的连线可「断开关系」，断开后的虚线可通过再点连线「恢复关系」，支持删除关系。
- **连线模式**：工具栏「连线模式」支持自动（按年龄差判断）、父母子女、爱人、其他（自定义称谓）四种模式，依次点击两个节点即可连线。

### 导入 / 导出

| 类型 | 说明 |
|---|---|
| 导出图片 | PNG（可选 1x / 2x / 4x / 6x 或自定义倍数）或 SVG 矢量图 |
| 导出数据 | JSON / XML（完整数据：人物 + 关系 + 视图）用做备份或 CSV（仅人物 + 关系，无法导入） |
| 导入 JSON / XML | 完整导入，替换当前数据（含视图位置、设置偏好） |
| 导入 XLSX | 增量导入，将表格中的独立人物追加到画布（不带关系） |

> **Excel 批量导入**：下载模板后填写，姓名为必填项；可添加自定义属性列（列名即属性名）；多值字段用 `|` 分隔；性别可填「男」/「女」；日期支持 `YYYY-MM`、`YYYY-MM-DD` 或 `YYYY`。导入后使用「连线模式」建立关系。

### 数据保存与备份

- **自动保存**：所有修改实时自动保存到本机浏览器 / 应用，关闭后再次打开数据仍在。
- **撤销**：工具栏「撤销」或 `Ctrl + Z`（输入框中除外）。
- **备份建议**：重要数据请定期使用「导出数据」(JSON) 备份。
- **更换设备**：旧设备导出 JSON，新设备「导入数据」即可完整迁移。
- **Android 导出**：会调起系统分享面板，可选择「保存到文件 / 微信 / 邮件」等应用保存。

---

## 面向开发者：使用与开发指南

### 环境要求

- **Node.js**（建议 20+）
- **npm**
- （可选，Android 打包）JDK 17+、Android SDK、Gradle

### 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（http://localhost:3000）
npm run dev

# 3. 构建生产版本
npm run build

# 4. 预览生产构建
npm run preview

# 5. 类型检查
npm run lint
```

### 项目结构

```
src/
├── components/              # React 组件
│   ├── Relationship.tsx     #   主图谱组件
│   ├── PersonNode.tsx       #   自定义人物节点
│   ├── SpouseEdge.tsx       #   爱人关系边
│   ├── ParentChildEdge.tsx  #   父母子女关系边
│   ├── CustomEdge.tsx       #   自定义关系边
│   ├── PersonDetails.tsx    #   人物详情面板
│   ├── EdgeDetails.tsx      #   关系详情面板
│   ├── SettingsPanel.tsx    #   设置面板
│   ├── HelpPage.tsx         #   帮助中心（使用指南）
│   └── ...                  #   其他工具组件
├── store/
│   └── useRelationshipStore.ts # Zustand 状态管理（数据模型、持久化、撤销）
├── utils/
│   ├── dataSerializer.ts    #   数据序列化（JSON/XML/CSV 导入导出）
│   ├── relationship.ts      #   亲属称谓自动推算
│   ├── imageCompress.ts     #   图片压缩
│   └── xlsxTemplate.ts      #   Excel 模板生成
├── assets/                  # 静态资源
├── App.tsx                  # 应用入口
├── main.tsx                 # 挂载入口
└── index.css                # 全局样式

tools/
└── convert_legacy.py        # 旧版 FamilyTree 数据 → Relationship 数据转换工具

android/                     # Capacitor 生成的 Android 原生工程
├── dev.keystore             # 签名密钥库（勿提交到 git）
├── keystore.properties      # 签名配置（勿提交到 git）
├── local.properties         # SDK 路径配置（勿提交到 git）
└── app/build.gradle         # Android 构建配置
```

### 数据格式

- 序列化逻辑集中在 `src/utils/dataSerializer.ts`，支持 JSON / XML / CSV 三种格式。
- 导入导出字段（节点、边、视图、显示设置）与 `src/store/useRelationshipStore.ts` 中的类型定义一一对应。
- 旧版（FamilyTree）导出的数据无法直接使用，请先用转换工具处理，见下文。

### 旧版数据转换工具

项目曾用名 FamilyTree，旧版导出的 JSON / XML 缺少新版字段（如 `displaySettings`、`viewport`、XML 根节点不同），需先转换：

```bash
# 使用 Miniconda 等任一 Python 3.10+ 环境
python tools/convert_legacy.py 输入文件 [输出文件]
# 不指定输出文件时，自动生成 relationship-data.json / relationship-data.xml
```

转换内容：

- XML 根节点 `<familyTree>` → `<relationship>`
- 补全新版 `displaySettings`（含 `showCanvasHint` 等默认值）
- 旧 JSON 缺失的 `displaySettings` / `viewport` 用新版默认值补全
- `fieldOrder` 缺失内置字段时追加到末尾（尊重 `removedBuiltinFields`）
- 多值字段统一规范化

### Android APK 打包

从零打包 APK 的完整教程（环境准备、每个命令与参数的含义、签名配置、常见问题排查）见：

👉 [devdoc/package.md](devdoc/package.md)

---

## 致谢开源项目

本项目基于以下优秀的开源项目构建，特此致谢：

- **[React](https://react.dev/)** — UI 框架（MIT）
- **[Vite](https://vitejs.dev/)** — 现代化前端构建工具（MIT）
- **[React Flow (@xyflow/react)](https://xyflow.com/)** — 交互式图可视化引擎（MIT）
- **[Dagre](https://github.com/dagrejs/dagre)** — 图布局算法（MIT）
- **[Zustand](https://github.com/pmndrs/zustand)** — 轻量级状态管理（MIT）
- **[Tailwind CSS](https://tailwindcss.com/)** — 原子化 CSS 框架（MIT）
- **[Capacitor](https://capacitorjs.com/)** — 跨平台原生容器（MIT）
- **[lucide-react](https://lucide.dev/)** — 开源图标库（ISC）
- **[motion](https://motion.dev/)** — 动画库（MIT）
- **[html-to-image](https://github.com/bubkoo/html-to-image)** — DOM 转图片（MIT）
- **[qrcode.react](https://github.com/zpao/qrcode.react)** — 二维码生成（ISC）
- **[xlsx (SheetJS)](https://sheetjs.com/)** — Excel 文件解析（Apache-2.0）
- **[clsx](https://github.com/lukeed/clsx)** — 类名拼接（MIT）
- **[tailwind-merge](https://github.com/dcastil/tailwind-merge)** — 类名合并（MIT）
- **[uuid](https://github.com/uuidjs/uuid)** — 唯一标识生成（MIT）
- **[TypeScript](https://www.typescriptlang.org/)** — 类型系统（Apache-2.0）
- **[express](https://expressjs.com/)** — Node.js Web 框架（MIT）

## 开源协议

[Apache-2.0](LICENSE)
