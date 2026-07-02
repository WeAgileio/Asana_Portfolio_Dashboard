## ADDED Requirements

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
