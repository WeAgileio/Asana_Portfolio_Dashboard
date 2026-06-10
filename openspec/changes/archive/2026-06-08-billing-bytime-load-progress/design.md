## Context

`BillingTasksByTime.vue` 透過共用 composable `useProjectProgress` 載入專案進度。`loadProgress()` 流程為：先設 `loading = true` → 取得專案清單與 sections → 建立 `items`（每列 `loadingTasks: true`）→ 各專案並行拉取 section 任務 → 完成後該列 `loadingTasks: false`，全部結束後 `loading = false`。

目前 UI 僅在 `loading && items.length === 0` 時顯示全頁「正在載入…」，表格出現後各列有「任務載入中…」遮罩，但**缺少跨專案的整體進度摘要**。本頁與 `ProgressTimelineByTime.vue` 結構類似，但本次僅改請款時間序頁。

## Goals / Non-Goals

**Goals:**

- 在工具列下方、主表格上方顯示載入進度條／文字，讓操作者知道「共 N 個專案、已完成 M 個」。
- 進度在「整批載入」與「部分專案仍 `loadingTasks`」期間可見；全部完成後隱藏。
- 樣式與現有 `progress-page` 工具列一致（字級、配色），不遮擋 sticky 表頭邏輯。
- 優先在 view 內以 `computed` 從 `items` 推導進度；若邏輯可重用再考慮 composable 小 helper。

**Non-Goals:**

- 不在此變更中為 `ProgressTimelineByTime` 或其他頁面加同款進度（可後續抽取元件）。
- 不顯示 section／任務層級的細粒度 API 請求數。
- 不改變 `loadProgress` 的載入策略、快取或 INITIAL_LOAD_LIMIT。

## Decisions

### 1. 進度資料來源：view 層 computed

**決策**：在 `BillingTasksByTime.vue` 新增 computed，例如：

- `loadProgressTotal` = 目前 `items` 中應載入的專案數（`items.length`）
- `loadProgressDone` = `items.filter(i => !i.loadingTasks).length`
- `loadProgressActive` = `loading || items.some(i => i.loadingTasks)`
- `loadProgressPercent` = total > 0 ? done / total : 0

**理由**：`loadingTasks` 已存在且準確反映各專案任務是否載完；無需改 API 或 composable 即可滿足需求。

**替代方案**：在 `useProjectProgress` 匯出 `projectsLoadProgress` — 較適合多頁共用，但本次 YAGNI，除非實作時發現 duplicated logic。

### 2. 顯示時機

**決策**：

- `loading && items.length === 0`：顯示「正在準備專案清單…」（或沿用現有全頁 loading，並在 header 下加 slim 進度條 indeterminate）。
- `items.length > 0 && anyProjectLoadingTasks`：顯示 determinate 進度「已載入 M / N 個專案」+ 進度條。
- 可選：列出 1～2 個仍 `loadingTasks` 的專案名稱（truncate），避免列表過長。

**理由**：section 前置階段與任務並行階段使用者感知不同，分開文案較清楚。

### 3. UI 位置與元件形式

**決策**：在 `<header class="page-header">` 與 `<main class="page-main">` 之間，或 `page-main` 最上方插入 `div.load-progress-banner`（全寬、sticky 可選否 — 預設不 sticky，避免與表頭 sticky 衝突）。

**理由**：符合「畫面上方、表格上方」；不嵌入橫向 scroll 容器，避免裁切。

### 4. 無障礙

**決策**：使用 `role="status"`、`aria-live="polite"`，進度條用 `aria-valuenow` / `aria-valuemax`（若為 determinate）。

## Risks / Trade-offs

- **[Risk] `items` 在 section 階段已全部建立但任務未開始** → 短時間內顯示 0/N；可接受，文案可寫「正在載入專案任務…」。
- **[Risk] 單專案 `reloadProjectProgress` 時 total 仍為全部 items** → 進度條可能短暫顯示 N-1/N；可接受，或僅在 `loading` 全批時顯示 banner（trade-off：單專案重載無 banner）。**Mitigation**：banner 在 `anyProjectLoadingTasks` 時顯示，含單專案重載，文案仍正確（done 會暫減 1）。
- **[Risk] 與現有全頁 empty loading 重複** → **Mitigation**：有 items 後隱藏全頁 loading，僅保留 banner；或合併為單一進度 UX。

## Migration Plan

- 純前端 UI 變更，部署後重新整理即可；無資料遷移。
- 回滾：移除 banner 區塊與相關 computed／樣式。

## Open Questions

- 是否需要在「準備階段」也顯示 indeterminate 進度條（目前傾向是）。
- 是否在後續將 banner 抽成 `ProjectLoadProgressBanner.vue` 供 ProgressTimelineByTime 共用（本次不強制）。
