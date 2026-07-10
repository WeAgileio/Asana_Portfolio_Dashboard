## ADDED Requirements

### Requirement: Header and body month columns share identical width

The bytime month grid in **請款進展·時間序** and **專案進展·時間序** SHALL render header and body month columns at the same pixel width so vertical grid lines align on initial load and during horizontal scroll.

#### Scenario: Columns align at initial load

- **WHEN** either bytime view finishes loading and displays the month grid
- **THEN** each month column border in the header table aligns with the corresponding column border in the body table at `scrollLeft = 0`

#### Scenario: Columns stay aligned while scrolling

- **WHEN** the user scrolls the month grid horizontally (drag or scrollbar)
- **THEN** header and body month column boundaries remain aligned at the same `scrollLeft`

### Requirement: Billing amounts in month headers are fully visible

The month column header billing row (`💰 collected / total`) SHALL display complete formatted amounts without truncation, clipping, or unreadably small text.

#### Scenario: Long billing totals display in full

- **WHEN** a month column header shows billing amounts with comma-separated values (e.g. `1,831,800 / 2,167,800`)
- **THEN** both numbers and the separator are fully visible within the column without `overflow: hidden` clipping

### Requirement: Dynamic month column width from billing content

The system SHALL compute month column width from the longest billing header string across visible month columns, with a minimum of 154px, and apply that width consistently to header `colgroup`/`th`, body `colgroup`/`td`, and scroll-position calculations.

#### Scenario: Width expands for long billing strings

- **WHEN** aggregated billing amounts produce a header string wider than 154px
- **THEN** all month columns use the computed width (≥ 154px) in both header and body tables

#### Scenario: Width falls back to minimum when no billing

- **WHEN** no billing amounts are present for any month column
- **THEN** month columns use 154px width in both tables

### Requirement: Consistent scroll container gutter

Header and body horizontal scroll containers SHALL use matching scrollbar visibility so client width does not differ between the two tables.

#### Scenario: No gutter mismatch on load

- **WHEN** the month grid is displayed
- **THEN** header and body scroll containers do not differ in effective content width due to asymmetric scrollbar treatment
