# 速览微浏览器 SPA 跳页 404 案例分析与 Webview src 绑定避坑指南

> 适用版本：`siyuan-live-slides` v0.9.0+
> 状态：已修复（67 套件 / 608 测试全绿，typecheck 与构建通过）
> 最后更新：2026-10-25
> 关联改动：`src/ui/components/peek/WebviewPeekDrawer.vue`（webview `src` 属性与响应式状态解耦）
> 关联文档：《编译链路性能优化与内核契约避坑指南》（其中已收录 webview partition/代理契约，本文补充 src 与导航事件契约）

---

## 一、问题现象

速览抽屉（微型浏览器）访问外部网站时，不同站点表现分裂：

| 站点 | 表现 | 后文定位 |
|---|---|---|
| `https://subpal.netlify.app/` | 一切正常 | 纯单屏应用，URL 永不变 → **躲过** bug，而非免疫 |
| `https://posedirector.netlify.app/` | 首页正常；点 Library 跳 `/library` 后**短暂显示次级页，随即变成 Netlify "Page not found" 404 页** | 命中完整因果链 |
| `https://chat-any.netlify.app/` | 同上（次级页 404） | 同上 |

**关键判别特征**：报错页**不是**插件的「页面加载失败」诊断卡片，而是 **Netlify 官方 404 模板页**。这说明它是一次"成功"的 HTTP 加载——服务器返回了 404 状态的 HTML 并被 webview 正常渲染；而代理/DNS/证书类网络失败会走 `did-fail-load` 并弹出插件自己的诊断卡（`WebviewPeekDrawer.vue` 中 `onDidFailLoad`）。**看清报错页的"身份"，第一秒就能排除一半假设。**

---

## 二、定位过程（证据链）

结论先行：**三重因素叠加**——插件侧一个隐蔽的响应式绑定 bug × Electron webview 的 `src` 属性契约 × 托管站点未配置 SPA 回退（fallback）。三者缺一，此症状都不会出现。

### 2.1 证据一：深链接 HTTP 状态实测（curl，2026-10-25）

| URL | 状态码 | 说明 |
|---|---|---|
| `https://posedirector.netlify.app/` | 200 | 首页正常 |
| `https://posedirector.netlify.app/library` | **404** | Netlify 默认 404 页，与用户截图完全一致 |
| `https://chat-any.netlify.app/chat` | **404** | 同上 |
| `https://subpal.netlify.app/any/random/deep/path` | **404** | **正常站点深链接同样 404！** |

subpal 深链接也 404，直接推翻了第一猜想"subpal 配置了 SPA fallback 所以没事"。它正常的真实原因见 2.3。

### 2.2 证据二：Electron webview `src` 属性契约（源码确认）

核对 Electron 源码 `lib/renderer/web-view/web-view-attributes.ts` 的 `SrcAttribute`：

- webview 元素上 **`src` 属性一变，MutationObserver 立即调 `parse()` → `loadURL()`**，对已加载页面发起全新的整页导航；
- 页面内部导航（含 SPA pushState）**不会**反向同步 `src` 属性；
- 程序化导航（`wv.loadURL()`）内部以 `setValueIgnoreMutation` + `observer.takeRecords()` 屏蔽自身回写，避免循环。

即：**`src` 属性是"一次性点火开关"，不是"实时地址的镜像"**。任何把它当双向绑定来用的框架写法（Vue `:src` 绑响应式 ref），都会把"显示当前地址"变成"强制重载到当前地址"。

### 2.3 证据三：对照组 subpal 的 bundle 反查

下载 `https://subpal.netlify.app/assets/index-*.js`（312KB）检索：`react-router` / `BrowserRouter` / `HashRouter` / `wouter` / `useNavigate` / `pushState` —— **全部 0 命中**。

subpal 是无路由库的纯单屏应用：URL 永远停在 `/`，`did-navigate-in-page` 永不触发，`currentUrl` 永不更新，`src` 属性永不被回写 → **从未进入 bug 路径**。

顺带说明 hash 路由站点（`/#/page`）为何也无症状：`src` 回写虽仍触发 `loadURL`，但仅 hash 不同的导航属同文档（same-document）导航，Chromium 只定位锚点不重载文档——这正是本 bug 此前长期潜伏、直到遇到 **history 路由 + 无 fallback** 站点组合才暴露的原因。

### 2.4 完整因果链（以 posedirector 点 Library 为例）

```
挂载：<webview :src="currentUrl"> ──> 加载 https://posedirector.netlify.app/ ✓
点击 Library：
  1. SPA pushState 页内路由 ──> 新页面立即渲染        ← 用户看到"短暂显示次级页"
  2. did-navigate-in-page 事件 ──> onDidNavigateInPage 更新 currentUrl = .../library
  3. Vue 因 :src 绑定回写 webview 的 src 属性
  4. Electron SrcAttribute 契约 ──> 强制 loadURL(.../library) 整页 GET
  5. 站点未配 SPA fallback ──> Netlify 返回 404 HTML   ← 404 页替换掉次级页
```

"短暂显示后报错"的时序差 = 步骤 1 的同步渲染与步骤 4 网络往返之间的几百毫秒。

---

## 三、修复方案

核心思路一句话：**`src` 属性只负责"首次点火"，此后一切导航通过 `wv.loadURL()` 驱动；`currentUrl` 退化为纯展示状态（地址栏显示、复制、外跳）。**

### 3.1 模板：`src` 改绑挂载时一次性取值（`WebviewPeekDrawer.vue:130`）

```diff
- <webview :src="currentUrl" ...>
+ <webview :src="initialUrl" ...>
```

模板注释块同步追加「注意 2」：严禁把 `src` 改绑回 `currentUrl`，防止后人"顺手简化"导致回归。

### 3.2 脚本：新增一次性常量（`WebviewPeekDrawer.vue:303`）

```ts
// webview 的 src 属性只在挂载时取一次初始值，此后永不回写
const initialUrl = props.url
```

`currentUrl` / `urlInputValue` 在桌面端仅作地址栏展示；`did-navigate` / `did-navigate-in-page` / `did-stop-loading` 的事件处理器**无需任何改动**——它们更新 `currentUrl` 从此只是纯赋值，不再有 DOM 副作用。既有导航路径（`watch(props.url)` 与地址栏回车 `navigateToUrl()`）原本就已调用 `wv.loadURL()`，天然适配。

组件由 `SlidesPreviewTab.vue` 以 `v-if="hasOpenedWeb"` 常驻挂载一次、`v-show` 切换可见性；`hasOpenedWeb` 与 `peekUrl` 在同一同步代码块赋值，Vue 批量渲染后挂载时 `props.url` 必为真实地址，`initialUrl` 取值可靠。

### 3.3 iframe 降级分支为何刻意不改

Web/Docker 环境的 `<iframe :src="currentUrl">` **保留原绑定**：

- iframe 分支没有 `did-navigate-*` 事件，`currentUrl` 只会被用户动作（地址栏回车、props 变更）改写，不存在"事件回写漂移"，无此 bug；
- 更重要的是，iframe 没有命令式导航 API，`src` 绑定**就是它唯一的导航机制**，改掉等于砍掉地址栏导航。

### 3.4 验证

- `npm test`：67 套件 / 608 测试全绿；
- `npm run typecheck`：通过；
- `npm run build`：构建成功并同步至思源插件目录；
- 手动验收：速览打开 `https://posedirector.netlify.app/`，点 Library → 次级页正常停留，地址栏仍实时跟踪 `/library`，后退/前进/刷新正常。

---

## 四、避坑契约速查表（本次新增认知，触及 webview 必读）

| 契约点 | 结论 | 依据 |
|---|---|---|
| **webview `src` 属性变更 = 强制导航** | 属性一变即 `loadURL()` 整页重载，与"当前是否已加载页面"无关；`src` 是点火开关，不是地址镜像 | Electron `web-view-attributes.ts` 的 `SrcAttribute.handleMutation` |
| **页内导航不回写 `src`** | SPA pushState、锚点等只触发 `did-navigate-in-page`，`src` 属性保持原值 | Electron webview 语义 |
| **响应式框架禁止绑 `src` 到会漂移的状态** | Vue `:src` / React `src={state}` 绑定导航事件更新的 ref，都会造成"每次页内路由 → 强制整页重载" | 本文根因 |
| **同文档导航不重载** | 仅 hash/锚点不同的 `loadURL` 只定位不重载——hash 路由站点因此对强制重载免疫 | Chromium same-document navigation 语义 |
| **HTTP 4xx/5xx 不是加载失败** | `did-fail-load` 不触发，webview 如实渲染服务器返回的错误页；插件的诊断卡只覆盖网络层失败 | Electron `did-fail-load` 触发条件 |
| **`new-window` 拦截后 `loadURL` 是整页导航** | 对 `target="_blank"`/`window.open` 的拦截重定向同样绕不过"深链接无 fallback 即 404" | `WebviewPeekDrawer.vue` 的 `onNewWindow` |

---

## 五、遗留边界（非插件职责，如实呈现即可）

1. **硬刷新深链接仍会 404**：用户在 `/library` 上点刷新，或站点内链用 `target="_blank"`（被 `onNewWindow` 拦截后就地加载），仍会整页请求 `/library` 而 404——这与真实浏览器刷新行为完全一致。根治在站点侧：Netlify 加 `_redirects`（`/* /index.html 200`）或 `netlify.toml` 的 `[[redirects]]`，这也是普通浏览器刷新/分享深链接所必需的部署配置。
2. **404 叠加提示不可行**：曾考虑对 4xx/5xx 叠加一行"该站点未配置 SPA fallback"提示，但 `webRequest`/`session` API 属主进程，插件运行在渲染进程拿不到，无法低成本探测 HTTP 状态码；维持"如实呈现服务器响应"。

---

## 六、方法论小结

1. **报错页的"身份"比报错本身信息量大**：Netlify 模板 404 ≠ 插件诊断卡 ≠ Chromium 错误页，三者分别指向"服务器响应/网络层/渲染层"，先分诊再排查。
2. **对照组是最好的实验设计**：三个站点中"正常"的 subpal 恰好是关键对照组——深链接同样 404 却无症状，说明"站点是否配 fallback"不是分界变量；反查它的 bundle（无路由库）才锁定真正的分界变量是"URL 是否会变"。
3. **框架直觉 × 宿主语义冲突是隐藏 bug 高发区**：Vue 教会我们"状态绑定属性"，Electron webview 却把属性当命令；两者叠加时单测（无真实 Electron）和纯 Web 环境都测不出来，只能靠契约速查表防御性约束，并把禁忌写进模板注释。
4. **"看起来正常"的站点可能只是没踩到路径**：修复验证时除了复现失败站点，也要解释成功站点为什么成功（躲过 ≠ 免疫），否则无法确信修复覆盖了全部路径。
