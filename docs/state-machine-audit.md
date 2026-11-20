# 隐式状态机审计与修复跟踪 (State Machine Audit)

> 生成日期：2026-11-21
> 范围：全库 `src/`（~37k 行）＋生成代码内嵌运行时
> 方法：并行代码探查（编译管线 / 引擎与插件生命周期 / sync·UI·export 精读）＋ 全部 P0 逐条源码交叉验证
> 状态图例：`待修复` → `已修复` → `已验证` → `已提交 <hash>`

---

## 〇、架构事实澄清

- AGENTS.md 所述 `engine-manager.ts`（Sandbox/DevServer 双模引擎，端口 3030）**在当前代码中不存在**。`src/engine/` 仅含 `runtime-node.ts`、`v-click-resolver.ts`、`web-sandbox-bridge.ts`。文档与代码已漂移。
- 全库 7 处 `FSM-N 缺陷修复` 注释（FSM-1/2/3/6/8/9/10）是历史事故地图，均以注释形式存在而非类型化状态。

---

## 一、隐式状态机清单

### A. 编译调度链

| # | 状态机 | 位置 | 评估 |
|---|---|---|---|
| A1 | CompileScheduler（显式 FSM） | `src/sync/compile-scheduler.ts:19-98` | 🟢 健全 |
| A2 | 插件层脏文档单槽 `dirtyDocId` + 防抖 | `src/index.ts:69,74,417-456` | 🔴 P0-1/P0-2 |
| A3 | 编译失败兜底空文档 | `src/compiler/document-compiler.ts:676-681` | 🔴 P0-3 |
| A4 | CompileConsumerGate 三态 + verifyTimer | `src/sync/compile-consumer-gate.ts:77-220` | 🟡 一次性定时器仅修复首个 stale record |
| A5 | attrOverrides 影子属性层 | `src/compiler/document-compiler.ts:241` | 🔴 P1-F（无界增长/全量快照钉死内核真值） |
| A6 | trackedListSuperBlocks / fallbackWarnedDocId / compiledIalIndex | `src/compiler/document-compiler.ts:242-244` | 🟡 会话级无界（低危） |

### B. 解析器行扫描状态机

| # | 状态机 | 位置 | 评估 |
|---|---|---|---|
| B1 | frontmatter YAML 光标 + 子状态 | `src/compiler/frontmatter-parser.ts:165-287` | 🟡 baseIndent 首行缩进陷阱、非平衡引号致注释剥离失效 |
| B2 | 分片扫描 inHtmlComment + fence 游标 | `src/compiler/slides-importer.ts:78-173` | 🔴 P0-7（EOF 卡死 ×2） |
| B3 | live 导入 inCodeFence + 页累积器 + lastBlock | `src/compiler/live-slides-importer.ts:201-474` | 🔴 P0-7（同类 EOF 卡死）；🟡 双前置 `---` 回填错位 |
| B4 | `src:` 子演示递归 | `src/compiler/slides-importer.ts:341-342` | 🔴 P0-6（无环保护） |
| B5 | html-cleaner 四族 token 保护/恢复 | `src/compiler/html-cleaner.ts:4-154` | 🟢 |
| B6 | directive-wrapper kind-grouping / slot 继承 | `src/compiler/directive-wrapper.ts:377-547` | 🟢 |
| B7 | slides-ast-builder headingStack + 页 frontmatter | `src/compiler/slides-ast-builder.ts:186,407-433` | 🔴 P1-C1（双图覆写）；🟡 P1-C2（superblock 标题污染） |

### C. 同步联动层

| # | 状态机 | 位置 | 评估 |
|---|---|---|---|
| C1 | 反向定位锁（FSM-2） | `src/sync/inspector-sync-coordinator.ts:25-41` | 🟡 纯时间窗无完成信号（低危，暂缓） |
| C2 | 分页符记忆（FSM-3） | 同上 :27-28 | 🟢 |
| C3 | CursorTracker | `src/sync/cursor-tracker.ts` | 🟡 切文档不重置 activePageIndex（低危，暂缓） |
| C4 | InspectorSyncThrottle 单槽节流 | `src/sync/inspector-sync-cache.ts:81-101` | 🟢 |
| C5 | BlockAttrCache TTL 惰性驱逐 | 同上 :24-56 | 🟡 会话级无界（低危，暂缓） |

### D. IPC 桥与协议

| # | 状态机 | 位置 | 评估 |
|---|---|---|---|
| D1 | 沙箱桥握手（FSM-6 LWW） | `src/engine/web-sandbox-bridge.ts:33-118` | 🔴 P1-A（resetReady 死代码 / detach 清队列违背缓存注释） |
| D2 | BroadcastChannel 双屏协议 | `src/ui/tab/usePresenterSync.ts` | 🟡 P1-D2（无 docId/seq，REQUEST_SYNC 全员应答） |
| D3 | ApiSwitchBridge 注册机 | `src/plugin/api-switch-bridge.ts` | 🟡 P1-F2（外部卸载无感知 / managedAiConfigState 不重置） |

### E. UI 组件域

| # | 状态机 | 位置 | 评估 |
|---|---|---|---|
| E1 | 预览页签 Pin | `src/ui/tab/SlidesPreviewTab.vue` | 🟡 先锁后绑（低危，暂缓） |
| E2 | 跳页输入 / 角标 | page-jump-input + jump badge | 🟢 |
| E3 | 速览抽屉双通道 | `src/ui/tab/usePeekDrawerState.ts` | 🟡 P1-E2（await 乱序覆写）；hasOpenedWeb 单向阀为已知取舍 |
| E4 | 演示者计时器（FSM-8） | `src/ui/tab/usePresenterTimer.ts` | 🟢（startTimers 双启守卫缺失，低危暂缓） |
| E5 | 放映位置三源写入 | presenter/preview tabs | 🟡 P1-D1（切文档不重置页码）；seq 仲裁暂缓 |
| E6 | 导入对话框 | `src/ui/components/useSlidesImport.ts` | 🟢 代际防护良好（按钮 disabled 兜底重入） |
| E7 | 导出编排 | `src/ui/tab/usePreviewExport.ts` | 🟡 P1-B2（仅一类有防重入、无错误 toast） |

### F. 生成代码内运行时 FSM

| # | 状态机 | 位置 | 评估 |
|---|---|---|---|
| F1 | 独立播放器 currentIndex + 遮罩（FSM-9） | `src/export/standalone-runtime-sections/slide-rendering.ts` 等 | 🟢 |
| F2 | 跳页角标计时器对 | `src/export/standalone-runtime-sections/jump-badge.ts` | 🟢 |
| F3 | 无头导出沙箱生命周期 | `src/export/image-exporter.ts:214-253` | 🟡 250ms 固定渲染等待（暂缓）；mode 耦合（暂缓） |
| F4 | PDF 打印 iframe 生命周期 | `src/export/pdf-exporter.ts:85-142` | 🟡 P1-B3（350ms 固定等待 → load 事件优先） |
| F5 | 插件生命周期 | `src/index.ts` | 🔴 P0-4/P0-5（卸载不对称 / 定时器穿越） |

### G. 命令与编排

| # | 状态机 | 位置 | 评估 |
|---|---|---|---|
| G1 | 命令导出防重入 | `src/plugin/command-registry.ts:295-331` | 🔴 P1-B1（TOCTOU） |
| G2 | currentDocId 多写者 | command-registry ×4 + onSwitchProtyle | 🟡 收敛同值，暂缓 |
| G3 | updatePreviewTabHeader | `src/plugin/preview-tab-title.ts:71-120` | 🟡 P1-E3（last-finished-wins） |

---

## 二、隐藏问题与修复跟踪

### P0 — 正常路径可复现（✅ 全部修复并提交）

| ID | 问题 | 位置 | 状态 |
|---|---|---|---|
| P0-1 | **多文档丢更新回归**：pendingBatch 逐个喂回单槽 dirtyDocId，批次 [A,B,C] 塌缩为 C | `src/index.ts:683-691` | ✅ 已提交 `e173f2c`（dirtyDocs 集合化） |
| P0-2 | **脏标记打错文档**：onWsMain 忽略事务真实 docId，后台文档永不重编译 | `src/index.ts:405-412` | ✅ 已提交 `e173f2c`（编译块索引反查） |
| P0-3 | **编译异常静默清空预览**：catch 兜底返回 0 页空文档并被当作成功回写 | `src/compiler/document-compiler.ts:676-681` + `src/index.ts:664-679` | ✅ 已提交 `e173f2c`（上抛 + lastGoodDoc + 限频提示） |
| P0-4 | **eventBus 卸载不对称**：匿名监听器泄漏、旧实例穿越卸载驱动编译 | `src/index.ts:185-186` vs `:283-285` | ✅ 已提交 `e173f2c`（具名化对称注销） |
| P0-5 | **启动定时器穿越卸载**：detectAndCompile 两个 setTimeout 无句柄 | `src/index.ts:211-212` | ✅ 已提交 `e173f2c`（句柄化 + unload 回收） |
| P0-6 | **src: 导入无限递归**：无 visited 集无深度上限，损坏 zip 即栈溢出 | `src/compiler/slides-importer.ts:341-342` | ✅ 已提交 `f0ace9a`（环检测 + 深度上限 8） |
| P0-7 | **解析器 EOF 卡死态**：未闭合 `<!--` / 代码围栏使其后所有分页失效或分页误判 | `src/compiler/slides-importer.ts:98-110,152-165`；`src/compiler/live-slides-importer.ts:266-281` | ✅ 已提交 `f0ace9a`（注释重启扫描 / 围栏推进 EOF / 显式告警） |
| P0-8 | **列表超级块每编译重写根属性**：pageTargetNode 查找域错误致 currentLayout 恒空 | `src/compiler/list-column-scanner.ts:449,509-518` | ✅ 已提交 `f0ace9a`（docAttrs 合并属性回退判定） |

### P1 — 边界条件 / 资源退化（✅ 计划内 13 项全部修复并提交）

| ID | 问题 | 位置 | 状态 |
|---|---|---|---|
| P1-A | resetReady() 零调用者（死转移）；attach 先清 pendingMessages 违背 main.ts 缓存注释 | `src/engine/web-sandbox-bridge.ts:57-83` | ✅ 已提交 `defe6a4`（iframe load 接线 + detach 保留队列 + 冲刷失败重试） |
| P1-B1 | 命令导出 TOCTOU：检查在 await 前、置位在后 | `src/plugin/command-registry.ts:295-331` | ✅ 已提交 `defe6a4`（置位先于 await） |
| P1-B2 | 五类导出仅一类防重入且无错误 toast | `src/ui/tab/usePreviewExport.ts:66-166` | ✅ 已提交 `defe6a4`（runExclusiveExport 统一收口） |
| P1-B3 | PDF 打印 350ms 固定渲染等待、对话框期间移除 iframe | `src/export/pdf-exporter.ts:110-119` | ✅ 已提交 `defe6a4`（load 事件优先 + 延迟移除） |
| P1-C1 | 双图页后图覆写 frontmatter（击穿先到先得预扫描） | `src/compiler/slides-ast-builder.ts:407-433` | ✅ 已提交 `2e65ecf`（首个图文来源胜出 + 背景来源区分） |
| P1-C2 | superblock 内标题污染全局大纲栈（未传 parentContainerId） | `src/compiler/slides-ast-builder.ts:442-445` | ✅ 已提交 `2e65ecf`（容器上下文传入） |
| P1-D1 | 切文档不重置页码（preview + presenter 双处） | `SlidesPreviewTab.vue:515-539`；`SlidesPresenterTab.vue:710-719` | ✅ 已提交 `bbdbbf2`（renderedDocId 跟踪 + adoptSlides 重置） |
| P1-D2 | BC 协议无身份：SYNC_SLIDES 不带 docId，残留窗口可覆写新窗口数据 | `src/ui/tab/usePresenterSync.ts` | ✅ 已提交 `bbdbbf2`（docId + slidesUpdatedAt 准入过滤） |
| P1-E1 | 导出图片命令防重入（与 P1-B1 同修） | `src/plugin/command-registry.ts` | ✅ 已提交 `defe6a4` |
| P1-E2 | handleOpenPeekDrawer await 乱序完成覆写后点的链接 | `src/ui/tab/usePeekDrawerState.ts:49-92` | ✅ 已提交 `633c249`（代际卫） |
| P1-E3 | syncInspectorBlock / updatePreviewTabHeader 异步乱序完成 | `src/index.ts:608-621`；`src/plugin/preview-tab-title.ts:71-120` | ✅ 已提交 `633c249`（coordinator 代际 + 最后发起者胜出） |
| P1-F1 | attrOverrides：块删除事务不清除条目（会话级增长 + 遮蔽内核真值） | `src/sync/inspector-sync-coordinator.ts:493-522` | ✅ 已提交 `01c47f7`（custom-* 域过滤 + delete 事务清除） |
| P1-F2 | ApiSwitchBridge.destroy 不清 managedAiConfigState | `src/plugin/api-switch-bridge.ts:72-83` | ✅ 已提交 `01c47f7`（destroy 置空） |

### P2 — 低危 / 打磨项（本轮暂缓，留档）

- `cancelledCursorBlockId` 无过期（index.ts:597-600）
- `extractSlideMatter` 宽松路径双重返回；60 行 frontmatter 上限；非平衡撇号注释剥离失效
- `resolveCodeSnippet` 缺 endregion 静默内联全文件
- live 导入双前置 `---` 与回填 1:1 错位
- BLOCK_REF_REGEX 锚点含括号截断；引用内容不二次展开
- `startTimers` 双启 interval 泄漏；token 保护串碰撞
- preview 页签 Pin 先锁后绑；CursorTracker 切文档 activePageIndex 残留
- image-exporter 250ms 固定等待与 mode 耦合；verify 定时器每轮仅修复一个 consumer
- `isOpeningSetting` 500ms 定时解锁；双 preview tab 抢占全局桥 attach
- AI 层无 AbortController / in-flight 合并（ai-service.ts:72-148）
- currentDocId 多写者收敛；BC 页码消息无 seq 仲裁

---

## 三、修复方案（按批次）

| 批次 | 内容 | 涉及文件 | 提交 |
|---|---|---|---|
| FIX-1/2 | P0-1/2/3/4/5：脏文档集合化、事务归属反查、编译失败上抛 + lastGoodDoc、监听器对称卸载、启动定时器回收 | index.ts、document-compiler.ts、compile-scheduler.ts | ✅ `e173f2c` |
| FIX-3 | P0-6：src: 递归 visited 集 + 深度上限 | slides-importer.ts | ✅ `f0ace9a` |
| FIX-4 | P0-7：EOF 强制出栈 + 未闭合围栏游标推进 | slides-importer.ts、live-slides-importer.ts | ✅ `f0ace9a` |
| FIX-5 | P0-8：根属性差异判定改读 docAttrs/override 层 | list-column-scanner.ts、document-compiler.ts | ✅ `f0ace9a` |
| FIX-6 | P1-A：resetReady 接线（iframe load）+ detach 保留队列 + 冲刷失败重试 | web-sandbox-bridge.ts、SlidesPreviewTab.vue | ✅ `defe6a4` |
| FIX-7 | P1-B：导出防重入前置 + 错误 toast + PDF load 优先 | command-registry.ts、usePreviewExport.ts、pdf-exporter.ts | ✅ `defe6a4` |
| FIX-8 | P1-C：双图页取首个 + 背景来源区分 + superblock 标题隔离 | slides-ast-builder.ts | ✅ `2e65ecf` |
| FIX-9 | P1-D：切文档重置页码 + BC 协议 docId/slidesUpdatedAt 准入 | SlidesPreviewTab.vue、SlidesPresenterTab.vue、usePresenterSync.ts、main.ts、slides-client/index.html | ✅ `bbdbbf2` |
| FIX-10 | P1-E：代际卫统一模式 | usePeekDrawerState.ts、inspector-sync-coordinator.ts、preview-tab-title.ts | ✅ `633c249` |
| FIX-11 | P1-F：custom-* 域过滤 + 删除事务清理 override + ApiSwitchBridge 状态重置 | inspector-sync-coordinator.ts、api-switch-bridge.ts | ✅ `01c47f7` |

## 四、验证与提交记录

**修复执行记录（2026-11-21）**

| 验证项 | 基线 | 修复后 |
|---|---|---|
| `pnpm test` | 107 文件 / 1043 用例全绿 | 110 文件 / **1086 用例全绿（+43 新增用例）** |
| `pnpm run typecheck` | 0 错误 | 0 错误 |
| `pnpm run build` | — | ✅ Vite 产物 + package.zip（22 条目）集市规范校验通过 |

**新增测试文件（7 个，共 43 用例）**

| 测试文件 | 用例数 | 覆盖 |
|---|---|---|
| tests/compile-dirty-batch.test.ts | 7 | 多文档批次补跑、事务归属反查、失败保留 lastGoodDoc、卸载清理、监听器对称源码守护 |
| tests/importer-eof-cycles.test.ts | 9 | src 环/深度上限、未闭合注释/围栏 EOF 出口、闭合回归守护 |
| tests/list-column-scanner.test.ts（追加） | +4 | 根版式收敛（docAttrs 提供时不重复写 / clover 保持 / 旧行为兼容 / 清空不重复下发） |
| tests/bridge-handshake-export-guard.test.ts | 7 | detach 保留队列、resetReady 接线、冲刷失败重试、导出 TOCTOU 源码守护、防重入/错误收口 |
| tests/ast-builder-first-wins.test.ts | 3 | 双图页首个胜出、背景来源区分、容器标题隔离 |
| tests/presenter-sync-docid.test.ts | 5 | 快照准入过滤、跨文档页码重置、legacy 兼容、REQUEST_SYNC 应答身份 |
| tests/async-epoch-guard.test.ts | 3 | peekDrawer/previewTabHeader/syncInspectorBlock 乱序代际卫 |
| tests/override-lifecycle.test.ts | 5 | custom-* 域过滤、键移除收缩、删除事务清除、受管配置重置 |

**提交序列（自旧至新）**

1. `e173f2c` fix(compile): 脏文档集合化防丢更新 + 事务归属反查 + 编译失败保留 lastGoodDoc
2. `f0ace9a` fix(compiler): 导入解析 EOF 卡死态治理 + src 递归防环 + 根版式写放大收敛
3. `defe6a4` fix(engine/export): 沙箱桥握手语义修复 + 导出防重入与错误收口 + PDF 打印就绪优先
4. `2e65ecf` fix(ast): 页面图文/背景版式首个胜出 + 超级块容器标题大纲隔离
5. `bbdbbf2` fix(sync-ui): 双屏广播协议数据身份过滤 + 切文档页码重置
6. `633c249` fix(sync): 异步乱序完成代际卫统一收口
7. `01c47f7` fix(sync-lifecycle): 覆盖层生命周期治理 + ApiSwitchBridge 状态重置

**结论**：P0 全部 8 项、P1 计划内全部 13 项已修复、验证并分步提交；P2 低危打磨项与暂缓项（AI AbortController、image-exporter 固定等待、BC seq 仲裁、currentDocId 多写者收敛等）保留在第二节清单中供后续迭代。
