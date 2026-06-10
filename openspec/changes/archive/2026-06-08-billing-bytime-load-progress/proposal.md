## Why

「請款進展·時間序」（`BillingTasksByTime.vue`）在重新載入或首次進入時，會依專案逐批向 Asana 拉取 section 與任務；目前僅有全頁「正在載入…」或各列遮罩，操作者無法在畫面上方一眼看出**已載入多少專案、尚有多少專案在載入**，等待時缺乏整體進度感。

## What Changes

- 在 `BillingTasksByTime.vue` 頁面**主內容區上方**（工具列下方）新增載入進度區塊，於資料載入期間顯示。
- 進度資訊至少包含：**已完成專案數／總專案數**、視覺化進度（例如進度條或百分比），並可選擇性顯示**目前正在載入的專案名稱**。
- 進度應反映 `useProjectProgress` 內各專案 `loadingTasks` 狀態；整批 `loading === true` 且尚無專案列時，可顯示「準備載入」或 section 前置階段提示。
- 載入完成後自動隱藏進度區塊；不影響既有表格、篩選、橫向捲動與單專案重新載入行為。
- 若需從 composable 匯出衍生狀態（例如 `projectsLoadProgress` computed），變更應保持與其他共用 `useProjectProgress` 的頁面向後相容。

## Capabilities

### New Capabilities

- `billing-bytime-load-progress`: 請款進展·時間序頁面在載入專案資料時，於畫面上方展示可讀的整體載入進度與專案完成情況。

### Modified Capabilities

- （無既有 `openspec/specs/` 主規格需修改）

## Impact

- **主要檔案**：`src/views/BillingTasksByTime.vue`（模板、樣式、本地 computed）
- **可能涉及**：`src/composables/useProjectProgress.ts`（若將進度彙總邏輯抽到 composable 供此頁與未來頁面共用）
- **不影響**：Asana API、後端代理、路由與其他進度／請款視圖的預設行為（除非刻意共用新 composable 匯出）
