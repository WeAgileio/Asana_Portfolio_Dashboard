import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { apiCacheKey } from "./index.mjs";
import {
  childDatabaseId,
  parseSectionGid,
  projectFromNotionPage,
  projectGidFromPage,
  resolveDataSource,
  resolveRootPageId,
  sectionsFromTasks,
  taskFromNotionPage,
} from "./notionSource.mjs";

test("DATA_SOURCE 空值是 asana，非法值帶出原字", () => {
  assert.equal(resolveDataSource(""), "asana");
  assert.equal(resolveDataSource(undefined), "asana");
  assert.equal(resolveDataSource(" Notion "), "notion");
  assert.throws(() => resolveDataSource("nope"), /無效的 DATA_SOURCE：nope/);
});

test("根頁面 ID 有預設", () => {
  assert.equal(resolveRootPageId(""), "3e353bdeb3b1803ea05ec8b6873d9f4d");
  assert.equal(resolveRootPageId(" abc "), "abc");
});

test("專案 gid 優先 AsanaID，完成狀態仍可映射", () => {
  const page = {
    id: "3e453bde-b3b1-817f-b6c4-f6ed201cc261",
    created_time: "2026-01-02T00:00:00.000Z",
    url: "https://www.notion.so/page",
    properties: {
      名稱: { type: "title", title: [{ plain_text: "久樘-一心段" }] },
      AsanaID: { type: "rich_text", rich_text: [{ plain_text: "1213756671111644" }] },
      Asana連結: {
        type: "url",
        url: "https://app.asana.com/1/1/project/1213756671111644",
      },
      狀態: { type: "status", status: { name: "完成" } },
      請款金額: { type: "number", number: 999 },
    },
  };
  assert.equal(projectGidFromPage(page), "1213756671111644");
  const project = projectFromNotionPage(page, ["主設計甲", "窗口乙"]);
  assert.equal(project.gid, "1213756671111644");
  assert.equal(project.name, "久樘-一心段");
  assert.deepEqual(project.memberNames, ["主設計甲", "窗口乙"]);
  assert.equal(project.archived, false);
  assert.equal(project.notes_permalink_url, "https://www.notion.so/page");
  assert.equal(project.project_permalink_url, "https://www.notion.so/page");
  assert.equal(project.permalink_url, "https://www.notion.so/page");
  assert.equal(project.project_brief.permalink_url, "https://www.notion.so/page");
});

test("沒有 AsanaID 時用 Notion 頁面 id", () => {
  const page = { id: "aaaa-bbbb", properties: {} };
  assert.equal(projectGidFromPage(page), "aaaabbbb");
});

test("只認標題恰好為任務的子資料庫", () => {
  const blocks = [
    { type: "child_database", id: "status-db", child_database: { title: "狀態更新" } },
    { type: "child_database", id: "task-db", child_database: { title: "任務" } },
  ];
  assert.equal(childDatabaseId(blocks, "任務"), "task-db");
  assert.equal(childDatabaseId(blocks, "狀態更新"), "status-db");
  assert.equal(childDatabaseId(blocks, "任務 "), null);
});

test("階段只含有任務者，並依選項順序", () => {
  const rows = [
    { stage: "C15 圖說最終修正階段" },
    { stage: "C01-1 新案洽談" },
    { stage: "" },
  ];
  const sections = sectionsFromTasks("121", rows, [
    "C01-1 新案洽談",
    "C02 報價／議價",
    "C15 圖說最終修正階段",
  ]);
  assert.deepEqual(
    sections.map((section) => section.name),
    ["C01-1 新案洽談", "C15 圖說最終修正階段"]
  );
  assert.equal(sections[1].gid, "notion-section:121:C15 圖說最終修正階段");
  assert.deepEqual(parseSectionGid(sections[1].gid), {
    projectGid: "121",
    stageName: "C15 圖說最終修正階段",
  });
});

test("進行中的請款任務用任務金額，不是專案金額", () => {
  const page = {
    id: "task-1",
    created_time: "2026-03-01T00:00:00.000Z",
    url: "https://www.notion.so/task",
    properties: {
      名稱: { type: "title", title: [{ plain_text: "竣工圖確認" }] },
      狀態: { type: "status", status: { name: "進行中" } },
      任務類型: { type: "select", select: { name: "請款任務" } },
      請款金額: { type: "number", number: 1200 },
      階段: { type: "select", select: { name: "C15 圖說最終修正階段" } },
      計畫完成時間: { type: "date", date: { start: "2026-09-01T08:00:00.000+08:00" } },
      指派: { type: "people", people: [{ id: "u1", name: "周以恒" }] },
      Asana連結: { type: "url", url: "https://app.asana.com/0/1/2" },
    },
  };
  const mapped = taskFromNotionPage(page);
  assert.equal(mapped.stage, "C15 圖說最終修正階段");
  assert.equal(mapped.task.completed, false);
  assert.equal(mapped.task.due_on, "2026-09-01");
  assert.equal(mapped.task.assignee.name, "周以恒");
  assert.equal(mapped.task.permalink_url, "https://www.notion.so/task");
  const amount = mapped.task.custom_fields.find((field) => field.name === "請款金額");
  const flag = mapped.task.custom_fields.find((field) => field.name === "請款任務");
  assert.equal(amount.number_value, 1200);
  assert.equal(flag.enum_value.name, "是");
  assert.equal(
    mapped.task.custom_fields.some((field) => field.number_value === 999),
    false
  );
});

test("完成的一般任務不是請款任務", () => {
  const mapped = taskFromNotionPage({
    id: "task-2",
    url: "https://www.notion.so/t2",
    properties: {
      名稱: { type: "title", title: [{ plain_text: "調整圖說" }] },
      狀態: { type: "status", status: { name: "完成" } },
      任務類型: { type: "select", select: { name: "一般任務" } },
      請款金額: { type: "number", number: null },
    },
  });
  assert.equal(mapped.task.completed, true);
  assert.equal(
    mapped.task.custom_fields.find((field) => field.name === "請款任務").enum_value.name,
    "否"
  );
  assert.equal(
    mapped.task.custom_fields.find((field) => field.name === "請款金額").number_value,
    null
  );
});

test("快取鍵含資料來源與權杖，換來源或換金鑰就不同", () => {
  const asanaKey = apiCacheKey("asana", "pat-a", "/projects", "limit=100");
  const notionKey = apiCacheKey("notion", "pat-a", "/projects", "limit=100");
  const otherToken = apiCacheKey("notion", "pat-b", "/projects", "limit=100");
  assert.notEqual(asanaKey, notionKey);
  assert.notEqual(notionKey, otherToken);
  assert.match(notionKey, /^notion:/);
  assert.match(asanaKey, /^asana:/);
});

function runServer(env) {
  return spawn(process.execPath, ["server/index.mjs"], {
    env: { ...process.env, ...env },
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  });
}

function waitForExit(child, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: null, stderr: "" });
    }, ms);
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

test("非法 DATA_SOURCE 讓程序退出並印出該值", async () => {
  const child = runServer({ DATA_SOURCE: "nope", PORT: "0" });
  const result = await waitForExit(child, 8000);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /nope/);
});

test("未設定 DATA_SOURCE 時 /api/config 是 asana", async () => {
  const port = 9877;
  const env = { ...process.env, PORT: String(port) };
  delete env.DATA_SOURCE;
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env,
    cwd: fileURLToPath(new URL("..", import.meta.url)),
  });
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(stdout || "server did not start")), 8000);
    const tick = setInterval(() => {
      if (stdout.includes("監聽埠")) {
        clearInterval(tick);
        clearTimeout(timer);
        resolve();
      }
    }, 50);
    child.on("exit", (code) => {
      clearInterval(tick);
      clearTimeout(timer);
      reject(new Error(`server exited ${code}: ${stdout}`));
    });
  });
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/config`);
    const body = await res.json();
    assert.deepEqual(body, { dataSource: "asana" });
  } finally {
    child.kill();
  }
});

test("DATA_SOURCE=notion 時 /api/config 是 notion", async () => {
  const port = 9876;
  const child = runServer({ DATA_SOURCE: "notion", PORT: String(port) });
  let stdout = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(stdout || "server did not start")), 8000);
    const tick = setInterval(() => {
      if (stdout.includes("監聽埠")) {
        clearInterval(tick);
        clearTimeout(timer);
        resolve();
      }
    }, 50);
    child.on("exit", (code) => {
      clearInterval(tick);
      clearTimeout(timer);
      reject(new Error(`server exited ${code}: ${stdout}`));
    });
  });
  await ready;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/config`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, { dataSource: "notion" });
  } finally {
    child.kill();
  }
});
