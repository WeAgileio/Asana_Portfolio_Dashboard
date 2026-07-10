## 1. Composable

- [x] 1.1 新增 `src/composables/useBytimeMonthColWidth.ts`：依各月 `collected`/`total` 組 billing 字串，估算最寬 px（下限 154），回傳 `monthColWidthPx` 與 CSS 變數 style 物件

## 2. BillingTasksByTime

- [x] 2.1 整合 composable，以 `monthColumnBillingAmounts` 驅動 `--bytime-month-col-w`
- [x] 2.2 更新 scoped CSS：`.bytime-col-month`、`.th-month`、月欄 td 改用 CSS 變數；表頭 th 加 width/min/max 與表身一致
- [x] 2.3 將 `BYTIME_MONTH_COL_W` 與 scroll 定位改為 composable 回傳值
- [x] 2.4 統一表身 scrollbar 隱藏（與表頭一致），保留 `scrollbar-gutter: stable`

## 3. ProgressTimelineByTime

- [x] 3.1 整合 composable（同 2.1）
- [x] 3.2 更新 scoped CSS（同 2.2）
- [x] 3.3 更新 scroll 定位常數（同 2.3）
- [x] 3.4 統一 scrollbar 行為（同 2.4）

## 4. 驗證

- [x] 4.1 手動驗證「請款進展·時間序」：載入即對齊、長 billing 完整顯示、橫向捲動後仍對齊
- [x] 4.2 手動驗證「專案進展·時間序」：同上
- [x] 4.3 Demo mode（`make demo`）確認 16 專案、250 萬級 billing 不截斷且格線對齊
