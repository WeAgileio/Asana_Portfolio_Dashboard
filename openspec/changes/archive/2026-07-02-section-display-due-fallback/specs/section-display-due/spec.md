## ADDED Requirements

### Requirement: In-progress sections use earliest incomplete task due

When a section has at least one incomplete task, the section display due date SHALL be the **earliest** `due_on` among incomplete tasks that have a non-empty `due_on`, regardless of whether the section contains milestone tasks.

#### Scenario: Milestone section with earlier incomplete task due

- **WHEN** a section has milestone tasks with `due_on` 2026-06-15
- **AND** an incomplete non-milestone task has `due_on` 2026-04-05
- **THEN** the section display due date is 2026-04-05
- **AND** the section is placed in the April 2026 month column

#### Scenario: Incomplete tasks with mixed due dates

- **WHEN** a section has incomplete tasks with `due_on` 2026-05-20 and 2026-04-05
- **THEN** the section display due date is 2026-04-05
- **AND** the section is placed in the April 2026 month column
- **AND** the card shows「截止日期：2026/04/05」（locale-formatted equivalent）

#### Scenario: Some incomplete tasks lack due dates

- **WHEN** at least one incomplete task has `due_on` 2026-07-01
- **AND** other incomplete tasks have no `due_on`
- **THEN** the section display due date is 2026-07-01

### Requirement: In-progress sections without due go unscheduled

When a section has at least one incomplete task and **no** incomplete task has a non-empty `due_on`, the section SHALL be treated as unscheduled on the progress timeline by time.

#### Scenario: Incomplete tasks all without due

- **WHEN** all incomplete tasks have empty or missing `due_on`
- **THEN** the section appears in the unscheduled column
- **AND** the card shows「截止日期：—」

### Requirement: Completed sections use latest task due

When all tasks in a section are completed, the section display due date SHALL be the **latest** `due_on` among tasks that have a non-empty `due_on`.

#### Scenario: Multiple completed tasks with due dates

- **WHEN** all tasks are completed
- **AND** tasks have `due_on` 2026-02-01 and 2026-06-30
- **THEN** the section display due date is 2026-06-30
- **AND** the section is placed in the June 2026 month column
- **AND** the section status remains done

#### Scenario: Single completed task with due date

- **WHEN** all tasks completed and only one task has `due_on` 2026-03-15
- **THEN** the section display due date is 2026-03-15

#### Scenario: All completed without any due dates

- **WHEN** all tasks completed and no task has a non-empty `due_on`
- **THEN** the section appears in the unscheduled column
- **AND** the card shows「截止日期：—」

### Requirement: Display due is separate from milestone status rules

Section status (`behind`, `at-risk`, `not-started`, etc.) SHALL continue to be computed from milestone due dates only (`latestMilestoneDueOn` logic unchanged). The section display due date SHALL NOT alter status calculation.

#### Scenario: Fallback display due with no milestone

- **WHEN** a section has no milestone tasks
- **AND** the earliest incomplete task `due_on` is within one week
- **THEN** the section display due date reflects that task due date
- **AND** section status is not `behind` solely because of that fallback date

### Requirement: Unified card label for display due

The progress timeline by time section card SHALL always label the display date as「截止日期：」followed by the formatted date or「—」, regardless of whether the date comes from milestone, incomplete task, or completed task fallback.

#### Scenario: Card label for task-based fallback

- **WHEN** a section display due date comes from earliest incomplete task due
- **THEN** the card still shows「截止日期：{date}」and not a different label

### Requirement: Timeline view consumes display due only

The progress timeline by time view (`ProgressTimelineByTime`) SHALL use `sectionDisplayDueOn` for month column bounds, section bucketing, card date text, and within-cell / month-priority sorting. Billing tasks by time and other views are out of scope.

#### Scenario: Section moves from unscheduled to month column

- **WHEN** a section previously had no milestone and no display due
- **AND** an incomplete task is assigned `due_on` 2026-08-01
- **THEN** after progress reload the section appears in the August 2026 column instead of unscheduled
