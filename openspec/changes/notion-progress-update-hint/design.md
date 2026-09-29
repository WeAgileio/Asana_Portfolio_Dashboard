## Context

見 `proposal.md`。Notion 模式在 `taskBundle` 裡已經 `listAllBlocks` 找標題為「任務」的子資料庫，並明確跳過「狀態更新」。區段回應是 `{ data: AsanaSection[] }`，Asana 代理也是這個形狀。`fetchSectionsByProject` 只讀 `data`。專案進展、請款兩頁共用 `useProjectProgress`，名字列各自畫在頁面裡。

「狀態更新」每一列有 Notion 自動的 `last_edited_time`。某一列是全庫最新的編輯時間時，它落在窗內，就等於至少有一列落在窗內。

## Goals / Non-Goals

**Goals:**

- 在既有任務載入裡多一次「狀態更新」查詢，只取最新一列的上次編輯時間。
- 時間窗在顯示當下、以台北時間計算，快取裡放的是時間戳而不是布林。
- 燈泡只畫在「專案進展」的專案名之前。

**Non-Goals:**

- 不把「狀態更新」的標題、內文、編輯者畫出來。
- 不在請款頁、專案選擇器、Asana、展示模式顯示燈泡。
- 不為了跨過週六零點而自動重查。

## Decisions

1. **查最新一列，不掃歷史。** 找到「狀態更新」資料庫後，用 `last_edited_time` 降序、`page_size: 1` 查一列。沒有該資料庫或沒有列時，時間戳為 `null`。這次查詢的結果放進現有 `taskBundle` 快取（五分鐘），重新載入專案時跟任務一起略過快取。
   - 替代方案：用週六當下的 `on_or_after` 過濾再快取布林。週六 00:00 前後，舊快取會把上一輪的「有更新」繼續當成真。

2. **區段回應多一個旁路欄位。** Notion 的 `/projects/:gid/sections` 仍回 `{ data: sections }`，另加 `status_updated_at`（ISO 字串或 `null`）。Asana 代理不回這個欄位，前端當成 `null`。不改區段陣列的元素形狀。
   - 替代方案：新端點。多一次往返，而區塊清單在 `taskBundle` 裡已經有了。

3. **時間窗在前端算。** 純函式：把「現在」換算成 `Asia/Taipei` 的日曆日，往回找到最近的週六（當天是週六就用當天），起點為該日 00:00。`status_updated_at >= 起點` 才亮。函式放在前端可單獨用 node 測的模組，頁面只負責呼叫。
   - 替代方案：伺服器算好布林。開啟中的頁面跨過週六不會自己熄燈，而且測試要綁請求時間。

4. **提示掛在進度項目上，只有一頁畫出來。** `useProjectProgress` 在區段載入完成時寫入 `statusUpdatedAt`。`ProgressTimelineByTime` 在專案名連結之前，以 `v-if` 放 `<span>💡</span>`。`title` 與 `aria-label` 寫出狀態更新的最近編輯時間（台北時間）。載入中或值為 `null` 或不在窗內，不渲染這個元素。請款兩頁不讀這個欄位。

## Risks / Trade-offs

- [每個專案多一次 Notion 查詢] → 只取一列，並跟任務包一起快取；重新載入單專案時才略過。
- [整庫搬移或新增欄位會把每一列的上次編輯時間刷成同一秒，該週六之後的專案會一起亮] → 接受。這是選定「上次編輯時間」的代價，不另做內容比對。
- [頁面開著跨過週六 00:00，燈泡要等下次重繪才重算] → 時間戳已在前端，重繪會重算；不另加計時器。新的編輯仍要等快取過期或手動重新載入。

## Migration Plan

無資料遷移。退回時拿掉區段回應的 `status_updated_at` 與專案名上的燈泡即可，Asana 回應形狀不曾改變。

## Open Questions

無。
