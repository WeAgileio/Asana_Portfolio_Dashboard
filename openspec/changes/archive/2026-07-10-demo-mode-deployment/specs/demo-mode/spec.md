## ADDED Requirements

### Requirement: Demo mode build flag

The application SHALL support a build-time flag `VITE_DEMO_MODE` that, when set to `true` at build time, enables demonstration mode in the compiled frontend bundle.

#### Scenario: Demo build enables mode

- **WHEN** the frontend is built with `VITE_DEMO_MODE=true`
- **THEN** `import.meta.env.VITE_DEMO_MODE` evaluates to `'true'` in the running app

#### Scenario: Production build disables mode by default

- **WHEN** the frontend is built without `VITE_DEMO_MODE` or with it empty/false
- **THEN** demonstration mode is not active and existing PAT login behavior is unchanged

### Requirement: Skip login in demo mode

When demonstration mode is active, the application SHALL NOT require an Asana PAT and SHALL treat the user as logged in on startup.

#### Scenario: Direct entry to dashboard

- **WHEN** user opens the demo deployment URL
- **THEN** the login page is not shown and the main navigation with progress tabs is displayed immediately

#### Scenario: Demo auth does not use real PAT

- **WHEN** demonstration mode is active
- **THEN** no request is sent to Asana APIs for live project data regardless of stored tokens

### Requirement: Demo tab visibility

When demonstration mode is active, the application SHALL hide the「十週更新統計」tab and SHALL NOT load the Weekly Trends view.

#### Scenario: Weekly trends tab hidden

- **WHEN** demonstration mode is active
- **THEN** only「專案進展」「請款進展」「請款進展·時間序」tabs are visible in the top navigation

#### Scenario: Default tab on demo entry

- **WHEN** user first lands on the demo deployment
- **THEN** the default active tab is「專案進展」（progress by time）

### Requirement: Demo mode indicator

When demonstration mode is active, the application SHALL display a visible indicator in the top navigation that data is for demonstration only.

#### Scenario: Badge shown

- **WHEN** demonstration mode is active
- **THEN** the top navigation includes text equivalent to「展示模式 · 示意資料」

### Requirement: No real data exposure in demo

When demonstration mode is active, the application MUST NOT fetch or display real Asana workspace, project, member, or billing data.

#### Scenario: Mock data only

- **WHEN** user interacts with project picker, progress timeline, or billing views in demonstration mode
- **THEN** all displayed projects, sections, tasks, members, and amounts come from the demo mock layer only

#### Scenario: Demo deployment has no Asana PAT dependency

- **WHEN** the demo container or static demo deployment runs without `ASANA_DEFAULT_PAT` or user-supplied PAT
- **THEN** the three progress/billing views remain fully usable for live demonstration

### Requirement: Demo logout behavior

When demonstration mode is active, the application SHALL NOT expose a logout action that leaves the user on an unusable login screen requiring a real PAT.

#### Scenario: Logout hidden or non-destructive

- **WHEN** demonstration mode is active
- **THEN** either the logout control is hidden or activating it does not require real PAT entry to continue using the demo
