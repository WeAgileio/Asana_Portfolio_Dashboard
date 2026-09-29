## Purpose

在 Notion 模式的「專案進展」專案名前面，標出最近一個週六以來「狀態更新」有被改過的專案。

## ADDED Requirements

### Requirement: Update hint uses status-update last edited time

When the active source is Notion, the application SHALL treat a project as recently updated when its `狀態更新` child database has at least one row whose last-edited time is on or after the most recent Saturday at 00:00 in Asia/Taipei, and before or at the current time. When the current local date in Asia/Taipei is Saturday, that Saturday at 00:00 SHALL be the start of the window. A project with no `狀態更新` database, or with no row inside the window, SHALL NOT be treated as recently updated. Row titles and other properties SHALL NOT decide the hint.

#### Scenario: Edit on Saturday is inside the window

- **WHEN** the active source is Notion and a `狀態更新` row was last edited at Saturday 00:00 Asia/Taipei
- **THEN** that project is treated as recently updated

#### Scenario: Edit before Saturday is outside the window

- **WHEN** the active source is Notion and every `狀態更新` row was last edited before the most recent Saturday 00:00 Asia/Taipei
- **THEN** that project is not treated as recently updated

#### Scenario: Today is Saturday

- **WHEN** the current date in Asia/Taipei is Saturday and a `狀態更新` row was last edited earlier that same Saturday
- **THEN** that project is treated as recently updated

#### Scenario: Missing status-update database

- **WHEN** a project page has no child database titled `狀態更新`
- **THEN** that project is not treated as recently updated

### Requirement: Lightbulb appears before the project name on the progress view

On the project-progress view only, a recently updated project SHALL show the lightbulb emoji 💡 immediately before the project name. The lightbulb SHALL NOT occupy space when the project is not recently updated. The lightbulb SHALL expose, to pointer hover and assistive technology, that the status update was edited, including the latest last-edited time inside the window. Billing views SHALL NOT show the lightbulb. While the project's update signal is still unknown, the lightbulb SHALL NOT be shown.

#### Scenario: Recently updated project

- **WHEN** the user views project progress and a Notion project is recently updated
- **THEN** 💡 is shown immediately before that project's name

#### Scenario: Project without a recent edit

- **WHEN** the user views project progress and a Notion project is not recently updated
- **THEN** no lightbulb is shown and the name is not indented to reserve a lightbulb slot

#### Scenario: Billing views omit the lightbulb

- **WHEN** the user views either billing view and a Notion project is recently updated
- **THEN** the project name has no lightbulb

### Requirement: Asana and demonstration mode omit the hint

When the active source is Asana, or demonstration mode is active, the project-progress view SHALL NOT show the lightbulb and SHALL NOT query a Notion status-update database.

#### Scenario: Asana progress view

- **WHEN** the active source is Asana and the user views project progress
- **THEN** no project name shows a lightbulb

#### Scenario: Demonstration mode

- **WHEN** demonstration mode is active and the user views project progress
- **THEN** no project name shows a lightbulb
