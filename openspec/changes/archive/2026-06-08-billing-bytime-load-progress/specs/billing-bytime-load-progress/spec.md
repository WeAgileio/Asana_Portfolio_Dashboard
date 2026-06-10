## ADDED Requirements

### Requirement: Load progress banner visibility

The billing tasks by-time view SHALL display a load progress banner below the page toolbar while project data is being fetched, and SHALL hide the banner when no project rows are actively loading tasks.

#### Scenario: Initial batch load with no project rows yet

- **WHEN** the view triggers a full progress load and `loading` is true with zero items in the list
- **THEN** the banner SHALL indicate that project data is being prepared (indeterminate or equivalent messaging)

#### Scenario: Partial project task load

- **WHEN** at least one project row exists and at least one row has `loadingTasks` true
- **THEN** the banner SHALL remain visible until all visible project rows have `loadingTasks` false

#### Scenario: All projects loaded

- **WHEN** every project row in `items` has `loadingTasks` false and batch `loading` is false
- **THEN** the load progress banner SHALL NOT be displayed

### Requirement: Load progress counts

The load progress banner SHALL show how many projects have finished loading tasks versus the total number of projects currently in the load set.

#### Scenario: Determinate progress display

- **WHEN** project rows are present and some rows still have `loadingTasks` true
- **THEN** the banner SHALL display completed count and total count (e.g. loaded M of N projects)
- **AND** SHALL provide a visual progress indicator reflecting M divided by N

#### Scenario: Total matches current items length

- **WHEN** progress is calculated during a load
- **THEN** the total count SHALL equal the number of project entries currently in `items` for that load

### Requirement: Non-blocking layout

The load progress banner SHALL NOT prevent interaction with the project table below except where existing global loading disables controls.

#### Scenario: Table visible during per-project load

- **WHEN** project rows are shown while some projects are still loading tasks
- **THEN** the table SHALL remain visible beneath the banner
- **AND** the banner SHALL NOT be placed inside horizontal scroll containers that would clip it

### Requirement: Accessibility of load status

The load progress banner SHALL expose loading status to assistive technologies.

#### Scenario: Screen reader updates

- **WHEN** the completed project count increases during load
- **THEN** the banner region SHALL use an appropriate live region (e.g. `aria-live="polite"`) so updated counts can be announced
