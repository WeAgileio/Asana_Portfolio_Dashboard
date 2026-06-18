# Asana 儀表板

以 **Vue 3 + TypeScript + Pinia + Vite** 建置的前端，搭配 **Node.js + Express** 後端處理 Asana OAuth／權杖與 API Proxy。登入後可在同一套介面檢視 **十週任務更新統計**、**專案進展（月欄表）**、**請款進展** 與 **請款進展·時間序**。

## 技術棧

| 層級 | 說明 |
|------|------|
| 前端 | Vue 3、TypeScript、Vite 6、Pinia、Axios |
| 後端 | Express、`cookie-session`、Asana REST API |
| 容器 | 多階段 `Dockerfile`（建置前端靜態檔 + 生產用 Node 服務） |

## 主要功能（登入後）

### 十週更新統計

- 以卡片呈現最近 **10 週**的任務更新量與依「更新人」統計。
- 點選週別可開啟該週任務清單，並可依更新人篩選。
- 分頁切換時會快取資料，僅在按下「重新載入」時再向後端請求。

### 專案進展（月欄表）

- 使用 **`useProjectProgress`** 載入專案、Section 與任務。
- 以 **年／月** 為欄，依 Section 的 **里程碑最晚截止日** 對齊月份；無法對應者集中在 **未排** 欄（可折疊以省寬度）。
- **表頭**（年／月與左側欄）在頁面捲動時 **固定於視窗頂端**；表頭與表身為雙層橫向捲動並 **同步 `scrollLeft`**。
- 同一格內多個 Section **直向堆疊**；卡片上顯示截止日、請款、完成度等。
- **任務載入中**或整體 **重新載入** 時 **禁止橫向拖曳**，避免與載入狀態衝突。

### 請款進展（橫向列表）

- 與「專案進展」等視圖共用 **`useProjectProgress`** 與專案選擇／搜尋／排序。
- 僅列出任務自訂欄位為「請款進展」（或舊名「請款任務」）且值為「是」的任務；橫向卡片顯示完成狀態、截止日，請款以 **💰** 與金額呈現（不顯示區段名稱）。
- 需於 `.env` 設定 **`VITE_BILLING_TASK_FIELD`**（可選；未設時依名稱比對「請款進展」「請款任務」），語法與 **`VITE_BILLING_FIELD`** 相同。

### 請款進展·時間序（月欄表）

- 同樣共用 **`useProjectProgress`**；依任務 **截止日** 對齊月份，無截止或落在表格外者進 **未排** 欄。
- 表頭／表身雙層橫向捲動與「專案進展」一致；月欄寬度固定，避免卡片內長文字撐寬欄位導致與表頭錯位。

### 登入

- 支援 **個人存取權杖（PAT）** 或 **OAuth**（依後端與 Asana 應用設定）。

## 環境需求

- **Node.js 20+**（與 `Dockerfile` 一致；本機 18+ 多數情況仍可用）
- **npm** 10+（或相容版本）
- **Docker**（選用：本機 compose 或生產映像）

## 安裝與本機開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 環境變數

```bash
cp .env.example .env
```

**與 `.env.example` 的對應：** 範例檔以**註解**示範 **`VITE_BILLING_FIELD`**、**`VITE_BILLING_TASK_FIELD`** 與 **`DASHBOARD_IMAGE`**。下表其餘鍵請在複製後的 **`.env` 自行補上**（鍵名與下表一致即可）。

後端（`server/index.mjs` 以 `dotenv` 讀取**專案根目錄** `.env`；`npm run server`／`docker run --env-file .env` 等皆適用）：

**必填（OAuth）：**

| 變數 | 說明 |
|------|------|
| `ASANA_CLIENT_ID` | Asana OAuth 應用 Client ID |
| `ASANA_CLIENT_SECRET` | Asana OAuth Client Secret |
| `ASANA_REDIRECT_URI` | OAuth 回呼 URL（需與 Asana 後台一致） |
| `SESSION_SECRET` | `cookie-session` 簽章用密鑰 |

**常用選用：**

| 變數 | 說明 |
|------|------|
| `ASANA_DEFAULT_PAT` | 後端預設 PAT（僅建議本機開發） |
| `PORT` | 後端埠號，預設 `3001` |

前端（**本機**由 Vite 讀根目錄 `.env`；`VITE_*` 只在**當次** `dev`／`build` 生效。生產 **Docker 映像**裡的前端已在建置時打進 bundle，請款相關欄位請用 **`docker build --build-arg VITE_BILLING_FIELD=...`** 等，見下文〈Docker〉）：

| 變數 | 說明 |
|------|------|
| `VITE_BILLING_FIELD` | **選用。** 請款**金額**自訂欄位（**單一變數**）：逗號分隔多個；**純數字**為欄位 **GID**，其餘為**名稱**；比對時 GID 優先。未設時依名稱嘗試「請款金額」「請款額」。例：`請款金額` 或 `請款金額,1234567890123456` |
| `VITE_BILLING_TASK_FIELD` | **選用。** 「請款進展／請款任務」**是／否**自訂欄位（語法同 `VITE_BILLING_FIELD`）。未設時依名稱比對「請款進展」「請款任務」。 |
| `VITE_PROXY_TARGET` | 開發時 API Proxy 目標，預設 `http://localhost:3001`；`docker-compose.yml` 的 frontend 服務設為 `http://backend:3001` |
| `VITE_STORAGE_ENCRYPT_KEY` | 選用；強化前端敏感資料儲存加密（`src/utils/storageEncrypt.ts`） |
| `VITE_DEFAULT_PROJECT_GID` | 選用；`stores/dashboard` 預設專案 GID |

**正式環境 Compose**（`docker-compose.prod.yml`；與該檔同目錄的 `.env` 主要用於 **Compose 變數替換**）：

| 變數 | 說明 |
|------|------|
| `DASHBOARD_IMAGE` | **選用。** 覆寫預設映像（預設 `yuminggood/asana_dashboard:latest`） |
| `PORT` | **選用。** 容器內後端埠，預設 `3001`（對應 compose 內 `PORT: ${PORT:-3001}`） |

`docker-compose.prod.yml` **範例未**逐條列出 `ASANA_*`／`SESSION_SECRET`；部署時請在平台環境變數、自行加上 `env_file: .env`，或擴充 `environment`，讓容器內與本機一樣具備 OAuth 所需變數。

### 3. 啟動開發（前後端分開）

終端機一（Vite，預設 <http://localhost:5173>）：

```bash
npm run dev
```

終端機二（Express API + 開發時 Proxy）：

```bash
npm run server
```

瀏覽器開啟 **<http://localhost:5173>**；前端會將 `/api` 等請求轉到後端（見 `vite.config.ts`）。

**單一終端機同時啟動前後端**（專案根目錄執行以讀取 `.env`；`Ctrl+C` 會一併結束兩個程序）：

```bash
make dev
```

或：

```bash
npm run dev:all
```

需已安裝 **GNU Make**（例如 Git for Windows 內建 `make`）。其餘可用目標見根目錄 `Makefile`（`install`、`frontend`、`backend`、`build`）。

### 4. 本機建置與預覽

```bash
npm run build
npm run preview
```

生產環境由後端提供 `dist` 靜態檔時，請以 **`npm run server`**（或 Docker 映像）啟動，並確認環境變數與 Asana 設定正確。

## Docker

### 開發用 Compose（`docker-compose.yml`）

```bash
docker compose up --build
```

- **backend**：`3001`，`npm run server`
- **frontend**：`5173`，`npm run dev -- --host 0.0.0.0`（`VITE_PROXY_TARGET=http://backend:3001`）

### 生產映像（根目錄 `Dockerfile`）

建置並標籤（範例與 Docker Hub 倉庫一致）。請款相關欄位需寫進前端時請加 **build-arg**（否則用程式內建預設名稱）；**請款進展**是／否欄位可選 **`VITE_BILLING_TASK_FIELD`**：

```bash
docker build -t yuminggood/asana_dashboard:latest -t yuminggood/asana_dashboard:1.9.0 \
  --build-arg VITE_BILLING_FIELD=請款金額 \
  --build-arg VITE_BILLING_TASK_FIELD=請款進展 .
```

若要確保可在 **Linux ARM64/v8**（如 Apple Silicon、部分 NAS、雲端 ARM VM）執行，請用 buildx 建置對應平台（或直接建 multi-arch）：

```bash
# 只建 ARM64/v8（可 --load 到本機）
docker buildx build --platform linux/arm64/v8 \
  -t yuminggood/asana_dashboard:arm64 \
  --build-arg VITE_BILLING_FIELD=請款金額 \
  --build-arg VITE_BILLING_TASK_FIELD=請款進展 .

# 同時建 amd64 + arm64/v8 並推送（推薦給 Docker Hub）
docker buildx build --platform linux/amd64,linux/arm64/v8 \
  -t yuminggood/asana_dashboard:latest \
  -t yuminggood/asana_dashboard:1.9.0 \
  --build-arg VITE_BILLING_FIELD=請款金額 \
  --build-arg VITE_BILLING_TASK_FIELD=請款進展 \
  --push .
```

推送前請先 **`docker login`**：

```bash
docker push yuminggood/asana_dashboard:latest
docker push yuminggood/asana_dashboard:1.9.0
```

單機執行（前後端同一埠 **3001**）：

```bash
docker run -p 3001:3001 --env-file .env yuminggood/asana_dashboard:latest
```

瀏覽器：<http://localhost:3001>

### GitHub Release 後自動推送 Docker Hub

建立 **GitHub Release** 並**發佈**（`published`）時，會執行 [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml)：以 **buildx** 建置 **linux/amd64** 與 **linux/arm64/v8**，並推送 **`yuminggood/asana_dashboard:latest`**、**發佈標籤**（若標籤為 `v1.x.x` 會另推送 **`1.x.x`**）。

請在儲存庫 **Settings → Secrets and variables → Actions** 設定：

| Secret | 說明 |
|--------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 帳號（與映像前綴一致，例如 `yuminggood`） |
| `DOCKERHUB_TOKEN` | Docker Hub [Access Token](https://docs.docker.com/security/for-developers/access-tokens/)（勿用一般登入密碼） |
| `VITE_BILLING_FIELD` | **選用。** 與本機 `--build-arg VITE_BILLING_FIELD=…` 相同，寫入前端建置 |
| `VITE_BILLING_TASK_FIELD` | **選用。** 請款進展是／否欄位；與本機 `--build-arg` 相同。Release 建置時由 [docker-publish workflow](.github/workflows/docker-publish.yml) 傳入（未設 Secret 時為空，使用程式預設名稱）。 |

### 正式環境 Compose（`docker-compose.prod.yml`）

- 預設 **`image: yuminggood/asana_dashboard:latest`**（或於同目錄 `.env` 設定 `DASHBOARD_IMAGE`）。
- 對外對應 **3001**；環境變數可寫在與 compose 同目錄的 `.env`（群暉等環境相容說明見檔案內註解）。
- 若主機是 ARM64 且要強制指定平台，可在 compose 服務加上 `platform: linux/arm64/v8`。

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

若出現 **`pull access denied`**：確認已 `docker login`、Hub 上倉庫存在，且映像名稱／標籤正確。

## 專案結構（節錄）

```text
server/
└── index.mjs                 # Express：OAuth、Proxy、靜態檔（生產）

src/
├── api/asana.ts              # Asana API 與請款欄位等解析
├── composables/
│   └── useProjectProgress.ts # 專案進展等共用狀態與載入
├── components/               # 圓形／線性進度、Section 卡片等
├── stores/                   # auth、dashboard 等
├── types/asana.ts
├── views/
│   ├── Login.vue
│   ├── WeeklyTrends.vue      # 十週更新統計
│   ├── ProgressTimelineByTime.vue  # 專案進展（月欄）
│   ├── BillingTasks.vue      # 請款進展（橫向）
│   └── BillingTasksByTime.vue      # 請款進展·時間序（月欄）
├── App.vue                   # 頂部導覽與分頁
└── main.ts

.github/workflows/            # CI（Release 後推送 Docker Hub 等）
Dockerfile                    # 生產多階段建置
Dockerfile.dev                # 開發用基底（搭配 compose）
docker-compose.yml
docker-compose.prod.yml
.env.example
```

## 注意事項

- Asana API 有 **Rate Limit**（例如 150 req/min）；專案與 Section 多時載入較久屬正常，程式已盡量併發與搜尋 API。
- **PAT、OAuth Secret、`SESSION_SECRET` 等請勿提交**到版本庫；僅放在 `.env` 或由部署平台注入。
- **已封存（archived）** 的專案通常不會出現在列表與進度相關視圖。

## 版本紀錄

### v1.10.8（目前 `package.json` 版本）

- **請款進展·時間序**、**進展時間軸**：重新載入或首次進頁後，若您尚未手動橫向捲動月欄表，仍會自動對齊「目前月份」；若已捲動到其他月份檢視，重新載入完成後會保留原本的橫向位置，不再強制跳回當月。
- **破壞性變更**：無。

### v1.10.7

- **請款進展·時間序**、**進展時間軸**、**請款進展**：載入專案資料時，於頁面上方顯示整體載入進度（例如「已載入 M / N 個專案」與進度條）；全部載入完成後自動隱藏；發生錯誤時不顯示進度列。
- **破壞性變更**：無。

### v1.10.6

- **專案進展·時間序**：頂部新增依 **專案成員** 篩選（成員名稱來自 Asana 專案的成員清單）；可複選、清除篩選；工具列在寬／窄螢幕維持單行或可橫向捲動，篩選浮層不依賴易被裁切的內嵌面板。
- **破壞性變更**：無。

### v1.10.5

- **例行發版**：同步版本與 Release 流程，功能內容與 `v1.10.4` 一致。
- **破壞性變更**：無。

### v1.10.4

- **例行發版**：同步版本與 Release 流程，功能內容與 `v1.10.3` 一致。
- **破壞性變更**：無。

### v1.10.3

- **例行發版**：延續 `v1.10.2` 的功能內容，維持目前「專案進展／請款進展」視圖與月欄金額呈現。
- **破壞性變更**：無。

### v1.10.2

- **例行發版**：版本號與釋出流程更新；使用體驗與前一版一致。
- **破壞性變更**：無。

### v1.10.1

- **專案進展**：移除舊版「專案進度（橫向）」分頁，導覽統一保留月欄型「專案進展」。
- **月欄金額**：在「專案進展·時間序」與「請款進展·時間序」的每月表頭新增 `💰已請款 / 目標` 金額摘要，方便快速比對。
- **破壞性變更**：無。

### v1.9.0

- **請款進展／請款進展·時間序**：新分頁；任務欄位「請款進展」（或舊名「請款任務」）為是者列入；共用 `useProjectProgress`；時間序依**任務截止日**分月欄，表頭／表身欄寬鎖定避免內容撐寬錯位。
- **環境變數**：**`VITE_BILLING_TASK_FIELD`**（語法同 `VITE_BILLING_FIELD`）；**Docker** `Dockerfile` 支援 **`ARG VITE_BILLING_TASK_FIELD`**；`.env.example` 補註解。
- **專案進展**：與請款時間序共用之表格樣式修正（捲軸槽、欄寬、`box-sizing` 等）。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.9.0`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.8.0

- **頂部導覽**：移除「Asana 儀表板」標題；分頁以**紫底白字**標示目前頁；**登出**獨立於右側。
- **專案進展**：工具列改為**左右分區**（左：排序與搜尋；右：狀態圖例與日期／按鈕）；移除頁首標題區與「專案搜尋」文字標籤（搜尋框保留 placeholder 與 `aria-label`）。
- **狀態圖例**：抽出為 **`ProgressStatusLegend`**；視窗寬度 **≤1250px** 時改為「狀態圖例」按鈕＋彈窗；較窄寬度時工具列可直向堆疊。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.8.0`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.7.0

- **專案進展（未排欄）**：表頭與收合格顯示 **已完成／未排總數**；**點各專案列未排格**僅展開該專案之 section 卡片（同時間僅一列展開）；**點表頭「未排」**可收合；篩選後若該專案不在清單內會自動收合。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.7.0`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.6.0

- **專案進展**：點**月欄表頭**可將該月有內容的專案列排到最上（再點同一欄取消）；該月內排序為 **延後（紅）→ 風險（黃）→ 其餘**，同層再依該月欄內**里程碑截止日最早**者在上；可點區為整格表頭。修正橫向拖曳後**再點月欄無效**（清除拖曳旗標）。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.6.0`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.5.0

- **後端**：`GET /api/*` 代理**記憶體快取**（依使用者隔離、分級 TTL、可略過）；`docker-compose` 可 `env_file: .env`；`Dockerfile`／`Dockerfile.dev` 內建 `ASANA_PROXY_CACHE_*` 預設值。
- **前端**：表頭「重新同步數據」與單專案重新載入會**略過代理快取**；專案進展任務載入改為**依專案列遮罩**（非整表），並修正橫向捲動時**專案／未排** sticky 欄被誤設為 `position: relative` 的問題。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.5.0`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.4.2

- **專案進展**：表頭左欄加寬（寬螢幕 **480px**），說明文字在 **≥1200px** 可**完整換行顯示**（取消行數裁切）；排序與搜尋區略**右移**（與左欄間距）；與請款橫向列表等視圖樣式對齊。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.4.2`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.4.1

- **CI**：新增 [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml)，於 **GitHub Release 發佈**後以 **buildx** 建置 **linux/amd64**、**linux/arm64/v8** 並推送 **Docker Hub**（`latest`、Release 標籤等）；需於儲存庫設定 `DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN`（選用 `VITE_BILLING_FIELD`）。說明見上文「GitHub Release 後自動推送 Docker Hub」。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.4.1`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.4.0

- **專案進展**：表頭 **依專案名稱排序**（`ProjectSortControl`：Asana 原始順序／遞增／遞減，中文以 `zh-Hant` 比對）；**搜尋與排序**橫列、加寬搜尋框以顯示完整 placeholder。
- **表頭版面**：左側標題＋說明、中間排序與搜尋、右側雙列狀態圖例與日期／按鈕；兩頁 **欄位對齊**（寬螢幕左欄固定寬度、中欄靠左對齊）。
- **圖例**：紅色狀態文案為 **延後**（含括號說明）。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.4.0`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.3.3

- **專案進展**：修正「重新載入／重新整理後對齊當月欄」的橫向捲動時機；資料載入完成後以短重試確保 DOM 就緒再捲動，首次進頁亦在載入完成後對齊。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.3.3`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.3.2

- **專案進展（左側專案欄）**：新增顯示各狀態 section 數（含總數與 0），以文字顏色區分；位置調整回專案名稱區塊。
- **專案進展（未排欄）**：維持原本僅顯示未排總數與展開內容，不拆分狀態。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.3.2`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.3.1

- **專案進展**：月份表頭在「總數」下方，新增顯示各狀態 section 數（含 0），並以文字顏色呈現。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.3.1`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.3.0

- **專案進展**：各專案列標題旁 **單專重新載入**（僅重抓該專案 sections／任務）；頁面右下角 **回到頂端** 浮動按鈕。
- **專案進展**：月欄表頭顯示該欄 **section 總數**（依目前篩選）；按頂部「重新載入」或選專案套用後，橫向捲動會對齊 **當月** 欄。
- **修正**：瀏覽器 **重新整理** 後正確還原 **已選專案**（`await loadFromStorage`、`tokenHash` 同步、已勾選專案時不再套用首次僅載入 5 個專案的限制）。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.3.0`）；**linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.2.0

- **專案進展**：頂部橫列工具列（標題、**專案搜尋**、狀態圖例、日期與按鈕）；關鍵字篩選專案名稱（留空顯示全部）；資料載入中禁用搜尋欄。
- **專案進展**：月欄與未排統計依目前篩選結果計算。
- **開發體驗**：`make dev`／`npm run dev:all` 以 **concurrently** 並行啟動前後端（跨平台較可靠）；README 補充說明。
- **修正**：已選專案以 **deep watch** 寫入 `localStorage`，避免重新載入時未依選擇載入。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.2.0`）；映像支援 **linux/amd64** 與 **linux/arm64/v8**（見上文 Docker 章節）。

### v1.1.0

- **專案進展**：月欄表、未排欄、固定表頭、表頭／表身橫向捲動同步、欄寬與格線對齊。
- **共用**：`useProjectProgress` 供「專案進展」與請款相關視圖共用。
- **請款**：`VITE_BILLING_FIELD`（金額）；**v1.9.0** 起另支援 `VITE_BILLING_TASK_FIELD`（請款進展是／否，見上文）。
- **操作**：橫向拖曳捲動；載入中禁止拖曳。
- **Docker 映像**：`yuminggood/asana_dashboard`（例：`latest`、`1.1.0`）。

### 較早版本（摘要）

- **v0.2.x**：專案進度風險色、請款顯示、拖曳捲動、載入遮罩與置中等 UI／行為調整。

若需對照 Git 標籤，請見儲存庫 **Releases** 或 `git tag`。
