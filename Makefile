# 本機開發：請在專案根目錄執行（會讀取根目錄 .env）
# Windows：需已安裝 GNU Make（例如 Git for Windows 內建），並建議用同一終端機跑 npm
# 並行 dev 使用 npm 腳本（concurrently），避免 bash「&」在 Windows 上不可靠

.PHONY: install frontend backend dev build \
	demo demo-dev demo-dev-all demo-build demo-docker-build demo-docker-pull demo-docker-up demo-docker-down

DEMO_IMAGE ?= yuminggood/asana_dashboard:demo
VITE_BILLING_FIELD ?= 請款金額
VITE_BILLING_TASK_FIELD ?= 請款進展

install:
	npm install

frontend:
	npm run dev

backend:
	npm run server

# 同時啟動後端 API 與 Vite（Ctrl+C 會一併結束兩個程序）
dev:
	npm run dev:all

build:
	npm run build

# ── 展示模式（VITE_DEMO_MODE=true，虛構資料、略過 PAT 登入）────────────────
# 僅啟動 Vite：API 在前端 mock，不需後端（避免 dev:all 等待/佔用 3001）

# 本機 demo → http://localhost:5173
demo: demo-dev

demo-dev:
	@echo "展示模式（mock 資料，不需後端）→ http://localhost:5173"
	@echo "（若無輸出，請確認 5173 未被占用：lsof -i :5173）"
	VITE_DEMO_MODE=true npm run dev:demo

# 若需同時跑後端（一般不需要）
demo-dev-all:
	VITE_DEMO_MODE=true npm run dev:all

demo-build:
	VITE_DEMO_MODE=true npm run build

demo-docker-build:
	docker build -t $(DEMO_IMAGE) \
		--build-arg VITE_DEMO_MODE=true \
		--build-arg VITE_BILLING_FIELD=$(VITE_BILLING_FIELD) \
		--build-arg VITE_BILLING_TASK_FIELD=$(VITE_BILLING_TASK_FIELD) .

demo-docker-pull:
	docker compose -f docker-compose.demo.yml pull

demo-docker-up:
	docker compose -f docker-compose.demo.yml up -d

demo-docker-down:
	docker compose -f docker-compose.demo.yml down
