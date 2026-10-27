# 「即现」路演 PPT — 文件清单与维护指南

本文档说明路演 PPT 的成品位置、构建脚本结构，以及后续如何修改再生成。所有内容（文案、配色、版式、图片）都由 `.pptx_build/build.cjs` 一键生成，**不要直接手工编辑 .pptx 文件**——改脚本重新构建即可，否则下次重建会覆盖手工改动。

---

## 1. 文件清单

### 成品（`docs/`）

| 文件 | 说明 | 状态 |
| --- | --- | --- |
| `即现-插件介绍.md` | 产品计划输出的路演大纲（内容源文件，含演讲备注） | 已入库 |
| `即现-插件介绍.pptx` | 最初生成的亮暗混排版（部分页白底、部分页黑底） | 已入库，**已被下面两版取代**，可随时删除或仅作存档 |
| `即现-插件介绍-亮色.pptx` | 亮色主题 16 页：全白底，封面/尾页为亮色图片全屏沉浸式 | 待入库 |
| `即现-插件介绍-暗色.pptx` | 暗色主题 16 页：全深墨绿底，封面/尾页为聚光舞台照片 | 待入库 |

两个主题版内容、版式、演讲备注完全一致，仅配色与封面尾页图片不同。

### 构建系统（`.pptx_build/`，位于仓库根目录）

| 文件 | 说明 |
| --- | --- |
| `build.cjs` | pptxgenjs 构建脚本（CommonJS，因为仓库 package.json 是 `"type": "module"`，后缀必须是 `.cjs`） |
| `assets/icon.png` | 插件图标（由仓库根目录 `icon.webp` 转换而来，白底不透明，所以页面上始终垫白色/浅色圆角卡片） |
| `assets/stage.jpg` | 聚光舞台讲者照片（暗色版封面/封底全屏图） |
| `assets/night.jpg` | 深夜伏案照片（第 2 页「深夜 23:00」右侧配图，两主题通用） |
| `assets/cover_light.jpg` | 亮色版封面全屏图（MacBook + 绿色笔记本暖木书桌，图源 Unsplash 风格免费图） |
| `assets/end_light.jpg` | 亮色版封底全屏图（粉彩海滩地平线） |
| `assets/bg_dark.png` / `bg_light.png` | 程序生成的辉光渐变背景，用于「转折」「三句话」等陈述页 |
| `assets/scrim_cover.png` / `scrim_end.png` | 暗色版照片上的黑色渐变遮罩（保证白字可读） |
| `assets/scrim_cover_light.png` / `scrim_end_light.png` | 亮色版照片上的白色渐变遮罩（保证深字可读） |
| `assets/plane.jpg` | 机舱照片（旧第 11 页配图，现已不引用，保留备用） |

---

## 2. 环境依赖

| 依赖 | 用途 | 本机状态 |
| --- | --- | --- |
| Node.js ≥ 18 + 全局 `pptxgenjs` | 生成 .pptx | 已装（`npm install -g pptxgenjs`；全局目录 `C:\Users\<用户>\AppData\Roaming\npm\node_modules`） |
| LibreOffice（`soffice`） | 把 .pptx 转 PDF 做预览质检 | 已装，不在 PATH，用全路径 `C:\Program Files\LibreOffice\program\soffice.exe` |
| Python + `pymupdf` | PDF 渲染成 PNG 逐页目检 | 已装（`pip install pymupdf`） |

---

## 3. 快速修改流程

```bash
cd D:/MyCodingProjects/siyuan-slidev/.pptx_build

# 1) 编辑 build.cjs（用任何编辑器；改文案、配色、版式、图片引用）

# 2) 重新生成两个主题的 pptx，直接输出到 docs/
NODE_PATH="$APPDATA/npm/node_modules" node build.cjs
# 控制台输出 OK 2 themes x 16 slides 即成功

# 3) 预览质检（LibreOffice 转 PDF → PyMuPDF 渲染 PNG）
"/c/Program Files/LibreOffice/program/soffice.exe" --headless --convert-to pdf --outdir . "../docs/即现-插件介绍-亮色.pptx"
"/c/Program Files/LibreOffice/program/soffice.exe" --headless --convert-to pdf --outdir . "../docs/即现-插件介绍-暗色.pptx"
python - <<'EOF'
import pymupdf, os
os.makedirs("render", exist_ok=True)
for tag, f in [("L", "即现-插件介绍-亮色.pdf"), ("D", "即现-插件介绍-暗色.pdf")]:
    doc = pymupdf.open(f)
    for i, pg in enumerate(doc):
        pg.get_pixmap(dpi=100).save(f"render/{tag}{i+1:02d}.png")
print("rendered")
EOF
# 然后逐张查看 render/L01.png … render/D16.png

# 4) 清理中间产物
rm -rf render *.pdf
```

> 预览注意：LibreOffice 用替代字体渲染，中文粗细/字宽与真实 PowerPoint 略有差异，判断"是否溢出"要留 ~10% 余量；删除线（strike）在 PowerPoint 中正常显示。

---

## 4. build.cjs 结构速览

```
C 常量表           ← 原始色板（绿=主色 / 琥珀=点缀，见下）
build(mode)       ← 唯一入口；mode = "light" | "dark"
  ├─ T 主题令牌    ← 每页只允许引用 T.xxx，禁止直接挑色
  ├─ 辅助函数      ← newSlide / footer / kicker / h1 / header /
  │                  hairline / chip / accChip / kbd / row / bars / arrowR
  └─ S1–S16 IIFE   ← 每页一个独立代码块，顺序即页序
文件末尾           ← 依次 build("light")、build("dark") 写入 docs/
```

画布：`LAYOUT_WIDE` 13.33 × 7.5 英寸；边距 `M = 0.62`；坐标单位英寸。

### 色板（C 常量）

| 角色 | 亮色值 | 暗色值 | 用途 |
| --- | --- | --- | --- |
| 背景 | `FFFFFF` | `0C1310` | 页面底色 |
| 主色绿 | `0E8A5F` / `0A5C41` | 文字提亮用 `17A673` | 标题强调、填充、图表 |
| 点缀琥珀 | `F59E0B` / `C77D06` | `F59E0B` | kicker、大数字、进度、高亮 |
| 卡片 | `EAF4EE` / `F6FAF8` | `152119` + 描边 `26382D` | 各类卡片、chips |
| 正文/弱化 | `17251E` / `5F7268` | `F2F7F4` / `9BB1A6` | 文字两级层次 |

改配色只需要改 `T` 令牌表或 `C` 常量，所有页面自动跟随。

### 页面目录（S1–S16）

| 页 | 主题 | 版式要点 |
| --- | --- | --- |
| S1 封面 | 亮暗分支 | 亮：cover_light.jpg 全屏 + 白遮罩；暗：stage.jpg 全屏 + 黑遮罩 |
| S2 深夜 23:00 | 通用 | night.jpg 右半 + 四行痛点 |
| S3 工具的割裂 | 通用 | 断接示意（两卡+✕）+ 01–04 四宗罪 |
| S4 转折 | 通用 | 辉光背景大字提问 + 删除线 chips + 琥珀句 |
| S5 正文零污染 | 通用 | 纯净文档示意 vs IAL 属性面板示意 |
| S6 双引擎 | 通用 | 左「0 依赖」浅卡 vs 右「3030」深卡 |
| S7 面板点选 | 通用 | 九宫格版式面板示意（8 版式+分页符） |
| S8 上下分屏 | 通用 | 编辑区/预览区双卡 + 双向箭头 |
| S9 双屏演讲 | 通用 | 全幅演讲者控制台示意（计时/进度/缩略/提词卡）+ 四特性栏 |
| S10 AI 加持 | 通用 | 五节点流程 + 「≈ 5 分钟」 |
| S11 离线交付 | 通用 | .html / .pdf 双卡（各三要点）+ 场景横条 |
| S12 一键迁入 | 通用 | 01–04 步骤链 + 结论横条 |
| S13 谁在用 | 通用 | 四用户卡片 |
| S14 三句话 | 通用 | 辉光背景 + 01/02/03 大编号 |
| S15 上手 | 通用 | STEP 1–4 键帽卡片 |
| S16 尾页 | 亮暗分支 | 亮：end_light.jpg 全屏 + 白遮罩；暗：stage.jpg + 重黑遮罩 |

每页最后一句 `s.addNotes("…")` 写入演讲备注（取自大纲的「💡 演讲备注」），与产品"提词进备注、正文零污染"的理念呼应。

---

## 5. 常见修改任务

### 改某页文字
打开 `build.cjs`，定位对应 `S*` 注释块，直接改 `addText` 的字符串。文案事实来源以 `docs/即现-插件介绍.md` 大纲和 `README_zh_CN.md` 为准，不要凭空编造数字（如端口 3030、16:9、快捷键 F/P/Alt+P 均来自 README）。

### 换图片
1. 把新图放入 `.pptx_build/assets/`（建议横图 ≥1600px 宽）；
2. 改对应页的 `A("xxx.jpg")` 引用；全屏图配 `sizing: { type: "cover", w: W, h: H }`（自动按比例裁切，不会拉伸变形）；
3. 若新图亮度/色调与现有遮罩不匹配，用 PIL 重新生成对应 scrim（参考 assets 里同名遮罩的生成逻辑：横向渐变保证文字区近纯色、另一侧透出图片）。

### 加一页 / 删一页
复制某个 `(() => { … })();` 块插入到目标位置，页码由 `newSlide()` 自动递增，无需手工改页号。删除就整块移除。`footer()` 自动显示"即现 · 让笔记开口说话"+ 页码（封面和尾页没有 footer，属正常）。

### 只重新生成一个主题
把文件末尾 IIFE 里的另一个 `await build(…)` 行临时注释掉即可，记得改回来。

### 新增一个主题（如「护眼米色」）
在 `build(mode)` 里给 `T` 表加一个分支即可——所有页面引用令牌，理论上一行分支就能扩出第三套主题；封面/尾页这类亮暗分支的页面需要补对应的图片分支。

### 调整字体
全局字体在 `FONT` / `MONO` 两个常量。正文微软雅黑、代码/键帽 Consolas，是刻意选择（2 字体内），不要引入第三个字体。避免使用 Light/Thin 字重。

---

## 6. 提交约定

- 生成脚本与素材（`.pptx_build/`）随成品一起入库，保证任何时候可以复现。
- 提交信息沿用仓库惯例：`docs: <中文摘要>`。
- `docs/即现-插件介绍.pptx`（混排版）被双主题取代后如确认不再需要，删除时在提交信息注明"由亮色/暗色版取代"即可，历史仍可追溯。
- 中间产物（`render/`、`*.pdf`、解包目录）不入库，构建完随手清理。
