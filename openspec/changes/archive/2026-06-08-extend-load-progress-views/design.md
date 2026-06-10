## Context

`BillingTasksByTime.vue` 已在 `page-header` 與 `page-main` 之間實作 `load-progress-banner`：以 `useProjectProgress` 的 `loading` 與 `items[].loadingTasks` 驅動，顯示「正在準備專案清單…」或「已載入 M / N 個專案」及進度條。`ProgressTimelineByTime.vue` 與 `BillingTasks.vue` 同樣使用 `useProjectProgress`，模板結構相近（`page-header` → `page-main`），但尚未有 banner；三頁若各自複製 template 與 CSS 將難以維護。

## Goals / Non-Goals

**Goals:**

- 三頁載入進度 UI 與行為一致（文案、indeterminate、determinate、最多 2 個載入中專案名稱）
- 抽取共用元件，單一來源維護樣式與 a11y
- 進度以 `items` 全量計算，不受搜尋／角色篩選影響
- `error` 存在時不顯示 banner（與 BillingTasksByTime 一致）

**Non-Goals:**

- 改變 `useProjectProgress` 載入策略或 API
- 在 banner 中反映篩選後子集進度
- 修改各頁表格內 per-row 的「任務載入中…」overlay

## Decisions

### 1. 共用元件 `ProjectLoadProgressBanner.vue`

新增 `src/components/ProjectLoadProgressBanner.vue`，接受 props：

- `loading: boolean` — 整批載入中
- `items: ProjectProgress[]` — 含 `loadingTasks` 與 `project.name`
- `hidden?: boolean` — 例如 `!!error` 時傳 true

元件內部以 computed 實作與 BillingTasksByTime 相同的邏輯（`loadProgressActive`、`loadProgressIndeterminate`、`loadProgressDone/Total/Percent`、`loadProgressPendingNames`），template 與 scoped CSS 自 BillingTasksByTime 移入。

**替代方案：** 僅 composable + 三處複製 template — 拒絕，CSS 與 markup 仍會漂移。

### 2. 三頁整合方式

各 view 在 `</header>` 與 `<main class="page-main">` 之間插入：

```vue
<ProjectLoadProgressBanner
  :loading="loading"
  :items="items"
  :hidden="!!error"
/>
```

- `BillingTasksByTime.vue`：移除 inline banner 與相關 computed／CSS，改為上述元件
- `ProgressTimelineByTime.vue`、`BillingTasks.vue`：新增 import 與同上用法

`BillingTasks.vue` 的 `displayRows` 來自篩選後的 `items`；banner 仍綁定原始 `items` ref，與 BillingTasksByTime 一致。

### 3. 樣式放置

Banner 樣式放在元件 scoped CSS 內。若三頁共用 `progress-page` 版面變數（如 banner 背景色），沿用 BillingTasksByTime 現有 token／色值，不新增全域 stylesheet。

## Risks / Trade-offs

- **[Risk] 元件 props 型別與各頁 items 結構不一致** → 使用既有 `ProjectProgress` 型別；三頁皆來自 `useProjectProgress`
- **[Risk] BillingTasksByTime 重構引入視覺 regression** → 重構前後對照 DOM 結構與 class 名稱保持一致
- **[Trade-off] 不抽取 composable** → 邏輯留在元件內即可；若未來第四頁需要可再抽 `useProjectLoadProgress`

## Migration Plan

1. 新增 `ProjectLoadProgressBanner.vue`
2. 重構 `BillingTasksByTime.vue` 使用元件並刪除重複程式
3. 在 `ProgressTimelineByTime.vue`、`BillingTasks.vue` 加入元件
4. `npm run build` 驗證

無資料遷移；可逐頁合併或一次 PR。

## Open Questions

（無）
