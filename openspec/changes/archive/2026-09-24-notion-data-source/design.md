## Context

見 `proposal.md`。現況是前端 `src/api/asana.ts` 在 `VITE_DEMO_MODE` 時改走 `src/demo/`，否則以 Bearer PAT 打 `/api/*`，由 `server/index.mjs` 代理 Asana。登入卡先打 `GET /api/workspaces` 驗證，再把權杖加密存進 `localStorage`。進展與請款頁只認識 `AsanaProject`、`AsanaSection`、`AsanaTask`。

Notion 根頁「專案總表」內嵌一個同名資料庫。每一列是一個專案頁，頁內各有一份名為「任務」與「狀態更新」的子資料庫，不是全工作區共用的一張任務表。

## Goals / Non-Goals

**Goals:**

- 伺服器讀 `DATA_SOURCE`，前端用一個不含密鑰的設定回應決定登入文案與分頁。
- Notion 模式下，沿用現有 `/api` 的專案、階段、任務讀取順序，回應改成上述型別，讓三個進展／請款頁不用分叉。
- 整合金鑰只存在瀏覽器加密儲存與請求 Bearer，與 Asana PAT 分鍵。

**Non-Goals:**

- 不改展示模式的建置旗標與徽章。
- 不把「狀態更新」對成十週統計。
- 不顯示業主、專案類型、Miro、備註，也不用專案列上的請款金額。
- 不在 Notion 模式標出 milestone；任務沒有這個欄位。

## Decisions

1. **設定在伺服器，前端只讀結果。** `DATA_SOURCE` 與 `NOTION_ROOT_PAGE_ID` 由 Express 在啟動時讀取。新增 `GET /api/config`，回 `{ dataSource: "asana" | "notion" }`。不回頁面 ID 以外的密鑰；頁面 ID 可回，它不是密鑰。前端在還原登入狀態前先要這個回應。`VITE_DEMO_MODE=true` 時不採用該回應。
   - 替代方案：把來源寫進 `VITE_DATA_SOURCE`。要重編前端才切得了，與「改設定檔重啟」不符。

2. **登入探針改打根頁面。** Notion 模式下登入卡把金鑰當 Bearer 打一個後端探針（例如 `GET /api/notion/access`）。後端用 `Authorization`、`Notion-Version` 讀 `NOTION_ROOT_PAGE_ID`。成功才讓前端呼叫既有的加密儲存，鍵名與 `asana_pat_enc` 分開（例如 `notion_token_enc`）。失敗回 401，文案說明金鑰無效或根頁面未分享給此整合。
   - 替代方案：只打 Notion `users/me`。金鑰有效但頁面沒分享時會進主畫面才失敗。

3. **後端在既有讀取路徑上改資料，不新增第二套前端 API。** `DATA_SOURCE=notion` 時，`/api/projects`、`/api/projects/:gid`、`/api/projects/:gid/sections`、`/api/sections/:gid/tasks` 改由 Notion 組出與 Asana 代理相同形狀的 JSON。`src/api/asana.ts` 的欄位解析因此可以留在原處。Bearer 仍由現有 interceptor 附上，但內容是 Notion 金鑰。
   - 替代方案：前端另寫 `notion.ts` 直接組型別。頁面要維護兩套載入，而子資料庫掃描本來就該留在後端。

4. **階段 id 可逆推回專案與階段名。** 沒有 Notion 階段物件。section gid 使用 `notion-section:{projectGid}:{階段名}`。查任務時解析這個 id，找到該專案頁的「任務」庫，再依 `階段` 篩選。階段順序用該 select 的選項順序，略過沒有列的選項。
   - 專案 gid：有 `AsanaID` 用它，沒有則用 Notion page id。這樣切回 Asana 時，已選專案的 localStorage 仍對得上有 AsanaID 的列。

5. **每個專案頁各自掃描子資料庫。** 讀根資料庫全部分頁後，對每個專案頁列出子區塊，取標題恰好為「任務」的 child database 再查列。沒有該資料庫的專案仍出現，階段為空。不讀「狀態更新」。
   - 人員欄位（`指派`、`主設計`、`窗口`）用 Notion users API 把 id 換成顯示名稱，同一請求生命週期內快取。

6. **欄位對應。** `完成` → `completed: true`；`進行中` 與 `未開始` → `completed: false`，`completed_at` 留空。`計畫完成時間` 的 start 做成 `due_on`（只取日期）。`任務類型=請款任務` → `billingTaskYes`。任務 `請款金額` → `billingAmount`。專案與任務的開啟連結用 Notion 頁面網址，不用 `Asana連結`。專案 `created_at` 用 Notion 頁面建立時間。不映射 `resource_subtype`。

7. **十週分頁。** 前端依 `/api/config` 的 `notion` 隱藏「十週更新統計」，與展示模式相同的隱藏方式，但不隱藏登出。Notion 模式下不實作 `tasks/search` 與 stories。

8. **快取。** 沿用後端現有記憶體快取的 TTL 設定，鍵必須含權杖雜湊與 Notion 路徑，避免換金鑰或換來源時吃到 Asana 回應。

## Risks / Trade-offs

- [每個專案一次子區塊掃描加一次任務查詢，31 個專案約數十次 Notion 呼叫] → 後端快取；載入進度條已能表示專案批次進度。
- [階段狀態若依賴 Asana milestone，Notion 模式會不同] → 接受。任務沒有 milestone 欄位，延後／風險仍只依截止日與完成狀態。
- [整合金鑰進瀏覽器，風險與現有 PAT 相同] → 沿用加密 localStorage，不下發到 `VITE_`，也不寫進 `.env`。
- [根頁面改版、子資料庫不叫「任務」、或階段選項改名] → 對不上的階段不會出現；登入探針只能保證根頁面可讀，不能保證每個專案頁都有任務庫。

## Migration Plan

1. 在 Notion 建立整合，並把「專案總表」分享給它。
2. 設定 `DATA_SOURCE=notion`。只有根頁不是預設那頁時才設 `NOTION_ROOT_PAGE_ID`。
3. 重啟伺服器。使用者在登入卡貼上整合金鑰。
4. 退回：把 `DATA_SOURCE` 設回 `asana` 或刪除後重啟。已存的 Asana PAT 仍在。

## Open Questions

無。對應與金鑰入口已在探索時確定。
