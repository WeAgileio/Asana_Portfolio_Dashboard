## 專案簡介

這是一個使用 **Vue 3 + TypeScript + Pinia + Vite** 建立的 Asana 儀表板專案，  
後端則使用 **Node.js + Express** 做 OAuth2 / PAT 驗證與 Asana API Proxy。

目標是幫你在瀏覽器裡快速掌握多個專案的：

- 專案整體完成度、各 Section 完成度（任務數 / 工作天數）
- 各專案、各週的「任務更新」情況（本週、最近十週趨勢）
- 新增的「專案進度」時間軸視圖，查看每個專案的階段進度與里程碑

## 主要功能

### 1. 專案概況（Dashboard）

- 顯示當前選定專案的：
  - 總任務數 / 已完成任務數 / 逾期任務數
  - 依 Section 統計完成率（任務數 + 工作天數兩種視角）
  - Section 完成度排名列表
- 可以使用 Asana OAuth 或個人權杖登入，並透過下拉選單選擇要看的專案。

### 2. 本週任務更新

- 汇總「本週內有更新」的所有任務（跨專案）。
- 顯示：
  - 任務名稱（可點擊直達 Asana）
  - 所屬專案 / Section
  - 受指派人
  - 最後更新時間與更新人（透過 stories 推算）

### 3. 十週更新統計

- 以卡片方式顯示最近十週的「任務更新數統計」：
  - 每週總更新次數
  - 各「更新人」的更新次數統計
- 點擊某一週的卡片，會在畫面中央彈出該週所有更新任務清單（與「本週任務更新」版型一致），可進一步檢視細節。

### 4. 專案進度（時間軸視圖）

- 每列是一個 Asana 專案，左側顯示專案名稱，右側橫向排列該專案的所有 Section：
  - 每個 Section 顯示：
    - Section 名稱
    - 里程碑任務中「最晚的截止日」
    - 任務完成率（依任務數計算）
    - 依完成度展示不同顏色進度條：
      - 灰色：尚未開始（無任務或全部未完成）
      - 藍色：進行中（部分完成）
      - 綠色：已完成（全部完成）
  - 若 Section 沒有任何任務且名稱是「未命名區段」，則不會顯示。
- 點擊任一 Section，會跳出任務清單彈窗：
  - 列出該 Section 底下所有任務、指派人、最後更新時間與完成狀態
  - 若任務是里程碑，整列會以粉紅底色 +「里程碑」標籤醒目標示。
- 上方可透過「選擇專案」開啟設定彈窗，勾選要載入的專案，選擇結果會儲存在 `localStorage`，下次開啟會自動沿用。
- 載入流程分兩階段：
  1. 先載入專案與 Section 結構（讓畫面快速出來）
  2. 再背景載入各 Section 任務與實際進度，並在時間軸上顯示「任務載入中…」半透明遮罩，完成後自動消失。

## 環境需求

- Node.js 18+（建議使用 LTS 或以上）
- npm 9+（或相容版本）

## 安裝與啟動（本機開發）

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

專案使用後端 OAuth Proxy，因此不再直接在前端放入 PAT，而是改由 `.env` 讀取設定。

請參考 `.env.example` 建立 `.env`（或 `.env.local`）：

```bash
cp .env.example .env
```

並填入以下關鍵欄位：

- `ASANA_CLIENT_ID` / `ASANA_CLIENT_SECRET` / `ASANA_REDIRECT_URI`：Asana OAuth 應用資訊
- `ASANA_DEFAULT_PAT`（選用）：預設後端使用的 PAT（方便開發）
- `SESSION_SECRET`：`cookie-session` 用的金鑰
- `VITE_REFRESH_INTERVAL_MINUTES`：前端自動刷新間隔（分鐘）

### 3. 啟動開發環境（前後端各自啟動）

前端（Vite）：

```bash
npm run dev
```

後端（Node + Express）：

```bash
npm run server
```

開啟瀏覽器到 `http://localhost:5173` 即可。

### 4. 使用 Docker 啟動（選用）

專案已提供簡單的 Docker 設定：

- `Dockerfile`
- `docker-compose.yml`

在專案根目錄執行（說明用，不會自動幫你執行）：

```bash
docker-compose up --build
```

會啟動：

- `backend` 容器：埠號 `3001`，執行 `npm run server`
- `frontend` 容器：埠號 `5173`，執行 `npm run dev -- --host 0.0.0.0`

## 專案結構（節錄）

```text
src/
├── api/
│   └── asana.ts           # 封裝所有 Asana API 呼叫與統計邏輯
├── assets/
├── components/
│   ├── CircleProgress.vue # 圓形進度元件（任務 / 工作天完成度）
│   ├── LinearProgress.vue # 線性進度條元件
│   ├── OverallSummary.vue # 專案整體摘要
│   ├── SectionCard.vue    # Section 卡片視圖
│   └── SectionRanking.vue # Section 排行視圖
├── stores/
│   └── dashboard.ts       # Dashboard 的 Pinia 狀態管理
├── types/
│   └── asana.ts           # Asana 相關型別定義（Project / Section / Task 等）
├── views/
│   ├── Dashboard.vue      # 專案概況頁
│   ├── WeeklyUpdates.vue  # 本週任務更新頁
│   ├── WeeklyTrends.vue   # 十週更新統計頁
│   └── ProgressTimeline.vue # 專案進度（時間軸）頁
├── App.vue                # 分頁切換與整體佈局
└── main.ts
```

## 注意事項

- Asana API 有 Rate Limit（預設 150 req/min），專案多、Section 多時可能會較慢；程式中已盡量使用搜尋 API / 併發載入降低等待時間。
- 個人權杖（PAT）與 OAuth 憑證請務必放在 `.env` 類檔案，不要提交到版本控制。
- 封存（archived）專案在列表中會自動被過濾，不會出現在選單與專案進度視圖。

## Release Notes

### v0.2.0

- **專案進度**：Section 依截止日與完成度顯示風險顏色
  - 紅色（落後）：截止日在一週內或已過期，且仍有未完成任務
  - 黃色（風險）：截止日在兩週內、完成度低於 75%
  - 紅/黃狀態時，完成度與任務數區塊會顯示對應背景色
- **專案進度**：每個 Section 顯示請款金額加總；專案標題顯示總請款與錢幣進度（十格）
- **專案進度**：時間軸支援滑鼠拖曳左右捲動，拖曳時不觸發任務詳情彈窗
- **專案進度**：任務彈窗內顯示任務截止日；載入中遮罩限定在專案時間軸範圍內
- **規則**：Cursor 提交與發版規則（`command-confirmation.md`）範例改為中文

### v0.2.1

- **專案進度**（時間軸）：預設將「最左邊的 in-progress section」置中顯示（載入完成後自動調整；拖曳不干擾）
- **專案進度**（UI）：年份/加總區塊的字體與間距、以及相關視覺排版細節微調
