## 1. PageToolbar 元件

- [x] 1.1 建立 `src/components/PageToolbar.vue`，含 `v-model:hidden`、完整工具列 panel、偏右小標籤「顯示工具列」
- [x] 1.2 工具列右端「隱藏」按鈕（ghost 樣式、`aria-label`）
- [x] 1.3 隱藏時 panel 0px 不占流式高度；小標籤 `position` 偏右（`right: 20px` 對齊 page padding）
- [x] 1.4 `localStorage` 讀寫 `pageToolbarHidden`；手動顯示時設 `userPrefersVisible`
- [x] 1.5 slots：`search`、`filters-inline`、`role-filter`、`legend`；內建 resync、reload、picker emits
- [x] 1.6 撰寫共用 toolbar CSS（單排 nowrap、可選 scrollable）

## 2. 自動隱藏

- [x] 2.1 ResizeObserver + debounce 偵測 overflow
- [x] 2.2 overflow 且非 `userPrefersVisible` 時自動 `hidden = true`
- [x] 2.3 手動顯示後啟用橫向捲動，不自動再隱藏

## 3. 遷移 BillingTasks

- [x] 3.1 替換 header 為 `PageToolbar`
- [x] 3.2 接入 search、filters-inline（排序）、legend slots
- [x] 3.3 移除重複 toolbar CSS 與 column 媒體查詢

## 4. 遷移 BillingTasksByTime

- [x] 4.1 替換 header 為 `PageToolbar`
- [x] 4.2 接入 search、filters-inline、legend slots
- [x] 4.3 移除重複 toolbar CSS 與 column 媒體查詢

## 5. 遷移 ProgressTimelineByTime

- [x] 5.1 替換 header 為 `PageToolbar`
- [x] 5.2 接入 search、filters-inline、role-filter、legend slots
- [x] 5.3 `@hide` 關閉角色篩選 popover
- [x] 5.4 移除重複 toolbar CSS 與 column 媒體查詢

## 6. 驗證

- [x] 6.1 寬螢幕：完整工具列 +「隱藏」
- [x] 6.2 點「隱藏」→ 0px + 偏右「顯示工具列」標籤
- [x] 6.3 點標籤還原、localStorage 記憶
- [x] 6.4 窄螢幕自動隱藏；手動顯示後橫向捲動
- [x] 6.5 三頁行為一致
