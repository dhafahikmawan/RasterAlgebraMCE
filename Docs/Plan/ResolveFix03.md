# Implementation Plan: Resolve Fix 03

## 1. Goal

Fix the problems described in `Docs/Fix/Fix03.md` with a small, low-risk change set that a junior developer or a low-cost AI agent can complete safely. The work is limited to the right-panel form UI, the style registry, and the Raster Algebra / MCE form state. It should not require a large refactor or redesign.

## 2. Problem Summary

The plugin currently has three issues:

1. Styling is inconsistent and not namespaced under a shared `spazio-*` convention.
2. The MCE/AHP interface is hard to read because editable vs non-editable fields are not visually distinguished.
3. The Raster Algebra and MCE forms do not let the user choose which raster should act as the bounding box, even though the calculation logic depends on a reference raster.

## 3. Implementation Constraints

- Keep the change localized to the form and styling code.
- Avoid broad UI rewrites.
- Prefer small DOM updates and state-driven rerenders over structural rewrites.
- Keep the default behavior stable unless a form field specifically changes.
- If the work is split across tasks, do not mix the styling fix, the AHP UX fix, and the bounding-box fix in the same commit.

## 4. Files Most Likely to Change

- `src/lib/geolibre/right-panel.ts`
- `src/lib/styles/right-panel-styles.ts`
- `tests/right-panel.test.ts` (new or updated regression coverage)
- Possibly `src/lib/SpatioProcessing/raster-algebra.ts` and `src/lib/SpatioProcessing/mce.ts` only if the bounding-box selection needs a small helper or input validation change.

## 5. Desired Behavior

### A. Styling Namespacing

All dynamically created plugin elements should use the new class names below, and the style registry should generate those names consistently:

- Dropdowns: `spazio-dropdown`
- Dropdown options: `spazio-dropdown-options`
- Calculator expression fields: `spazio-expression-field`
- Calculator buttons: `spazio-calculator-button`
- Text / numeric fields: `spazio-text-field`
- File fields: `spazio-file-field`
- Checkboxes: `spazio-checkbox`
- Sliders: `spazio-slider`
- Input labels: `spazio-input-label`
- Input field descriptions: `spazio-input-description`
- AHP table: `spazio-ahp-table`
- AHP fields: `spazio-ahp-field`
- AHP table headers: `spazio-ahp-headers`
- Status fields: `spazio-status`
- Main container: `spazio-container`
- Submit / processing buttons: `spazio-submit-button`
- Other buttons: `spazio-button`
- Title: `spazio-title`
- Description: `spazio-description`
- Any other element: prefix with `spazio-`

Implementation note: the style registry should not keep old names like `right-panel-status` or `right-panel-button` for generated DOM elements. Update the class list generation in `applyRightPanelStyle` so it adds the correct `spazio-*` class names.

### B. MCE AHP UX

The AHP grid should visually communicate which cells are editable and which are derived.

- Cells that are non-editable because they are locked by the matrix structure should be greyed out.
- The disabled cells should still be readable but clearly not eligible for user input.
- Use a visual style such as muted background, grey text, and disabled cursor state.
- Keep the underlying matrix logic unchanged.

Implementation note: the current logic already sets `input.disabled = row >= column` for the AHP grid. The fix is primarily visual and should be implemented using CSS plus any `disabled` styling hook already available to the browser.

### C. Bounding-box raster selector

Both the Raster Algebra form and the MCE form need a new field after the raster uploads:

- A dropdown labeled something like “Bounding box raster” or “Reference raster”.
- The default option must be the first raster in the form.
- For Raster Algebra, the default is the leftmost raster operand (the first raster in the array that is used to build the expression context).
- For MCE, the default is the first uploaded raster.
- Whenever the set of rasters changes, the dropdown must be rebuilt and the selected value must be reset to a valid raster.
- If the user removes or replaces selected rasters, the dropdown must not retain a non-existent key.

This selector should be treated as a form-level value, not a hidden global state. Keep it in the same closure or render context as the raster list so it is easy to reset cleanly.

## 6. Work Breakdown for a Junior Developer or Cheap AI Agent

### Task 1: Map current style names to the required `spazio-*` names

1. Open `src/lib/styles/right-panel-styles.ts`.
2. Confirm the existing registry keys and generated classes.
3. Update the class generation logic in `applyRightPanelStyle` so it emits names like `spazio-status` rather than `right-panel-status`.
4. Preserve all current style values; this is a naming change, not a layout redesign.
5. Do not change unrelated plugin styling.

Expected output: all generated element classes follow the `spazio-*` pattern without breaking layout.

### Task 2: Update the right panel element creation calls

1. Open `src/lib/geolibre/right-panel.ts`.
2. Find each call to `applyRightPanelStyle(...)` for form controls and panel parts.
3. Replace the old style names with the nearest names from the new class spec.
4. Keep the actual DOM structure the same.
5. Review the file carefully for any element that still uses the old class scheme.

Expected output: the interface uses a consistent class registry and all visible elements match the new naming standard.

### Task 3: Improve MCE AHP visual clarity

1. In `src/lib/styles/right-panel-styles.ts`, add a muted disabled style for the AHP matrix entries.
2. Ensure the style targets the non-editable cells created in the MCE/AHP render logic.
3. Keep the logic that disables the cells in `renderAhp()` as-is.
4. Add a `disabled` visual state to the `ahpInput` style or a dedicated `ahpInputDisabled` class if needed.

Expected output: users can clearly tell which AHP cells are active and which are locked.

### Task 4: Add a bounding-box selector to Raster Algebra

1. In the Raster Algebra block inside `loadOptionForm`, add a new `select` element after the raster upload area and before the expression field.
2. Maintain a local state value such as `selectedBoundingRasterKey`.
3. Add a helper function that rebuilds the dropdown when `rasters` changes.
4. Default the selection to the first uploaded raster.
5. When the user add/removes rasters, call the helper again and ensure the value remains valid.
6. Do not leave the dropdown in a broken state if the user deletes all rasters.

Expected output: the user can choose a raster to serve as the bounding box without crashing or leaving a stale value.

### Task 5: Add a bounding-box selector to MCE

1. In the MCE form, add a select after the input file rows or immediately after the file count controls.
2. The options should correspond to the uploaded raster list.
3. Default to the first raster.
4. Reset the dropdown whenever the raster count changes or the file rows are re-rendered.
5. Keep the selected raster value in sync with file updates.

Expected output: the MCE form behaves the same way as Raster Algebra for bounding-raster selection.

### Task 6: Wire the selected raster into the processing step

1. Confirm the processing code path uses the bounding raster for the output extent or reference bounds.
2. If the current logic already assumes a raster list ordering, use the selected key to choose the correct raster explicitly.
3. If the processing layer is passed the rasters array directly, map the selected value to the corresponding raster instance before processing.
4. Keep the fallback behavior as the first raster when no choice is made.

Expected output: calculation uses the chosen bounding raster deterministically and does not silently default to the wrong raster.

### Task 7: Add tests and run the smallest verification set

1. Update `tests/right-panel.test.ts` with a regression check for the new selector state and the updated class names.
2. Cover at least:
   - dropdown renders after raster upload;
   - default selection is the first raster;
   - selection resets when raster list changes;
   - visual disabled state can be asserted through the DOM attribute or class state.
3. Run the smallest relevant test set before broader validation.

## 7. Recommended Implementation Order

Use this order to keep the work safe and easy to review:

1. Update the style registry and class names.
2. Fix the AHP disabled-field styling.
3. Add the bounding-box dropdown to Raster Algebra.
4. Add the same selector to MCE.
5. Wire the selected raster into processing.
6. Add test coverage.
7. Run the narrow test, then the general suite.

This order keeps the UI changes visible and reviewable before the processing logic is touched.

## 8. Risk Control Checklist

- [ ] No global state introduced for the bounding-box selection.
- [ ] Dropdown rebuild logic only targets the current form.
- [ ] First raster remains the default when the list is valid.
- [ ] Disabled AHP fields remain disabled and never become editable via CSS alone.
- [ ] Existing calculations still work when no bounding-box selection is chosen.
- [ ] Tests cover the reset behavior after file changes.
- [ ] The old `right-panel-*` classes are removed from the active generated elements.

## 9. Verification

Run the focused validation first:

```bash
npx vitest run tests/right-panel.test.ts
```

Then run the broader project checks:

```bash
npm test
npm run build
```

Also do one manual check in the app:

1. Open Raster Algebra and upload two rasters.
2. Confirm the bounding-box selector defaults to the first raster.
3. Change the selection and calculate again.
4. Repeat the same check in MCE.
5. Confirm the selected raster remains valid after adding or deleting rasters.
6. Confirm the AHP matrix still behaves correctly and the disabled cells are visually distinct.

## 10. Acceptance Criteria

The issue is resolved when all of the following are true:

- Every generated form element uses a `spazio-*` class pattern.
- The AHP grid clearly distinguishes editable and non-editable fields.
- Raster Algebra and MCE both include a bounding-box raster selector.
- The selected default is the first valid raster and resets when the raster list changes.
- The chosen bounding raster is used consistently in processing.
- The relevant regression tests pass.
- The project still builds and the existing suite remains green.

## 11. Recommended Notes for the Implementer

Keep the patch small and mechanical. Do not rewrite the panel architecture. Do not add background state or helper layers unless the selector logic truly needs them. The safest approach is to add a few local helper functions inside the existing `loadOptionForm` function that rebuild the UI when the raster list changes.

If this work is being delegated to a low-cost AI agent, instruct it to: 1) change only the form styling names, 2) add the bounding-box dropdown logic in one place per form, 3) leave the AHP logic alone except for disabled styling, and 4) validate using the narrow right-panel test before broader checks.
