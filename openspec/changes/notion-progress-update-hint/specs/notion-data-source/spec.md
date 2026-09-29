## MODIFIED Requirements

### Requirement: Section and task mapping

For each project page, the application SHALL read the child database titled `任務` and group its rows by the `階段` select. A stage SHALL appear only when it has at least one task. Stages SHALL be ordered by the select option order, from `C01-1 新案洽談` through `C20 尾款請款`. The application SHALL NOT show rows from the child database titled `狀態更新` as sections, tasks, or weekly-trend entries. When that database exists, the application SHALL read its rows' last-edited times to decide the project-progress update hint, and SHALL NOT use the rows' titles or body for that hint.

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

#### Scenario: Status-update last-edited time is readable

- **WHEN** a project page contains a child database titled `狀態更新`
- **THEN** the application reads row last-edited times for the project-progress update hint and does not turn those rows into sections or tasks
