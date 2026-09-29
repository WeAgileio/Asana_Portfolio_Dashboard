import assert from "node:assert/strict";
import test from "node:test";
import {
  formatTaipeiEditedAt,
  isEditedSinceSaturday,
  progressUpdateHintLabel,
  saturdayWindowStart,
  statusUpdatedAtFromBody,
} from "./notionUpdateWindow.mjs";

const tuesday = new Date("2026-09-29T02:00:00.000Z");
const saturdayStart = "2026-09-25T16:00:00.000Z";

test("週二往回最近的週六 00:00（台北）", () => {
  assert.equal(saturdayWindowStart(tuesday).toISOString(), saturdayStart);
});

test("當天是週六時起點就是當天 00:00", () => {
  const saturdayAfternoon = new Date("2026-09-26T07:00:00.000Z");
  assert.equal(saturdayWindowStart(saturdayAfternoon).toISOString(), saturdayStart);
});

test("週六 00:00 算在窗內，前一刻算在窗外", () => {
  assert.equal(isEditedSinceSaturday(saturdayStart, tuesday), true);
  assert.equal(isEditedSinceSaturday("2026-09-25T15:59:59.999Z", tuesday), false);
});

test("提示文字用台北時間，窗外沒有文字", () => {
  assert.equal(
    progressUpdateHintLabel("2026-09-27T01:00:00.000Z", tuesday),
    "狀態更新於 2026/09/27 09:00 有修改"
  );
  assert.equal(formatTaipeiEditedAt("2026-09-27T01:00:00.000Z"), "2026/09/27 09:00");
  assert.equal(progressUpdateHintLabel("2026-09-25T15:59:59.999Z", tuesday), null);
  assert.equal(progressUpdateHintLabel(null, tuesday), null);
});

test("區段回應沒有 status_updated_at 時是 null", () => {
  assert.equal(statusUpdatedAtFromBody({ status_updated_at: "2026-09-27T01:00:00.000Z" }), "2026-09-27T01:00:00.000Z");
  assert.equal(statusUpdatedAtFromBody({}), null);
  assert.equal(statusUpdatedAtFromBody(undefined), null);
});
