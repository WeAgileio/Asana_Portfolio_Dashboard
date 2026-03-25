# 本機開發：請在專案根目錄執行（會讀取根目錄 .env）
# Windows：需已安裝 GNU Make（例如 Git for Windows 內建），並建議用同一終端機跑 npm
# 並行 dev 使用 npm 腳本（concurrently），避免 bash「&」在 Windows 上不可靠

.PHONY: install frontend backend dev build

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
