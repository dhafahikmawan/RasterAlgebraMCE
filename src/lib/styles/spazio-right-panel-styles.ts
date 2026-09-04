import { RIGHT_PANEL_DARK_STYLES } from "./spazio-right-panel-dark";

export type RightPanelStyle = Partial<CSSStyleDeclaration>;

export type ThemeMode = "light" | "dark";
let currentTheme: ThemeMode = "dark";

export function setRightPanelTheme(theme: ThemeMode): void {
  currentTheme = theme;
}

export function getRightPanelTheme(): ThemeMode {
  return currentTheme;
}

export const RIGHT_PANEL_STYLES = {
  panel: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxSizing: "border-box",
    padding: "16px",
    width: "100%",
    minHeight: "100%",
    height: "100%",
    overflowY: "auto",
    backgroundColor: "#ffffff",
    color: "#111827",
    border: "1px solid #d1d5db",
    boxShadow: "0 2px 8px rgba(17, 24, 39, 0.12)",
    fontSize: "13px",
    lineHeight: "1.5",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  heading: {
    margin: "0",
    color: "#0f172a",
    fontSize: "16px",
    fontWeight: "600",
  },
  description: {
    margin: "0",
    color: "#475569",
    fontSize: "12px",
    lineHeight: "1.4",
  },
  text: {
    color: "#334155",
    fontSize: "13px",
  },
  formContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  formRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    boxSizing: "border-box",
  },
  status: {
    color: "#4b5563",
    fontSize: "12px",
    overflowWrap: "break-word",
  },
  label: {
    display: "block",
    marginBottom: "4px",
    color: "#374151",
    fontSize: "12px",
    fontWeight: "500",
  },
  input: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "36px",
    padding: "8px 10px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    fontFamily: "inherit",
  },
  expression: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "96px",
    padding: "8px 10px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontFamily: "monospace",
    resize: "vertical",
  },
  methodSelect: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "36px",
    padding: "8px 10px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "14px",
    fontFamily: "inherit",
  },
  range: {
    width: "100%",
    accentColor: "#1d4ed8",
    flex: "1 1 auto",
    minWidth: "0",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    accentColor: "#1d4ed8",
    cursor: "pointer",
  },
  radio: {
    accentColor: "#1d4ed8",
    cursor: "pointer",
  },
  output: {
    color: "#0f172a",
    fontWeight: "600",
  },
  selectOption: {
    backgroundColor: "#ffffff",
    color: "#000000",
  },
  button: {
    boxSizing: "border-box",
    minHeight: "36px",
    padding: "8px 14px",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
    backgroundColor: "#e2e8f0 ",
    color: "#1e293b",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  operationButton: {
    boxSizing: "border-box",
    minHeight: "36px",
    padding: "8px 14px",
    border: "1px solid #1d4ed8",
    borderRadius: "4px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    textAlign: "center",
  },
  downloadButton: {
    boxSizing: "border-box",
    minHeight: "36px",
    padding: "8px 14px",
    border: "1px solid #1d4ed8",
    borderRadius: "4px",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    textAlign: "center",
  },
  layerList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  layerCard: {
    boxSizing: "border-box",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "4px",
    backgroundColor: "#f9fafb",
    boxShadow: "0 1px 2px rgba(17, 24, 39, 0.08)",
  },
  checkLabel: {
    overflow: "hidden",
    color: "#111827",
    fontSize: "12px",
    fontWeight: "500",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    cursor: "pointer",
    userSelect: "none",
  },
  layerSubform: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
    paddingTop: "8px",
    borderTop: "1px solid #d1d5db",
  },
  wdSliderControl: {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    width: "100%",
    boxSizing: "border-box",
  },
  wdNumberInput: {
    boxSizing: "border-box",
    width: "82px",
    minWidth: "82px",
    maxWidth: "82px",
    minHeight: "36px",
    padding: "6px 8px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "13px",
    textAlign: "right",
    flex: "0 0 82px",
  },
  wdStatsGrid: { 
    display: "grid", 
    gridTemplateColumns: "1fr 1fr", 
    gap: "6px" 
  },
  wdStatItem: { 
    padding: "8px", 
    border: "1px solid #d1d5db", 
    borderRadius: "4px", 
    backgroundColor: "#f9fafb" 
  },
  wdStatLabel: { 
    display: "block", 
    color: "#6b7280", 
    fontSize: "11px" 
  },
  wdStatValue: { 
    display: "block", 
    color: "#111827", 
    fontSize: "14px", 
    fontWeight: "600" 
  },
  wdProgress: { 
    padding: "8px", 
    backgroundColor: "#eff6ff", 
    color: "#1e3a8a", 
    fontSize: "12px" 
  },
  wdBadge: { 
    display: "inline-block", 
    padding: "3px 8px", 
    borderRadius: "999px", 
    backgroundColor: "#e5e7eb", 
    color: "#374151", 
    fontSize: "11px", 
    fontWeight: "600" 
  },
  wdBadgeOk: { 
    backgroundColor: "#dcfce7", 
    color: "#166534" 
  },
  wdBadgeError: { 
    backgroundColor: "#fee2e2", 
    color: "#991b1b" 
  },
  wdBadgeRunning: { 
    backgroundColor: "#dbeafe", 
    color: "#1e40af" 
  },
  rasterList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  rasterRow: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "10px",
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
  },
  rasterControls: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  rasterBands: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  operations: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: "8px",
    backgroundColor: "#e2e8f0",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
  },
  operationsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "6px",
    padding: "8px",
    backgroundColor: "#e2e8f0",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
  },
  operationRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  countGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  mceRows: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  mceRow: {
    display: "grid",
    gap: "6px",
    padding: "10px",
    backgroundColor: "#ffffff",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
  },
  mceWeightInput: {
    boxSizing: "border-box",
    minHeight: "36px",
    padding: "8px 10px",
    color: "#111827",
    backgroundColor: "#ffffff",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    font: "inherit",
  },
  ahpLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#334155",
    fontWeight: "500",
  },
  ahpContainer: {
    flexDirection: "column",
    gap: "8px",
    overflowX: "auto",
  },
  ahpInput: {
    boxSizing: "border-box",
    width: "72px",
    minHeight: "32px",
    padding: "6px",
    color: "#111827",
    backgroundColor: "#ffffff",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    font: "inherit",
  },
  ahpField: {
    boxSizing: "border-box",
    width: "72px",
    minHeight: "32px",
    padding: "6px",
    color: "#111827",
    backgroundColor: "#ffffff",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    font: "inherit",
  },
  ahpInputDisabled: {
    backgroundColor: "#e2e8f0",
    color: "#64748b",
    borderColor: "#cbd5e1",
    cursor: "not-allowed",
  },
  ahpButton: {
    alignSelf: "flex-start",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
  },
  tableRow: {
    borderBottom: "1px solid #e2e8f0",
  },
  tableHeader: {
    padding: "6px",
    color: "#334155",
    fontWeight: "600",
    textAlign: "left",
  },
  tableCell: {
    padding: "6px",
    color: "#334155",
  },
  fieldset: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    margin: "0",
    padding: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "4px",
  },
  legend: {
    padding: "0 4px",
    color: "#334155",
    fontWeight: "600",
  },
  radioLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "#334155",
  },
  averagingGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  flexCol:{
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "15px",
  },
  flexRow:{
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  inputDescription:{
    color: "#475569",
    fontSize: "11px",
    lineHeight: "1.4",
  },
  section:{
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  hidden: { display: "none" },
  visibleFlex: { display: "flex" },
  visibleGrid: { display: "grid" },
  fileField: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: "36px",
    padding: "6px 10px",
    border: "1px solid #b8c1cc",
    borderRadius: "4px",
    outline: "none",
    backgroundColor: "#ffffff",
    color: "#111827",
    fontSize: "13px",
    fontFamily: "inherit",
  },
  calculatorButton: {
    boxSizing: "border-box",
    minHeight: "32px",
    padding: "6px 10px",
    border: "1px solid #6b7280",
    borderRadius: "4px",
    backgroundColor: "#f3f4f6",
    color: "#111827",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
  },
  statusError: {
    color: "#b91c1c",
    fontSize: "12px",
    overflowWrap: "break-word",
  },
  downloads: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
} as const;

const STYLE_CLASS_ALIASES = {
  panel: ["geolibre-plugin-right-panel", "spazio-container"],
  heading: "spazio-title",
  description: "spazio-description",
  text: "spazio-text",
  formContainer: "spazio-form-container",
  formRow: "spazio-form-row",
  status: "spazio-status",
  label: "spazio-input-label",
  input: "spazio-text-field",
  inputDescription: "spazio-input-description",
  expression: "spazio-expression-field",
  methodSelect: "spazio-dropdown",
  range: "spazio-slider",
  checkbox: "spazio-checkbox",
  radio: "spazio-radio",
  output: "spazio-output",
  selectOption: "spazio-dropdown-options",
  button: "spazio-button",
  operationButton: "spazio-submit-button",
  downloadButton: "spazio-submit-button",
  layerList: "spazio-layer-list",
  layerCard: "spazio-layer-card",
  checkLabel: "spazio-check-label",
  layerSubform: "spazio-layer-subform",
  wdSliderControl: "spazio-wd-slider-control",
  wdNumberInput: "spazio-wd-number-input",
  wdStatsGrid: "spazio-wd-stats-grid",
  wdStatItem: "spazio-wd-stat-item",
  wdStatLabel: "spazio-wd-stat-label",
  wdStatValue: "spazio-wd-stat-value",
  wdProgress: "spazio-wd-progress",
  wdBadge: "spazio-wd-badge",
  wdBadgeOk: "spazio-wd-badge-ok",
  wdBadgeError: "spazio-wd-badge-error",
  wdBadgeRunning: "spazio-wd-badge-running",
  rasterList: "spazio-raster-list",
  rasterRow: "spazio-raster-row",
  rasterControls: "spazio-raster-controls",
  rasterBands: "spazio-raster-bands",
  operations: "spazio-operations",
  operationsGrid: "spazio-operations-grid",
  operationRow: "spazio-operation-row",
  countGroup: "spazio-count-group",
  mceRows: "spazio-mce-rows",
  mceRow: "spazio-mce-row",
  mceWeightInput: "spazio-mce-weight-input",
  ahpLabel: "spazio-ahp-label",
  ahpContainer: "spazio-ahp-container",
  ahpInput: "spazio-ahp-input",
  ahpInputDisabled: "spazio-ahp-input-disabled",
  ahpButton: "spazio-ahp-button",
  table: "spazio-ahp-table",
  tableRow: "spazio-ahp-table-row",
  tableHeader: "spazio-ahp-headers",
  tableCell: "spazio-ahp-cell",
  fieldset: "spazio-fieldset",
  legend: "spazio-legend",
  radioLabel: "spazio-radio-label",
  averagingGroup: "spazio-averaging-group",
  hidden: "spazio-hidden",
  visibleFlex: "spazio-visible-flex",
  visibleGrid: "spazio-visible-grid",
  flexCol: "spazio-flex-col",
  flexRow: "spazio-flex-row",
  section: "spazio-section",
  fileField: "spazio-file-field",
  calculatorButton: "spazio-calculator-button",
  statusError: "spazio-status-error",
  downloads: "spazio-downloads",
  ahpField: ["spazio-ahp-field", "spazio-ahp-input"],
} as const;

export type RightPanelStyleName = keyof typeof RIGHT_PANEL_STYLES;

export function applyRightPanelStyle(
  element: HTMLElement,
  styleName: RightPanelStyleName,
  theme: ThemeMode = currentTheme,
): void {
  const styles = theme === "dark" ? RIGHT_PANEL_DARK_STYLES[styleName] : RIGHT_PANEL_STYLES[styleName];
  const alias = STYLE_CLASS_ALIASES[styleName];
  const classNames = Array.isArray(alias) ? alias : [alias ?? `spazio-${String(styleName).replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)}`];
  for (const className of classNames) {
    if (className) element.classList.add(className);
  }
  Object.assign(element.style, styles);
}

export function applySpazioRightPanelStyles<T extends HTMLElement>(
  element: T,
  className: string,
): T {
  const legacyStyleKeyMap: Record<string, RightPanelStyleName> = {
    "spazio-container": "panel",
    "spazio-title": "heading",
    "spazio-description": "description",
    "spazio-input-label": "label",
    "spazio-input-description": "inputDescription",
    "spazio-dropdown": "methodSelect",
    "spazio-dropdown-options": "selectOption",
    "spazio-text-field": "input",
    "spazio-file-field": "fileField",
    "spazio-submit-button": "operationButton",
    "spazio-button": "button",
    "spazio-expression-field": "expression",
    "spazio-calculator-button": "calculatorButton",
    "spazio-ahp-table": "table",
    "spazio-ahp-field": "ahpField",
    "spazio-ahp-headers": "tableHeader",
    "spazio-status": "status",
    "spazio-form-container": "formContainer",
    "spazio-slider": "range",
    "spazio-checkbox": "checkbox",
  };

  const mappedStyle = legacyStyleKeyMap[className];
  if (mappedStyle) {
    applyRightPanelStyle(element, mappedStyle);
    return element;
  }

  element.classList.add(className);
  return element;
}

export function applyRightPanelStyles(
  element: HTMLElement | SVGElement,
  ...styleNames: Array<RightPanelStyleName | string>
): void {
  for (const styleName of styleNames) {
    const key = styleName as RightPanelStyleName;
    if (RIGHT_PANEL_STYLES[key]) {
      applyRightPanelStyle(element as HTMLElement, key);
    }
  }
}

export function styleRightPanelTree(root: HTMLElement, theme: ThemeMode = currentTheme): void {
  const queue = [root];
  while (queue.length) {
    const current = queue.shift()!;
    const classNames = current.className ? String(current.className).split(/\s+/).filter(Boolean) : [];

    // Panel wrapper
    if (classNames.includes("geolibre-plugin-right-panel") || current === root) {
      applyRightPanelStyle(current, "panel", theme);
    }

    // Heading / text
    if (classNames.includes("spazio-title")) applyRightPanelStyle(current as HTMLElement, "heading", theme);
    if (classNames.includes("spazio-description")) applyRightPanelStyle(current as HTMLElement, "description", theme);
    if (classNames.includes("spazio-text")) applyRightPanelStyle(current as HTMLElement, "text", theme);
    if (classNames.includes("spazio-output")) applyRightPanelStyle(current as HTMLElement, "output", theme);

    // Status
    if (classNames.includes("spazio-status") || classNames.includes("na-status") || classNames.includes("plugin-control-status")) applyRightPanelStyle(current as HTMLElement, "status", theme);
    if (classNames.includes("spazio-status-error")) applyRightPanelStyle(current as HTMLElement, "statusError", theme);

    // Form structure
    if (current.tagName === "FORM" || classNames.includes("spazio-form-container")) applyRightPanelStyle(current as HTMLElement, "formContainer", theme);
    if (classNames.includes("spazio-form-row") || classNames.includes("na-form-row")) applyRightPanelStyle(current as HTMLElement, "formRow", theme);
    if (classNames.includes("spazio-section") || classNames.includes("na-section")) applyRightPanelStyle(current as HTMLElement, "section", theme);
    if (classNames.includes("spazio-flex-col")) applyRightPanelStyle(current as HTMLElement, "flexCol", theme);
    if (classNames.includes("spazio-flex-row")) applyRightPanelStyle(current as HTMLElement, "flexRow", theme);

    // Labels
    if (classNames.includes("spazio-input-label") || classNames.includes("na-label")) applyRightPanelStyle(current as HTMLElement, "label", theme);
    if (classNames.includes("spazio-input-description")) applyRightPanelStyle(current as HTMLElement, "inputDescription", theme);

    // Selects / options
    if (current.tagName === "SELECT" || classNames.includes("spazio-dropdown")) applyRightPanelStyle(current as HTMLElement, "methodSelect", theme);
    if (current.tagName === "OPTION" || classNames.includes("spazio-dropdown-options")) applyRightPanelStyle(current as HTMLElement, "selectOption", theme);

    // Inputs
    if (current.tagName === "INPUT") {
      const input = current as HTMLInputElement;
      if (input.type === "range" || classNames.includes("spazio-slider")) applyRightPanelStyle(current as HTMLElement, "range", theme);
      else if (input.type === "checkbox" || classNames.includes("spazio-checkbox")) applyRightPanelStyle(current as HTMLElement, "checkbox", theme);
      else if (input.type === "radio" || classNames.includes("spazio-radio")) applyRightPanelStyle(current as HTMLElement, "radio", theme);
      else if (classNames.includes("wd-number-input") || classNames.includes("spazio-wd-number-input")) applyRightPanelStyle(current as HTMLElement, "wdNumberInput", theme);
      else if (classNames.includes("spazio-text-field") || classNames.includes("spatio-file-input") || classNames.includes("na-file-input") || classNames.includes("plugin-control-input") || classNames.includes("na-input")) applyRightPanelStyle(current as HTMLElement, "input", theme);
      else applyRightPanelStyle(current as HTMLElement, "input", theme);
    }
    if (classNames.includes("spazio-file-field")) applyRightPanelStyle(current as HTMLElement, "fileField", theme);
    if (classNames.includes("spazio-expression-field")) applyRightPanelStyle(current as HTMLElement, "expression", theme);

    // Buttons
    if (current.tagName === "BUTTON" || classNames.includes("spazio-button") || classNames.includes("spazio-submit-button")) {
      if (
        classNames.includes("na-btn--primary") ||
        classNames.includes("spazio-submit-button") ||
        classNames.includes("spatio-submit-button")
      ) {
        applyRightPanelStyle(current as HTMLElement, "operationButton", theme);
      } else {
        applyRightPanelStyle(current as HTMLElement, "button", theme);
      }
    }
    if (classNames.includes("na-btn--primary")) applyRightPanelStyle(current as HTMLElement, "operationButton", theme);
    if (classNames.includes("na-btn--secondary") || classNames.includes("na-pick-btn")) applyRightPanelStyle(current as HTMLElement, "button", theme);
    if (classNames.includes("spazio-calculator-button")) applyRightPanelStyle(current as HTMLElement, "calculatorButton", theme);

    // Layer list
    if (classNames.includes("spazio-layer-list") || classNames.includes("na-layer-list")) applyRightPanelStyle(current as HTMLElement, "layerList", theme);
    if (classNames.includes("spazio-layer-card") || classNames.includes("na-layer-card")) applyRightPanelStyle(current as HTMLElement, "layerCard", theme);
    if (classNames.includes("spazio-check-label") || classNames.includes("na-check-label")) applyRightPanelStyle(current as HTMLElement, "checkLabel", theme);
    if (classNames.includes("spazio-layer-subform") || classNames.includes("na-layer-subform")) applyRightPanelStyle(current as HTMLElement, "layerSubform", theme);

    // Radio / fieldset
    if (classNames.includes("spazio-averaging-group") || classNames.includes("na-radio-group")) applyRightPanelStyle(current as HTMLElement, "averagingGroup", theme);
    if (classNames.includes("spazio-radio-label") || classNames.includes("na-radio-label")) applyRightPanelStyle(current as HTMLElement, "radioLabel", theme);
    if (classNames.includes("na-radio")) applyRightPanelStyle(current as HTMLElement, "radio", theme);
    if (classNames.includes("spazio-fieldset")) applyRightPanelStyle(current as HTMLElement, "fieldset", theme);
    if (classNames.includes("spazio-legend")) applyRightPanelStyle(current as HTMLElement, "legend", theme);

    // WD widgets
    if (classNames.includes("spazio-wd-slider-control") || classNames.includes("wd-slider-control")) applyRightPanelStyle(current as HTMLElement, "wdSliderControl", theme);
    if (classNames.includes("spazio-wd-progress") || classNames.includes("wd-progress")) applyRightPanelStyle(current as HTMLElement, "wdProgress", theme);
    if (classNames.includes("spazio-wd-stats-grid")) applyRightPanelStyle(current as HTMLElement, "wdStatsGrid", theme);
    if (classNames.includes("spazio-wd-stat-item")) applyRightPanelStyle(current as HTMLElement, "wdStatItem", theme);
    if (classNames.includes("spazio-wd-stat-label")) applyRightPanelStyle(current as HTMLElement, "wdStatLabel", theme);
    if (classNames.includes("spazio-wd-stat-value")) applyRightPanelStyle(current as HTMLElement, "wdStatValue", theme);
    if (classNames.includes("spazio-wd-badge")) applyRightPanelStyle(current as HTMLElement, "wdBadge", theme);
    if (classNames.includes("spazio-wd-badge-ok")) applyRightPanelStyle(current as HTMLElement, "wdBadgeOk", theme);
    if (classNames.includes("spazio-wd-badge-error")) applyRightPanelStyle(current as HTMLElement, "wdBadgeError", theme);
    if (classNames.includes("spazio-wd-badge-running")) applyRightPanelStyle(current as HTMLElement, "wdBadgeRunning", theme);

    // Raster
    if (classNames.includes("spazio-raster-list")) applyRightPanelStyle(current as HTMLElement, "rasterList", theme);
    if (classNames.includes("spazio-raster-row")) applyRightPanelStyle(current as HTMLElement, "rasterRow", theme);
    if (classNames.includes("spazio-raster-controls")) applyRightPanelStyle(current as HTMLElement, "rasterControls", theme);
    if (classNames.includes("spazio-raster-bands")) applyRightPanelStyle(current as HTMLElement, "rasterBands", theme);

    // Operations
    if (classNames.includes("spazio-operations")) applyRightPanelStyle(current as HTMLElement, "operations", theme);
    if (classNames.includes("spazio-operations-grid")) applyRightPanelStyle(current as HTMLElement, "operationsGrid", theme);
    if (classNames.includes("spazio-operation-row")) applyRightPanelStyle(current as HTMLElement, "operationRow", theme);
    if (classNames.includes("spazio-count-group")) applyRightPanelStyle(current as HTMLElement, "countGroup", theme);

    // MCE
    if (classNames.includes("spazio-mce-rows")) applyRightPanelStyle(current as HTMLElement, "mceRows", theme);
    if (classNames.includes("spazio-mce-row")) applyRightPanelStyle(current as HTMLElement, "mceRow", theme);
    if (classNames.includes("spazio-mce-weight-input")) applyRightPanelStyle(current as HTMLElement, "mceWeightInput", theme);

    // AHP
    if (classNames.includes("spazio-ahp-label")) applyRightPanelStyle(current as HTMLElement, "ahpLabel", theme);
    if (classNames.includes("spazio-ahp-container")) applyRightPanelStyle(current as HTMLElement, "ahpContainer", theme);
    if (classNames.includes("spazio-ahp-input")) applyRightPanelStyle(current as HTMLElement, "ahpInput", theme);
    if (classNames.includes("spazio-ahp-field")) applyRightPanelStyle(current as HTMLElement, "ahpField", theme);
    if (classNames.includes("spazio-ahp-input-disabled")) applyRightPanelStyle(current as HTMLElement, "ahpInputDisabled", theme);
    if (classNames.includes("spazio-ahp-button")) applyRightPanelStyle(current as HTMLElement, "ahpButton", theme);

    // Table
    if (classNames.includes("spazio-ahp-table")) applyRightPanelStyle(current as HTMLElement, "table", theme);
    if (classNames.includes("spazio-ahp-table-row")) applyRightPanelStyle(current as HTMLElement, "tableRow", theme);
    if (classNames.includes("spazio-ahp-headers")) applyRightPanelStyle(current as HTMLElement, "tableHeader", theme);
    if (classNames.includes("spazio-ahp-cell")) applyRightPanelStyle(current as HTMLElement, "tableCell", theme);

    // Downloads
    if (classNames.includes("spazio-downloads")) applyRightPanelStyle(current as HTMLElement, "downloads", theme);

    Array.from(current.children).forEach((child) => queue.push(child as HTMLElement));
  }
}
