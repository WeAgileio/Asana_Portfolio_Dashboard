import type { AsanaProject } from "@/types/asana";

const ASANA_APP_ORIGIN = "https://app.asana.com";

/**
 * 是否已為新網址格式之 Notes 路徑（…/project/{id}/note[…]）。
 */
function hasProjectNoteInPath(url: string): boolean {
  return /\/project\/\d+\/note(?:$|\/|\?|#)/i.test(url);
}

/** 若為 …/project/{id}/note/{id}，收斂成只要 …/project/{id}/note */
function shortProjectNoteUrl(url: string): string {
  return url.replace(/(\/project\/\d+\/note)\/\d+/, "$1");
}

function buildProjectNoteUrl(
  workspaceGid: string,
  projectGid: string
): string {
  return `${ASANA_APP_ORIGIN}/1/${encodeURIComponent(
    workspaceGid
  )}/project/${encodeURIComponent(projectGid)}/note`;
}

function tryParseWorkspaceAndProjectFromUrl(
  url: string
): { ws: string; project: string } | null {
  const m = url.match(/app\.asana\.com\/1\/(\d+)\/project\/(\d+)/i);
  if (m) return { ws: m[1]!, project: m[2]! };
  return null;
}

/**
 * 在 `.../1/{ws}/project/{id}` 或帶 list／board 等子視圖時，改為
 * `.../project/{id}/note`（不帶 brief／額外 id）。
 */
function withProjectNotePath(baseUrl: string): string {
  if (!baseUrl) return baseUrl;
  if (hasProjectNoteInPath(baseUrl)) {
    return shortProjectNoteUrl(baseUrl);
  }
  const s = baseUrl.replace(/\/$/, "");
  if (/\/project\/\d+$/i.test(s)) {
    return `${s}/note`;
  }
  const m = s.match(
    /^(https:\/\/app\.asana\.com\/1\/\d+\/project\/\d+)(?:\/(list|board|timeline|calendar|table|gantt|dashboard|overview|team|okrs?|messages?|conversations?))?$/i
  );
  if (m) {
    return `${m[1]!}/note`;
  }
  return baseUrl;
}

/**
 * 讓最終字串帶上 `…/1/{ws}/project/{id}/note`；若已含 `/note` 則盡量收斂成不帶後綴 id。
 */
function ensureProjectNotePath(candidate: string, project: AsanaProject): string {
  if (hasProjectNoteInPath(candidate)) {
    return shortProjectNoteUrl(candidate);
  }
  const ws = project.workspace_gid?.trim() || null;
  const pg = project.gid;
  if (ws && pg) {
    return buildProjectNoteUrl(ws, pg);
  }
  const fromCandidate = tryParseWorkspaceAndProjectFromUrl(candidate);
  if (fromCandidate) {
    return buildProjectNoteUrl(fromCandidate.ws, fromCandidate.project);
  }
  if (project.notes_permalink_url) {
    const p = tryParseWorkspaceAndProjectFromUrl(project.notes_permalink_url);
    if (p) {
      return buildProjectNoteUrl(p.ws, p.project);
    }
  }
  if (project.project_permalink_url) {
    const p = tryParseWorkspaceAndProjectFromUrl(project.project_permalink_url);
    if (p) {
      return buildProjectNoteUrl(p.ws, p.project);
    }
  }
  const patched = withProjectNotePath(candidate);
  if (hasProjectNoteInPath(patched)) {
    return shortProjectNoteUrl(patched);
  }
  return patched || candidate;
}

/**
 * 在瀏覽器開啟專案的連結。
 * 若已存的網址不是 Asana（例如 Notion 頁面），原樣回傳。
 * Asana 則固定為 `https://app.asana.com/1/{workspace}/project/{專案}/note`，不在 `/note` 後面加
 * brief 或其它 id；若從 API 帶到 `.../note/{id}` 會盡量收斂成上述形式。
 */
export function asanaProjectNotesUrl(project: AsanaProject): string {
  const stored =
    project.notes_permalink_url?.trim() ||
    project.project_permalink_url?.trim() ||
    "";
  if (stored && !/app\.asana\.com/i.test(stored)) {
    return stored;
  }
  const ws = project.workspace_gid?.trim() || null;
  const pg = project.gid;
  let candidate: string;
  if (ws && pg) {
    candidate = withProjectNotePath(
      `${ASANA_APP_ORIGIN}/1/${encodeURIComponent(
        ws
      )}/project/${encodeURIComponent(pg)}`
    );
  } else if (project.notes_permalink_url) {
    candidate = withProjectNotePath(project.notes_permalink_url);
  } else if (project.project_permalink_url) {
    candidate = withProjectNotePath(project.project_permalink_url);
  } else {
    candidate = `${ASANA_APP_ORIGIN}/0/${encodeURIComponent(project.gid)}/list`;
  }
  return ensureProjectNotePath(candidate, project);
}
