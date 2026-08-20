# Implementation Plan: Right Panel Styling Registry

This document describes how to implement `/Docs/Fix/Styling.md`. It is written
for a junior developer or a low-cost AI agent. Keep the change limited to the
right-panel styling surface; do not change raster processing, control types, or
the host panel API.

## 1. Goal and constraints

1. Add `/src/lib/styles/right-panel-styles.ts`.
2. Store right-panel styles as TypeScript class-name/style pairs in that file.
3. Make every element created by `/src/lib/geolibre/right-panel.ts` use the
   registry, including elements created inside `renderRasterList`, `renderAhp`,
   and the dynamic MCE rows.
4. Preserve the existing HTML element types and behavior:
   - `select` elements remain `select` elements.
   - `input[type=file]`, `input[type=number]`, `input[type=range]`,
     `input[type=radio]`, and `input[type=checkbox]` remain their current types.
   - `button`, `a`, `textarea`, `fieldset`, `table`, `tr`, `th`, and `td` are
     not replaced with other elements.
5. Do not move processing logic into the style registry. The registry should
   contain only style data and a small application helper if needed.
6. Right-panel rendering must not depend on declarations in
   `/src/lib/styles/plugin-control.css`. Other plugin surfaces may continue to
   use that stylesheet.

## 2. Current behavior to preserve

The owning renderer is `/src/lib/geolibre/right-panel.ts`.

- Raster Algebra creates the uploader, raster list, expression keyboard,
  expression textarea, Calculate button, and Download link.
- Multi Criteria Evaluation creates the raster-count slider, file/weight rows,
  AHP controls/table, band controls, Calculate button, and Download link.
- `operationsContainer`, `ahpContainer`, and `averagingGroup` are conditionally
  visible. Keep their event handlers and state transitions unchanged.
- `ENABLE_DOWNLOAD` still controls whether download links are visible and
  usable.

The current CSS source contains useful rules for the right panel, controls,
labels, statuses, inputs, buttons, flex layouts, and panel typography. Port the
needed values into the registry instead of relying on those selectors. Do not
copy unrelated floating-panel or map-control styles.

## 3. Registry design

### 3.1 Create the style module

Create `/src/lib/styles/right-panel-styles.ts` with:

```ts
export type RightPanelStyleName = ...;
export const RIGHT_PANEL_STYLES: Record<RightPanelStyleName, Record<string, string>> = ...;
export function applyRightPanelStyle(element: HTMLElement, styleName: RightPanelStyleName): void { ... }
```

Use names that describe the role of the element, not its current HTML tag. At
minimum define entries for:

- `panel`, `heading`, `description`, `methodSelect`, `formContainer`
- `status`, `label`, `input`, `expression`, `button`, `downloadButton`
- `rasterList`, `rasterRow`, `rasterControls`, `rasterBands`
- `operations`, `operationRow`, `operationButton`
- `mceCountGroup`, `mceRows`, `mceRow`, `mceWeightInput`
- `mceAhpLabel`, `mceAhpContainer`, `mceAhpInput`, `mceAhpButton`
- `fieldset`, `legend`, `radioLabel`, `averagingGroup`, `selectOption`
- `hidden` and `visibleFlex` for state changes.

The exact names may vary, but each style entry must be used by a concrete
element in `right-panel.ts`. Avoid a second one-off style object in the
renderer.

### 3.2 Apply styles without CSS selectors

`applyRightPanelStyle` should:

1. Set the registry key as the element's `className` (or add it with
   `classList.add` if the element needs multiple registry roles).
2. Copy each style property into `element.style` with `Object.assign` or a
   small loop.
3. Fail clearly for an unknown registry key during development, rather than
   silently producing an unstyled control.

Keep the registry values compatible with `CSSStyleDeclaration`: use string
values such as `"16px"`, `"1px solid #b8c1cc"`, `"100%"`, and `"none"`.

### 3.3 Required visual rules

Implement these requirements explicitly in the registry:

- Panel: near-white background, dark text, `boxSizing: "border-box"`,
  `padding: "16px"`, neutral border and/or shadow, and a readable vertical
  layout.
- Form and row containers: flex layout with consistent gaps; use
  `flexDirection: "column"` where controls are stacked.
- Inputs: full width where appropriate, stable minimum height, readable
  padding, and `border: "1px solid #b8c1cc"`.
- Selects: `backgroundColor: "#ffffff"`, `color: "#111827"`, and a visible
  border.
- Option elements: explicitly set `backgroundColor: "#ffffff"` and
  `color: "#000000"` when they are created in `drawDropdownOptions`.
- Buttons, including Processing, Calculate, AHP, keyboard, band, Delete, and
  file-upload controls where the browser permits styling: contrasting accent
  background, white text, and an explicit border such as
  `"1px solid #1d4ed8"`.
- Textarea: retain the input border and allow vertical resizing without
  changing its element type.
- Focus and hover styles: add `:hover`/`:focus` behavior only if it can be
  represented by the registry model. A practical implementation is to apply
  `mouseenter`/`mouseleave` and `focus`/`blur` handlers through a helper, or to
  keep the base state in the registry and document any intentionally omitted
  state. Do not reintroduce a dependency on `plugin-control.css`.

Use a small, coherent palette. Do not rely on inherited CSS variables from the
old stylesheet, because the right panel must remain styled if that stylesheet
is removed or changed.

## 4. Update `right-panel.ts`

Import `applyRightPanelStyle` and the registry type from the new style module.
Use the helper immediately after creating every right-panel element.

### 4.1 Shared creation points

Update these existing locations:

1. In `registerTemplateRightPanel`, style `wrap`, `heading`, `body`,
   `method`, and `methodFormContainer`.
2. In `drawDropdownOptions`, style every created `option` with the explicit
   option style. This ensures both the top-level method dropdown and the MCE
   averaging dropdown meet the white-background/black-text requirement.
3. In the Raster Algebra branch, style the status, uploader, raster list,
   keyboard toggle, operations container, operation rows/buttons, expression
   label, expression textarea, Calculate button, download link, raster rows,
   alias inputs, band containers/buttons, Delete buttons, and raster controls.
4. In the MCE branch, style the status, count group/label/slider/output,
   raster rows and their file/number/range inputs, AHP toggle/label/container,
   table cells/inputs/button, band fieldset/legend/radio labels, averaging
   select/group, Calculate button, and download link.

Do not leave a dynamically created button or input with only browser defaults.
If a control is intentionally compact, create a dedicated registry entry for
that role instead of adding an inline style in `right-panel.ts`.

### 4.2 Replace direct inline state styling

Replace these direct mutations:

- `operationsContainer.style.display = ...`
- `ahpContainer.style.display = ...`
- `averagingGroup.style.display = ...`
- download-link `style.display` assignments.

Use a helper such as `setRightPanelVisibility(element, "hidden" | "visibleFlex")`
that applies the corresponding registry style. The helper must preserve the
existing `display: "none"` behavior and use `display: "flex"` only for
containers that currently become flex containers. Keep `aria-disabled`,
`tabIndex`, `href`, and button disabled state logic as-is.

## 5. CSS cleanup

After the TypeScript renderer is fully styled, inspect
`/src/lib/styles/plugin-control.css` for selectors that are used only by the
right panel. Do not remove shared styles used by the floating panel or map
control. The preferred outcome is that right-panel behavior remains correct if
the right-panel-specific CSS rules are deleted; if deleting them is risky,
leave the stylesheet intact but ensure TypeScript inline styles are complete and
authoritative.

Do not add a new stylesheet for this task. The requested source of truth is the
TypeScript registry.

## 6. Tests

Extend `/tests/right-panel.test.ts` with focused DOM tests. Keep the existing
registration and cleanup tests.

Add tests that:

1. Render the registered panel, select `Raster Algebra`, and assert:
   - the method is still a `SELECT`;
   - the uploader is `INPUT` with `type="file"`;
   - the expression control is `TEXTAREA`;
   - Calculate and Download remain buttons/link controls;
   - input/select/button styles include visible borders;
   - select options have white background and black text;
   - the panel has the expected padding/background/box-sizing registry values.
2. Select `Multi Criteria Evaluation` and assert the count control remains a
   range input, raster file controls remain file inputs, weight controls remain
   number/range inputs, and the AHP toggle remains a checkbox.
3. Toggle AHP and the average-band radio option, asserting that visibility
   changes still occur through the expected `display` values.
4. Verify the download link remains hidden or disabled according to
   `ENABLE_DOWNLOAD` without changing its element type.

If tests need a stable hook, add `data-testid` or role attributes sparingly;
prefer existing element types, labels, class names, and `aria-label` values.
Do not mock raster processing for style-only assertions unless the test needs
to trigger an asynchronous calculation.

## 7. Validation checklist

Run these commands from the repository root after implementation:

```text
npm test -- --run tests/right-panel.test.ts
npm run lint
npm run build:lib
```

Then run the full suite:

```text
npm test
```

Manual smoke test in the plugin host:

1. Open the right panel and inspect the method dropdown.
2. Open Raster Algebra. Confirm the uploader, expression field, keyboard,
   raster controls, Calculate button, and Download link have borders and usable
   spacing.
3. Open Multi Criteria Evaluation. Confirm sliders, file inputs, number
   inputs, selects, radios, AHP controls, and buttons retain their original
   types and are styled consistently.
4. Open the AHP section and switch to average-band processing. Confirm the
   dynamic sections show and hide without layout errors.
5. Check a browser or host environment where the old `plugin-control.css` is
   unavailable. The right-panel controls should still have their registry
   styles.

## 8. Completion criteria

The task is complete when `/src/lib/styles/right-panel-styles.ts` is the
documented source of truth for right-panel styling, every element created by
`right-panel.ts` receives a registry style, the six explicit requirements in
`/Docs/Fix/Styling.md` are visible in code and tests, processing behavior is
unchanged, and the focused tests, lint, and library build pass.