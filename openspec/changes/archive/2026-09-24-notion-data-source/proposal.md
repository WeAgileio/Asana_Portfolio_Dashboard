## Why

儀表板目前只讀 Asana。工作室已有一份 Notion「專案總表」，結構與專案、階段、任務、請款對得上，需要能從設定檔改吃這份資料，且金鑰用登入卡輸入，不要寫進環境變數。

## What Changes

- 新增執行期設定 `DATA_SOURCE=asana|notion`，預設 `asana`。改設定後重啟即切換，不必重新建置前端。
- `VITE_DEMO_MODE=true` 時仍走現有展示模式，忽略 `DATA_SOURCE`。
- `DATA_SOURCE=notion` 時，登入卡改為輸入 Notion 整合金鑰。驗證方式是確認能讀到設定的根頁面（專案總表），通過後加密存於瀏覽器，與 Asana PAT 分開存放。請求以 Bearer 送給後端，由後端呼叫 Notion。不新增 `NOTION_TOKEN` 環境變數。
- 根頁面 ID 由 `NOTION_ROOT_PAGE_ID` 指定，預設 `3e353bdeb3b1803ea05ec8b6873d9f4d`。
- 後端讀專案總表，再讀每個專案頁內名為「任務」的子資料庫，對成現有的專案／階段／任務型別。畫面沿用現有四頁中的三頁。
- Notion 模式下隱藏「十週更新統計」。不載入「狀態更新」資料庫。
- 只顯示有任務的階段。任務狀態「完成」為已完成；「進行中」與「未開始」都視為未完成。請款金額與是否請款取自任務，不取專案列上的請款金額。專案 gid 使用 `AsanaID`。

## Capabilities

### New Capabilities

- `notion-data-source`: 以設定檔在 Asana 與 Notion 之間切換資料來源，用登入卡輸入 Notion 整合金鑰，並把專案總表與各專案的任務庫對成現有儀表板資料。

### Modified Capabilities

- （無。展示模式的建置旗標、略過登入、隱藏十週分頁與示意徽章維持不變。）

## Impact

- 設定：`.env.example` 增加 `DATA_SOURCE`、`NOTION_ROOT_PAGE_ID`。
- 後端：`server/index.mjs` 在 Notion 模式下改為用請求內的 Bearer 呼叫 Notion API，不再代理 Asana。
- 前端：`Login.vue`、`stores/auth.ts`、`App.vue`（分頁可見性）、`src/api/asana.ts`（或同等的來源分支）。現有進展與請款頁面的畫面與狀態色不變。
- 依賴：後端需能呼叫 `https://api.notion.com`。Notion 整合必須已被分享「專案總表」。
