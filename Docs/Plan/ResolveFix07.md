# Implementation Plan: Resolve Fix 07

## 1. Goal

Implement dynamic column layout for the Raster Calculator keyboard grid as specified in [Docs/Fix/Fix07.md](../Fix/Fix07.md) using a clean, surgical, and robust solution tailored for implementation by a junior developer or low-cost AI agent.

The target behavior:
- Replace the hardcoded 4-column layout (`repeat(4, 1fr)`) with dynamic column sizing based on the right panel's width.
- Ensure the number of columns dynamically evaluates to the largest integer between 2 and 5 (inclusive) that fits the container width without buttons overflowing or spilling out of the panel card.
- Maintain seamless reactivity when the panel is opened, resized, or zoomed, and when switching between dark and light themes.
- Cleanly disconnect observers and event listeners when switching methods or unmounting/closing the panel.

---

## 2. Problem Summary

In `src/lib/styles/spazio-right-panel-styles.ts` and `src/lib/styles/spazio-right-panel-dark.ts`:
```ts
operationsGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "6px",
  padding: "8px",
  ...
}
```
Because `gridTemplateColumns` is hardcoded to 4 columns:
- When the GeoLibre right panel is narrowed (or opened in a narrow workspace/split screen), the 4 columns compress beyond the minimum viable button width and spill out horizontally or clip text labels like `arccos(`, `arcsin(`, `arctan(`.
- When the panel is resized wider, the grid stays fixed at 4 columns rather than adapting to utilize the available width effectively.

Fix 07 requirement:
> "In the raster calculator keyboard, currently the buttons are arranged in a fixed number of column, which is 4. If the right panel container from GeoLibre is too small, the buttons might spill out of the card. Make it so that it is dynamic depending on the width of the container (the biggest number between (inclusive) 2 and 5 that can fit in the right panel size)"

---

## 3. Implementation Constraints & Guidelines

- **Surgical scope**: Only touch the keyboard operations grid container layout, its width responsiveness, styles, and associated tests.
- **Clarity for junior developers / cheap AI agents**:
  - Provide clear arithmetic formulas and thresholds for calculating column count.
  - Detail exact DOM element lifecycle hooks and cleanup paths so no memory leaks (e.g., orphaned `ResizeObserver`) are introduced.
  - Keep fallback logic explicit and resilient if `ResizeObserver` is unavailable in test or older environments.
- **Theme compatibility**: Theme switching via `styleRightPanelTree` or `applyRightPanelStyle` resets element inline styles to `operationsGrid`. Ensure dynamic column styling is preserved or reapplied whenever styles/themes are re-rendered.
- **Do not break existing features**: The textarea focus retention (`e.preventDefault()` on mousedown), text insertion, and toggle visibility must remain intact.

---

## 4. Files to Change

1. `src/lib/geolibre/right-panel.ts`
   - Implement dynamic column calculation helper and responsive container observer/listener for `operationsContainer`.
   - Ensure clean disconnect when the view unmounts or method changes.
2. `src/lib/styles/spazio-right-panel-styles.ts`
   - Support column count preservation in `styleRightPanelTree`.
3. `src/lib/styles/spazio-right-panel-dark.ts`
   - Keep baseline compatibility.
4. `tests/right-panel.test.ts`
   - Add unit tests verifying column calculation logic and dynamic adjustments between 2 and 5 columns based on container widths.

---

## 5. Technical Solution & Sizing Math

### Column Determination Logic

Let container width be `W` (measured width of `operationsContainer` or its immediate parent `wrapper`).
Inspecting the keyboard buttons:
- Buttons have labels ranging from 1 character (`+`, `-`) up to 7 characters (`arccos(`, `arctan(`, `IF(`, etc.).
- With button padding, font size 13–14px, a comfortable minimum button width is approximately 58px - 64px.
- Grid container padding is 8px left + 8px right = 16px.
- Grid gap between columns is 6px.

Using an explicit target button minimum width threshold (`minButtonWidth = 58px`):
A pure, deterministic column calculation function:
```ts
export function calculateKeyboardColumns(containerWidth: number): number {
  // Account for operationsGrid padding (8px left + 8px right = 16px)
  const availableWidth = Math.max(0, containerWidth - 16);
  const gap = 6;
  const minButtonWidth = 58; // Minimum comfortable width for 7-character operators

  // Test candidate columns from 5 down to 2
  for (let cols = 5; cols >= 2; cols--) {
    const totalGaps = (cols - 1) * gap;
    const buttonWidth = (availableWidth - totalGaps) / cols;
    if (buttonWidth >= minButtonWidth) {
      return cols;
    }
  }
  return 2; // Floor at 2 as required: "between (inclusive) 2 and 5"
}
```

Breakdown of thresholds:
- Width >= 340px -> 5 columns
- Width >= 270px -> 4 columns
- Width >= 200px -> 3 columns
- Width < 200px -> 2 columns

This strictly guarantees:
- Always between 2 and 5 inclusive (min = 2, max = 5).
- Largest integer number of columns that fits without buttons collapsing or spilling out.

### Responsive Mechanism: ResizeObserver + CSS Grid Inline Override

1. **Helper function**:
```ts
const updateGridColumns = () => {
  const width = operationsContainer.clientWidth || wrapper.clientWidth || 320;
  const cols = calculateKeyboardColumns(width);
  operationsContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  operationsContainer.dataset.columns = String(cols);
};
```

2. **ResizeObserver**:
Attach a `ResizeObserver` observing `wrapper` (or `operationsContainer`):
```ts
const resizeObserver = typeof ResizeObserver !== 'undefined'
  ? new ResizeObserver(() => updateGridColumns())
  : null;
resizeObserver?.observe(wrapper);
```

3. **Lifecycle Cleanup**:
- Store cleanup in `loadOptionForm` or hook into unregister/panel destruction to call `resizeObserver?.disconnect()`.
- Also invoke `updateGridColumns()` immediately when the keyboard toggle is opened (`keyboardToggle.addEventListener('click', ...)`).

4. **Preserving on Theme Toggle**:
When `styleRightPanelTree` is invoked during theme toggle, `Object.assign(element.style, styles)` is called, which resets `gridTemplateColumns` back to default.
- In `styleRightPanelTree`, after applying `operationsGrid`, check and reapply:
```ts
if (classNames.includes("spazio-operations-grid")) {
  applyRightPanelStyle(current as HTMLElement, "operationsGrid", theme);
  const cols = (current as HTMLElement).dataset.columns;
  if (cols) {
    (current as HTMLElement).style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  }
}
```

---

## 6. Work Breakdown for a Junior Developer or Cheap AI Agent

### Task 1: Add the pure column calculation utility
1. Open `src/lib/geolibre/right-panel.ts`.
2. Add and export `calculateKeyboardColumns(containerWidth: number): number`.
3. Check edge conditions:
   - Width is 0 or negative -> returns 2.
   - Width is very large -> returns 5.
   - Width around 320px (default panel width) -> returns 4.

Expected output: `calculateKeyboardColumns` behaves deterministically with zero side effects.

### Task 2: Connect ResizeObserver to the keyboard container
1. In `loadOptionForm` under `"Raster Algebra"`, define an observer that watches `wrapper` or `operationsContainer`.
2. When triggered, read container width and call `operationsContainer.style.gridTemplateColumns = `repeat(${cols}, 1fr)``.
3. Set `operationsContainer.dataset.columns = String(cols)`.
4. In `keyboardToggle` click handler, invoke `updateGridColumns()` when opening so columns format properly even if layout was measured while hidden.
5. In panel cleanup / method change, disconnect the observer to avoid memory leaks.

Expected output: resizing the container updates grid columns immediately without button overflow.

### Task 3: Retain column layout on theme toggle
1. Open `src/lib/styles/spazio-right-panel-styles.ts`.
2. Find `styleRightPanelTree` around line 736 where `spazio-operations-grid` is handled.
3. After `applyRightPanelStyle(...)`, check if `(current as HTMLElement).dataset.columns` exists.
4. If it exists, re-set `(current as HTMLElement).style.gridTemplateColumns = `repeat(${cols}, 1fr)``.

Expected output: clicking the Theme Toggle button preserves dynamic column count.

### Task 4: Add regression & behavior unit tests
1. Open `tests/right-panel.test.ts`.
2. Add a test suite for `calculateKeyboardColumns`:
   - Verify it returns 2 for width < 200px.
   - Verify it returns 3 for width ~240px.
   - Verify it returns 4 for width ~320px.
   - Verify it returns 5 for width > 350px.
   - Verify it never returns < 2 or > 5.
3. Add a test verifying `operationsContainer` updates grid columns according to container width.

Expected output: automated tests pass cleanly and prove responsiveness.

---

## 7. Verification

Run the test suite:
```bash
npx vitest run tests/right-panel.test.ts
```

### Manual Verification Checklist
1. Open the plugin in GeoLibre.
2. Select **Raster Algebra** and click **Open/Close Calculator Keyboard**.
3. Drag the right panel resizing handle to make it narrower (e.g. ~200px):
   - Buttons should arrange into 2 or 3 columns.
   - No buttons or text labels should spill out of the card.
4. Drag the panel wider (e.g. ~400px+):
   - Buttons should dynamically arrange into 4 or 5 columns.
5. Toggle Dark/Light theme and verify the columns do not jump back to a hardcoded 4 columns.
