export interface AsanaProject {
  gid: string;
  name: string;
  color: string | null;
  /** 是否已封存（archived），封存專案在列表中會被過濾掉 */
  archived?: boolean;
  /** ISO 建立時間，用於專案清單排序 */
  created_at?: string | null;
  /** 專案所屬 workspace／organization 的 GID，用於組合網址 */
  workspace_gid?: string | null;
  /**
   * 專案 **Notes（新 UI 為 project brief）** 頁的永久連結；與
   * `https://app.asana.com/1/…/project/…/note/…` 同級。
   */
  notes_permalink_url?: string | null;
  /** 對應 Notes／brief 資源的 GID，無則可能尚未建立 brief */
  project_brief_gid?: string | null;
  /** 專案本身永久連結（多為列表／概覽），作為無 brief 時的後備 */
  project_permalink_url?: string | null;
  /** 專案成員顯示名稱（來自 GET project(s) 的 `members`） */
  memberNames?: string[];
}

export interface AsanaSection {
  gid: string;
  name: string;
}

export interface AsanaUser {
  gid: string;
  name: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string | null;
  // Asana 的最近更新時間（用於週更新頁面）
  modified_at?: string | null;
  due_on: string | null;
  assignee: AsanaUser | null;
  /** 任務類型，例如 milestone，用於進度視圖 */
  resource_subtype?: string | null;
  // 由 stories 推算出的更新人名稱（非 Asana 原生欄位）
  updaterName?: string | null;
  /** 任務創建人名稱（來自 API created_by） */
  creatorName?: string | null;
  /** 請款金額（來自指定 custom field 的數值） */
  billingAmount?: number | null;
  /**
   * 「請款進展」（或舊名「請款任務」）自訂欄位是否為「是」（enum／boolean／文字等由 API 解析）
   */
  billingTaskYes?: boolean;
  permalink_url: string;
}

export interface SectionStats {
  section: AsanaSection;
  tasks: AsanaTask[];
  total: number;
  completed: number;
  incomplete: number;
  overdue: number;
  /** 完成度（依任務數）：已完成任務數 / 總任務數 */
  completionRate: number;
  /** 完成度（依天數）：(總工作天 - 未完成工作天) / 總工作天，僅計算平日 */
  completionRateByDays: number;
  totalWorkingDays: number;
  incompleteWorkingDays: number;
}

export interface ProjectStats {
  project: AsanaProject;
  sections: SectionStats[];
  totalTasks: number;
  totalCompleted: number;
  totalOverdue: number;
  /** 完成度（依任務數） */
  overallCompletionRate: number;
  /** 完成度（依天數） */
  overallCompletionRateByDays: number;
  totalWorkingDays: number;
  incompleteWorkingDays: number;
}
