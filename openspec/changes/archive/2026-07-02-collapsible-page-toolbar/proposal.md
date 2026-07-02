## Why

專案進展、請款進展、請款進展·時間序三個頁面的 header 工具列在寬度不足時會意外換行，佔用垂直空間並壓縮下方表格可視區。使用者需要在預設完整工具列的前提下，能一鍵隱藏整條工具列以最大化資料區，並以清楚文字與小標籤還原。

## What Changes

- 新增共用 `PageToolbar` 元件，取代三個 view 中重複的 `page-header-toolbar`
- 工具列右端提供 **「隱藏」** 文字按鈕；隱藏後 `page-header` 高度為 **0px**（不占版面）
- 隱藏後於內容區上緣 **偏右** 顯示小標籤 **「顯示工具列」**，作為唯一還原入口
- 預設顯示完整工具列（與現行寬螢幕一致）；寬度不足且使用者未偏好永遠顯示時，自動隱藏
- 使用者手動點「顯示工具列」後，若仍塞不下則改橫向捲動，不再自動隱藏
- 「重新同步」保留工具列內；「重新載入」同列顯示（寬度不足時隨整條工具列一起隱藏）
- 偏好存入 `localStorage`（`pageToolbarHidden`）
- 三頁透過 slot 注入差異（專案進展含角色篩選 slot）
- 移除 `<900px` toolbar column 堆疊媒體查詢

## Capabilities

### New Capabilities

- `page-toolbar`: 可隱藏／顯示的頁面工具列——含 0px 隱藏、偏右小標籤還原、自動隱藏、localStorage 記憶、三頁共用 slot

### Modified Capabilities

（無既有 spec）

## Impact

- **新增**：`src/components/PageToolbar.vue`
- **修改**：`ProgressTimelineByTime.vue`、`BillingTasksByTime.vue`、`BillingTasks.vue`
- **樣式**：各 view 重複 toolbar CSS 遷移至共用元件
- **無 API／後端變更**
