# project-picker-filter Specification

## Purpose
TBD - created by archiving change project-picker-filter. Update Purpose after archive.
## Requirements
### Requirement: Shared project picker panel

The application SHALL provide a shared `ProjectPickerPanel` component used by Billing Tasks, Billing Tasks By Time, and Progress Timeline By Time for the「選擇要載入的專案」overlay.

#### Scenario: Three views use the same panel

- **WHEN** user opens project selection on any of the three progress pages
- **THEN** the same panel component is rendered with checkbox list and load actions

### Requirement: Name keyword filter

The project picker SHALL filter the displayed project list by a name keyword search that matches case-insensitively as a substring of the project name.

#### Scenario: Name search narrows list

- **WHEN** user types「test」in the name search field
- **THEN** only projects whose names contain「test」(any case) are shown in the list

#### Scenario: Empty search shows all passing date filter

- **WHEN** the name search field is empty
- **THEN** name filtering does not exclude any project

### Requirement: Name sort order

The project picker SHALL allow sorting the displayed list by project name A→Z, Z→A, or default (no name sort override).

#### Scenario: Name ascending sort

- **WHEN** user selects name sort A→Z
- **THEN** displayed projects are ordered by name ascending (`zh-Hant` locale) after date sorting rules

#### Scenario: Name descending sort

- **WHEN** user selects name sort Z→A
- **THEN** displayed projects are ordered by name descending after date sorting rules

### Requirement: Created-at filter presets and range

The project picker SHALL support created-at filtering with: all projects, recent N years (0.5, 1, 3, 5), a selected calendar year, and optional custom start/end dates.

#### Scenario: Recent half year preset

- **WHEN** user selects「近半年」（0.5 年）
- **THEN** only projects with `created_at` on or after six months before today (local calendar) are shown

#### Scenario: Recent one year preset

- **WHEN** user selects「近 1 年」
- **THEN** only projects with `created_at` on or after one year before today (local calendar) are shown

#### Scenario: Selected year filter

- **WHEN** user selects year 2024 from the year dropdown
- **THEN** only projects whose `created_at` falls in calendar year 2024 are shown

#### Scenario: Custom date range

- **WHEN** user sets start date 2024-01-01 and end date 2024-06-30
- **THEN** only projects with `created_at` within that inclusive local-date range are shown

#### Scenario: Project without created_at under date filter

- **WHEN** any created-at filter other than「全部」is active
- **THEN** projects without `created_at` are not shown

#### Scenario: All preset clears date filter

- **WHEN** user selects「全部」and no year or custom range is set
- **THEN** created-at filtering does not exclude projects (including those without `created_at`)

### Requirement: Created-at sort order

The project picker SHALL allow sorting the displayed list by created-at newest-first or oldest-first.

#### Scenario: Newest first default

- **WHEN** the picker opens
- **THEN** created-at sort defaults to newest-first (matching current `fetchProjects` order)

#### Scenario: Oldest first

- **WHEN** user selects created-at sort oldest-first
- **THEN** displayed projects are ordered by `created_at` ascending; projects without `created_at` sort last

### Requirement: Display created date on each row

Each project row in the picker list SHALL show the project name and its creation date formatted for zh-TW locale, or「—」when `created_at` is missing.

#### Scenario: Row shows formatted date

- **WHEN** a project has `created_at` 2024-03-15
- **THEN** the row displays the name and a date equivalent to 2024/03/15

### Requirement: Filter does not clear hidden selections

Filtering and sorting SHALL only affect which projects are visible in the list. Projects already selected but hidden by the filter SHALL remain in `selectedProjectGids` until the user unchecks them or clears selection.

#### Scenario: Hidden selection persists on apply

- **WHEN** user checks project A
- **AND** user applies a name filter that hides project A
- **AND** user clicks「套用選擇」
- **THEN** project A is still included in the load set

### Requirement: Filter result count and empty state

The project picker SHALL show how many projects match the current filters versus the total count, and SHALL show an empty-state message when no projects match.

#### Scenario: Match count displayed

- **WHEN** 12 of 87 projects match the current filters
- **THEN** the UI indicates 12 matching of 87 total (wording may vary)

#### Scenario: No matches

- **WHEN** no project matches the current filters
- **THEN** an empty-state message is shown instead of an empty checkbox list

### Requirement: Reset filter UI on close

When the project picker closes, filter and sort controls SHALL reset to defaults. Selected project gids SHALL NOT be reset on close.

#### Scenario: Close panel resets filters only

- **WHEN** user sets name search and date filters then closes the panel without applying
- **THEN** reopening the panel shows default filter and sort state
- **AND** previously checked projects remain checked

### Requirement: Select all visible filtered projects

The project picker SHALL provide a control to select all projects currently visible in the filtered list. The action SHALL merge those project gids into `selectedProjectGids` without removing gids that are selected but hidden by the current filter.

#### Scenario: Select all adds visible projects

- **WHEN** the filtered list shows projects A, B, and C
- **AND** project A is already selected
- **AND** user activates「全選」
- **THEN** projects A, B, and C are all selected
- **AND** any other previously selected gids not in the filtered list remain selected

#### Scenario: Hidden selection preserved

- **WHEN** user has selected project X that is hidden by the current filter
- **AND** user activates「全選」for the visible list
- **THEN** project X remains selected

#### Scenario: Disabled when list empty

- **WHEN** no project matches the current filters
- **THEN** the select-all control is disabled

#### Scenario: Disabled when all visible already selected

- **WHEN** every project in the filtered list is already selected
- **THEN** the select-all control is disabled

