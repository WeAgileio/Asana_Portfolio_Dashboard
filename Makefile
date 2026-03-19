SHELL := /bin/bash

.PHONY: install frontend backend dev

install:
	npm install

frontend:
	npm run dev

backend:
	npm run server

# 同時啟動前端與後端（適合本機開發測試）
dev:
	npm run server & \
	npm run dev

