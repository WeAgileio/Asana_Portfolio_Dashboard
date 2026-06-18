# bytime-reload-scroll-position

## Purpose

請款進展·時間序與進展時間軸頁面的月欄表，在整批重新載入完成後，依使用者是否曾手動橫向捲動決定對齊目前月份或保留捲動位置。

## Requirements

### Requirement: Align to current month when user has not scrolled

When a batch reload completes and the user has not manually scrolled the month table horizontally, the view SHALL scroll to align the current month column.

### Requirement: Preserve scroll position when user has scrolled

When a batch reload completes and the user has manually scrolled horizontally, the view SHALL restore the previous `scrollLeft` instead of jumping to the current month.

### Requirement: Detect manual horizontal scroll

Head scroll, body scroll, and drag-to-scroll (beyond a small threshold) SHALL mark the user as having manually scrolled; programmatic alignment SHALL NOT.

### Requirement: Single-project reload unchanged

Reloading a single project row SHALL NOT trigger batch scroll alignment or preservation logic.

### Requirement: Skip scroll when table hidden

When the month table is not visible (empty or filtered to zero rows), pending scroll actions SHALL be cleared without scrolling.
