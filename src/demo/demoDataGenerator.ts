import type { AsanaProject, AsanaSection, AsanaTask, AsanaUser } from "@/types/asana";

export type DemoSectionBundle = {
  section: AsanaSection;
  tasks: AsanaTask[];
};

export type DemoProjectBundle = {
  project: AsanaProject;
  sections: DemoSectionBundle[];
  defaultSelected: boolean;
};

export type DemoDataset = {
  projects: AsanaProject[];
  bundles: DemoProjectBundle[];
  defaultSelectedProjectGids: string[];
};

const DEMO_WORKSPACE_GID = "demo-workspace-1";
const SPAN_MONTHS = 18;

const DEMO_MEMBERS: AsanaUser[] = [
  { gid: "demo-user-1", name: "張心言" },
  { gid: "demo-user-2", name: "趙予安" },
  { gid: "demo-user-3", name: "周以恒" },
  { gid: "demo-user-4", name: "吴知夏" },
];

const MEMBER_NAMES = DEMO_MEMBERS.map((m) => m.name);

const PROJECT_COLORS = [
  "purple",
  "light-green",
  "light-blue",
  "light-orange",
  "light-warm-red",
  "light-purple",
  "light-teal",
  "light-yellow",
  "light-pink",
  "none",
];

type SectionTemplate = {
  name: string;
  tasks: string[];
  billing?: { amount: number };
};

/** 公設建案標準階段（虛構展示用 workflow） */
const WORKFLOW_STAGES: SectionTemplate[] = [
  {
    name: "C01 新案洽談",
    tasks: ["業主提供資料與溝通需求", "基地分析", "需求訪談會議", "案例與風格定向"],
  },
  {
    name: "C02 報價／議價",
    tasks: ["確認設計範圍", "設計面積計算", "服務費用估算", "報價簡報"],
  },
  {
    name: "C03 簽訂合約／第一期請款",
    tasks: ["合約內容確認與用印", "開立發票", "合約歸檔"],
    billing: { amount: 280000 },
  },
  {
    name: "C04 都審階段",
    tasks: ["全面 SKP 設計建模", "都審單元化設計建模", "都審簡報準備", "都審會議"],
  },
  {
    name: "C05 風格 3D 提案階段",
    tasks: [
      "風格 3D 會前會提案簡報 PPT",
      "第一次風格 3D 提案簡報",
      "大廳 3D 模型與渲染",
      "中庭景觀 3D 調整",
    ],
  },
  {
    name: "C06 第二期請款",
    tasks: ["填寫請款領據", "開立發票", "請款里程碑"],
    billing: { amount: 320000 },
  },
  {
    name: "C07 全案設計深化階段",
    tasks: ["設計深化共識心智圖會議", "空間深化設計小提案", "平面細部修正", "材質與工法確認"],
  },
  {
    name: "C08 一次圖說階段",
    tasks: ["Revit 結構建模", "Revit 設計建模", "一次圖說校核", "圖說發包前檢討"],
  },
  {
    name: "C10 建材設定階段",
    tasks: ["石材磁磚情境圖協尋", "建材小樣蒐集彙整", "建材小樣提案會議", "配色定案"],
  },
  {
    name: "C09 第三期請款",
    tasks: ["填寫請款領據", "開立發票", "第三期請款"],
    billing: { amount: 260000 },
  },
  {
    name: "C11 營造工地現況檢視",
    tasks: ["頂板拆模後現場巡視", "現場與圖說相符性確認"],
  },
  {
    name: "C12 二次圖說階段",
    tasks: ["業主回饋 ABC 分類", "圖說修正啟動會議", "二次圖說修正", "圖面索引更新"],
  },
  {
    name: "C13 第四期請款",
    tasks: ["填寫請款領據", "開立發票"],
    billing: { amount: 240000 },
  },
  {
    name: "C14 業主圖說會議／工務會議",
    tasks: ["裝修發包前最終檢討", "工務協調會議"],
  },
  {
    name: "C15 圖說最終修正階段",
    tasks: ["依會議紀錄調整圖說", "設計圖說資料交付", "竣工圖確認"],
  },
  {
    name: "C16 工程標單",
    tasks: ["依圖說製作工程標單", "標單與業主確認"],
  },
  {
    name: "C17 傢俱飾品建議書階段",
    tasks: ["傢俱飾品需求 PPT", "與廠商溝通需求", "提案資料檢視回饋", "報價提供業主"],
  },
  {
    name: "C18 第五期請款",
    tasks: ["填寫請款領據", "開立發票"],
    billing: { amount: 180000 },
  },
  {
    name: "C19 完工驗收階段",
    tasks: ["偕同業主現場巡視", "缺失列管與追蹤", "空間錄影紀錄", "驗收簽認"],
  },
  {
    name: "C20 尾款請款",
    tasks: ["填寫請款領據", "開立發票", "結案報告"],
    billing: { amount: 150000 },
  },
];

const FINAL_BILLING_STAGE_INDEX = WORKFLOW_STAGES.length - 1;
const FINAL_BILLING_STAGE = WORKFLOW_STAGES[FINAL_BILLING_STAGE_INDEX]!;

/** 專案合約總額區間（元）：150 萬–250 萬 */
const CONTRACT_TOTAL_MIN = 1_500_000;
const CONTRACT_TOTAL_MAX = 2_500_000;

function contractTotalForSeed(seed: string): number {
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const t = (hash % 101) / 100;
  return Math.round(CONTRACT_TOTAL_MIN + t * (CONTRACT_TOTAL_MAX - CONTRACT_TOTAL_MIN));
}

/** 依各期請款權重比例，將合約總額分配至現有請款階段 */
function applyContractTotal(stages: SectionTemplate[], contractTotal: number): SectionTemplate[] {
  const normalized = ensureTerminalFinalBilling(stages);
  const billingIndices: number[] = [];
  let baseSum = 0;
  normalized.forEach((s, i) => {
    if (s.billing) {
      billingIndices.push(i);
      baseSum += s.billing.amount;
    }
  });
  if (billingIndices.length === 0 || baseSum === 0) return normalized;

  let allocated = 0;
  const result = normalized.map((s) => ({ ...s, tasks: [...s.tasks] }));
  billingIndices.forEach((idx, j) => {
    const stage = result[idx]!;
    const isLast = j === billingIndices.length - 1;
    const amount = isLast
      ? contractTotal - allocated
      : Math.round((stage.billing!.amount / baseSum) * contractTotal);
    allocated += amount;
    result[idx] = { ...stage, billing: { amount } };
  });
  return result;
}

/** 確保階段序列以 C20 尾款請款 結束，之後不再追加任務 */
function ensureTerminalFinalBilling(stages: SectionTemplate[]): SectionTemplate[] {
  const finalName = FINAL_BILLING_STAGE.name;
  const trimmed = [...stages];
  const existingFinal = trimmed.findIndex((s) => s.name === finalName);
  if (existingFinal >= 0) {
    return trimmed.slice(0, existingFinal + 1);
  }
  return [...trimmed, FINAL_BILLING_STAGE];
}

/** 接待中心建案：強化風格 3D 提案階段任務 */
const FLAGSHIP_RECEPTION_STAGES: SectionTemplate[] = [
  WORKFLOW_STAGES[0]!,
  WORKFLOW_STAGES[1]!,
  WORKFLOW_STAGES[2]!,
  {
    name: "C05 風格 3D 提案階段",
    tasks: [
      "接待中心平面配置確認",
      "樣品屋戶型配置確認",
      "風格 image 提案 PPT",
      "第一次風格 3D Sprint 簡報",
      "第二次風格 3D Sprint 簡報",
    ],
  },
  WORKFLOW_STAGES[5]!,
  WORKFLOW_STAGES[6]!,
  WORKFLOW_STAGES[7]!,
  WORKFLOW_STAGES[8]!,
  WORKFLOW_STAGES[16]!,
  WORKFLOW_STAGES[9]!,
  WORKFLOW_STAGES[14]!,
  WORKFLOW_STAGES[18]!,
  FINAL_BILLING_STAGE,
];

/** 完整 20 階段建案（終點為尾款請款） */
const FULL_WORKFLOW_STAGES: SectionTemplate[] = [...WORKFLOW_STAGES];

/** 早期以平面／風格 3D 為主，仍銜接至尾款請款結案 */
const EARLY_PLAN_3D_STAGES: SectionTemplate[] = ensureTerminalFinalBilling([
  {
    name: "概念平面階段",
    tasks: ["大廳 3D SKP 模擬", "搜尋相似平面案例", "平面配置草案", "動線檢討"],
  },
  {
    name: "風格3D提案階段",
    tasks: ["PPT 腳本定向定量", "室內回套新建築平面", "第一次 3D 提案", "渲染定稿"],
  },
  {
    name: "風格3D修改",
    tasks: ["室內平面修改", "景觀平面修改", "材質細部調整", "業主回饋修正"],
  },
  ...WORKFLOW_STAGES.slice(5),
]);

type ProjectSpec = {
  gid: string;
  name: string;
  stages: SectionTemplate[];
  /** 合約總額（元），請款分期加總應等於此值 */
  contractTotal: number;
  /** 0–1，已完成階段比例 */
  progress: number;
  /** 專案起始月（相對 anchor，負值表示過去） */
  startMonthOffset: number;
  createdMonthsAgo: number;
  defaultSelected: boolean;
  color?: string;
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(anchor: Date, days: number): string {
  const d = new Date(anchor);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function addMonths(anchor: Date, months: number): string {
  const d = new Date(anchor);
  d.setMonth(d.getMonth() + months);
  return toDateStr(d);
}

function addMonthsDate(anchor: Date, months: number): Date {
  const d = new Date(anchor);
  d.setMonth(d.getMonth() + months);
  return d;
}

function isoAtAnchor(anchor: Date, dayOffset = 0): string {
  const d = new Date(anchor);
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString();
}

function section(gid: string, name: string): AsanaSection {
  return { gid, name };
}

let taskSeq = 0;

function makeTask(
  anchor: Date,
  opts: {
    sectionKey: string;
    name: string;
    completed: boolean;
    dueOn: string | null;
    assigneeIndex?: number;
    milestone?: boolean;
    billingAmount?: number;
    billingTaskYes?: boolean;
    dayOffsetCreated?: number;
  }
): AsanaTask {
  taskSeq += 1;
  const gid = `demo-task-${opts.sectionKey}-${taskSeq}`;
  const assignee =
    DEMO_MEMBERS[(opts.assigneeIndex ?? taskSeq) % DEMO_MEMBERS.length] ?? null;
  const completedAt =
    opts.completed && opts.dueOn
      ? `${opts.dueOn}T10:00:00.000Z`
      : opts.completed
        ? isoAtAnchor(anchor, -1)
        : null;

  return {
    gid,
    name: opts.name,
    completed: opts.completed,
    completed_at: completedAt,
    created_at: isoAtAnchor(anchor, opts.dayOffsetCreated ?? -60),
    modified_at: isoAtAnchor(anchor, opts.completed ? -2 : -1),
    due_on: opts.dueOn,
    assignee,
    resource_subtype: opts.milestone ? "milestone" : "default_task",
    creatorName: assignee?.name ?? null,
    billingAmount: opts.billingAmount ?? null,
    billingTaskYes: opts.billingTaskYes ?? false,
    permalink_url: "#demo-task",
  };
}

function pickStagesEvenly(count: number): SectionTemplate[] {
  const lastIdx = FINAL_BILLING_STAGE_INDEX;
  const n = Math.max(7, Math.min(count, WORKFLOW_STAGES.length));
  if (n >= WORKFLOW_STAGES.length) return [...WORKFLOW_STAGES];

  const indices: number[] = [];
  const preludeCount = n - 1;
  for (let i = 0; i < preludeCount; i++) {
    const denom = Math.max(preludeCount - 1, 1);
    indices.push(Math.round((i * (lastIdx - 1)) / denom));
  }
  indices.push(lastIdx);

  const unique = [...new Set(indices)];
  return ensureTerminalFinalBilling(unique.map((i) => WORKFLOW_STAGES[i]!));
}

/** 依階段索引在 18 個月跨度內分配 due 月份 */
function monthOffsetForSection(
  sectionIndex: number,
  sectionCount: number,
  startMonthOffset: number
): number {
  if (sectionCount <= 1) return startMonthOffset;
  const t = sectionIndex / (sectionCount - 1);
  return Math.round(startMonthOffset + t * SPAN_MONTHS);
}

function buildSectionsFromStages(
  anchor: Date,
  projectKey: string,
  stages: SectionTemplate[],
  contractTotal: number,
  progress: number,
  startMonthOffset: number
): DemoSectionBundle[] {
  const normalizedStages = applyContractTotal(stages, contractTotal);
  const count = normalizedStages.length;
  const completedThrough = Math.floor(progress * count);
  const finalSectionIndex = count - 1;

  return normalizedStages.map((stage, i) => {
    const monthOff = monthOffsetForSection(i, count, startMonthOffset);
    const sectionDone = i < completedThrough;
    const sectionActive = i === completedThrough;
    const secKey = `${projectKey}-s${i + 1}`;

    const tasks = stage.tasks.map((taskName, ti) => {
      const taskProgress = sectionDone
        ? true
        : sectionActive
          ? ti < Math.ceil(stage.tasks.length * 0.55)
          : false;
      const dayJitter = ti * 4 + (i % 3);
      const dueBase = addMonthsDate(anchor, monthOff);
      const isLast = ti === stage.tasks.length - 1;
      const billing = stage.billing;

      return makeTask(anchor, {
        sectionKey: secKey,
        name: taskName,
        completed: taskProgress,
        dueOn: addDays(dueBase, dayJitter + (taskProgress ? 0 : 7)),
        assigneeIndex: (i + ti) % DEMO_MEMBERS.length,
        milestone: isLast && !!billing,
        billingTaskYes: !!billing && isLast,
        billingAmount: billing && isLast ? billing.amount : undefined,
        dayOffsetCreated: monthOff * 28 - 14,
      });
    });

    // 進行中階段：至少一個近到期未完成任務（展示 at-risk / behind）
    // 尾款請款為最終階段，不在此階段之後再調整任務
    if (sectionActive && tasks.length > 0 && i < finalSectionIndex) {
      const tail = tasks[tasks.length - 1]!;
      if (!tail.completed) {
        tasks[tasks.length - 1] = {
          ...tail,
          due_on: i % 2 === 0 ? addDays(anchor, -2) : addDays(anchor, 10),
        };
      }
    }

    return {
      section: section(`${projectKey}-sec-${i + 1}`, stage.name),
      tasks,
    };
  });
}

function makeProjectBundle(anchor: Date, spec: ProjectSpec, colorIndex: number): DemoProjectBundle {
  const sections = buildSectionsFromStages(
    anchor,
    spec.gid,
    spec.stages,
    spec.contractTotal,
    spec.progress,
    spec.startMonthOffset
  );

  return {
    defaultSelected: spec.defaultSelected,
    project: {
      gid: spec.gid,
      name: spec.name,
      color: spec.color ?? PROJECT_COLORS[colorIndex % PROJECT_COLORS.length] ?? "none",
      archived: false,
      created_at: isoAtAnchor(addMonthsDate(anchor, -spec.createdMonthsAgo)),
      workspace_gid: DEMO_WORKSPACE_GID,
      notes_permalink_url: null,
      project_brief_gid: null,
      project_permalink_url: "#demo-project",
      memberNames: MEMBER_NAMES,
    },
    sections,
  };
}

/** 完整建案專案名稱（皆為虛構建商／虛構路段） */
const BUILDING_PROJECT_NAMES = [
  "森闊-合睦段",
  "星瀾-光綺段",
  "晨逸-瀾橋段",
  "曜石-翠湖段",
  "沐川-B15接待中心",
  "澄灣-玉露段",
  "柏嵐-向陽段",
  "聽雨-雲嶺段",
  "初陽-澄月段",
  "霧峰-安林段",
  "青隅-海嶼段",
  "月台-桃川段",
  "遠杉-靜北段",
];

/** 以 anchor 生成 demo 資料集（≥15 專案、每案 ≥7 區間、跨度 18 個月） */
export function generateDemoDataset(anchorInput?: Date): DemoDataset {
  taskSeq = 0;
  const anchor = startOfDay(anchorInput ?? new Date());

  const specs: ProjectSpec[] = [
    {
      gid: "demo-proj-hecheng-a20",
      name: "禾澄-A20接待中心",
      stages: ensureTerminalFinalBilling(FLAGSHIP_RECEPTION_STAGES),
      contractTotal: contractTotalForSeed("demo-proj-hecheng-a20"),
      progress: 0.72,
      startMonthOffset: -18,
      createdMonthsAgo: 18,
      defaultSelected: true,
      color: "purple",
    },
    {
      gid: "demo-proj-yinghu-anhe",
      name: "映湖-晴川段",
      stages: FULL_WORKFLOW_STAGES,
      contractTotal: contractTotalForSeed("demo-proj-yinghu-anhe"),
      progress: 0.58,
      startMonthOffset: -18,
      createdMonthsAgo: 18,
      defaultSelected: true,
      color: "light-green",
    },
    {
      gid: "demo-proj-yinghu-zhongxiao",
      name: "映湖-松露段",
      stages: EARLY_PLAN_3D_STAGES,
      contractTotal: contractTotalForSeed("demo-proj-yinghu-zhongxiao"),
      progress: 0.75,
      startMonthOffset: -14,
      createdMonthsAgo: 14,
      defaultSelected: true,
    },
    {
      gid: "demo-proj-senkuo-sanmin",
      name: "森闊-合睦段",
      stages: pickStagesEvenly(9),
      contractTotal: contractTotalForSeed("demo-proj-senkuo-sanmin"),
      progress: 0.65,
      startMonthOffset: -16,
      createdMonthsAgo: 16,
      defaultSelected: true,
    },
    ...BUILDING_PROJECT_NAMES.slice(1).map((name, i) => {
      const gid = `demo-proj-extra-${i + 2}`;
      const stageCount = 7 + (i % 6);
      const progress = 0.25 + (i % 8) * 0.09;
      return {
        gid,
        name,
        stages: pickStagesEvenly(stageCount),
        contractTotal: contractTotalForSeed(gid),
        progress: Math.min(0.95, progress),
        startMonthOffset: -18 + (i % 4),
        createdMonthsAgo: 12 + (i % 7),
        defaultSelected: false,
      } satisfies ProjectSpec;
    }),
  ];

  const bundles = specs.map((spec, i) => makeProjectBundle(anchor, spec, i));
  const projects = bundles.map((b) => b.project);
  const defaultSelectedProjectGids = bundles
    .filter((b) => b.defaultSelected)
    .map((b) => b.project.gid);

  return { projects, bundles, defaultSelectedProjectGids };
}
