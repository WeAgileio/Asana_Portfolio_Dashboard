## Why

請款進展·時間序頁面（`BillingTasksByTime.vue`）已具備專案載入進度 banner，使用者可在背景逐專案載入任務時掌握整體進度；進展時間軸（`ProgressTimelineByTime.vue`）與請款進展（`BillingTasks.vue`）使用相同的 `useProjectProgress` 載入模式，卻缺少同等視覺回饋，造成三頁體驗不一致。

## What Changes

- 將 `BillingTasksByTime.vue` 的載入進度 banner（文案、進度條、不確定狀態、載入中專案名稱）套用到 `ProgressTimelineByTime.vue` 與 `BillingTasks.vue`
- 抽取共用元件或 composable，避免三處重複 template 與樣式
- 進度計算以 `items`（全量專案列）為準，不受頁面內搜尋／篩選影響
- banner 置於 `page-header` 與 `page-main` 之間，載入完成後自動隱藏；錯誤狀態下不顯示

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `billing-bytime-load-progress`：將載入進度 banner 需求從單一「請款進展·時間序」頁擴展至「進展時間軸」與「請款進展」頁，三頁行為一致

## Impact

- `src/views/BillingTasksByTime.vue` — 重構為使用共用 banner 元件
- `src/views/ProgressTimelineByTime.vue` — 新增載入進度 banner
- `src/views/BillingTasks.vue` — 新增載入進度 banner
- 新增共用元件（如 `ProjectLoadProgressBanner.vue`）及可選 composable（如 `useProjectLoadProgress`）
- 無 API、路由或後端變更
