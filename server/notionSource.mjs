import axios from "axios";
import { createHash } from "node:crypto";

const NOTION_VERSION = "2022-06-28";
const NOTION_API = "https://api.notion.com/v1";
const DEFAULT_ROOT_PAGE_ID = "3e353bdeb3b1803ea05ec8b6873d9f4d";
const TASK_DATABASE_TITLE = "任務";
const BUNDLE_TTL_MS = 5 * 60_000;

const notion = axios.create({ baseURL: NOTION_API });

/** @type {Map<string, { expiresAt: number, pages: any[] }>} */
const projectListCache = new Map();
/** @type {Map<string, { expiresAt: number, tasks: any[], stageOrder: string[] }>} */
const taskBundleCache = new Map();
/** @type {Map<string, string>} */
const userNameCache = new Map();

export function resolveDataSource(raw) {
  const trimmed = raw == null ? "" : String(raw).trim();
  if (trimmed === "") return "asana";
  const lower = trimmed.toLowerCase();
  if (lower === "asana" || lower === "notion") return lower;
  const err = new Error(`無效的 DATA_SOURCE：${raw}`);
  err.code = "INVALID_DATA_SOURCE";
  throw err;
}

export function resolveRootPageId(raw) {
  const trimmed = raw == null ? "" : String(raw).trim();
  return trimmed || DEFAULT_ROOT_PAGE_ID;
}

export function childDatabaseId(blocks, title) {
  for (const block of blocks || []) {
    if (block?.type !== "child_database") continue;
    if (block.child_database?.title === title) return block.id;
  }
  return null;
}

export function projectGidFromPage(page) {
  const asanaId = plainText(page?.properties?.["AsanaID"]).trim();
  if (asanaId) return asanaId;
  return String(page?.id || "").replace(/-/g, "");
}

export function projectFromNotionPage(page, memberNames) {
  const link = typeof page?.url === "string" ? page.url.trim() : "";
  const names = Array.isArray(memberNames) ? memberNames : [];
  return {
    gid: projectGidFromPage(page),
    name: plainText(page?.properties?.["名稱"]).trim(),
    color: null,
    archived: false,
    created_at: page?.created_time ?? null,
    workspace_gid: null,
    permalink_url: link || null,
    project_brief: link ? { gid: null, permalink_url: link } : null,
    notes_permalink_url: link || null,
    project_brief_gid: null,
    project_permalink_url: link || null,
    members: names.map((name) => ({ name })),
    memberNames: names,
  };
}

export function taskFromNotionPage(page) {
  const props = page?.properties || {};
  const status = plainText(props["狀態"]).trim();
  const taskType = plainText(props["任務類型"]).trim();
  const amount = props["請款金額"]?.type === "number" ? props["請款金額"].number : null;
  const dueRaw = props["計畫完成時間"]?.type === "date" ? props["計畫完成時間"].date?.start : "";
  const due = typeof dueRaw === "string" && /^\d{4}-\d{2}-\d{2}/.test(dueRaw) ? dueRaw.slice(0, 10) : null;
  const assigneeNames = peopleNamesFromProperty(props["指派"]);
  const link = typeof page?.url === "string" ? page.url.trim() : "";
  const billingYes = taskType === "請款任務";
  return {
    stage: plainText(props["階段"]).trim(),
    task: {
      gid: plainText(props["AsanaID"]).trim() || String(page?.id || "").replace(/-/g, ""),
      name: plainText(props["名稱"]).trim(),
      completed: status === "完成",
      completed_at: null,
      created_at: page?.created_time ?? null,
      modified_at: null,
      due_on: due,
      assignee: assigneeNames.length
        ? { gid: "notion-assignee", name: assigneeNames.join("、") }
        : null,
      resource_subtype: null,
      permalink_url: link,
      custom_fields: [
        {
          gid: "notion-billing-amount",
          name: "請款金額",
          type: "number",
          number_value: typeof amount === "number" && Number.isFinite(amount) ? amount : null,
        },
        {
          gid: "notion-billing-task",
          name: "請款任務",
          type: "enum",
          enum_value: { name: billingYes ? "是" : "否" },
        },
      ],
    },
  };
}

export function sectionsFromTasks(projectGid, taskRows, stageOrder) {
  const present = new Set(
    (taskRows || []).map((row) => row.stage).filter((name) => name)
  );
  const ordered = [];
  for (const name of stageOrder || []) {
    if (present.has(name)) {
      ordered.push(name);
      present.delete(name);
    }
  }
  for (const name of present) ordered.push(name);
  return ordered.map((name) => ({
    gid: `notion-section:${projectGid}:${name}`,
    name,
  }));
}

export function parseSectionGid(sectionGid) {
  const prefix = "notion-section:";
  if (typeof sectionGid !== "string" || !sectionGid.startsWith(prefix)) return null;
  const rest = sectionGid.slice(prefix.length);
  const colon = rest.indexOf(":");
  if (colon <= 0) return null;
  return {
    projectGid: rest.slice(0, colon),
    stageName: rest.slice(colon + 1),
  };
}

function tokenHash(token) {
  return createHash("sha256").update(token, "utf8").digest("hex").slice(0, 32);
}

function notionHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

function plainText(prop) {
  if (!prop || typeof prop !== "object") return "";
  if (prop.type === "title") return joinRich(prop.title);
  if (prop.type === "rich_text") return joinRich(prop.rich_text);
  if (prop.type === "url") return prop.url || "";
  if (prop.type === "select") return prop.select?.name || "";
  if (prop.type === "status") return prop.status?.name || "";
  return "";
}

function joinRich(parts) {
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => (part && part.plain_text) || "").join("");
}

function peopleNamesFromProperty(prop) {
  if (!prop || prop.type !== "people" || !Array.isArray(prop.people)) return [];
  return prop.people
    .map((person) => (person && typeof person.name === "string" ? person.name.trim() : ""))
    .filter(Boolean);
}

async function notionGet(token, path, params) {
  const res = await notion.get(path, { headers: notionHeaders(token), params });
  return res.data;
}

async function notionPost(token, path, body) {
  const res = await notion.post(path, body, { headers: notionHeaders(token) });
  return res.data;
}

async function listAllBlocks(token, blockId) {
  const blocks = [];
  let cursor;
  do {
    const page = await notionGet(token, `/blocks/${blockId}/children`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    blocks.push(...(page.results || []));
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

async function queryAllPages(token, databaseId) {
  const pages = [];
  let cursor;
  do {
    const page = await notionPost(token, `/databases/${databaseId}/query`, {
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    pages.push(...(page.results || []));
    cursor = page.has_more ? page.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function userName(token, userId) {
  const key = `${tokenHash(token)}:${userId}`;
  if (userNameCache.has(key)) return userNameCache.get(key);
  let name = "";
  try {
    const user = await notionGet(token, `/users/${userId}`);
    name = typeof user?.name === "string" ? user.name.trim() : "";
  } catch {
    name = "";
  }
  userNameCache.set(key, name);
  return name;
}

async function memberNamesOf(token, page) {
  const names = [];
  for (const key of ["主設計", "窗口"]) {
    const prop = page?.properties?.[key];
    if (!prop || prop.type !== "people" || !Array.isArray(prop.people)) continue;
    for (const person of prop.people) {
      const direct = person && typeof person.name === "string" ? person.name.trim() : "";
      const name = direct || (person?.id ? await userName(token, person.id) : "");
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

async function assigneeNames(token, page) {
  const direct = peopleNamesFromProperty(page?.properties?.["指派"]);
  if (direct.length) return direct;
  const prop = page?.properties?.["指派"];
  if (!prop || prop.type !== "people" || !Array.isArray(prop.people)) return [];
  const names = [];
  for (const person of prop.people) {
    if (!person?.id) continue;
    const name = await userName(token, person.id);
    if (name) names.push(name);
  }
  return names;
}

const rootDatabaseCache = new Map();

async function rootDatabaseId(token, rootPageId) {
  const key = `${tokenHash(token)}:${rootPageId}`;
  const hit = rootDatabaseCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.id;
  const blocks = await listAllBlocks(token, rootPageId);
  const id =
    childDatabaseId(blocks, "專案總表") ||
    blocks.find((block) => block?.type === "child_database")?.id ||
    null;
  if (!id) {
    const err = new Error("根頁面裡找不到專案資料庫");
    err.status = 404;
    throw err;
  }
  rootDatabaseCache.set(key, { id, expiresAt: Date.now() + BUNDLE_TTL_MS });
  return id;
}

export async function assertRootReadable(token, rootPageId) {
  await notionGet(token, `/pages/${rootPageId}`);
}

async function allProjectPages(token, rootPageId, bypass) {
  const key = `${tokenHash(token)}:${rootPageId}`;
  if (!bypass) {
    const hit = projectListCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.pages;
  }
  const databaseId = await rootDatabaseId(token, rootPageId);
  const pages = await queryAllPages(token, databaseId);
  projectListCache.set(key, { pages, expiresAt: Date.now() + BUNDLE_TTL_MS });
  return pages;
}

async function findProjectPage(token, rootPageId, projectGid, bypass) {
  const pages = await allProjectPages(token, rootPageId, bypass);
  const want = String(projectGid).replace(/-/g, "");
  return (
    pages.find((page) => projectGidFromPage(page).replace(/-/g, "") === want) || null
  );
}

async function taskBundle(token, rootPageId, projectGid, bypass) {
  const key = `${tokenHash(token)}:${rootPageId}:${projectGid}`;
  if (!bypass) {
    const hit = taskBundleCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit;
  }
  const projectPage = await findProjectPage(token, rootPageId, projectGid, bypass);
  if (!projectPage) return null;
  const blocks = await listAllBlocks(token, projectPage.id);
  const databaseId = childDatabaseId(blocks, TASK_DATABASE_TITLE);
  let stageOrder = [];
  let tasks = [];
  if (databaseId) {
    const schema = await notionGet(token, `/databases/${databaseId}`);
    const stageProp = schema?.properties?.["階段"];
    const options =
      stageProp?.select?.options || stageProp?.status?.options || [];
    stageOrder = options.map((option) => option?.name).filter(Boolean);
    const pages = await queryAllPages(token, databaseId);
    tasks = [];
    for (const page of pages) {
      const mapped = taskFromNotionPage(page);
      const names = await assigneeNames(token, page);
      if (names.length) {
        mapped.task.assignee = { gid: "notion-assignee", name: names.join("、") };
      }
      tasks.push(mapped);
    }
  }
  const bundle = {
    tasks,
    stageOrder,
    expiresAt: Date.now() + BUNDLE_TTL_MS,
  };
  taskBundleCache.set(key, bundle);
  return bundle;
}

export async function handleNotionRequest(token, path, { rootPageId, bypass }) {
  if (path === "/workspaces") {
    return { data: [{ gid: "notion", name: "Notion" }] };
  }

  if (path === "/projects") {
    const pages = await allProjectPages(token, rootPageId, bypass);
    const data = [];
    for (const page of pages) {
      data.push(projectFromNotionPage(page, await memberNamesOf(token, page)));
    }
    return { data };
  }

  const projectMatch = path.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    const page = await findProjectPage(token, rootPageId, decodeURIComponent(projectMatch[1]), bypass);
    if (!page) {
      const err = new Error("找不到專案");
      err.status = 404;
      throw err;
    }
    return { data: projectFromNotionPage(page, await memberNamesOf(token, page)) };
  }

  const sectionMatch = path.match(/^\/projects\/([^/]+)\/sections$/);
  if (sectionMatch) {
    const projectGid = decodeURIComponent(sectionMatch[1]);
    const bundle = await taskBundle(token, rootPageId, projectGid, bypass);
    if (!bundle) {
      const err = new Error("找不到專案");
      err.status = 404;
      throw err;
    }
    return { data: sectionsFromTasks(projectGid, bundle.tasks, bundle.stageOrder) };
  }

  const taskMatch = path.match(/^\/sections\/(.+)\/tasks$/);
  if (taskMatch) {
    const parsed = parseSectionGid(decodeURIComponent(taskMatch[1]));
    if (!parsed) {
      const err = new Error("階段 id 無法解析");
      err.status = 404;
      throw err;
    }
    const bundle = await taskBundle(token, rootPageId, parsed.projectGid, bypass);
    if (!bundle) {
      const err = new Error("找不到專案");
      err.status = 404;
      throw err;
    }
    const data = bundle.tasks
      .filter((row) => row.stage === parsed.stageName)
      .map((row) => row.task);
    return { data };
  }

  const err = new Error("Notion 模式不支援此路徑");
  err.status = 404;
  throw err;
}
