## 1. 設定與來源開關

- [x] 1.1 在 `server/index.mjs` 讀取 `DATA_SOURCE`（只允許 `asana` 或 `notion`，空值視為 `asana`，其他值啟動失敗）與 `NOTION_ROOT_PAGE_ID`（空值為 `3e353bdeb3b1803ea05ec8b6873d9f4d`），並提供 `GET /api/config` 回 `{ dataSource }`。驗證：未設定時回應 `asana`；設成 `notion` 後重啟回應 `notion`；設成其他值時程序退出並印出該值。
- [x] 1.2 在 `.env.example` 註記 `DATA_SOURCE` 與 `NOTION_ROOT_PAGE_ID`，並寫明不使用 `NOTION_TOKEN`。驗證：範例檔含這兩項，且沒有要求把整合金鑰寫進環境變數。

## 2. 登入卡與分開存放的金鑰

- [x] 2.1 前端在非展示模式時先讀 `/api/config`。`notion` 時登入卡文案改為 Notion 整合金鑰，提交時打後端探針而不是 `/api/workspaces`。驗證：`DATA_SOURCE=notion` 且未登入時只見登入卡，看不到主分頁。
- [x] 2.2 後端探針用請求 Bearer 與 `Notion-Version` 讀取根頁面；失敗回 401。前端只在成功後把金鑰加密寫入與 `asana_pat_enc` 不同的鍵。驗證：讀得到根頁面才進入主畫面；金鑰錯誤或頁面未分享時停在登入卡並顯示錯誤，且 Asana PAT 的儲存鍵內容不變。
- [x] 2.3 Notion 模式的登出只清 Notion 金鑰並回到登入卡。展示模式仍略過登入、不採用 `/api/config`。驗證：登出後再整理仍要重新輸入金鑰；`VITE_DEMO_MODE=true` 時即使 `DATA_SOURCE=notion` 也不出現登入卡、不打 Notion。

## 3. Notion 對成現有專案與任務

- [x] 3.1 `DATA_SOURCE=notion` 時，`/api/projects` 與 `/api/projects/:gid` 改讀根資料庫：gid 優先 `AsanaID`，名稱用 `名稱`，建立時間用頁面建立時間，連結用 Notion 頁面網址，`主設計` 與 `窗口` 轉成顯示名稱放進成員。`狀態=完成` 的列仍回傳。驗證：有 `AsanaID` 的列其 gid 等於該值；完成的專案仍在清單中。
- [x] 3.2 `/api/projects/:gid/sections` 掃描該專案頁標題恰好為「任務」的子資料庫，依 `階段` 選項順序只回有任務的階段，gid 為 `notion-section:{projectGid}:{階段名}`。不讀「狀態更新」。驗證：沒有列的階段不出現；「狀態更新」的列不會變成階段或任務。
- [x] 3.3 `/api/sections/:gid/tasks` 依階段 gid 篩選該任務庫：`完成` 為已完成，`進行中` 與 `未開始` 為未完成，截止日為 `計畫完成時間` 的開始日期，`請款任務` 設為請款任務，金額用任務的 `請款金額`。驗證：一筆進行中的請款任務在回應裡是未完成、`billingTaskYes` 為真，且金額不是專案列上的請款金額。
- [x] 3.4 Notion 回應走現有記憶體快取時，快取鍵含權杖雜湊與路徑。驗證：換一把金鑰或切回 Asana 後不會拿到上一把金鑰的專案清單。

## 4. 畫面沿用與 Asana 不變

- [x] 4.1 Notion 模式隱藏「十週更新統計」，保留「專案進展」「請款進展」「請款進展·時間序」與登出。Asana 模式仍顯示十週分頁。驗證：兩邊登入後的頂部分頁符合上述可見性。
- [x] 4.2 以 Notion 金鑰走完專案選擇、進展與請款頁，確認階段、完成狀態、截止日與請款任務來自任務庫。驗證：抽一個已知專案，畫面上的階段只含有任務的 C 階段，請款頁金額對得上任務的請款金額。
