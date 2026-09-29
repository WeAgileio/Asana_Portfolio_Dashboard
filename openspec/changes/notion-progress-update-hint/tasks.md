## 1. 週六時間窗

- [x] 1.1 新增可被前端與 `node --test` 共用的純函式：給定一個瞬間，回傳 `Asia/Taipei` 最近一個週六（當天是週六則用當天）的 00:00，並判斷一個 ISO 時間戳是否落在該起點到現在。驗證：`node --test` 涵蓋週二往回的週六、當天就是週六、週六 00:00 算在窗內、週六前一刻算在窗外。

## 2. 讀取狀態更新的上次編輯時間

- [x] 2.1 在 `taskBundle` 掃描子區塊時，若有標題恰好為「狀態更新」的資料庫，以 `last_edited_time` 降序取一列，把該列的上次編輯時間放進任務包；沒有資料庫或沒有列則為 `null`。此值跟現有五分鐘快取一起走，單專案重新載入時一起略過快取。驗證：`node --test server/notionSource.test.mjs` 用假的查詢結果確認取到最新一列的時間，空結果為 `null`，且這些列不會變成階段或任務。
- [x] 2.2 Notion 的 `/projects/:gid/sections` 在原有 `{ data }` 之外回 `status_updated_at`。Asana 代理不回這個欄位。驗證：有「狀態更新」列時回應帶 ISO 時間；沒有該資料庫時為 `null`；Asana 模式的區段回應沒有這個欄位。

## 3. 專案進展的燈泡

- [x] 3.1 `fetchSectionsByProject` 讀取 `status_updated_at`（沒有則為 `null`），`useProjectProgress` 在區段載入完成時寫入該專案的 `statusUpdatedAt`。展示模式維持 `null`。驗證：Notion 區段回應帶時間時，進度項目上看得到同一字串；Asana 與展示模式為 `null`。
- [x] 3.2 只在 `ProgressTimelineByTime` 的專案名連結之前，於時間窗內以 `v-if` 顯示 💡，並用 `title` 與 `aria-label` 寫出台北時間的最近編輯時間。載入中、窗外、或沒有時間戳時不渲染，名字不預留空位。請款兩頁不畫燈泡。驗證：窗內專案的名字前方有燈泡且可讀出編輯時間；窗外與請款頁的專案名沒有燈泡。
