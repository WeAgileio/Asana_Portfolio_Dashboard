#!/usr/bin/env node
/**
 * 一次性：從 Asana 拉專案／section／task 結構，輸出 sanitized JSON（不含 PAT）。
 * 用法：ASANA_PAT='...' node scripts/fetch-asana-demo-seed.mjs
 */
import axios from "axios";

const pat = process.env.ASANA_PAT?.trim();
if (!pat) {
  console.error("請設定 ASANA_PAT 環境變數");
  process.exit(1);
}

const api = axios.create({
  baseURL: "https://app.asana.com/api/1.0",
  headers: { Authorization: `Bearer ${pat}` },
});

async function main() {
  const { data: wsRes } = await api.get("/workspaces", { params: { limit: 5 } });
  const workspace = wsRes.data?.[0];
  if (!workspace) throw new Error("no workspace");

  const { data: projRes } = await api.get("/projects", {
    params: {
      workspace: workspace.gid,
      limit: 30,
      archived: false,
      opt_fields: "gid,name,color,created_at,members,members.name",
    },
  });

  const projects = (projRes.data ?? []).filter((p) => !p.archived);
  const picked = projects.slice(0, 4);

  const out = {
    workspaceName: workspace.name,
    projects: [],
  };

  for (const p of picked) {
    const { data: secRes } = await api.get(`/projects/${p.gid}/sections`, {
      params: { opt_fields: "gid,name" },
    });
    const sections = secRes.data ?? [];
    const sectionDetails = [];

    for (const s of sections.slice(0, 5)) {
      const { data: taskRes } = await api.get(`/sections/${s.gid}/tasks`, {
        params: {
          limit: 15,
          opt_fields:
            "gid,name,completed,due_on,resource_subtype,assignee.name,custom_fields.name,custom_fields.number_value,custom_fields.display_value,custom_fields.enum_value,custom_fields.enum_value.name",
        },
      });
      sectionDetails.push({
        name: s.name,
        tasks: (taskRes.data ?? []).map((t) => ({
          name: t.name,
          completed: t.completed,
          due_on: t.due_on ?? null,
          resource_subtype: t.resource_subtype ?? null,
          assignee: t.assignee?.name ?? null,
          customFieldNames: (t.custom_fields ?? [])
            .filter((cf) => cf.display_value || cf.number_value != null)
            .map((cf) => cf.name),
        })),
      });
    }

    out.projects.push({
      name: p.name,
      color: p.color,
      created_at: p.created_at,
      memberNames: (p.members ?? []).map((m) => m.name).filter(Boolean),
      sections: sectionDetails,
    });
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e.response?.data ?? e.message);
  process.exit(1);
});
