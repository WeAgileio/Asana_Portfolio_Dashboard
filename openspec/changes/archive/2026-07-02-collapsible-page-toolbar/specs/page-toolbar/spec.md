## ADDED Requirements

### Requirement: Default visible full toolbar

The page toolbar SHALL default to visible with all filter and action controls shown, matching the current wide-screen layout.

#### Scenario: First visit on wide screen

- **WHEN** user opens any affected page for the first time with sufficient viewport width
- **THEN** the full toolbar is visible with all controls in a single row

#### Scenario: Stored preference visible

- **WHEN** `localStorage` key `pageToolbarHidden` is `"false"`
- **THEN** the toolbar is visible on load

### Requirement: Hide button with text label

When the toolbar is visible, the toolbar SHALL display a text button labeled「隱藏」at the right end.

#### Scenario: Hide toolbar

- **WHEN** user clicks「隱藏」
- **THEN** the toolbar panel is hidden with zero layout height
- **AND** `localStorage` key `pageToolbarHidden` is set to `"true"`

#### Scenario: Hide button accessibility

- **WHEN** the hide button is rendered
- **THEN** it has `aria-label`「隱藏工具列」

### Requirement: Right-aligned restore tab when hidden

When the toolbar is hidden, a small tab labeled「顯示工具列」SHALL appear aligned to the **right** above the page content as the sole restore control.

#### Scenario: Restore tab visible when hidden

- **WHEN** the toolbar is hidden
- **THEN** the page header occupies zero vertical space in document flow
- **AND** a right-aligned tab labeled「顯示工具列」is visible

#### Scenario: Show toolbar via tab

- **WHEN** user clicks the「顯示工具列」tab
- **THEN** the full toolbar becomes visible
- **AND** `localStorage` key `pageToolbarHidden` is set to `"false"`

#### Scenario: Restore tab accessibility

- **WHEN** the restore tab is rendered
- **THEN** it has `aria-label`「顯示工具列」

### Requirement: Auto-hide when width insufficient

When the toolbar is visible and content does not fit in one row, the system SHALL auto-hide the toolbar unless the user has manually chosen to keep it visible.

#### Scenario: Auto-hide on overflow

- **WHEN** the toolbar is visible, `userPrefersVisible` is false, and toolbar content overflows one row
- **THEN** the toolbar is automatically hidden and the restore tab is shown

#### Scenario: Manual show prevents auto-hide

- **WHEN** user has clicked「顯示工具列」in the current session or stored preference is visible
- **THEN** the toolbar remains visible with horizontal scroll instead of auto-hiding on overflow

### Requirement: Resync remains in toolbar resync reload in toolbar

When visible,「重新同步數據」and「重新載入」SHALL both appear in the toolbar row (hidden together when toolbar is hidden).

#### Scenario: Sync and reload visible

- **WHEN** toolbar is visible on a wide screen
- **THEN** both resync and reload buttons are accessible in the toolbar

### Requirement: Shared toolbar across three pages

The same `PageToolbar` component SHALL be used by Progress Timeline, Billing Tasks, and Billing Tasks By Time.

#### Scenario: Progress Timeline role filter slot

- **WHEN** user is on Progress Timeline with toolbar visible
- **THEN** role filter controls are provided via the `role-filter` slot

#### Scenario: Billing pages without role filter

- **WHEN** user is on Billing Tasks or Billing Tasks By Time
- **THEN** role filter slot content is not shown

### Requirement: Close role filter popover on hide

Hiding the toolbar SHALL close any open project role filter popover on Progress Timeline.

#### Scenario: Hide closes role panel

- **WHEN** user hides the toolbar while the role filter panel is open
- **THEN** the role filter panel is closed

### Requirement: No column stacking on narrow screens

On viewports below 900px, the toolbar SHALL NOT use `flex-direction: column` to stack controls vertically.

#### Scenario: Narrow viewport

- **WHEN** viewport width is less than 900px and toolbar is visible with user preference to stay visible
- **THEN** toolbar uses horizontal scroll rather than multi-row column stacking
