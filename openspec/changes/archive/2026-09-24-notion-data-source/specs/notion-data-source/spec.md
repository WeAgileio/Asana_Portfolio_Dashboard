## Purpose

讓儀表板用設定檔改從 Notion 專案總表讀取專案、階段與請款任務，並以登入卡輸入整合金鑰，現有進展與請款畫面沿用同一套資料形狀。

## ADDED Requirements

### Requirement: Runtime data source switch

The application SHALL read `DATA_SOURCE` at server startup. The only accepted values are `asana` and `notion`. When the variable is missing or empty, the source SHALL be `asana`. Changing the value SHALL take effect after the server process restarts, without rebuilding the frontend.

#### Scenario: Default remains Asana

- **WHEN** `DATA_SOURCE` is unset and demonstration mode is not active
- **THEN** the dashboard loads projects, sections, and tasks from Asana using the existing PAT login

#### Scenario: Notion selected from config

- **WHEN** `DATA_SOURCE` is `notion` and demonstration mode is not active
- **THEN** the dashboard loads projects, sections, and tasks from the configured Notion root page instead of Asana

#### Scenario: Unknown value is rejected

- **WHEN** `DATA_SOURCE` is set to a value other than `asana` or `notion`
- **THEN** the server fails startup with an error that names the invalid value

### Requirement: Demonstration mode overrides the data source

When `VITE_DEMO_MODE` is `true`, the application SHALL keep the existing demonstration behavior and SHALL ignore `DATA_SOURCE`.

#### Scenario: Demo build ignores Notion config

- **WHEN** the frontend is built with `VITE_DEMO_MODE=true` and the server has `DATA_SOURCE=notion`
- **THEN** the user sees demonstration data, the login card is not shown, and no Notion or Asana request is made for live project data

### Requirement: Notion integration token login

When the active source is Notion, the application SHALL show the same login card used for Asana PAT entry, with copy that asks for a Notion integration token. The token SHALL NOT be read from an environment variable.

#### Scenario: Prompt before dashboard

- **WHEN** the active source is Notion and no Notion token is stored
- **THEN** the login card is shown and the main tabs are not shown

#### Scenario: Successful login

- **WHEN** the user submits a token that can read the configured root page
- **THEN** the token is stored encrypted in the browser, separate from any Asana PAT, and the dashboard is shown

#### Scenario: Token cannot read the root page

- **WHEN** the user submits a token that is missing, rejected, or cannot read the configured root page
- **THEN** the login card stays visible and shows an error, and the token is not stored

#### Scenario: Stored Asana PAT is left intact

- **WHEN** the user logs in with a Notion token
- **THEN** any previously stored Asana PAT remains available for a later switch back to `DATA_SOURCE=asana`

### Requirement: Notion logout

When the active source is Notion, logout SHALL clear only the Notion token and return the user to the Notion login card.

#### Scenario: Logout returns to login

- **WHEN** the user logs out while the active source is Notion
- **THEN** the Notion token is removed from browser storage and the login card is shown again

### Requirement: Notion root page

The server SHALL read the Notion root page id from `NOTION_ROOT_PAGE_ID`. When that variable is missing or empty, the id SHALL be `3e353bdeb3b1803ea05ec8b6873d9f4d`.

#### Scenario: Default root page

- **WHEN** `DATA_SOURCE` is `notion` and `NOTION_ROOT_PAGE_ID` is unset
- **THEN** project rows are read from the database embedded in page `3e353bdeb3b1803ea05ec8b6873d9f4d`

### Requirement: Project mapping

Each row of the root database SHALL become one project. The project id SHALL be the row's `AsanaID` when that value is non-empty; otherwise it SHALL be the Notion page id. The project name SHALL be the row title `名稱`. The project creation time SHALL be the Notion page creation time. The project link SHALL be the Notion page URL, even when the row also has `Asana連結`. Rows SHALL NOT be dropped because their `狀態` is `完成`.

#### Scenario: Project id prefers AsanaID

- **WHEN** a root-database row has a non-empty `AsanaID`
- **THEN** the dashboard project id equals that `AsanaID`

#### Scenario: Completed projects remain listed

- **WHEN** a root-database row has `狀態` equal to `完成`
- **THEN** the project still appears in the project picker

#### Scenario: Project link is the Notion page

- **WHEN** a root-database row has both `Asana連結` and a Notion page URL
- **THEN** the project link is that Notion page URL

### Requirement: Section and task mapping

For each project page, the application SHALL read the child database titled `任務` and group its rows by the `階段` select. A stage SHALL appear only when it has at least one task. Stages SHALL be ordered by the select option order, from `C01-1 新案洽談` through `C20 尾款請款`. The application SHALL NOT read the child database titled `狀態更新`.

A task SHALL use the row title as its name, `計畫完成時間` start as its due date, and `指派` display names as its assignee. `狀態` of `完成` SHALL mark the task completed. `狀態` of `進行中` or `未開始` SHALL mark the task not completed. The task link SHALL be the Notion page URL, even when the row also has `Asana連結`.

#### Scenario: Stage with no tasks is omitted

- **WHEN** a project's task database has no row whose `階段` is a given stage
- **THEN** that stage is not shown for the project

#### Scenario: In-progress task stays incomplete

- **WHEN** a task row has `狀態` equal to `進行中`
- **THEN** the dashboard treats the task as not completed

#### Scenario: Task link is the Notion page

- **WHEN** a task row has both `Asana連結` and a Notion page URL
- **THEN** the task link is that Notion page URL

#### Scenario: Status-update database is ignored

- **WHEN** a project page contains a child database titled `狀態更新`
- **THEN** its rows are not shown in progress, billing, or weekly views

### Requirement: Billing fields come from tasks

A task SHALL be treated as a billing task when `任務類型` is `請款任務`. Its billing amount SHALL be the task row's `請款金額`. The root row's `請款金額` SHALL NOT be used as a task or project billing total.

#### Scenario: Billing task flag

- **WHEN** a task row has `任務類型` equal to `請款任務`
- **THEN** the billing views include that task as a billing task

#### Scenario: Project-level amount is unused

- **WHEN** a root row has `請款金額` and its tasks have their own `請款金額` values
- **THEN** displayed billing amounts come from the task rows only

### Requirement: Project role names

Project member names used by the existing role filter SHALL be the display names of `主設計` and `窗口` on the root row.

#### Scenario: Designers and contacts appear as roles

- **WHEN** a root row has people in `主設計` or `窗口`
- **THEN** those people's display names are available to the project role filter

### Requirement: Weekly trends hidden for Notion

When the active source is Notion, the application SHALL hide the「十週更新統計」tab and SHALL NOT load weekly task-update data.

#### Scenario: Weekly tab hidden

- **WHEN** the active source is Notion and the user is logged in
- **THEN** the visible tabs are「專案進展」「請款進展」and「請款進展·時間序」

### Requirement: Asana behavior unchanged

When the active source is Asana and demonstration mode is not active, login, project loading, section loading, task loading, and the weekly trends tab SHALL behave as they do today.

#### Scenario: Asana weekly tab remains

- **WHEN** the active source is Asana and the user is logged in
- **THEN** the「十週更新統計」tab is available
