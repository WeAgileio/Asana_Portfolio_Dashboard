## Why

Notion 模式下，各專案頁的「狀態更新」目前完全不讀。檢視「專案進展」時無法一眼看出哪個專案自最近一個週六以來有人改過進度，必須逐頁打開 Notion。

## What Changes

- Notion 模式下，載入專案任務時一併查看該專案頁內標題為「狀態更新」的子資料庫，只取各列的上次編輯時間，不把那些列顯示成階段或任務。
- 「專案進展」頁的專案名左側，若任一列的上次編輯時間落在最近一個週六 00:00（台北時間）到現在，顯示燈泡 emoji 💡。沒有更新時不留空位。
- 請款進展、請款進展·時間序不顯示燈泡。Asana 與展示模式行為不變。

## Capabilities

### New Capabilities

- `notion-progress-update-hint`: 在「專案進展」的專案名前方，依「狀態更新」的上次編輯時間顯示本週已更新的燈泡提示。

### Modified Capabilities

- `notion-data-source`: 放寬「不讀狀態更新」——列仍不進入進展、請款或週統計，但可讀取上次編輯時間以供上述提示。

## Impact

- 後端：`server/notionSource.mjs` 在既有的專案子區塊掃描中多查一次「狀態更新」，把最近編輯時間附在專案或任務載入結果上。沿用現有五分鐘快取。
- 前端：`ProgressTimelineByTime.vue` 的專案名列。請款兩頁、`App.vue` 分頁、Asana 代理路徑不改。
- 規格：`openspec/specs/notion-data-source` 裡「不讀狀態更新」的敘述要改窄。
