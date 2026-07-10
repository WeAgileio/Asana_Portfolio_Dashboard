# demo-mock-data Specification

## Purpose
TBD - created by archiving change demo-mode-deployment. Update Purpose after archive.
## Requirements
### Requirement: Mock API coverage for progress pipeline

When demonstration mode is active, the frontend API layer SHALL intercept and satisfy the following functions without network calls to `/api` for Asana data: `fetchProjects`, `fetchProject`, `fetchSectionsByProject`, and `fetchTasksBySection`.

#### Scenario: Projects list from mock

- **WHEN** `useProjectProgress` loads projects in demonstration mode
- **THEN** `fetchProjects` returns a non-empty list of demo projects without calling the backend Asana proxy

#### Scenario: Sections and tasks from mock

- **WHEN** a demo project is loaded in demonstration mode
- **THEN** `fetchSectionsByProject` and `fetchTasksBySection` return sections and tasks for that project from the demo dataset

#### Scenario: Unmocked APIs not required for demo tabs

- **WHEN** demonstration mode is active and user stays within the three progress/billing tabs
- **THEN** `searchTasksUpdatedSince`, `fetchTaskLastUpdaterName`, and `fetchWorkspaces` are not required for core functionality

### Requirement: Runtime demo dataset generation

The demo mock layer SHALL generate dataset content at runtime using an anchor date of the current local calendar day when the dataset is first initialized in the session.

#### Scenario: Dates relative to today

- **WHEN** demo dataset is generated on a given calendar day
- **THEN** task and section due dates are computed relative to that day so timeline columns align with「now」for live demo

#### Scenario: Session-stable dataset

- **WHEN** user navigates between tabs or reopens project picker within the same browser session without full reload
- **THEN** the same demo project GIDs and task data are returned consistently

### Requirement: Fictional demo entities

All demo entities SHALL use fictional names and MUST NOT contain real client, project, person, or billing identifiers.

#### Scenario: Project names are fictional

- **WHEN** demo projects are listed
- **THEN** at least three fictional project names are shown (e.g. 品牌官網改版, Q2 行銷活動, CRM 系統整合) with no real organization names

#### Scenario: Member names are fictional

- **WHEN** demo projects include `memberNames`
- **THEN** all names are fictional Chinese display names usable for member filter demonstration

### Requirement: Demo progress narrative

The demo dataset SHALL include multiple projects with varied section progress states so that status colors and completion rates are visually distinct in live demo.

#### Scenario: Mixed section statuses

- **WHEN** default-selected demo projects are loaded
- **THEN** the derived section statuses include at least one of each: `done`, `in-progress`, `at-risk`, and `not-started` (via underlying task completion and due dates processed by existing `calcSectionProgress`)

#### Scenario: At-risk section present

- **WHEN** default demo projects are loaded
- **THEN** at least one section contains an incomplete task with a due date before the anchor date

### Requirement: Demo billing fields on tasks

Demo tasks that represent billing items SHALL include `billingTaskYes: true` and a numeric `billingAmount` directly on the task object so billing views work without Asana custom field parsing.

#### Scenario: Billing views show amounts

- **WHEN** user opens「請款進展」or「請款進展·時間序」in demonstration mode with default projects selected
- **THEN** at least one billing task with a positive `billingAmount` is visible and year billing summaries are non-zero where applicable

### Requirement: Demo project picker content

The demo dataset SHALL include at least four projects, with at least three selected by default when no prior demo localStorage selection exists.

#### Scenario: Enough projects for filter demo

- **WHEN** user opens project picker in demonstration mode on first visit
- **THEN** at least four projects are available in the list and at least one project is not in the default selection set (to demonstrate filtering/selection)

#### Scenario: Default selection loads on entry

- **WHEN** user opens demo deployment for the first time
- **THEN** at least three demo projects are loaded automatically without manual picker confirmation

### Requirement: Demo data type compatibility

Mock responses SHALL conform to existing TypeScript types `AsanaProject`, `AsanaSection`, and `AsanaTask` so `useProjectProgress` and views require no demo-specific branches.

#### Scenario: Types match production pipeline

- **WHEN** mock API returns demo entities
- **THEN** each entity includes fields required by `calcSectionProgress` and billing views (`gid`, `name`, `completed`, `due_on`, etc.)

