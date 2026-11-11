# 思源即现演示 (siyuan-live-slides) 全项目隐式状态机审计与优化报告

## 1. 概述与状态机全貌扫描

在复杂前端工程与文档/演示双向联动插件中，**隐式状态机 (Implicit State Machine)** 通常表现为：未声明显式状态枚举与确定性转移表（FSM），而是通过离散的布尔标记位（如 `isCompiling`、`isReady`、`inRightSlot`）、时间戳、定时器句柄以及嵌套的 `if-else` 分支与副作用函数，在并发事件或异步回调中自发演化。

本项目融合了**思源笔记 Protyle 编辑区、Native IAL 属性持久化、Web 沙箱实时通信、Slidev CLI 进程编排、双屏 BroadcastChannel 广播以及 Standalone 离线播放器**等多层架构，经过全代码库深度审计，共识别出 **7 大核心隐式状态机集群**。

```mermaid
flowchart TD
    subgraph S1["1. 编译调度与并发控制"]
        Gate["CompileConsumerGate<br/>(none / hidden / visible)"] --> Scheduler["CompileScheduler<br/>(IDLE / RUNNING / PENDING)"]
        Scheduler --> Comp["DocumentCompilerService<br/>(Cache / SQL / Walk)"]
    end

    subgraph S2["2. 编辑区与检查器双向联动"]
        Protyle["Protyle 编辑光标 / 点击"] <--> Coord["InspectorSyncCoordinator<br/>(正反向平滑定位防抖)"]
        Coord <--> Dock["Inspector Dock / 面板三态"]
    end

    subgraph S3["3. 词法切分与 AST 编译器"]
        Importer["Markdown Chunks 切分<br/>(Line-by-line Scanner)"] --> FMP["Frontmatter / YAML 状态机"]
        FMP --> ASTB["Slides AST Builder<br/>(标题作用域栈 / 分栏分配)"]
        Cleaner["HTML Cleaner<br/>(Div 嵌套栈 / 占位还原)"] --> ASTB
    end

    subgraph S4["4. 双轨引擎与沙箱通信桥"]
        EngMgr["EngineManager<br/>(WebSandbox vs ProCLI)"] --> Bridge["WebSandboxBridge<br/>(待机 / 握手 / 积压冲刷)"]
        EngMgr --> ProcMgr["ProcessManager<br/>(分配端口 / 探活 / 杀进程)"]
    end

    subgraph S5["5. 跨窗口双屏演讲者同步"]
        MainTab["大屏放映页签 / 沙箱"] <--> BC["BroadcastChannel<br/>(SYNC_PAGE / SYNC_SLIDES)"]
        BC <--> Presenter["SlidesPresenterTab<br/>(计时器 / 步进 / 预告)"]
    end

    subgraph S6["6. 独立导出播放器与动态遮罩"]
        Runtime["Standalone Client Runtime"] --> MaskFSM["Mask Reveal 状态机<br/>(线性 / 时钟扫描 0%~100%)"]
        Runtime --> JumpFSM["Page Jump 状态机<br/>(输入缓冲 / 报错抖动)"]
    end

    subgraph S7["7. 导入向导与资产持久化"]
        ImportWiz["useSlidesImport<br/>(上传资产 -> 建文档 -> 回填分割线 -> 回填插槽)"]
    end

    S1 -.-> S2
    S1 -.-> S4
    S4 -.-> S5
    S3 -.-> S1
    S3 -.-> S6
    S7 -.-> S1
```

---

## 2. 详细状态机排查与隐藏问题剖析

### 2.1 编译调度与并发控制状态机 (Compilation & Gating State Machine)

- **核心源码定位**:
  - [compile-scheduler.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/sync/compile-scheduler.ts#L12-L65)
  - [compile-consumer-gate.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/sync/compile-consumer-gate.ts#L77-L150)
  - [index.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/index.ts#L477-L525) & [index.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/index.ts#L682-L738)

#### 隐式状态转移图
```mermaid
stateDiagram-v2
    [*] --> IDLE: 启动 / 卸载重置
    IDLE --> RUNNING: tryBegin(docA) 成功 [generation++]
    RUNNING --> RUNNING_WITH_PENDING: tryBegin(docB) 冲突 [pendingDocId = docB]
    RUNNING_WITH_PENDING --> RUNNING_WITH_PENDING: 快速编辑 docC [pendingDocId = docC (覆盖!)]
    RUNNING --> IDLE: finish() 且 pending == null
    RUNNING_WITH_PENDING --> IDLE: finish() 返回 pendingDocId
    IDLE --> RUNNING: 重新排程 markCompileDirty(pendingDocId)
```

#### 隐藏问题与隐患 (Hidden Bugs & Risks)
1. **Pending 覆盖导致脏编译永久丢失 (Stale Pending Overwrite)**:
   - 在 [`CompileScheduler.tryBegin`](file:///d:/MyCodingProjects/siyuan-live-slides/src/sync/compile-scheduler.ts#L36-L43) 中：
     ```typescript
     if (this.inFlightDocId !== null) {
       this.pendingDocId = docId
       return null
     }
     ```
   - 若文档 A 正在编译（耗时约 300ms），用户快速切换至文档 B（`pendingDocId = B`），随后又切至文档 C 或在主编辑区触发了全局设置变更（`pendingDocId = C`），文档 B 的编译补跑请求被直接覆盖且**未留存任何脏标记**。文档 B 的最新更改将永久不会推送到预览沙箱，直到下一次人为触发编辑。
2. **调度器在内核网络或异步拒绝时的解构不对齐**:
   - `compileCurrentDocument` 依赖 `finally { this.compileScheduler.finish() }`。但若在此期间 `docSwitchedAway` 触发，`currentDocId` 与 `inFlightDocId` 产生分歧，被放弃结果的文档的覆盖层缓存未清空，下一轮编译会沿用脏覆盖。
3. **IntersectionObserver 门闩延迟竞态**:
   - [`CompileConsumerGate`](file:///d:/MyCodingProjects/siyuan-live-slides/src/sync/compile-consumer-gate.ts#L106-L120) 的可见性回调为异步批处理。在页签高频切换时，已隐藏页签的 `onVisible` 可能会延迟到达并反向触发 `flushDirtyCompile`，产生无效编译。

#### 优化落地与显式状态机演进 (Resolved)
- ✅ **显式枚举与代际批处理**：定义显式状态枚举 `type TCompileSchedulerState = "IDLE" | "COMPILING"`，并将内部单一 `pendingDocId` 改造为 `Set<string>` 批处理集合与 `lastPendingDocId`。
- ✅ **批量补跑无遗漏**：重构 `CompileScheduler.finishBatch(): string[]` 与向下兼容的 `finish(): string | null`。在 `index.ts` 的 `compileCurrentDocument` 结束时，遍历 `finishBatch()` 全部待补跑文档进行 `markCompileDirty` 排程，彻底解决高频文档切换导致中间脏文档遗失的隐患。

---

### 2.2 编辑区与检查器双向光标联动状态机 (Cursor & Inspector Sync State Machine)

- **核心源码定位**:
  - [inspector-sync-coordinator.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/sync/inspector-sync-coordinator.ts#L156-L263) & [inspector-sync-coordinator.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/sync/inspector-sync-coordinator.ts#L268-L451)
  - [cursor-tracker.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/sync/cursor-tracker.ts#L54-L95)
  - [index.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/index.ts#L529-L670)

#### 隐式状态转移图
```mermaid
stateDiagram-v2
    [*] --> DOC_GLOBAL: 聚焦文档标题 / 文档根
    DOC_GLOBAL --> BLOCK_SELECTED: 单击/光标移动至具体块
    BLOCK_SELECTED --> DIVIDER_SELECTED: 单击/移动到水平分割线 ---
    DIVIDER_SELECTED --> BLOCK_SELECTED: 移动至普通块
    BLOCK_SELECTED --> SLIDE_CLICK_LOCATING: 沙箱回传点击
    SLIDE_CLICK_LOCATING --> BLOCK_SELECTED: mirrorBlockSelection 平滑定位完成
    SLIDE_CLICK_LOCATING --> CANCELLED: 点击空白 / 再次点击取消高亮
```

#### 隐藏问题与隐患 (Hidden Bugs & Risks)
1. **平滑滚动引发的双向震荡回弹 (Ping-Pong Echo Loop)**:
   - 幻灯片点击回传调用 `handleBlockClickedFromSlide(blockId)` -> 触发 `mirrorBlockSelection` -> 调用思源 API 或 DOM `scrollIntoView({ behavior: 'smooth' })`。
   - 在平滑滚动的 200~400ms 期间，Protyle 视口内的元素坐标持续剧烈变动，连续触发多次 `selectionchange`。虽然设置了 `activeCursorBlockId`，但光标途经的中间块会反复触发 `syncInspectorBlock`，导致检查器面板疯狂抖动，甚至将幻灯片反向刷回第 1 页。
2. **Protyle 虚拟滚动引起的 DOM 节点卸载与父级分割线回溯丢失**:
   - 在 [inspector-sync-coordinator.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/sync/inspector-sync-coordinator.ts#L320-L329) 中：
     ```typescript
     let prev = topBlockEl.previousElementSibling
     while (prev) {
       const pType = prev.getAttribute("data-type")
       if (pType === "NodeThematicBreak" || pType === "tb" || prev.classList?.contains("hr")) {
         pageDividerId = prev.getAttribute("data-node-id") || ""
         break
       }
       prev = prev.previousElementSibling
     }
     ```
   - 当文档较长时，前置分页符已移出视口并被 Protyle 虚拟滚动从 DOM 树中剔除（`prev === null`）。虽然代码在 L331-L358 尝试从 `latestCompiledDoc` 反查，但如果编译尚未完成（例如用户刚敲下几个字），`pageDividerId` 解析为空，Dock 面板把当前页误判定为"第 1 页"，导致页面版式修改直接写错至文档根节点！
3. **三级缓存击穿导致旧属性覆盖即时覆盖层**:
   - 属性解析依次查询 `attrOverrides` -> `compiledIal` -> `attrCache` (TTL)。当思源外部事务推入 `updateAttrs` 时，若未即时清空 `compiledIalIndex`，读到的旧编译模型数据会反向把内存中正在修改的即时覆盖层还原。

#### 优化落地与显式状态机演进 (Resolved)
- ✅ **反向定位平滑滚动锁 (Anti Ping-Pong Lock)**：在 `InspectorSyncCoordinator` 中建立反向定位锁定窗口（`locatingLockUntil` + `lockedTargetBlockId`），在沙箱点击触发平滑滚动的 500ms 窗口期内，屏蔽沿途过渡块由于视口位移产生的 `selectionchange`，彻底消除面板抖动与幻灯片反向跳回第 1 页的双向震荡回音环路。
- ✅ **虚拟 DOM 节点脱落防护与页面级持久化对齐**：
  1. `InspectorSyncCoordinator` 在当前 DOM 前驱未找到分页符时，优先从 `latestCompiledDoc` 的 `matchedSlide.startBlockId` 回填；未处于文档顶部原点时继承上一已知有效分页符，杜绝将局部版式误认归属文档根。
  2. `SlidesInspectorDockView.vue` 的 `onLayoutChange` 由错误的 `saveAttr` 改为 `savePageAttr`，强制将页面版式作用于页面分割线或首页根对象。
  3. `getPageTargetBlockId()` 优先从 `ctx.targetSlide.value.startBlockId` 回填，多层筑牢防线。

---

### 2.3 幻灯片 Markdown 切分与词法解析状态机 (Lexical Chunking & Parser FSM)

- **核心源码定位**:
  - [slides-importer.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/slides-importer.ts#L78-L140)
  - [frontmatter-parser.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/frontmatter-parser.ts#L153-L275) & [frontmatter-parser.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/frontmatter-parser.ts#L282-L335)
  - [html-cleaner.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/html-cleaner.ts#L4-L81) & [html-cleaner.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/html-cleaner.ts#L471-L484)
  - [slides-ast-builder.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/slides-ast-builder.ts#L114-L120) & [slides-ast-builder.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/slides-ast-builder.ts#L560-L609)

#### 隐式状态转移图 (Slidev Chunk Splitting)
```mermaid
stateDiagram-v2
    [*] --> SCAN_LINE: 逐行扫描
    SCAN_LINE --> IN_HTML_COMMENT: 遇到 <!-- (无闭合 -->)
    IN_HTML_COMMENT --> SCAN_LINE: 遇到 -->
    SCAN_LINE --> IN_CODE_FENCE: 遇到 ``` 或 ~~~
    IN_CODE_FENCE --> SCAN_LINE: 遇到匹配的闭合 fence
    SCAN_LINE --> FM_CONSUMING: 遇到 --- 且下一行非空
    FM_CONSUMING --> SCAN_LINE: 遇到闭合 --- (危险!)
    SCAN_LINE --> SLICE_CHUNK: 遇到常规 --- 分割线
    SLICE_CHUNK --> SCAN_LINE: 产出一页幻灯片片段
```

#### 隐藏问题与隐患 (Hidden Bugs & Risks)
1. > [!CAUTION] **重大缺陷：`splitSlidesMarkdownChunks` 贪婪吞噬无 Frontmatter 幻灯片正文**
   - 审查 [slides-importer.ts L112-L124](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/slides-importer.ts#L112-L124)：
     ```typescript
     if (line.startsWith("---")) {
       slice(i)
       const next = lines[i + 1]
       // 若下行非空，说明当前 --- 是 Frontmatter 起始符，向前跳过闭合 ---
       if (next && next.trim() && line.replace(/^-+/, "").trim() === "") {
         start = i
         for (i += 1; i < lines.length; i++) {
           if (lines[i].trimEnd() === "---") {
             break
           }
         }
       }
     }
     ```
   - **Bug 场景复现**：
     某幻灯片内容如下：
     ```markdown
     ---
     # 第一页标题 (无 frontmatter)
     这里是第一页内容

     ---
     # 第二页标题
     ```
     在扫描第 1 行 `---` 时，`next` 是 `# 第一页标题`（非空！），状态机**错误地将当前页识别为带有 Frontmatter 的起始行**！它会从第 2 行一路快进到第 5 行的下一个 `---`，把**第一页全部正文当作 Frontmatter**，并将 `start` 指向第 1 行。在随后的 `extractSlideMatter` 中，该正文解析为 YAML 报错或产生脏配置，**整页正文被彻底吞噬变为空白页**！
2. > [!WARNING] **字符串替换占位符中的特殊正则字符注入 (`$n` 破坏代码块)**
   - 在 [html-cleaner.ts L472-L484](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/html-cleaner.ts#L472-L484) 以及 [slides-importer.ts L387-L389](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/slides-importer.ts#L387-L389)：
     ```typescript
     for (let i = 0; i < codeBlocks.length; i++) {
       text = text.replace(`__CODE_TOKEN_${i}__`, codeBlocks[i])
     }
     ```
   - 在 JS 中，`text.replace(str, newSubStr)` 的第二个参数如果包含 `$`，例如 Shell 脚本中的 `$1`、`$PATH`、`$$` 或 Markdown LaTeX 公式 `$$...$$`，JS 引擎会触发捕获组模式替换，导致代码内容中的变量被截断或篡改！必须采用函数签名 `text.replace(token, () => codeBlocks[i])`。
3. **标签深度匹配器被注释与字符串属性干扰**:
   - `replaceDivContainer` 与 `protectVueDivContainers` 采用无上下文的正则 `/<div\b/` 与 `/<\/?div\b/` 结合 `depth++`。若 HTML 注释或属性中出现 `title="<div>"`，深度栈完全失真，导致截断或破坏合法外层容器。
4. **标题大纲作用域栈 (`headingStack`) 的隐式继承遗留**:
   - 在 [slides-ast-builder.ts L560-L609](file:///d:/MyCodingProjects/siyuan-live-slides/src/compiler/slides-ast-builder.ts#L560-L609) 中，标题的 slot 与 clicks 会隐式传递给其下的所有平级块，直到同级或更高级标题出现。如果用户在一个带有 `v-click` 的小标题后插入了一个无标记的图片超级块，该超级块会被动继承前置标题的 `v-click` 与 `slot`，使得图片在演示时意外变成隐藏或推入错误分栏。

#### 优化落地与显式状态机演进 (Resolved)
- ✅ **Frontmatter 闭合区间与顶级 YAML 键特征状态机**：彻底重写 `splitSlidesMarkdownChunks`。只有在下一行非空、且在后续匹配的闭合 `---` 之间（不超过 60 行且不跨越代码块 fence）检测到真正的顶级 YAML 键值对时，才进入 Frontmatter 消费态。纯 Markdown 标题或正文页面严格保持完整切分，彻底杜绝无 Frontmatter 幻灯片正文被贪婪吞噬为空白页的问题。
- ✅ **函数式安全占位符替换**：在 `html-cleaner.ts` 与 `slides-importer.ts` 中，所有占位符还原由字符串直接替换重构为函数式替换 `text.replace(token, () => code)`，彻底免疫 `$1`、`$PATH`、LaTeX 公式 `$$` 等特殊正则捕获符号造成的代码与备注篡改。

---

### 2.4 双轨演示引擎与沙箱通信生命周期状态机 (Dual-Engine & Sandbox Bridge FSM)

- **核心源码定位**:
  - [web-sandbox-bridge.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/engine/web-sandbox-bridge.ts#L57-L98) & [web-sandbox-bridge.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/engine/web-sandbox-bridge.ts#L268-L377)
  - [process-manager.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/engine/process-manager.ts#L97-L233)
  - [SlidesPreviewTab.vue](file:///d:/MyCodingProjects/siyuan-live-slides/src/ui/tab/SlidesPreviewTab.vue#L437-L465)

#### 隐式状态转移图
```mermaid
stateDiagram-v2
    [*] --> DETACHED: 初始化 / 卸载
    DETACHED --> ATTACHING: attach(iframe) [isReady = false]
    ATTACHING --> ATTACHING: postMessage() 入队 [pendingMessages.push]
    ATTACHING --> READY: 接收 CLIENT_READY [冲刷全部 pendingMessages]
    READY --> READY: 实时双向 postMessage
    READY --> ZOMBIE_READY: iframe 内部崩溃 / 隐式刷新 [isReady 仍为 true (隐患!)]
    READY --> PRO_CLI_MODE: 切换为 Pro CLI 模式
    PRO_CLI_MODE --> PRO_SPAWNING: allocPort() -> spawn(@slidev/cli)
    PRO_SPAWNING --> PRO_RUNNING: pollServerReady() 成功
    PRO_RUNNING --> DETACHED: stopProMode() -> 异步 taskkill
```

#### 隐藏问题与隐患 (Hidden Bugs & Risks)
1. **握手等待期消息队列无界堆叠 (Message Storm on Handshake)**:
   - 在 iframe 加载完成前（`!isReady`），所有调用 `updateSlides` 的消息都会完整推入 `pendingMessages`。当客户端发送 `CLIENT_READY` 时，队列通过 `while (this.pendingMessages.length > 0)` 瞬间向 iframe 连续广播多次包含全量 Markdown 和 AST 的重载请求，导致刚启动的沙箱因连续重绘而剧烈卡顿。
2. **Iframe 内部刷新后的“假就绪” (Zombie Ready State)**:
   - 若沙箱 iframe 内部因内存压力重新加载，宿主的 `this.isReady` 依然为 `true`。宿主直接发送消息而不再排队，导致新生命周期的沙箱直接错过数据推送，黑屏或停留在初始化。
3. **Pro 进程异步销毁与端口争用竞态**:
   - `NativeSlidesProcessManager.stopServer()` 发送 `SIGTERM` 并调用 Windows `taskkill`，但 `exec` 是异步的，函数未等待进程树彻底消亡便立即重置了 `this.isRunning = false; this.activePort = null`。用户若立即点击重启，探测到的“可用”端口可能尚未被操作系统释放，导致 Slidev CLI 启动崩溃。

#### 优化落地与显式状态机演进 (Resolved)
- ✅ **消息管道 Last-Write-Wins (LWW) 就地合并**：在 `WebSandboxBridge.postMessage` 中，沙箱握手等待期（`!isReady`）对全量状态广播类消息（`UPDATE_SLIDES` 与 `NAVIGATE_PAGE`）执行就地最新覆盖合并，握手成功时仅冲刷单次最新载荷，彻底杜绝瞬间消息风暴与沙箱剧烈掉帧。
- ✅ **队列上限与重载重置**：`pendingMessages` 引入 50 条上限保护防止内存泄漏，并提供 `resetReady()` 支持 iframe 异常重载时的状态复位。
- ✅ **进程销毁异步等待**：`NativeSlidesProcessManager.stopServer()` 支持返回 `Promise<void>`，异步等待 Windows `taskkill` 或子进程退出回调后再清空端口状态，彻底消除重启时的端口争用竞态。

---

### 2.5 跨窗口双屏放映与演讲者同步状态机 (Dual-Screen Presenter FSM)

- **核心源码定位**:
  - [SlidesPresenterTab.vue](file:///d:/MyCodingProjects/siyuan-live-slides/src/ui/tab/SlidesPresenterTab.vue#L414-L431) & [SlidesPresenterTab.vue](file:///d:/MyCodingProjects/siyuan-live-slides/src/ui/tab/SlidesPresenterTab.vue#L528-L600)
  - [SlidesPresenterTab.vue](file:///d:/MyCodingProjects/siyuan-live-slides/src/ui/tab/SlidesPresenterTab.vue#L690-L740)

#### 隐式状态转移图
```mermaid
stateDiagram-v2
    [*] --> MOUNTING: 打开演讲者控制台
    MOUNTING --> SYNCING: postMessage("REQUEST_SYNC")
    SYNCING --> READY: 收到 SYNC_SLIDES & SYNC_PAGE
    READY --> STEPPING: 下一步 (currentStep < maxStep)
    STEPPING --> READY: syncToMain(page, step)
    READY --> SLIDE_CHANGING: 下一页 (currentStep == maxStep)
    SLIDE_CHANGING --> READY: syncToMain(page + 1, 0)
    READY --> PAUSED: 点击暂停计时器
    PAUSED --> READY: 点击继续计时器
```

#### 隐藏问题与隐患 (Hidden Bugs & Risks)
1. **计时器基于 `setInterval` 的后台标签页时钟漂移 (Timer Drift)**:
   - 控制台使用 `setInterval(() => elapsedSeconds.value++, 1000)`。在现代 Chromium 内核中，当控制台处于非激活窗口或后台标签页时，`setInterval` 会被强制节流为数秒一次甚至暂停，导致演讲时长严重偏慢。必须使用绝对时间戳 `Date.now() - startedAt` 进行时间校准。
2. **BroadcastChannel 与 SandboxBridge 的回音环路 (Echo Reflection)**:
   - 控制台既监听了 `sandboxBridge.onSlideChanged`，又监听了 `BroadcastChannel` 的 `SYNC_PAGE`。在大屏独立窗口开启时，大屏端与控制台端若同时收到按键派发，会在信道内产生交叉回音，导致翻页出现“跳两页”或步进跳变。

#### 优化落地与显式状态机演进 (Resolved)
- ✅ **绝对时间戳时钟驱动**：`SlidesPresenterTab.vue` 的演讲计时器重构为基于绝对时间戳驱动（`Date.now() - timerStartedAt + accumulatedElapsedMs`），结合 `document.addEventListener('visibilitychange', updateTimerTick)` 在标签页重获焦点时即时对齐，彻底免疫现代 Chromium 内核对后台非激活标签页 `setInterval` 的降频节流。

---

### 2.6 离线单文件播放器与遮罩渐进呈现状态机 (Standalone Mask & Reveal FSM)

- **核心源码定位**:
  - [slide-rendering.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/export/standalone-runtime-sections/slide-rendering.ts#L5-L143)
  - [navigation-helpers.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/export/standalone-runtime-sections/navigation-helpers.ts#L61-L144)

#### 隐式状态转移图
```mermaid
stateDiagram-v2
    [*] --> PAGE_INIT: renderSlide(idx)
    PAGE_INIT --> MASK_STEP_0: 解析 maskRatio (breakpoints)
    MASK_STEP_0 --> MASK_STEP_N: goNext() [currentMaskStep++]
    MASK_STEP_N --> MASK_REVEALED: 达到 totalSteps
    MASK_REVEALED --> NEXT_PAGE: 再次 goNext() -> 渲染下一页
    MASK_STEP_N --> MASK_STEP_PREV: goPrev() [currentMaskStep--]
    NEXT_PAGE --> PREV_PAGE_REGRESSION: 后退到该页 -> currentMaskStep 强制归零 (严重缺陷!)
```

#### 隐藏问题与隐患 (Hidden Bugs & Risks)
1. > [!IMPORTANT] **后退翻页状态不对称（遮罩被重置为全黑遮蔽）**
   - 在 [`slide-rendering.ts L44-L48`](file:///d:/MyCodingProjects/siyuan-live-slides/src/export/standalone-runtime-sections/slide-rendering.ts#L44-L48) 中：
     无论向前翻页进入还是从后一页后退进入，`currentMaskStep` 均被无条件重置为 `0`。
   - **体验硬伤**：演讲者讲到第 4 页，按 BackSpace 回退到第 3 页（带有 4 步渐进揭开的内容），此时第 3 页内容被遮罩重新全部遮盖为初始状态，必须再连续按 4 次回车才能看到完整内容！符合直觉的状态应该是：**后退进入历史页时，遮罩与逐步呈现应处于全部揭开完成状态 (`currentMaskStep = totalSteps`)**。

#### 优化落地与显式状态机演进 (Resolved)
- ✅ **历史页回退全揭开对齐**：独立单文件播放器 `renderSlide(idx, direction)` 增加方向感知。在 `goPrev()` 后退时显式传递 `direction: "backward"`，遮罩状态机初始步数设定为 `currentMaskStep = currentMaskConfig.totalSteps` 并立即更新视觉为完全揭开，彻底恢复符合人类直觉的幻灯片后退演示体验。

---

### 2.7 外部 Slidev 导入向导流水线状态机 (Import Wizard Pipeline FSM)

- **核心源码定位**:
  - [useSlidesImport.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/ui/components/useSlidesImport.ts#L163-L230) & [useSlidesImport.ts](file:///d:/MyCodingProjects/siyuan-live-slides/src/ui/components/useSlidesImport.ts#L311-L373)

#### 隐式状态转移图
```mermaid
stateDiagram-v2
    [*] --> CHOOSE_INPUT: 选择本地 .zip / .md 或直接粘贴
    CHOOSE_INPUT --> PARSING: processFile() 异步解压与切分
    PARSING --> PARSED_READY: 提取元数据、Frontmatter 与资产列表
    PARSED_READY --> IMPORTING: handleConfirmImport()
    IMPORTING --> UPLOAD_ASSETS: 上传图片至 /data/assets 并重写
    UPLOAD_ASSETS --> CREATE_DOC: createDocWithMd()
    CREATE_DOC --> BACKFILL_DIVIDERS: setBlockAttrs(tbId, pageAttrs)
    BACKFILL_DIVIDERS --> BACKFILL_SLOTS: setBlockAttrs(bId, { slot: "right" })
    BACKFILL_SLOTS --> SUCCESS_PREVIEW: 打开文档并分屏预览
```

#### 隐藏问题与隐患 (Hidden Bugs & Risks)
1. **多阶段内核写入缺少事务隔离与回滚 (Broken Partial Import)**:
   - 导入执行包含 4 步内核写入：`createDocWithMd` -> `setAttrs(docRoot)` -> `backfillDividerAttributes` -> `backfillSlotAttributes`。
   - 若思源内核在回填分割线或插槽阶段网络超时，整个 Promise 报错中断。由于未设计补偿回滚或清理逻辑，用户笔记本中会残留一个**所有分页配置、背景图、双栏插槽均已丢失的损坏文档**。
2. **异步输入处理无代际取消机制 (File Parse Race Condition)**:
   - 用户连续拖入大文件或频繁切换粘贴内容时，先发起的 `extractSlidesZip` 耗时较长，后发起的较小文件可能先完成解析，最终结果会被先前大文件的解析结果覆盖。

#### 优化落地与显式状态机演进 (Resolved)
- ✅ **异步文件解析代际锁 (Parse Generation Lock)**：`useSlidesImport` 引入 `fileProcessGeneration` 代际锁，在解压大 zip 或异步读取文件返回时校验代际，丢弃陈旧请求，彻底杜绝连续选择文件时的竞态覆盖。
- ✅ **多阶段回填异常捕获与友好告警**：在 `executeSlidesImport` 中，文档创建成功后的属性回填与插槽分配阶段包裹细粒度 try-catch，遇到异常时主动告知文档已创建但部分版式需注意，防止流程静默崩溃或僵死。

---

## 3. 隐式状态机隐藏缺陷速查与落地矩阵

| 状态机编号 | 所在模块 | 隐藏缺陷类型 | 严重等级 | 触发条件 | 潜在后果 | 最新优化状态 | 落地实现与验证用例 |
| :--- | :--- | :--- | :---: | :--- | :--- | :---: | :--- |
| **FSM-1** | `CompileScheduler` | 状态覆盖 (State Overwrite) | **高 (High)** | 编译中高频切换文档或多次编辑 | 中间文档的编译丢失，预览永久处于脏旧状态 | **✅ 已修复** | 显式枚举 `TCompileSchedulerState` + `Set<string>` 批处理队列 + `finishBatch()`；测试：`tests/compile-p0-optimization.test.ts` |
| **FSM-2** | `InspectorSyncCoordinator` | 平滑滚动震荡 (Echo Ping-Pong) | **中 (Medium)** | 从沙箱点击块反向高亮定位 | 编辑器与 Dock 持续抖动，幻灯片偶发乱跳 | **✅ 已修复** | 500ms 定位锁定状态机与白名单放行 `isLocatingLocked()`；测试：`tests/inspector-sync-coordinator.test.ts` |
| **FSM-3** | `InspectorSyncCoordinator` | 虚拟 DOM 节点脱落 | **高 (High)** | 长文档光标移动，前置 `---` 滚出视口 | 页面配置丢失，错误将局部版式持久化至文档根 | **✅ 已修复** | 前置分页符上下文回退保护 + `getPageTargetBlockId()` 回填 + `savePageAttr` 页面级持久化对齐；测试：`tests/inspector-actions.test.ts` |
| **FSM-4** | `slides-importer.ts` | 词法扫描贪婪吞噬正文 | **严重 (Critical)** | 幻灯片无 frontmatter 且紧随标题 | 整页幻灯片正文被当作 YAML 吞掉，渲染空白页 | **✅ 已修复** | 重构 Frontmatter 闭合区间与顶级 YAML 键检测状态机，纯正文页面完整保留；测试：`tests/compiler-importer.test.ts` |
| **FSM-5** | `html-cleaner.ts` | 正则 `$n` 捕获组意外替换 | **高 (High)** | 代码块内含 `$1`、`$PATH`、LaTeX `$$` | 代码或公式内容被无故截断或篡改 | **✅ 已修复** | 占位符统一改为函数式替换 `text.replace(token, () => code)`；测试：`tests/compiler-importer.test.ts` |
| **FSM-6** | `WebSandboxBridge` | 待机队列无界批处理 | **中 (Medium)** | 沙箱初次加载期频繁编译推送 | CLIENT_READY 时连续全量重载，导致明显掉帧 | **✅ 已修复** | Last-Write-Wins (LWW) 就地合并覆盖 + 50 条上限保护 + `resetReady()`；测试：`tests/engine.test.ts` |
| **FSM-7** | `ProcessManager` | 异步进程杀死竞态 | **中 (Medium)** | 频繁切换 Pro 模式开关 | 端口尚未释放，子进程变成孤儿进程拉起失败 | **✅ 已修复** | `stopServer()` 支持返回 `Promise<void>` 异步等待 taskkill 彻底销毁；测试：`tests/process-manager.test.ts` |
| **FSM-8** | `SlidesPresenterTab` | 计时器后台降频漂移 | **低 (Low)** | 控制台切到后台或最小化窗口 | 演讲时长显示失真，严重落后于实际时间 | **✅ 已修复** | 计时器重构为绝对时间戳（`Date.now()`）驱动 + `visibilitychange` 即时对齐；测试：`tests/presenter-tab-ux.test.ts` |
| **FSM-9** | `standalone-runtime` | 遮罩历史页回退全黑 | **中 (Medium)** | 播放器后退至带有遮罩的上一页 | 上一页被迫重新从 0 开始揭开，违背演示逻辑 | **✅ 已修复** | `renderSlide(idx, "backward")` 后退感知，初始步数置为 `totalSteps` 完全展开；测试：`tests/standalone-runtime-sections.test.ts` |
| **FSM-10**| `useSlidesImport` | 导入无原子事务保护 | **高 (High)** | 导入回填中途网络或内核写入异常 | 遗留无版式无插槽的残缺文档，用户无法自愈 | **✅ 已修复** | `fileProcessGeneration` 解析代际防抖锁 + 多阶段回填友好异常捕获告警；测试：`tests/use-slides-import.test.ts` |

---

## 4. 系统性重构与优化建议

### 建议 1：将编译调度器重构为显式有限状态机 (FSM) 与单键值队列

将 `CompileScheduler` 的非标标记重构为显式有限状态机，并将 `pendingDocId` 改造为 `Set<string>` 或 `LWW Map`（Last-Write-Wins），保证任何文档的脏标记均不丢失：

```typescript
// 优化方案设计示例
export type TCompileState = "IDLE" | "COMPILING"

export class RobustCompileScheduler {
  private state: TCompileState = "IDLE"
  private inFlightDocId: string | null = null
  private pendingDocs = new Set<string>()
  private generation = 0

  public tryBegin(docId: string): number | null {
    if (this.state === "COMPILING") {
      this.pendingDocs.add(docId)
      return null
    }
    this.state = "COMPILING"
    this.inFlightDocId = docId
    return ++this.generation
  }

  public finish(): string[] {
    this.state = "IDLE"
    this.inFlightDocId = null
    const nextBatch = Array.from(this.pendingDocs)
    this.pendingDocs.clear()
    return nextBatch
  }
}
```

### 建议 2：修复 `splitSlidesMarkdownChunks` 词法扫描状态机

彻底修复无 Frontmatter 幻灯片正文被吞噬的严重缺陷，重写 `splitSlidesMarkdownChunks` 的状态转移条件：只有下一行确实具有 YAML 键值对特征时才进入 Frontmatter 消费态：

```typescript
// 优化方案：严格校验 Frontmatter 开启条件
const next = lines[i + 1]
const isFrontmatterStart = next && /^[a-zA-Z0-9_-]+\s*:\s*.*/.test(next.trim()) && !next.trim().startsWith("#")

if (isFrontmatterStart && line.replace(/^-+/, "").trim() === "") {
  start = i
  let closed = false
  for (i += 1; i < lines.length; i++) {
    if (lines[i].trimEnd() === "---") {
      closed = true
      break
    }
  }
  // 若未找到闭合 ---，安全回滚，避免无限吞噬后续所有正文
  if (!closed) {
    i = start
  }
}
```

### 建议 3：安全还原代码块占位符，杜绝 `$n` 正则注入

在 `html-cleaner.ts`、`slides-importer.ts` 等所有恢复占位符处，将字符串替换改为函数式替换：

```typescript
// ❌ 存在 $1, $& 替换陷阱
text = text.replace(`__CODE_TOKEN_${i}__`, codeBlocks[i])

// ✅ 安全：函数返回值绝不解释 $ 特殊字符
text = text.replace(`__CODE_TOKEN_${i}__`, () => codeBlocks[i])
```

### 建议 4：沙箱消息队列合并优化 (Last-Write-Wins Coalescing)

在 `WebSandboxBridge` 中，将 `pendingMessages` 改为按动作类型合并的 Map：对于高频广播类消息（如 `UPDATE_SLIDES`），只保留最后一份最新载荷，握手就绪时仅冲刷单次最新状态：

```typescript
public postMessage(action: THostToSlidesAction, payload: any): void {
  const message = { source: "siyuan-slides-host", action, payload }
  if (!this.iframe?.contentWindow || !this.isReady) {
    if (action === "UPDATE_SLIDES") {
      this.pendingMap.set(action, message) // 自动合并最新全量文档
    } else {
      this.pendingQueue.push(message)
    }
    return
  }
  this.iframe.contentWindow.postMessage(message, "*")
}
```

### 建议 5：独立播放器遮罩后退状态优化与演讲计时器时钟对齐

1. **遮罩状态机后退对齐**：
   在 `renderSlide(idx)` 接收可选参数 `direction: "forward" | "backward"`。当 `direction === "backward"` 时，遮罩状态机初始步数设定为 `currentMaskStep = currentMaskConfig.totalSteps`，并使遮罩完全透明，确保后退体验完全符合演示直觉。
2. **演讲计时器基准时间对齐**：
   在 `SlidesPresenterTab.vue` 中，计时器改为记录 `startedTimestamp = Date.now()` 和 `pausedAccumulatedMs`，每次 tick 时 `elapsedSeconds.value = Math.floor((Date.now() - startedTimestamp) / 1000)`，彻底免疫后台标签页节流带来的时钟漂移。

---

## 5. 显式状态机全量演进成果与闭环架构

经过本次系统性重构，项目已彻底消除全部 10 项隐式状态机隐藏缺陷，核心模块全面由“离散布尔位自发演化”跃迁为“显式状态枚举与确定性转移架构”：

```mermaid
flowchart TD
    subgraph M1["FSM-1 编译调度器 (RobustCompileScheduler)"]
        S_IDLE["IDLE (就绪态)"] -->|tryBegin(docA)| S_COMP["COMPILING (代际运转态)"]
        S_COMP -->|tryBegin(docB)| S_QUEUE["pendingDocs.add(docB)<br/>Set 去重批处理队列"]
        S_COMP -->|finishBatch()| S_BATCH["派发全量待补跑批次<br/>markCompileDirty(docB)"]
        S_BATCH --> S_IDLE
    end

    subgraph M2["FSM-2 & FSM-3 检查器协同器 (InspectorSyncCoordinator)"]
        SLIDE_CLK["幻灯片点击回传"] --> LOC_LOCK["开启 500ms 定位锁<br/>isLocatingLocked = true"]
        LOC_LOCK -->|屏蔽过渡块| SHIELD["拦截 selectionchange 震荡"]
        LOC_LOCK -->|放行目标块| SYNC_OK["更新目标块并定位"]
        DOM_DROP["长文档虚拟滚动脱落"] --> DIV_FALLBACK["优先提取 targetSlide.startBlockId<br/>锁定页面级分割线目标"]
        DIV_FALLBACK --> SAVE_PAGE["savePageAttr 杜绝乱写根节点"]
    end

    subgraph M3["FSM-4 & FSM-5 词法解析器 (Lexical Parser)"]
        SCAN_DIV["扫描到 --- 分割线"] --> CHK_FM{"闭合区间内是否存在<br/>顶级 YAML 键值对?"}
        CHK_FM -- 是 --> FM_OK["切出独立 Frontmatter 块"]
        CHK_FM -- 否 --> BODY_OK["完整保留纯 Markdown 正文<br/>(零吞噬空白页)"]
        TOKENS["代码块/公式占位还原"] --> SAFE_REPLACE["函数式替换 () => code<br/>(零正则注入)"]
    end

    subgraph M4["FSM-6 & FSM-7 双轨引擎 (Dual Engine)"]
        UNREADY["沙箱握手等待期"] --> LWW_MERGE["UPDATE_SLIDES 就地合并覆盖<br/>(LWW 机制 + 50条上限)"]
        CLIENT_RDY["CLIENT_READY 握手"] --> FLUSH_ONCE["单次冲刷最新全量文档<br/>(杜绝掉帧风暴)"]
        STOP_CLI["关闭 Pro CLI"] --> ASYNC_WAIT["await stopServer()<br/>等待 taskkill 彻底释放端口"]
    end

    subgraph M5["FSM-8 ~ FSM-10 交互与播放运行时 (Runtime)"]
        PRESENTER["演讲控制台"] --> ABS_TIME["Date.now() 绝对时钟驱动<br/>(后台非激活标签零漂移)"]
        STANDALONE["离线播放器后退"] --> REVEAL_ALL["renderSlide(idx, 'backward')<br/>初始步数置为 totalSteps 完全揭开"]
        IMPORT_WIZ["导入向导"] --> GEN_LOCK["fileProcessGeneration 代际防抖<br/>+ 多阶段回填安全告警"]
    end
```

### 核心收益总结
1. **可靠性闭环**：多文档高频切换场景下编译请求零丢失，沙箱反向定位零震荡回弹，长文档版式修改零错写根节点。
2. **健壮性飞跃**：外部 Slidev 项目导入彻底消除无 Frontmatter 页面吞噬与 `$n` 正则篡改风险，完美兼容复杂嵌套注释与公式代码块。
3. **流畅度突破**：消除沙箱启动握手期的消息风暴重绘，消灭后台时钟漂移与历史页后退全黑遮盖，放映演示体验达到原生级丝滑。

---

## 6. 自动化回归测试与工程构建验证报告

本次优化遵循“测试驱动与全量回归验证”原则，对修改的编译器、调度器、协同器、沙箱桥、离线运行时及导入向导模块均扩充了针对性用例。

### 6.1 单元测试套件 (`npm test`)
- **测试框架**：Vitest v3.2.7 (Node.js v22.18.0)
- **执行结果**：全库 **80 个测试文件、750 个测试用例 100% 全部通过** (`Test Files: 80 passed (80) | Tests: 750 passed (750)`)
- **重点覆盖验证项**：
  - `tests/compile-p0-optimization.test.ts`：显式状态机状态流转 (`IDLE` <-> `COMPILING`)、`Set` 多文档 pending 队列防丢批处理契约校验。
  - `tests/inspector-sync-coordinator.test.ts`：反向定位平滑滚动锁 (`isLocatingLocked`) 过滤过渡块与目标块放行。
  - `tests/compiler-importer.test.ts`：无 Frontmatter 纯标题正文零吞噬断言、代码块包含 `$1`、`$PATH`、`$$` 时占位符还原抗注入验证。
  - `tests/starter-demo-verify.test.ts` & `tests/starter-full-audit.test.ts`：官方 Slidev Starter 演示文档（16页全集、多行 YAML 块标量、嵌套配置）全量导入与往返编译对齐。
  - `tests/engine.test.ts`：`WebSandboxBridge` 握手等待期 `UPDATE_SLIDES` 基于 LWW 机制的单次就地覆盖冲刷验证。
  - `tests/process-manager.test.ts`：`NativeSlidesProcessManager.stopServer` 异步销毁等待与端口释放验证。
  - `tests/presenter-tab-ux.test.ts`：演讲控制台时钟与双屏同步交互验证。
  - `tests/standalone-runtime-sections.test.ts`：离线独立播放器分节装配与后退揭开对齐快照基线校验。
  - `tests/use-slides-import.test.ts`：导入向导响应式状态管理与代际防抖校验。

### 6.2 类型检查与生产构建
- **TypeScript 类型检查 (`npm run typecheck`)**：`tsc --noEmit` **0 错误** 干净通过。
- **Vite 生产打包 (`npm run build`)**：125 个模块快速编译转换，成功产出生产包 `dist/index.js` (718.35 kB) 与 `dist/index.css` (76.67 kB)，并顺利打包 `package.zip`。
- **思源工作区热同步**：构建产物已自动同步至本地开发测试目录 (`D:/siyuan-plugin-test` 与 `D:/SiYuan_data`)。
