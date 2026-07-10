## Context

儀表板為 Vue 3 SPA + Express Asana 代理。三個進度／請款頁共用 `useProjectProgress`，經 `src/api/asana.ts` 呼叫 `fetchProjects`、`fetchProject`、`fetchSectionsByProject`、`fetchTasksBySection`。目前無 mock、無 demo mode；所有資料需 PAT 與真實 Asana。

展示需求（來自 explore）：live demo、可切 tab 與專案篩選、不暴露真實資料、獨立 demo URL 一鍵進入、不含十週更新統計。

## Goals / Non-Goals

**Goals:**

- Build-time `VITE_DEMO_MODE=true` 建置獨立 demo 映像
- Demo 部署開啟即進 dashboard，無 PAT
- Mock 僅覆蓋 progress 管線所需 4 個 API function
- Runtime 假資料生成（anchor = `today`），含多專案、多狀態、請款欄位
- 頂部「展示模式 · 示意資料」提示
- Demo compose／文件說明

**Non-Goals:**

- 正式環境同頁 mock／真實切換
- `WeeklyTrends` 與 search／stories API mock
- 後端 `server/index.mjs` demo 分支（除非未來改 runtime 切換）
- 修改 `useProjectProgress` 或三個 view 的業務邏輯
- Demo 內多 scenario 切換（進行中／全部完成等）

## Decisions

### 1. Build-time flag 而非 runtime env

**選擇**：`VITE_DEMO_MODE` 於 Vite build 嵌入 bundle（`import.meta.env.VITE_DEMO_MODE === 'true'`）。

**理由**：demo 部署物理隔離，bundle 內不可能誤連 Asana；tree-shake 可選擇性排除 mock 程式碼路徑於正式 build。

**替代方案**：後端 `DEMO_MODE` runtime — 需維護兩套路徑且正式映像仍有誤設風險；**不採**。

### 2. Mock 層放在 `src/api/asana.ts`

**選擇**：各 exported fetch function 開頭判斷 `isDemoMode()`，true 則委派 `src/demo/demoApi.ts`（或同目錄模組）。

```
fetchProjects()           → getDemoProjects()
fetchProject(gid)         → getDemoProject(gid)
fetchSectionsByProject()  → getDemoSections(projectGid)
fetchTasksBySection()     → getDemoTasks(sectionGid)
```

**理由**：`useProjectProgress` 與三 view 零改動；衍生邏輯（`calcSectionProgress`）照常運作。

**替代方案**：改 composable 注入 mock — 侵入性高；**不採**。

### 3. Runtime 生成器 + 模組級快取

**選擇**：`generateDemoDataset({ anchorDate: new Date() })` 於首次 mock API 呼叫時建立並快取於模組 singleton；同一 session 資料穩定。

**理由**：live demo 月欄永遠對齊「現在」；reload 後重新 generate 可接受。

**替代方案**：build 時寫死 JSON — 日期會過期；**不採**。

### 4. Auth：demo 自動登入

**選擇**：`auth.ts` 在 demo mode 下 `loadFromStorage()` 後若未登入，設定固定 token `"__demo__"` 與固定 `tokenHash`（例如 `"demo"`），使 `isLoggedIn === true`；`App.vue` 不渲染 `Login`。

**理由**：現有 axios interceptor 與 localStorage 鍵（`asana_progress_selected_project_gids_v1_<hash>`）可沿用；登出可清除並重新注入 demo token 或隱藏登出按鈕。

**建議**：demo 模式隱藏「登出」或改為無 op，避免誤進 Login。

### 5. App shell：tab 與 badge

**選擇**：`App.vue` 依 `isDemoMode()`：

- 不渲染「十週更新統計」tab 與 `WeeklyTrends` component
- 頂部 nav 顯示 badge「展示模式 · 示意資料」
- 預設 tab 維持 `progressByTime`

### 6. 假資料敘事（4 專案）

| 專案 | 敘事 | 預設勾選 |
|------|------|----------|
| 品牌官網改版 | 進行中，含 at-risk section | 是 |
| Q2 行銷活動 | 已完成 | 是 |
| CRM 系統整合 | 剛起步 | 是 |
| 內部知識庫建置 | 進行中 | 否（展示篩選） |

每專案 4–5 sections（需求確認、設計、開發、測試等），每 section 5–12 tasks。Task 直接帶 `billingAmount`、`billingTaskYes`（不需 custom field 解析）。

成員：`王小明`、`李美玲`、`陳大偉`、`林雅婷`（虛構）。

日期規則（相對 anchor）：

- 已完成 section：due 在 anchor 前 1–4 月，tasks 多數 `completed: true`
- in-progress：due anchor + 3～14 天
- at-risk：至少 1 task `due_on` = anchor - 3 天且未完成
- not-started：section 內 tasks 全未完成、due 在 anchor + 1～3 月

Gid 使用穩定假 gid（如 `demo-proj-1`），避免與真實 Asana gid 格式混淆即可。

### 7. 部署

**選擇**：

- `Dockerfile` 新增 `ARG VITE_DEMO_MODE=`、`ENV VITE_DEMO_MODE=$VITE_DEMO_MODE`
- 新增 `docker-compose.demo.yml`：`image: ...:demo` 或 build-arg demo
- `README.md` 新增「展示部署」章節

Demo 容器**不設定** `ASANA_DEFAULT_PAT`。後端仍可跑（serve 靜態），但 demo bundle 不發 `/api` 請求至需 auth 的 endpoint（mock 在 frontend 短路）。

**可選優化**：demo 純靜態 nginx — 非必要，現有單容器架構可保留。

## Risks / Trade-offs

| 風險 | 緩解 |
|------|------|
| Mock 與真實 API 行為漂移 | Mock 回傳型別對齊 `AsanaProject`／`AsanaTask`；僅覆蓋 4 functions |
| Demo URL 被公開爬取 | 文件建議子網域 + 可選 Basic Auth；資料本身全虛構 |
| `permalink_url` 點出連到假 gid | Demo task 的 permalink 可為 `#` 或 example.com 佔位 |
| 每次 reload 數字微變 | 可接受；必要時改 session 級 seed |
| 正式 build 誤開 demo flag | CI 僅 demo job 傳 `VITE_DEMO_MODE=true`；預設空/false |

## Migration Plan

1. 實作 mock 與 demo flag（不影響正式 build）
2. 本機驗證：`VITE_DEMO_MODE=true npm run dev`
3. 建置 demo 映像並 push tag `:demo`
4. 新 host／port 部署 `docker-compose.demo.yml`
5. 正式部署不變；rollback 為停止 demo 容器

## Open Questions

- Demo 映像是否納入現有 GitHub Release workflow 自動建 `:demo` tag？（建議後續 PR 加 job，非本 change 阻擋項）
- 是否在正式 Login 頁加「前往展示環境」連結？（建議 optional follow-up）
