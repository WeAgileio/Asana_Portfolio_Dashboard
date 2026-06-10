## 1. 進度狀態（script）

- [x] 1.1 在 `BillingTasksByTime.vue` 新增 computed：`loadProgressTotal`、`loadProgressDone`、`loadProgressActive`、`loadProgressPercent`（依 `items` 與 `loadingTasks` / `loading` 推導）
- [x] 1.2 新增 computed `loadProgressPendingNames`（可選）：最多列出 2 個仍 `loadingTasks` 的專案名稱，供 banner 副標使用

## 2. 進度 UI（template）

- [x] 2.1 在 `page-header` 與 `page-main` 之間（或 `page-main` 頂部）加入 `load-progress-banner`，`v-if="loadProgressActive"`
- [x] 2.2 當 `loading && items.length === 0` 時顯示 indeterminate 文案（例如「正在準備專案清單…」）
- [x] 2.3 當 `items.length > 0` 且有專案仍載入時，顯示「已載入 M / N 個專案」與 determinate 進度條
- [x] 2.4 為 banner 加上 `role="status"`、`aria-live="polite"`，進度條加上 `aria-valuenow` / `aria-valuemax`（determinate 時）

## 3. 樣式與互動

- [x] 3.1 新增 scoped CSS：全寬 banner、與現有 `progress-page` 配色一致，不放入橫向 scroll 容器
- [x] 3.2 確認 banner 顯示時不影響 sticky 表頭與既有 `bytimeDragScrollDisabled` 行為
- [x] 3.3 確認全部專案 `loadingTasks === false` 且 `loading === false` 後 banner 自動隱藏

## 4. 驗證

- [x] 4.1 手動測試：首次進頁、重新載入、重新同步數據 — 進度由 0/N 增至 N/N 後消失
- [x] 4.2 手動測試：單專案列「重新載入」時 banner 短暫出現且計數合理
- [x] 4.3 執行 `npm run build` 確認 TypeScript 與編譯無誤
