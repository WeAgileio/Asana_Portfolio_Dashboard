## Why

儀表板目前完全依賴真實 Asana API 與 PAT 登入，無法在現場 live demo 時安全展示「專案進展·時間序」與請款相關頁面，且存在暴露真實專案、成員與金額的風險。需要一套獨立的展示部署：開啟即用、可互動切 tab 與篩選專案，全程使用虛構示意資料。

## What Changes

- 新增 build-time 展示模式（`VITE_DEMO_MODE=true`），用於獨立 demo 映像／部署
- 展示模式下略過 PAT 登入，自動進入主儀表板
- 展示模式隱藏「十週更新統計」tab，僅保留「專案進展」「請款進展」「請款進展·時間序」
- 在 `src/api/asana.ts` 加入 mock 分支，攔截 `fetchProjects`、`fetchProject`、`fetchSectionsByProject`、`fetchTasksBySection`，不回打 Asana
- 新增 runtime 假資料生成器（以 `today` 為 anchor），產出虛構專案／section／task，含請款欄位與多種進度狀態
- 頂部導覽顯示「展示模式 · 示意資料」提示
- 新增 demo 建置與部署設定（Docker build-arg、`docker-compose.demo.yml`、文件更新）
- 正式部署行為不變（`VITE_DEMO_MODE` 預設 false）

## Capabilities

### New Capabilities

- `demo-mode`: 展示模式啟用條件、登入略過、tab 可見性、UI 提示與安全約束（不得連線真實 Asana）
- `demo-mock-data`: 假資料生成規則、API mock 覆蓋範圍、虛構實體內容與日期錨點策略

### Modified Capabilities

（無。現有 `project-picker-filter`、`section-display-due` 等規格在展示模式下仍適用，僅資料來源改為 mock，不要求修改其 requirement。）

## Impact

- **前端**：`App.vue`、`src/stores/auth.ts`、`src/api/asana.ts`；新增 `src/demo/`（或 `src/utils/demoDataGenerator.ts`）
- **建置／部署**：`Dockerfile`（`ARG VITE_DEMO_MODE`）、新增 `docker-compose.demo.yml`、`.env.example` 與 `README.md`
- **不受影響**：`useProjectProgress`、三個目標 view、`ProjectPickerPanel` 邏輯（資料管線不變）
- **不實作**：`WeeklyTrends` mock、正式環境同頁切換 mock／真實、後端 Asana proxy 的 demo 分支（除非未來改為 runtime 切換）
