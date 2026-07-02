## 1. 篩選／排序工具

- [x] 1.1 新增 `src/utils/projectPickerFilter.ts`：`filterByName`、`filterByCreatedAt`（全部／近 0.5·1·3·5 年／年份／起迄）、`sortProjects`（創建新→舊／舊→新 + 名稱 default/A→Z/Z→A）
- [x] 1.2 新增 `formatProjectCreatedAt(created_at)` 輔助函式

## 2. ProjectPickerPanel 元件

- [x] 2.1 新增 `ProjectPickerPanel.vue`：overlay、篩選列（名稱搜尋、創建篩選、創建排序、名稱排序）、列表含建立日期、計數、空狀態
- [x] 2.2 實作 `v-model:selectedGids`、已選計數（含 hidden 提示）、關閉時重置篩選 UI
- [x] 2.3 遷移 picker 樣式與 `.picker-actions .reload-btn` 至元件

## 3. 三頁遷移

- [x] 3.1 `ProgressTimelineByTime.vue` 改用 `ProjectPickerPanel`，移除重複 markup/CSS
- [x] 3.2 `BillingTasksByTime.vue` 同上
- [x] 3.3 `BillingTasks.vue` 同上

## 4. 驗證

- [x] 4.1 `npm run build` 通過
- [x] 4.2 手動驗收：名稱搜尋、近 0.5·1·3·5 年／年份／起迄、創建排序、名稱 A→Z、列顯示日期、隱藏已選仍套用、關閉重置篩選
