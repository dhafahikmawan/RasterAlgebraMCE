# Implementation Plan: Resolve Fix 04

## 1. Goal

Fix the problems described in [Docs/Fix/Fix04.md](../Fix/Fix04.md) using a small, low-risk change set that a junior developer or a low-cost AI agent can complete safely. The work should be limited to the raster input form, the raster processing pipeline, and a narrow set of regression tests.

The goal is to add a per-raster `NoData` override and to make missing cells caused by bounding-box mismatch behave according to an explicit policy instead of always being treated as `NaN`.

---

## 2. Problem Summary

There are two separate but related problems:

1. Each uploaded raster should support its own `NoData` value, so that a raster can define a numeric sentinel that is treated as missing data for that layer.
2. The plugin currently uses one raster's bounding box as the effective processing extent. When another operand lacks data in a pixel covered by that bounding box, the plugin interprets the value as `NaN` by default. This should instead be controlled by a user-facing dropdown with the following options:
   - `NaN`: current behavior
   - `0`: missing cells are treated as zero
   - `Skip`: if a raster with real data meets a bounding-box-induced missing value, the operation returns the existing value and skips the calculation (Default).

The rule must be scoped only to missing data caused by the bounding-box mismatch. Actual `NaN` values already present in uploaded rasters should continue to follow the existing `NAN_HANDLING_MODE` policy.

---

## 3. Implementation Constraints

- Keep the patch strictly scoped to the form UI and raster processing logic.
- Do not rewrite the calculator architecture or create a large new data model.
- Prefer local helper functions and a few small state updates over a new global state layer.
- Default behavior must remain stable when no user input is given.
- Keep the `NoData` field optional for each raster and default it to empty meaning “no additional NoData handling”.
- Do not mix the `NoData` work, the bounding-box policy work, and the underlying algebra fix into one large commit.
- If an AI agent is used, instruct it to work in this order: small form changes, then processing changes, then tests.

---

## 4. Files Most Likely to Change

- `src/lib/geolibre/right-panel.ts`
- `src/lib/SpatioProcessing/raster-algebra.ts`
- `src/lib/core/types.ts` or any shared raster metadata contract if a per-raster `NoData` field is modeled there
- `tests/raster-algebra.test.ts`
- `tests/right-panel.test.ts` if the form is tested there
- Any helper file that builds raster inputs or processes uploaded rasters

---

## 5. Root Cause and Required Behavior

### Root Cause

The current processing model assumes a single bounding box derived from one raster. When the raster grid is expanded to match that bounding box, pixels that do not exist in a secondary raster are treated as missing by default.

The code currently does not distinguish between:

- a real uploaded `NaN` value already present in raster data; and
- a synthetic missing pixel created only because another raster is aligned to a wider bounding box.

This causes all missing values to be treated as `NaN` even when the user wants data to behave as `0` or to skip the operation.

### Required Behavior

For each raster input:

- store an optional `NoData` numeric value;
- treat that sentinel as missing for that raster only;
- if empty, keep the current behavior for that raster.

For bounding-box-induced gaps:

- the form must expose a selection after the bounding-box selector;
- the selected behavior must be applied only when data is missing because the current bounding box extends beyond the source raster's covered pixels;
- real `NaN` values already in the raster must continue to follow the existing `NAN_HANDLING_MODE` path.

---

## 6. Work Breakdown for a Junior Developer or Cheap AI Agent

### Task 1: Trace the raster input model and current form state

1. Search for the raster upload and raster metadata code.
2. Find the form state object that stores uploaded rasters and their file metadata.
3. Confirm where the selected bounding box raster is chosen and where the raster array is passed into processing.
4. Identify whether the operation pipeline already passes a raster descriptor object or just raw arrays.
5. Keep the fix local to the existing state model instead of introducing a second parallel state system.

Expected output: the implementer can point to the exact form state object and processing function that currently owns raster metadata.

### Task 2: Add `NoData` support to the per-raster input metadata

1. In the raster entry/model used by the form, add an optional field named `noData` or equivalent.
2. Default it to `null`, `undefined`, or an empty string to represent “no explicit NoData handling”.
3. Add a numeric input field next to each raster upload row.
4. Label it clearly as “NoData value” or “Missing value override”.
5. Preserve the existing raster upload behavior when the field is left empty.

Expected output: each uploaded raster can carry an optional missing-data sentinel without changing the default behavior.

### Task 3: Add the missing-data policy dropdown after the bounding-box selection

1. In the raster algebra form, locate the existing bounding-box selection UI.
2. Add a second dropdown immediately after it.
3. Label it clearly, for example “Missing data from bbox change” or “Missing data handling”.
4. Provide the three options:
   - `NaN`
   - `0`
   - `Skip`
5. Default the value to `Skip`.
6. Keep this state local to the form so it is easy to reset when the raster list changes.

Expected output: the UI lets the user explicitly choose how missing values from bounding-box mismatch should be handled.

### Task 4: Rebuild the selector state whenever rasters change

1. Add a helper function that rebuilds the dropdown options when the raster list changes.
2. Reset selection to the first valid raster if the current selection becomes invalid.
3. If no rasters remain, clear the selector safely.
4. Ensure the helper is reused when rasters are added, removed, or replaced.
5. Do not leave stale state values behind in the DOM.

Expected output: the form remains valid even when the raster list is modified multiple times.

### Task 5: Distinguish bounding-box-created gaps from true raster NaNs

1. In the processing layer, trace the logic that decides whether a value is considered missing.
2. Add a clear branch that checks whether the value is missing because the current bounding box exceeds the source raster extent.
3. Keep true raster NaNs on the existing `NAN_HANDLING_MODE` path.
4. Only apply the selected `NaN` / `0` / `Skip` policy to the synthetic missing values caused by bounding-box mismatch.
5. Preserve the old behavior when the user chooses `NaN`.

Expected output: the operation engine treats `NaN` and bounding-box gaps differently instead of collapsing them into one category.

### Task 6: Implement the `0` and `Skip` behavior correctly

1. For the `0` option, substitute a value of `0` only when the missing data is due to bounding-box mismatch and there is no actual raster value there.
2. For the `Skip` option, detect the case where one raster has a valid value and the other side is missing because of the bbox mismatch; return the existing value and skip the arithmetic operation for that pixel.
3. Do not apply `Skip` to real `NaN` values already in uploaded data.
4. Keep the operation consistent across all supported raster algebra operations.

Expected output: the selected policy changes behavior only for synthetic missing data, not for genuine NaN pixels in uploaded files.

### Task 7: Add regression tests

1. Add a focused test for the form state that verifies a `NoData` field can be set and left empty.
2. Add a test that verifies the missing-data policy dropdown is rendered after the bounding-box selector.
3. Add a test that verifies the default selection is the first valid raster and resets when the raster list changes.
4. Add a raster algebra test covering all three missing-data behaviors:
   - `NaN`
   - `0`
   - `Skip`
5. Add at least one test that confirms actual raster `NaN` values still follow the `NAN_HANDLING_MODE` behavior instead of the bbox policy.

Expected output: the regression tests capture the bug and validate the fix without broad suite churn.

---

## 7. Recommended Implementation Order

Use this sequence to keep the work reviewable and low-risk:

1. Trace the raster metadata and form state.
2. Add the `NoData` field to the raster entry model and UI.
3. Add the missing-data policy dropdown to the form.
4. Build the dropdown reset logic whenever raster inputs change.
5. Update the processing layer to differentiate synthetic bbox gaps from true NaN values.
6. Implement the `0` and `Skip` logic carefully.
7. Add regression tests.
8. Run the smallest relevant test set first.

This keeps the UI changes visible and the processing fix isolated.

---

## 8. Risk Control Checklist

- [ ] The per-raster `NoData` field is optional and defaults safely.
- [ ] The missing-data policy applies only to bounding-box-induced gaps, not uploaded NaNs.
- [ ] The selected raster and policy are kept in the same form-local state.
- [ ] Dropdowns are rebuilt when rasters are added or removed.
- [ ] The default remains valid even when raster data changes.
- [ ] The `Skip` behavior only bypasses a pixel when the missing side is caused by the bbox mismatch.
- [ ] Existing behavior is preserved when the user chooses `NaN`.
- [ ] Regression tests cover both the form and the processing logic.

---

## 9. Verification

Run the smallest relevant checks first:

```bash
npx vitest run tests/raster-algebra.test.ts
```

If the form UI has a targeted test file:

```bash
npx vitest run tests/right-panel.test.ts
```

Then run the broader project validation if needed:

```bash
npm test
npm run build
```

### Manual validation checklist

1. Upload two rasters with different bounding boxes.
2. Confirm the dropdown defaults to the current behavior (`NaN`) when no choice is made.
3. Set the missing-data policy to `0` and verify the result is zero where the bbox introduces missing data.
4. Set the missing-data policy to `Skip` and verify the operation keeps the existing value when the missing side is caused by bbox mismatch.
5. Confirm an actual raster NaN still follows the normal `NAN_HANDLING_MODE` behavior.
6. Remove a raster and confirm the selector resets to a valid item without breaking the form.

---

## 10. Acceptance Criteria

The issue is resolved when all of the following are true:

- Each raster has a per-input `NoData` field with an empty default.
- The missing-data policy dropdown is visible and functional after the bounding-box selector.
- Missing values caused only by bounding-box changes respect the selected `NaN` / `0` / `Skip` mode.
- Real uploaded `NaN` values continue to honor `NAN_HANDLING_MODE`.
- The form remains stable when rasters are added, removed, or replaced.
- Regression tests cover the new behavior and pass.
- The project still builds and the relevant existing suite remains green.

---

## 11. Recommended Notes for the Implementer

Keep the patch surgical. Do not redesign the right panel or the raster operation pipeline. The safest implementation is to add:

1. one local `NoData` field per raster,
2. one local missing-data policy selector per form,
3. one helper that resets state when raster inputs change,
4. one targeted processing branch that only applies to bbox-induced gaps.

If this work is being assigned to a low-cost AI agent, tell it to:

- read the raster metadata and form state first,
- add the `NoData` field without changing default behavior,
- add the dropdown after the bbox selector,
- fix the “synthetic missing cells” branch in the processing layer,
- validate with the smallest raster-algebra and form tests before broader checks.
