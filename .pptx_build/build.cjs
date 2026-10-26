/* 「即现 · SiYuan Slidev」路演 PPT 构建脚本 */
const pptxgen = require("pptxgenjs");
const path = require("path");

const ASSETS = path.join(__dirname, "assets");
const A = (f) => path.join(ASSETS, f);

const P = new pptxgen();
P.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
P.author = "即现 SiYuan Slidev";
P.title = "即现 · 笔记即演示，内容即思想";
P.subject = "思源笔记演示插件路演";
P.theme = { headFontFace: "Microsoft YaHei", bodyFontFace: "Microsoft YaHei" };

const W = 13.33, H = 7.5, M = 0.62, CW = W - 2 * M;
const FONT = "Microsoft YaHei", MONO = "Consolas";

// 配色：思源绿（主）× 聚光琥珀（点缀）
const C = {
  dark: "0C1310", darkCard: "152119", darkLine: "26382D",
  light: "FFFFFF", tint: "EAF4EE", tintSoft: "F6FAF8",
  primary: "0E8A5F", primDeep: "0A5C41", primBright: "17A673",
  accent: "F59E0B", accentDeep: "C77D06", accentTint: "FDF3DF",
  text: "17251E", muted: "5F7268",
  dtext: "F2F7F4", dmuted: "9BB1A6",
  hair: "DEE9E2", bar: "E3ECE6", foot: "9AAFA3",
};

const sh = () => ({ type: "outer", color: "1B2A22", blur: 7, offset: 2, angle: 90, opacity: 0.16 });
const shSoft = () => ({ type: "outer", color: "1B2A22", blur: 4, offset: 1, angle: 90, opacity: 0.12 });

let pageNo = 0;

function newSlide(dark = false) {
  const s = P.addSlide();
  pageNo++;
  s.background = dark ? { color: C.dark } : { color: C.light };
  return s;
}
function footer(s) {
  s.addText("即现 · 让笔记开口说话", { x: M, y: 7.06, w: 4, h: 0.3, fontFace: FONT, fontSize: 12, color: C.foot, margin: 0 });
  s.addText(String(pageNo).padStart(2, "0"), { x: W - M - 1, y: 7.06, w: 1, h: 0.3, fontFace: FONT, fontSize: 12, color: C.foot, align: "right", margin: 0 });
}
function kicker(s, txt, dark = false) {
  s.addText(txt, { x: M, y: 0.5, w: 9, h: 0.3, fontFace: FONT, fontSize: 12.5, bold: true, color: C.accent, charSpacing: 2.5, margin: 0 });
}
function h1(s, txt, dark = false) {
  s.addText(txt, { x: M, y: 0.8, w: CW, h: 0.66, fontFace: FONT, fontSize: 31, bold: true, color: dark ? C.dtext : C.text, margin: 0 });
}
function header(s, k, t, dark = false) { kicker(s, k, dark); h1(s, t, dark); }
function hairline(s, x, y, w, color = C.hair) {
  s.addShape(P.shapes.LINE, { x, y, w, h: 0, line: { color, width: 0.75 } });
}
function chip(s, x, y, w, h, txt, o = {}) {
  s.addText(txt, {
    shape: P.shapes.ROUNDED_RECTANGLE, rectRadius: Math.min(0.09, h / 2), x, y, w, h,
    fill: { color: o.fill || C.tint, transparency: o.transparency ?? 0 },
    line: o.border ? { color: o.border, width: 1 } : { color: o.fill || C.tint, width: 0 },
    fontFace: o.mono ? MONO : FONT, fontSize: o.size || 12, bold: o.bold !== false,
    color: o.color || C.primary, align: "center", valign: "middle", margin: 0, charSpacing: o.spacing,
  });
}
function kbd(s, x, y, w, h, txt) {
  s.addText(txt, {
    shape: P.shapes.ROUNDED_RECTANGLE, rectRadius: 0.07, x, y, w, h,
    fill: { color: "FFFFFF" }, line: { color: "C9D8CF", width: 1.25 },
    shadow: { type: "outer", color: "1B2A22", blur: 3, offset: 1.5, angle: 90, opacity: 0.3 },
    fontFace: MONO, fontSize: 14.5, bold: true, color: C.text, align: "center", valign: "middle", margin: 0,
  });
}
function row(s, x, y, w, lead, desc, o = {}) {
  s.addText(lead, { x, y, w, h: 0.34, fontFace: FONT, fontSize: o.leadSize || 16.5, bold: true, color: o.leadColor || C.text, margin: 0 });
  s.addText(desc, { x, y: y + 0.37, w, h: 0.32, fontFace: FONT, fontSize: o.descSize || 13, color: o.descColor || C.muted, margin: 0 });
}
function bars(s, x, y, ws, o = {}) {
  const h = o.h || 0.09, gap = o.gap || 0.17, color = o.color || C.bar;
  ws.forEach((wd, i) => s.addShape(P.shapes.ROUNDED_RECTANGLE, { x, y: y + i * (h + gap), w: wd, h, fill: { color: o.colors ? o.colors[i] || color : color }, rectRadius: Math.min(0.045, h / 2) }));
}
function arrowR(s, x, y, len, color = C.accent, wd = 2) {
  s.addShape(P.shapes.LINE, { x, y, w: len, h: 0, line: { color, width: wd, endArrowType: "triangle" } });
}

/* ============ S1 封面 ============ */
(() => {
  const s = newSlide(true);
  s.addImage({ path: A("stage.jpg"), x: 0, y: 0, w: W, h: H, sizing: { type: "cover", w: W, h: H } });
  s.addImage({ path: A("scrim_cover.png"), x: 0, y: 0, w: W, h: H });
  // 顶部品牌行
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 0.66, y: 0.58, w: 1.0, h: 1.0, rectRadius: 0.16, fill: { color: "FFFFFF" }, shadow: sh() });
  s.addImage({ path: A("icon.png"), x: 0.78, y: 0.7, w: 0.76, h: 0.76 });
  s.addText("SIYUAN SLIDEV", { x: 1.88, y: 0.72, w: 4.5, h: 0.34, fontFace: FONT, fontSize: 14, bold: true, color: C.dtext, charSpacing: 3, margin: 0 });
  s.addText("生长在思源笔记里的现代演示插件", { x: 1.88, y: 1.08, w: 4.6, h: 0.3, fontFace: FONT, fontSize: 12.5, color: C.dmuted, margin: 0 });
  // 主标题区
  s.addText("思源笔记演示插件 · MIT 开源", { x: 0.7, y: 2.62, w: 8, h: 0.34, fontFace: FONT, fontSize: 14, bold: true, color: C.accent, charSpacing: 2.5, margin: 0 });
  s.addText("即现", { x: 0.62, y: 2.98, w: 6, h: 1.55, fontFace: FONT, fontSize: 76, bold: true, color: C.dtext, margin: 0 });
  s.addText("笔记即演示，内容即思想。", { x: 0.7, y: 4.72, w: 9, h: 0.55, fontFace: FONT, fontSize: 26, bold: true, color: C.dtext, margin: 0 });
  s.addText("一篇笔记，直接登台 —— 此刻，让它开口说话。", { x: 0.7, y: 5.42, w: 9, h: 0.36, fontFace: FONT, fontSize: 15, color: C.dmuted, margin: 0 });
  // 特性预览 chips
  const chips = ["正文零污染", "双引擎渲染", "双屏演讲", "离线交付"];
  chips.forEach((t, i) => chip(s, 0.7 + i * 1.98, 6.28, 1.78, 0.5, t, { fill: "FFFFFF", transparency: 86, border: "FFFFFF", size: 12.5, color: C.dtext }));
  s.addNotes("开场提问：从一篇笔记到一份能登台的 PPT，你通常要花多久？今天介绍的「即现」，就是要把这段时间还给创作者——让笔记自己开口说话。");
})();

/* ============ S2 深夜 23:00 ============ */
(() => {
  const s = newSlide();
  s.addImage({ path: A("night.jpg"), x: 7.42, y: 1.02, w: 5.29, h: 5.58, sizing: { type: "cover", w: 5.29, h: 5.58 }, shadow: sh() });
  header(s, "PAIN · 痛点场景", "深夜 23:00，汇报前夜");
  s.addText("笔记早已写好，幻灯片还一片空白。", { x: M, y: 1.58, w: 6.4, h: 0.4, fontFace: FONT, fontSize: 16.5, color: C.muted, margin: 0 });
  const rows = [
    ["机械搬运", "从思源复制、粘贴、重排，重复到麻木"],
    ["格式拉扯", "字体与配色反复调整，时间悄悄溜走"],
    ["立刻过时", "笔记刚改一段，PPT 沦为过时孤岛"],
    ["灵魂拷问", "内容明明都在，为什么还要再搬一遍？"],
  ];
  rows.forEach((r, i) => {
    const y = 2.42 + i * 1.06;
    row(s, M, y, 6.5, r[0], r[1], i === 3 ? { leadColor: C.accentDeep } : {});
    if (i < 3) hairline(s, M, y + 0.86, 6.5);
  });
  footer(s);
  s.addNotes("描绘场景：笔记早就写完，幻灯片还一片空白；复制、粘贴、调格式到深夜。最无奈的是笔记一改，PPT 立刻过时。抛出问题：内容明明都在，为什么还要再搬一遍？");
})();

/* ============ S3 工具的割裂 ============ */
(() => {
  const s = newSlide();
  header(s, "WHY · 根源剖析", "这不是你的问题，是工具的割裂");
  // 左侧：割裂示意图
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: 2.28, w: 2.32, h: 1.62, rectRadius: 0.1, fill: { color: C.tint }, shadow: shSoft() });
  s.addText([
    { text: "思源笔记", options: { fontSize: 17, bold: true, color: C.text, breakLine: true } },
    { text: "内容都在这里", options: { fontSize: 12.5, color: C.muted } },
  ], { x: M, y: 2.28, w: 2.32, h: 1.62, align: "center", valign: "middle", fontFace: FONT, margin: 0 });
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 3.98, y: 2.28, w: 2.32, h: 1.62, rectRadius: 0.1, fill: { color: C.tintSoft }, line: { color: C.hair, width: 1 }, shadow: shSoft() });
  s.addText([
    { text: "演示文稿", options: { fontSize: 17, bold: true, color: C.text, breakLine: true } },
    { text: "还得从头再来", options: { fontSize: 12.5, color: C.muted } },
  ], { x: 3.98, y: 2.28, w: 2.32, h: 1.62, align: "center", valign: "middle", fontFace: FONT, margin: 0 });
  s.addShape(P.shapes.LINE, { x: 3.06, y: 3.09, w: 0.8, h: 0, line: { color: C.accent, width: 1.75, dashType: "dash" } });
  s.addShape(P.shapes.OVAL, { x: 3.28, y: 2.9, w: 0.38, h: 0.38, fill: { color: C.light }, line: { color: C.accent, width: 1.5 } });
  s.addText("✕", { x: 3.28, y: 2.9, w: 0.38, h: 0.38, fontFace: FONT, fontSize: 13, bold: true, color: C.accentDeep, align: "center", valign: "middle", margin: 0 });
  s.addText("每次搬运：复制 → 粘贴 → 重排 → 格式拉扯", { x: M, y: 4.28, w: 5.7, h: 0.34, fontFace: FONT, fontSize: 13, color: C.muted, margin: 0 });
  s.addText("笔记一改，PPT 立刻过时。", { x: M, y: 4.68, w: 5.7, h: 0.4, fontFace: FONT, fontSize: 15.5, bold: true, color: C.accentDeep, margin: 0 });
  s.addText("内容割裂不是偶然 —— 传统工具从设计上就把「写作」和「演示」当成了两件事。", { x: M, y: 5.5, w: 5.55, h: 0.9, fontFace: FONT, fontSize: 13, color: C.muted, margin: 0 });
  // 右侧：四宗罪
  const rows = [
    ["内容割裂", "笔记一份、幻灯片一份，人人都是搬运工"],
    ["正文污染", "配置代码混进 Markdown，笔记不再纯净"],
    ["门槛高筑", "酷炫动效背后，是 Node 与命令行的高墙"],
    ["表现贫瘠", "代码错乱、列表平铺，听众悄然走神"],
  ];
  rows.forEach((r, i) => {
    const y = 1.98 + i * 1.18;
    s.addText(String(i + 1).padStart(2, "0"), { x: 6.72, y: y + 0.02, w: 0.7, h: 0.5, fontFace: MONO, fontSize: 20, bold: true, color: C.primBright, margin: 0 });
    row(s, 7.52, y, 5.2, r[0], r[1]);
    if (i < 3) hairline(s, 6.72, y + 0.94, 6.0);
  });
  footer(s);
  s.addNotes("安抚听众：这不是你不够努力，而是工具天生割裂。逐条点出四宗罪：内容两份、正文污染、环境门槛、表现力不足。结论：问题不在人，在工具。");
})();

/* ============ S4 转折（暗） ============ */
(() => {
  const s = newSlide(true);
  s.addImage({ path: A("bg_dark.png"), x: 0, y: 0, w: W, h: H });
  s.addText("不复制、不粘贴、不重排。", { x: 0, y: 1.78, w: W, h: 0.45, align: "center", fontFace: FONT, fontSize: 19, color: C.dmuted, margin: 0 });
  s.addText("如果，笔记本身就是幻灯片？", { x: 0, y: 2.4, w: W, h: 1.1, align: "center", fontFace: FONT, fontSize: 46, bold: true, color: C.dtext, margin: 0 });
  // 复古三连划线 chips + 箭头
  const olds = ["复制", "粘贴", "重排"];
  olds.forEach((t, i) => {
    s.addText(t, { shape: P.shapes.ROUNDED_RECTANGLE, rectRadius: 0.09, x: 3.62 + i * 1.3, y: 4.06, w: 1.04, h: 0.52, fill: { color: C.darkCard }, line: { color: C.darkLine, width: 1 }, fontFace: FONT, fontSize: 15, color: C.dmuted, strike: true, align: "center", valign: "middle", margin: 0 });
  });
  arrowR(s, 7.72, 4.32, 0.9, C.accent, 2.25);
  s.addText("写下即所得，点开即放映。", { x: 8.82, y: 4.02, w: 4.2, h: 0.6, fontFace: FONT, fontSize: 21, bold: true, color: C.accent, valign: "middle", margin: 0 });
  s.addText([
    { text: "即现", options: { bold: true, color: C.primBright } },
    { text: "（SiYuan Slidev），由此而生 —— 取「想法即现、即刻呈现」之意。", options: { color: C.dmuted } },
  ], { x: 0, y: 5.5, w: W, h: 0.5, align: "center", fontFace: FONT, fontSize: 17, margin: 0 });
  s.addNotes("放慢语速，抛出核心转折：如果笔记本身就是幻灯片呢？解释命名：即现，取「想法即现、即刻呈现」之意。");
})();

/* ============ S5 正文零污染 ============ */
(() => {
  const s = newSlide();
  header(s, "ZERO POLLUTION · 核心理念", "正文零污染：配置沉淀在块属性");
  // 左：纯净文档示意
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.86, w: 5.55, h: 3.72, rectRadius: 0.1, fill: { color: C.light }, line: { color: C.hair, width: 1 }, shadow: sh() });
  s.addText("我的分享笔记.md", { x: 0.95, y: 2.1, w: 3.2, h: 0.32, fontFace: MONO, fontSize: 12.5, bold: true, color: C.muted, margin: 0 });
  chip(s, 4.62, 2.06, 1.28, 0.4, "✓ 100% 纯净", { fill: "E7F5EE", color: C.primary, size: 11.5 });
  hairline(s, M, 2.62, 5.55);
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 0.95, y: 2.88, w: 2.5, h: 0.17, fill: { color: "B9CCC2" }, rectRadius: 0.05 });
  bars(s, 0.95, 3.32, [4.85, 4.5, 4.72, 3.9, 4.6], { gap: 0.24, h: 0.11 });
  s.addText("正文一字不改，导出、移动端阅读零乱码", { x: 0.95, y: 5.02, w: 4.9, h: 0.32, fontFace: FONT, fontSize: 12.5, color: C.muted, margin: 0 });
  // 右：IAL 属性面板示意
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 6.62, y: 1.86, w: 6.09, h: 3.72, rectRadius: 0.1, fill: { color: C.darkCard }, shadow: sh() });
  s.addText("块属性 · IAL", { x: 6.98, y: 2.1, w: 2.5, h: 0.32, fontFace: FONT, fontSize: 13, bold: true, color: C.dtext, margin: 0 });
  chip(s, 10.52, 2.06, 1.85, 0.4, "custom-slidev-*", { mono: true, fill: C.darkLine, color: C.accent, size: 11.5 });
  hairline(s, 6.62, 2.62, 6.09, C.darkLine);
  const attrs = [
    ["layout", '"cover"'],
    ["transition", '"slide-left"'],
    ["click", '"+1"'],
    ["shiki-lines", '"1-3|5"'],
    ["notes", '"开场 30 秒，抛出问题…"'],
  ];
  attrs.forEach((a, i) => {
    s.addText([
      { text: "custom-slidev-" + a[0], options: { color: C.primBright } },
      { text: "  :  " + a[1], options: { color: C.accent } },
    ], { x: 6.98, y: 2.84 + i * 0.51, w: 5.5, h: 0.4, fontFace: MONO, fontSize: 13.5, margin: 0 });
  });
  // 底部结论
  s.addText("版式、转场、动画、提词 —— 全部进属性，正文不增一行代码。", { x: M, y: 5.85, w: CW, h: 0.42, align: "center", fontFace: FONT, fontSize: 16.5, bold: true, color: C.text, margin: 0 });
  const chips = ["版式 · 转场 · 动画 → 块属性", "演讲提词 → 私有备注", "导出 Markdown → 依旧纯净"];
  chips.forEach((t, i) => chip(s, M + i * 4.18, 6.45, 3.9, 0.5, t, { size: 13 }));
  footer(s);
  s.addNotes("强调第一条设计原则：正文零污染。配置全部进块属性，提词进私有备注；Markdown 一字不改，导出纯净、移动端零乱码。");
})();

/* ============ S6 双引擎 ============ */
(() => {
  const s = newSlide();
  header(s, "DUAL ENGINE · 渲染架构", "双引擎：开箱即用，极客留门");
  // 卡 A：Web 沙箱
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.86, w: 5.9, h: 4.42, rectRadius: 0.12, fill: { color: C.tint }, shadow: shSoft() });
  chip(s, 0.94, 2.14, 2.1, 0.44, "默认引擎 · 开箱即用", { fill: C.primary, color: "FFFFFF", size: 12 });
  s.addText("内置 Web 沙箱", { x: 0.94, y: 2.72, w: 5.2, h: 0.52, fontFace: FONT, fontSize: 23, bold: true, color: C.text, margin: 0 });
  s.addText([
    { text: "0 依赖", options: { fontSize: 44, bold: true, color: C.primary } },
    { text: "   免装 Node / CLI", options: { fontSize: 15, color: C.muted } },
  ], { x: 0.94, y: 3.36, w: 5.2, h: 0.85, fontFace: FONT, margin: 0 });
  s.addText("纯前端渲染，毫秒级即开即放。", { x: 0.94, y: 4.26, w: 5.2, h: 0.34, fontFace: FONT, fontSize: 13.5, color: C.muted, margin: 0 });
  hairline(s, 0.94, 4.78, 5.26);
  ["临时电脑、移动办公，打开就能放映", "版式 · 动效 · 转场 · 导出全功能内置", "无网络环境同样完成创作与排练"].forEach((t, i) => {
    s.addShape(P.shapes.OVAL, { x: 0.98, y: 5.06 + i * 0.4 + 0.07, w: 0.09, h: 0.09, fill: { color: C.primary } });
    s.addText(t, { x: 1.22, y: 5.02 + i * 0.4, w: 5.0, h: 0.34, fontFace: FONT, fontSize: 13, color: C.text, margin: 0 });
  });
  // 卡 B：Pro 模式
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 6.82, y: 1.86, w: 5.9, h: 4.42, rectRadius: 0.12, fill: { color: C.darkCard }, shadow: sh() });
  chip(s, 7.14, 2.14, 1.7, 0.44, "极客模式 · Pro", { fill: C.accent, color: "231A05", size: 12 });
  s.addText("桥接本地 Slidev CLI", { x: 7.14, y: 2.72, w: 5.3, h: 0.52, fontFace: FONT, fontSize: 23, bold: true, color: C.dtext, margin: 0 });
  s.addText([
    { text: "3030", options: { fontSize: 44, bold: true, color: C.accent, fontFace: MONO } },
    { text: "   本地 DevServer 端口", options: { fontSize: 15, color: C.dmuted } },
  ], { x: 7.14, y: 3.36, w: 5.3, h: 0.85, fontFace: FONT, margin: 0 });
  s.addText("一键桥接，深度定制不设上限。", { x: 7.14, y: 4.26, w: 5.3, h: 0.34, fontFace: FONT, fontSize: 13.5, color: C.dmuted, margin: 0 });
  hairline(s, 7.14, 4.78, 5.26, C.darkLine);
  ["Vue 组件级定制，表现力无上限", "完整 Slidev 生态与主题体系", "同一份笔记，热更新实时预览"].forEach((t, i) => {
    s.addShape(P.shapes.OVAL, { x: 7.18, y: 5.06 + i * 0.4 + 0.07, w: 0.09, h: 0.09, fill: { color: C.accent } });
    s.addText(t, { x: 7.42, y: 5.02 + i * 0.4, w: 5.0, h: 0.34, fontFace: FONT, fontSize: 13, color: C.dtext, margin: 0 });
  });
  s.addText("同一份笔记，新手与极客各得其所。", { x: M, y: 6.52, w: CW, h: 0.4, align: "center", fontFace: FONT, fontSize: 16, bold: true, color: C.text, margin: 0 });
  footer(s);
  s.addNotes("双引擎策略：默认 Web 沙箱零依赖，打开就能放；极客切 Pro 模式桥接本地 CLI。一句话：新手有简单的门，极客有无尽的路。");
})();

/* ============ S7 面板点选 ============ */
(() => {
  const s = newSlide();
  header(s, "NO SYNTAX · 零语法", "排版交给面板，动效一键即得");
  const rows = [
    ["九宫格版式", "封面、双栏、金句大字报……点选即套用"],
    ["v-click 渐进", "列表逐项浮现，演讲节奏尽在掌握"],
    ["Shiki 代码聚光", "讲到哪一行，哪一行点亮"],
    ["丝滑转场", "滑入、淡入、缩放，页面自然流动"],
  ];
  rows.forEach((r, i) => {
    const y = 1.98 + i * 1.08;
    row(s, M, y, 5.4, r[0], r[1]);
    if (i < 3) hairline(s, M, y + 0.86, 5.4);
  });
  chip(s, M, 6.35, 3.3, 0.5, "全程点选 · 零语法记忆", { fill: C.accentTint, color: C.accentDeep, size: 13 });
  // 右侧：配置面板示意
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 6.42, y: 1.72, w: 6.29, h: 4.95, rectRadius: 0.1, fill: { color: C.light }, line: { color: C.hair, width: 1 }, shadow: sh() });
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 6.42, y: 1.72, w: 6.29, h: 0.56, rectRadius: 0.1, fill: { color: C.tintSoft } });
  s.addShape(P.shapes.RECTANGLE, { x: 6.42, y: 2.08, w: 6.29, h: 0.2, fill: { color: C.tintSoft }, line: { color: C.tintSoft, width: 0 } });
  s.addText("即现演示配置 · 本页设置", { x: 6.74, y: 1.83, w: 3.6, h: 0.34, fontFace: FONT, fontSize: 13, bold: true, color: C.text, margin: 0 });
  s.addText("第 2 页 · 分割线", { x: 10.4, y: 1.85, w: 2.0, h: 0.32, fontFace: FONT, fontSize: 11.5, color: C.muted, align: "right", margin: 0 });
  const tiles = ["封面", "标准", "双栏", "过渡", "金句大字报", "居中", "引用", "致谢", "＋ 分页符"];
  tiles.forEach((t, i) => {
    const cx = 6.74 + (i % 3) * 1.94, cy = 2.5 + Math.floor(i / 3) * 1.02;
    const hot = i === 4;
    s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: cx, y: cy, w: 1.78, h: 0.86, rectRadius: 0.08, fill: { color: hot ? C.accentTint : C.tintSoft }, line: { color: hot ? C.accent : C.hair, width: hot ? 1.75 : 1 } });
    s.addText(t, { x: cx, y: cy, w: 1.78, h: 0.86, align: "center", valign: "middle", fontFace: FONT, fontSize: 12.5, bold: hot, color: hot ? C.accentDeep : C.muted, margin: 0 });
  });
  s.addText("元素动效", { x: 6.74, y: 5.72, w: 1.5, h: 0.32, fontFace: FONT, fontSize: 12, bold: true, color: C.muted, margin: 0 });
  chip(s, 8.06, 5.68, 1.06, 0.4, "v-click +1", { mono: true, size: 11.5 });
  chip(s, 9.24, 5.68, 1.3, 0.4, "Shiki 1-3|5", { mono: true, size: 11.5 });
  chip(s, 10.66, 5.68, 1.66, 0.4, "转场 slide-left", { mono: true, size: 11.5, color: C.accentDeep, fill: C.accentTint, border: C.accent });
  s.addText("右侧面板随光标实时聚焦当前块", { x: 6.42, y: 6.82, w: 6.29, h: 0.3, align: "center", fontFace: FONT, fontSize: 12, color: C.muted, margin: 0 });
  footer(s);
  s.addNotes("演示面板操作：九宫格选版式、一键 v-click、代码逐行聚光、转场点选。强调全程无需记忆任何语法。");
})();

/* ============ S8 上下分屏 ============ */
(() => {
  const s = newSlide();
  header(s, "LIVE SYNC · 双向联动", "上下分屏，双向联动");
  // 上：笔记编辑器
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 0.92, y: 1.62, w: 11.49, h: 1.78, rectRadius: 0.1, fill: { color: C.light }, line: { color: C.hair, width: 1 }, shadow: sh() });
  s.addText("思源笔记 · 编辑区", { x: 1.24, y: 1.78, w: 3, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.muted, margin: 0 });
  chip(s, 10.6, 1.74, 1.5, 0.38, "光标 · 第 3 段", { fill: C.accentTint, color: C.accentDeep, size: 11.5 });
  bars(s, 1.24, 2.26, [6.6, 8.9, 7.6], { h: 0.12, gap: 0.28, colors: [C.bar, C.accent, C.bar] });
  s.addShape(P.shapes.LINE, { x: 1.24, y: 2.63, w: 0.02, h: 0.24, line: { color: C.accentDeep, width: 2 } });
  // 中部：双向箭头
  s.addShape(P.shapes.LINE, { x: 3.4, y: 3.48, w: 0, h: 0.86, line: { color: C.primBright, width: 2.25, endArrowType: "triangle" } });
  s.addText("光标落到哪段，预览即刻翻到哪页", { x: 3.62, y: 3.72, w: 3.6, h: 0.36, fontFace: FONT, fontSize: 13.5, bold: true, color: C.primDeep, margin: 0 });
  s.addShape(P.shapes.LINE, { x: 9.9, y: 3.48, w: 0, h: 0.86, flipV: true, line: { color: C.accent, width: 2.25, endArrowType: "triangle" } });
  s.addText("点击幻灯片元素，编辑器反向定位", { x: 6.5, y: 3.72, w: 3.24, h: 0.36, align: "right", fontFace: FONT, fontSize: 13.5, bold: true, color: C.accentDeep, margin: 0 });
  // 下：幻灯片预览
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 0.92, y: 4.42, w: 11.49, h: 1.78, rectRadius: 0.1, fill: { color: C.darkCard }, shadow: sh() });
  s.addText("即现演示 · 实时预览", { x: 1.24, y: 4.58, w: 3, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.dmuted, margin: 0 });
  chip(s, 10.6, 4.54, 1.5, 0.38, "第 3 页 · 同步", { fill: C.darkLine, color: C.primBright, size: 11.5 });
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 4.52, y: 4.94, w: 4.3, h: 1.06, rectRadius: 0.06, fill: { color: C.light } });
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 4.72, y: 5.1, w: 1.7, h: 0.11, fill: { color: "B9CCC2" }, rectRadius: 0.04 });
  bars(s, 4.72, 5.36, [3.9, 3.3, 2.6], { h: 0.09, gap: 0.14, colors: [C.bar, C.accent, C.bar] });
  s.addText("毫秒级渲染，改完即见", { x: 9.1, y: 5.28, w: 3.1, h: 0.34, fontFace: FONT, fontSize: 12.5, color: C.dmuted, margin: 0 });
  // 底部要点
  const pts = ["边讲边改，画面即时刷新", "打字即排版，所见即所得", "上方笔记 · 下方幻灯片"];
  pts.forEach((t, i) => chip(s, M + i * 4.18, 6.5, 3.9, 0.5, t, { size: 13 }));
  footer(s);
  s.addNotes("演示分屏联动：光标移动，预览跟翻；点击幻灯片，编辑器反向定位。一句话：打字即排版，所见即所得。");
})();

/* ============ S9 双屏演讲 ============ */
(() => {
  const s = newSlide();
  header(s, "PRESENTER · 从容登台", "双屏演讲，按下 P 开启导播间");
  s.addImage({ path: A("stage.jpg"), x: M, y: 1.72, w: 3.92, h: 4.86, sizing: { type: "cover", w: 3.92, h: 4.86 }, shadow: sh() });
  s.addShape(P.shapes.RECTANGLE, { x: M, y: 5.94, w: 3.92, h: 0.64, fill: { color: "0A0F0C", transparency: 30 } });
  s.addText("观众看到的，是纯净的大屏", { x: 0.82, y: 6.06, w: 3.6, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: C.dtext, margin: 0 });
  // 演讲者控制台示意
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 4.9, y: 1.72, w: 7.81, h: 3.18, rectRadius: 0.1, fill: { color: C.darkCard }, shadow: sh() });
  s.addText("演讲者控制台", { x: 5.22, y: 1.9, w: 3, h: 0.32, fontFace: FONT, fontSize: 13, bold: true, color: C.dtext, margin: 0 });
  kbd(s, 11.98, 1.86, 0.52, 0.42, "P");
  s.addText("12:47", { x: 5.22, y: 2.42, w: 2.0, h: 0.75, fontFace: MONO, fontSize: 38, bold: true, color: C.accent, margin: 0 });
  s.addText("演讲计时 · 预计 15:00", { x: 5.22, y: 3.2, w: 2.2, h: 0.3, fontFace: FONT, fontSize: 12, color: C.dmuted, margin: 0 });
  // 当前页 / 下一页 缩略
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 7.62, y: 2.38, w: 2.16, h: 1.24, rectRadius: 0.06, fill: { color: C.light } });
  bars(s, 7.82, 2.62, [1.7, 1.5, 1.1], { h: 0.08, gap: 0.14 });
  s.addText("当前页 · P3", { x: 7.62, y: 3.66, w: 2.16, h: 0.28, align: "center", fontFace: FONT, fontSize: 11.5, color: C.dmuted, margin: 0 });
  arrowR(s, 9.9, 3.0, 0.32, C.primBright, 2);
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 10.34, y: 2.38, w: 2.16, h: 1.24, rectRadius: 0.06, fill: { color: C.light }, line: { color: C.accent, width: 1.25, dashType: "dash" } });
  bars(s, 10.54, 2.62, [1.6, 1.3], { h: 0.08, gap: 0.14 });
  s.addText("下一页预告 · P4", { x: 10.34, y: 3.66, w: 2.16, h: 0.28, align: "center", fontFace: FONT, fontSize: 11.5, color: C.dmuted, margin: 0 });
  // 提词卡
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 5.22, y: 4.02, w: 7.28, h: 0.72, rectRadius: 0.06, fill: { color: C.darkLine } });
  s.addText([
    { text: "「接下来这页，我们看第二组数据……」", options: { color: C.dtext, fontSize: 13.5, bold: true } },
    { text: "   AI 过渡引导词 · 已写入本页提词", options: { color: C.dmuted, fontSize: 11.5 } },
  ], { x: 5.44, y: 4.02, w: 6.9, h: 0.72, valign: "middle", fontFace: FONT, margin: 0 });
  // 特性行
  const rows = [
    ["主屏纯净放映", "你的屏幕掌控全局，观众只看内容"],
    ["大字号提词卡", "忘词，从此只是传说"],
    ["计时器 + 下一页预告", "节奏与内容，一屏尽览"],
    ["BroadcastChannel 双屏同步", "毫秒级广播，翻页零延迟"],
  ];
  rows.forEach((r, i) => {
    const y = 5.18 + i * 0.44;
    s.addShape(P.shapes.OVAL, { x: 4.94, y: y + 0.1, w: 0.09, h: 0.09, fill: { color: C.accent } });
    s.addText([
      { text: r[0] + "　", options: { bold: true, color: C.text } },
      { text: r[1], options: { color: C.muted } },
    ], { x: 5.18, y, w: 7.5, h: 0.36, fontFace: FONT, fontSize: 13.5, margin: 0 });
  });
  footer(s);
  s.addNotes("现场演示演讲者视图：按 P 呼出控制台。观众看大屏，你看计时器、下一页预告和提词卡。笑点：从此忘词只是传说。");
})();

/* ============ S10 AI 加持 ============ */
(() => {
  const s = newSlide();
  header(s, "AI POWERED · 五分钟成稿", "AI 加持：一篇长笔记，直接变演讲稿");
  // 输入节点
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: 2.62, w: 1.98, h: 1.6, rectRadius: 0.1, fill: { color: C.tintSoft }, line: { color: C.hair, width: 1 }, shadow: shSoft() });
  s.addText([
    { text: "一篇长笔记", options: { fontSize: 15.5, bold: true, color: C.text, breakLine: true } },
    { text: "调研 / 复盘 / 讲义", options: { fontSize: 11.5, color: C.muted } },
  ], { x: M, y: 2.62, w: 1.98, h: 1.6, align: "center", valign: "middle", fontFace: FONT, margin: 0 });
  arrowR(s, 2.72, 3.42, 0.28);
  // 三步
  const steps = [
    ["01", "智能分页", "读懂长文层级，在合适位置自动插入分页线"],
    ["02", "动效注入", "识别列表递进逻辑，自动配好 v-click"],
    ["03", "提词生成", "从内容提炼口播引导词，写入私有提词"],
  ];
  steps.forEach((st, i) => {
    const x = 3.14 + i * 2.52;
    s.addShape(P.shapes.ROUNDED_RECTANGLE, { x, y: 2.28, w: 2.32, h: 2.3, rectRadius: 0.1, fill: { color: C.tint }, shadow: shSoft() });
    s.addText(st[0], { x: x + 0.26, y: 2.5, w: 1, h: 0.4, fontFace: MONO, fontSize: 17, bold: true, color: C.accent, margin: 0 });
    s.addText(st[1], { x: x + 0.26, y: 2.96, w: 1.9, h: 0.4, fontFace: FONT, fontSize: 17.5, bold: true, color: C.text, margin: 0 });
    s.addText(st[2], { x: x + 0.26, y: 3.44, w: 1.84, h: 1.0, fontFace: FONT, fontSize: 12.5, color: C.muted, margin: 0 });
    if (i < 2) arrowR(s, x + 2.36, 3.42, 0.14);
  });
  arrowR(s, 10.7, 3.42, 0.28);
  // 输出节点
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 11.06, y: 2.62, w: 1.66, h: 1.6, rectRadius: 0.1, fill: { color: C.primary }, shadow: shSoft() });
  s.addText([
    { text: "登台开讲", options: { fontSize: 15.5, bold: true, color: "FFFFFF", breakLine: true } },
    { text: "全功能放映", options: { fontSize: 11.5, color: "D9EFE5" } },
  ], { x: 11.06, y: 2.62, w: 1.66, h: 1.6, align: "center", valign: "middle", fontFace: FONT, margin: 0 });
  // 底部大数字
  s.addText([
    { text: "≈ 5 分钟", options: { fontSize: 42, bold: true, color: C.accent } },
    { text: "   一杯咖啡的时间，从笔记到演讲稿", options: { fontSize: 17, color: C.text } },
  ], { x: 0, y: 5.15, w: W, h: 0.95, align: "center", valign: "middle", fontFace: FONT, margin: 0 });
  s.addText("AI 工具栏随文档面板一键触发，结果全部可人工微调", { x: 0, y: 6.28, w: W, h: 0.34, align: "center", fontFace: FONT, fontSize: 12.5, color: C.muted, margin: 0 });
  footer(s);
  s.addNotes("AI 三件事：自动分页、自动配动效、自动生成提词。一句话收尾：一杯咖啡的时间，从笔记到演讲稿。");
})();

/* ============ S11 离线交付 ============ */
(() => {
  const s = newSlide();
  s.addImage({ path: A("plane.jpg"), x: 7.62, y: 1.02, w: 5.09, h: 5.58, sizing: { type: "cover", w: 5.09, h: 5.58 }, shadow: sh() });
  header(s, "OFFLINE · 离线交付", "无网、无思源，演示永不掉线");
  const cards = [
    [".html", "单文件独立 HTML", "脚本、样式、数据、图片全部内联 —— 双击即放映，任何浏览器全功能播放"],
    [".pdf", "高保真 PDF 讲义", "16:9 横版高清输出，随心打印分发，会后资料一键归档"],
  ];
  cards.forEach((c, i) => {
    const y = 1.98 + i * 1.86;
    s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y, w: 6.55, h: 1.62, rectRadius: 0.1, fill: { color: i === 0 ? C.tint : C.tintSoft }, line: { color: C.hair, width: 1 }, shadow: shSoft() });
    chip(s, 0.9, y + 0.24, 0.98, 0.44, c[0], { mono: true, fill: i === 0 ? C.primary : C.primDeep, color: "FFFFFF", size: 12.5 });
    s.addText(c[1], { x: 2.06, y: y + 0.2, w: 4.9, h: 0.44, fontFace: FONT, fontSize: 17.5, bold: true, color: C.text, valign: "middle", margin: 0 });
    s.addText(c[2], { x: 0.9, y: y + 0.78, w: 5.9, h: 0.68, fontFace: FONT, fontSize: 13, color: C.muted, margin: 0 });
  });
  s.addText([
    { text: "涉密会议室、万米高空、借来的电脑 —— ", options: { color: C.muted } },
    { text: "发出去的文件，就是整场演讲。", options: { bold: true, color: C.primDeep } },
  ], { x: M, y: 5.95, w: 6.6, h: 0.6, fontFace: FONT, fontSize: 14.5, margin: 0 });
  footer(s);
  s.addNotes("讲场景：涉密会议室、万米高空、借别人的电脑。解法：单文件 HTML 双击即放，或导出 PDF 讲义。");
})();

/* ============ S12 一键迁入 ============ */
(() => {
  const s = newSlide();
  header(s, "MIGRATION · 老项目迁入", "已有 Slidev 项目？一键迁入思源");
  const steps = [
    ["01", "拖入导入", "拖拽 .md / .zip 或直接粘贴源码，自动建稿"],
    ["02", "自动预检", "解析总页数、主题、版式与静态资产清单"],
    ["03", "资产转存", "图片转存 assets/ 库，路径智能重写"],
    ["04", "容器还原", "复杂 HTML 容器，自动还原为原生块"],
  ];
  steps.forEach((st, i) => {
    const x = M + i * 3.02;
    s.addShape(P.shapes.ROUNDED_RECTANGLE, { x, y: 2.12, w: 2.62, h: 2.62, rectRadius: 0.1, fill: { color: C.tintSoft }, line: { color: C.hair, width: 1 }, shadow: shSoft() });
    s.addShape(P.shapes.OVAL, { x: x + 0.26, y: 2.38, w: 0.52, h: 0.52, fill: { color: C.primary } });
    s.addText(st[0], { x: x + 0.26, y: 2.38, w: 0.52, h: 0.52, align: "center", valign: "middle", fontFace: MONO, fontSize: 14, bold: true, color: "FFFFFF", margin: 0 });
    s.addText(st[1], { x: x + 0.26, y: 3.06, w: 2.1, h: 0.42, fontFace: FONT, fontSize: 17.5, bold: true, color: C.text, margin: 0 });
    s.addText(st[2], { x: x + 0.26, y: 3.54, w: 2.14, h: 1.0, fontFace: FONT, fontSize: 12.5, color: C.muted, margin: 0 });
    if (i < 3) arrowR(s, x + 2.68, 3.42, 0.28);
  });
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: M, y: 5.3, w: CW, h: 1.0, rectRadius: 0.1, fill: { color: C.tint } });
  s.addText([
    { text: "老项目零门槛迁移，从此与笔记同源。", options: { bold: true, color: C.primDeep, fontSize: 17 } },
    { text: "  版式、图片、容器全部自动处理，老资产不浪费。", options: { color: C.muted, fontSize: 13.5 } },
  ], { x: M + 0.4, y: 5.3, w: CW - 0.8, h: 1.0, valign: "middle", fontFace: FONT, margin: 0 });
  footer(s);
  s.addNotes("面向老用户：Slidev 项目拖进来即可迁移，版式、图片、容器自动处理。一句话：老资产不浪费，从此与笔记同源。");
})();

/* ============ S13 谁在用 ============ */
(() => {
  const s = newSlide();
  header(s, "WHO · 用户场景", "谁在用即现？");
  const cards = [
    ["CODE", "技术分享", "代码逐行聚光，架构图随讲述渐次浮现"],
    ["THESIS", "学术答辩", "公式严谨排版，提词从容，推导不冷场"],
    ["REPORT", "工作汇报", "周报即取即用，要点随节奏渐进入场"],
    ["WORKSHOP", "研讨共创", "边讲边记，现场反馈毫秒级即时上屏"],
  ];
  cards.forEach((c, i) => {
    const x = M + i * 3.075;
    s.addShape(P.shapes.ROUNDED_RECTANGLE, { x, y: 2.14, w: 2.88, h: 3.3, rectRadius: 0.12, fill: { color: i % 2 ? C.tintSoft : C.tint }, line: { color: C.hair, width: 1 }, shadow: shSoft() });
    chip(s, x + 0.3, 2.46, 1.42, 0.42, c[0], { fill: C.accentTint, color: C.accentDeep, size: 11.5, spacing: 1.5 });
    s.addText(c[1], { x: x + 0.3, y: 3.06, w: 2.3, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: C.text, margin: 0 });
    hairline(s, x + 0.3, 3.68, 2.28);
    s.addText(c[2], { x: x + 0.3, y: 3.88, w: 2.28, h: 1.4, fontFace: FONT, fontSize: 13, color: C.muted, lineSpacingMultiple: 1.25, valign: "top", margin: 0 });
  });
  s.addText("问问在场的朋友：你属于哪一类？", { x: 0, y: 5.95, w: W, h: 0.36, align: "center", fontFace: FONT, fontSize: 14, color: C.muted, margin: 0 });
  footer(s);
  s.addNotes("逐个点名四类用户：技术分享、学术答辩、工作汇报、研讨共创。互动：问问在场听众属于哪一类。");
})();

/* ============ S14 三句话（暗） ============ */
(() => {
  const s = newSlide(true);
  s.addImage({ path: A("bg_dark.png"), x: 0, y: 0, w: W, h: H });
  kicker(s, "TAKEAWAYS · 记住即现", true);
  const rows = [
    ["01", "省下时间", "内容只写一遍，排版交给插件"],
    ["02", "提升质感", "现代动效，让想法被认真对待"],
    ["03", "守住纯粹", "笔记依旧干净，演示随心而变"],
  ];
  rows.forEach((r, i) => {
    const y = 1.72 + i * 1.62;
    s.addText(r[0], { x: 1.06, y, w: 1.5, h: 1.1, fontFace: MONO, fontSize: 54, bold: true, color: C.accent, margin: 0 });
    s.addText(r[1], { x: 2.9, y: y + 0.08, w: 4.4, h: 0.66, fontFace: FONT, fontSize: 30, bold: true, color: C.dtext, margin: 0 });
    s.addText(r[2], { x: 7.4, y: y + 0.24, w: 5.0, h: 0.5, fontFace: FONT, fontSize: 16, color: C.dmuted, margin: 0 });
    if (i < 2) hairline(s, 1.06, y + 1.3, 11.2, C.darkLine);
  });
  s.addText("核心只有一句：内容只写一遍，其余交给插件。", { x: 0, y: 6.66, w: W, h: 0.4, align: "center", fontFace: FONT, fontSize: 15, bold: true, color: C.primBright, margin: 0 });
  s.addNotes("放慢节奏，总结三句话：省下时间、提升质感、守住纯粹。核心重复：内容只写一遍，其余交给插件。");
})();

/* ============ S15 上手 ============ */
(() => {
  const s = newSlide();
  header(s, "GET STARTED · 三十秒上手", "现在，轮到你了");
  const steps = [
    [["Alt+P"], "顶栏点「即现演示」，分屏预览即刻开启"],
    [["---"], "输入三横线分页，面板点选版式与动效"],
    [["F", "P"], "F 全屏放映，P 呼出演讲者控制台"],
    [[".html"], "一键导出单文件 HTML，随处分发"],
  ];
  steps.forEach((st, i) => {
    const x = M + i * 3.02;
    s.addShape(P.shapes.ROUNDED_RECTANGLE, { x, y: 2.06, w: 2.62, h: 3.16, rectRadius: 0.1, fill: { color: C.tintSoft }, line: { color: C.hair, width: 1 }, shadow: shSoft() });
    s.addText("STEP " + (i + 1), { x: x + 0.26, y: 2.3, w: 2.0, h: 0.3, fontFace: MONO, fontSize: 12, bold: true, color: C.accent, charSpacing: 1.5, margin: 0 });
    const keys = st[0];
    const kw = keys.length > 1 ? 1.0 : 1.34;
    keys.forEach((k, j) => kbd(s, x + 0.26 + j * (kw + 0.16), 2.76, kw, 0.56, k));
    s.addText(st[1], { x: x + 0.26, y: 3.62, w: 2.14, h: 1.4, fontFace: FONT, fontSize: 13.5, color: C.text, lineSpacingMultiple: 1.25, valign: "top", margin: 0 });
  });
  s.addText([
    { text: "现在就打开思源笔记，开启第一场即现演示。", options: { bold: true, color: C.primDeep, fontSize: 17 } },
  ], { x: 0, y: 5.68, w: W, h: 0.44, align: "center", fontFace: FONT, margin: 0 });
  s.addText("github.com/famotime/siyuan-slidev · MIT License", { x: 0, y: 6.24, w: W, h: 0.32, align: "center", fontFace: MONO, fontSize: 12, color: C.muted, margin: 0 });
  footer(s);
  s.addNotes("号召行动：三十秒上手——点开「即现演示」、三个减号分页、面板选版式、F 放映 P 提词。");
})();

/* ============ S16 结尾（暗） ============ */
(() => {
  const s = newSlide(true);
  s.addImage({ path: A("stage.jpg"), x: 0, y: 0, w: W, h: H, sizing: { type: "cover", w: W, h: H } });
  s.addImage({ path: A("scrim_end.png"), x: 0, y: 0, w: W, h: H });
  s.addShape(P.shapes.ROUNDED_RECTANGLE, { x: 6.17, y: 1.5, w: 1.0, h: 1.0, rectRadius: 0.16, fill: { color: "FFFFFF" }, shadow: sh() });
  s.addImage({ path: A("icon.png"), x: 6.29, y: 1.62, w: 0.76, h: 0.76 });
  s.addText("让笔记开口说话", { x: 0, y: 2.9, w: W, h: 1.1, align: "center", fontFace: FONT, fontSize: 54, bold: true, color: C.dtext, margin: 0 });
  s.addText("笔记即演示，内容即思想。", { x: 0, y: 4.28, w: W, h: 0.5, align: "center", fontFace: FONT, fontSize: 20, color: C.dmuted, margin: 0 });
  s.addText("即现 · SiYuan Slidev · MIT 开源", { x: 0, y: 5.42, w: W, h: 0.4, align: "center", fontFace: FONT, fontSize: 15, bold: true, color: C.accent, charSpacing: 1.5, margin: 0 });
  s.addText("下一场演示，从你的下一篇笔记开始。", { x: 0, y: 5.94, w: W, h: 0.4, align: "center", fontFace: FONT, fontSize: 15, color: C.dmuted, margin: 0 });
  s.addNotes("收尾金句：让笔记开口说话。致谢，并引导：下一场演示，从你的下一篇笔记开始。");
})();

P.writeFile({ fileName: path.join(__dirname, "deck.pptx") }).then(() => console.log("OK " + pageNo + " slides"));
