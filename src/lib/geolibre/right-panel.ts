import type { GeoLibreAppAPI, GeoLibreControl } from "./host-api";
import { loadRasterFromFile, compileExpression, calculateRaster } from "../SpatioProcessing/raster-algebra";
import type { RasterInput } from "../SpatioProcessing/raster-algebra";
import { buildMceRaster, calculateAhpWeights } from "../SpatioProcessing/mce";
import type { MceBandMode, MceMissingDataMode } from "../SpatioProcessing/mce";
import {
  applyRightPanelStyle,
} from "../styles/spazio-right-panel-styles";

/**
 * Set to `false` to hide the Download Result button for end-users.
 * Toggle this at the top of the file during development/deployment.
 */
export const ENABLE_DOWNLOAD = true;


/**
 * Demonstration of the GeoLibre right-sidebar panel host API.
 *
 * A plugin can register a native right-sidebar panel that docks beside
 * GeoLibre's built-in Style panel and behaves like a first-class part of the
 * workspace, instead of emulating one with a fixed overlay. The host renders
 * the panel chrome (header, collapse/close buttons, a collapsible rail, and a
 * resize handle); the plugin owns only the body via `render(container)`, using
 * plain DOM so it never has to share the host's UI framework.
 *
 * This module is intentionally self-contained so it is easy to copy, adapt, or
 * delete. Wire it from the plugin's `activate`/`deactivate` hooks (see
 * `src/geolibre.ts`).
 */

/** Stable id for this plugin's right panel. Replace with your own. */
export const RIGHT_PANEL_ID = "spatio-ra-mce-panel";
export const BASE_METHODS = ["", "Raster Algebra", "Multi Criteria Evaluation"];
export const BASE_METHODS_TC = ["Select Processing Function", "Raster Algebra", "Multi Criteria Evaluation"];

let _app : GeoLibreAppAPI;
let _method : HTMLSelectElement;
let _methodForm : HTMLElement;

export function setMethod(process : string){
  if(_method && _methodForm){
    _method.value = process;
    loadOptionForm(_methodForm, process);
  }
}

function drawDropdownOptions(dropdown : HTMLElement, options: string[], tcs?: string[]){
  options.forEach((option, index) =>{
    const optionElement = document.createElement("option");
    applyRightPanelStyle(optionElement, "selectOption");
    optionElement.value = option;
    if(!tcs || index >= tcs.length){
      optionElement.textContent = option;
    }else{
      optionElement.textContent = tcs[index];
    }
    dropdown.appendChild(optionElement);
  })
}

function setRightPanelVisibility(element: HTMLElement, styleName: "hidden" | "visibleFlex" | "visibleGrid") {
  applyRightPanelStyle(element, styleName);
}

let resultUrls: string [] = [];
function loadOptionForm(wrapper: HTMLElement, method : string){
  removeAllChildElements(wrapper);
  if(method === "Raster Algebra"){
    // ── State ──────────────────────────────────────────────────────────────
    const rasters: RasterInput[] = [];
    let keyboardOpen = false;
    let resultDownloadUrl: string | null = null;
    let expressionSelectionStart = 0;
    let expressionSelectionEnd = 0;
    let selectedBoundingRasterKey: string | null = null;

    const NAN_HANDLING_MODE: 'DEFAULT' | 'RASTER_PRIORITY' = 'DEFAULT';
    const OPERATIONS = [
      '+', '-', '*', '/', '^',
      '<', '<=', '=', '!=', '>=', '>',
      '(', ')', ',',
      'min(', 'max(', 'abs(',
      'sin(', 'cos(', 'tan(',
      'arcsin(', 'arccos(', 'arctan(',
      'ln(', 'log(', 'log10(',
      'IF(', 'AND(', 'OR(',
    ];

    // ── Status bar ─────────────────────────────────────────────────────────
    const status = document.createElement('div');
    applyRightPanelStyle(status, "status");
    status.setAttribute('role', 'status');

    // ── File uploader ──────────────────────────────────────────────────────
    const uploader = document.createElement('input');
    uploader.type = 'file';
    uploader.multiple = true;
    uploader.accept = '.tif,.tiff,image/tiff';
    applyRightPanelStyle(uploader, "input");
    uploader.setAttribute('aria-label', 'Raster files');

    // ── Raster list container ──────────────────────────────────────────────
    const rasterList = document.createElement('div');
    applyRightPanelStyle(rasterList, "rasterList");

    const boundingRasterLabel = document.createElement('label');
    applyRightPanelStyle(boundingRasterLabel, "label");
    boundingRasterLabel.textContent = 'Bounding box raster';
    const boundingRasterSelector = document.createElement('select');
    boundingRasterSelector.name = 'raster-algebra-bounding-raster';
    applyRightPanelStyle(boundingRasterSelector, "methodSelect");
    boundingRasterSelector.addEventListener('change', () => {
      selectedBoundingRasterKey = boundingRasterSelector.value || null;
    });

    const missingDataLabel = document.createElement('label');
    applyRightPanelStyle(missingDataLabel, "label");
    missingDataLabel.textContent = 'Missing data handling';
    const missingDataSelector = document.createElement('select');
    missingDataSelector.name = 'raster-algebra-missing-data-mode';
    applyRightPanelStyle(missingDataSelector, "methodSelect");
    drawDropdownOptions(missingDataSelector, ['NaN', '0', 'Skip']);
    missingDataSelector.value = 'Skip';

    const syncBoundingRasterSelector = () => {
      const entries = rasters.map((raster) => ({ key: raster.key, label: raster.key }));
      boundingRasterSelector.replaceChildren();
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = 'Default';
      applyRightPanelStyle(emptyOption, 'selectOption');
      boundingRasterSelector.appendChild(emptyOption);
      if (entries.length === 0) {
        boundingRasterSelector.disabled = true;
        selectedBoundingRasterKey = null;
        boundingRasterSelector.value = '';
        return;
      }
      entries.forEach(({ key, label }) => {
        const option = document.createElement('option');
        applyRightPanelStyle(option, 'selectOption');
        option.value = key;
        option.textContent = label;
        boundingRasterSelector.appendChild(option);
      });
      const currentSelection = entries.some((entry) => entry.key === selectedBoundingRasterKey)
        ? selectedBoundingRasterKey
        : null;
      selectedBoundingRasterKey = currentSelection;
      boundingRasterSelector.value = currentSelection ?? '';
      boundingRasterSelector.disabled = false;
    };

    // ── Keyboard toggle ────────────────────────────────────────────────────
    const keyboardToggle = document.createElement('button');
    keyboardToggle.type = 'button';
    applyRightPanelStyle(keyboardToggle, "button");
    keyboardToggle.textContent = 'Open/Close Calculator Keyboard';

    // ── Operator keyboard grid ─────────────────────────────────────────────
    const operationsContainer = document.createElement('div');
    applyRightPanelStyle(operationsContainer, "operationsGrid");
    setRightPanelVisibility(operationsContainer, "hidden");

    // ── Expression textarea ────────────────────────────────────────────────
    const expressionLabel = document.createElement('label');
    applyRightPanelStyle(expressionLabel, "label");
    expressionLabel.textContent = 'Expression';

    const expressionArea = document.createElement('textarea');
    applyRightPanelStyle(expressionArea, "input");
    applyRightPanelStyle(expressionArea, "expression");
    expressionArea.rows = 4;
    expressionArea.placeholder = 'Use the raster buttons or enter an expression';

    // Helper: capture cursor position so keyboard/band buttons insert at caret
    const captureSelection = () => {
      expressionSelectionStart = expressionArea.selectionStart;
      expressionSelectionEnd = expressionArea.selectionEnd;
    };
    ['click', 'keyup', 'select', 'focus', 'input'].forEach((evt) =>
      expressionArea.addEventListener(evt, captureSelection),
    );

    // Helper: insert text at the last known cursor position
    const insertText = (text: string) => {
      const before = expressionArea.value.slice(0, expressionSelectionStart);
      const after = expressionArea.value.slice(expressionSelectionEnd);
      expressionArea.value = before + text + after;
      expressionSelectionStart = expressionSelectionEnd = before.length + text.length;
      expressionArea.selectionStart = expressionArea.selectionEnd = expressionSelectionStart;
    };

    // Build operator buttons — all placed directly into the grid container.
    // `mousedown` is prevented so the textarea never loses focus when a key is clicked.
    OPERATIONS.forEach((op) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      applyRightPanelStyle(btn, "operationButton");
      btn.textContent = op;
      btn.addEventListener('mousedown', (e) => e.preventDefault());
      btn.addEventListener('click', () => insertText(op));
      operationsContainer.appendChild(btn);
    });

    keyboardToggle.addEventListener('click', () => {
      keyboardOpen = !keyboardOpen;
      keyboardToggle.setAttribute('aria-pressed', String(keyboardOpen));
      setRightPanelVisibility(operationsContainer, keyboardOpen ? "visibleGrid" : "hidden");
    });

    // ── Calculate button ───────────────────────────────────────────────────
    const calculateBtn = document.createElement('button');
    calculateBtn.type = 'button';
    applyRightPanelStyle(calculateBtn, "button");
    calculateBtn.textContent = 'Calculate';

    // ── Download link ──────────────────────────────────────────────────────
    const downloadLink = document.createElement('a');
    applyRightPanelStyle(downloadLink, "downloadButton");
    downloadLink.textContent = 'Download Result';
    downloadLink.download = 'raster-algebra-result.tif';
    downloadLink.setAttribute('aria-disabled', 'true');
    downloadLink.tabIndex = -1;
    if (!ENABLE_DOWNLOAD) {
      setRightPanelVisibility(downloadLink, "hidden");
    }
    downloadLink.addEventListener('click', (event) => {
      if (!downloadLink.href || downloadLink.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
      }
    });

    // Helper: rebuild the raster list rows
    const renderRasterList = () => {
      removeAllChildElements(rasterList);
      rasters.forEach((raster) => {
        const row = document.createElement('div');
        applyRightPanelStyle(row, "rasterRow");
        row.dataset.rasterKey = raster.key;

        const label = document.createElement('span');
        label.textContent = raster.key;

        const aliasInput = document.createElement('input');
        applyRightPanelStyle(aliasInput, "input");
        aliasInput.dataset.rasterAliasKey = raster.key;
        aliasInput.placeholder = 'Alias';
        aliasInput.value = raster.alias ?? '';
        aliasInput.addEventListener('input', () => {
          const selectionStart = aliasInput.selectionStart ?? aliasInput.value.length;
          const selectionEnd = aliasInput.selectionEnd ?? selectionStart;
          raster.alias = aliasInput.value || undefined;
          renderRasterList();
          const replacement = Array.from(
            rasterList.querySelectorAll<HTMLInputElement>('input[data-raster-alias-key]'),
          ).find((input) => input.dataset.rasterAliasKey === raster.key);
          replacement?.focus();
          replacement?.setSelectionRange(selectionStart, selectionEnd);
        });

        const noDataInput = document.createElement('input');
        applyRightPanelStyle(noDataInput, "input");
        noDataInput.type = 'number';
        noDataInput.step = 'any';
        noDataInput.dataset.rasterNoDataKey = raster.key;
        noDataInput.placeholder = 'NoData';
        noDataInput.value = raster.noData == null ? '' : String(raster.noData);
        noDataInput.setAttribute('aria-label', `NoData value for ${raster.key}`);
        noDataInput.addEventListener('input', () => {
          const value = noDataInput.value.trim();
          raster.noData = value === '' ? null : Number(value);
          if (Number.isNaN(raster.noData)) {
            raster.noData = null;
          }
          renderRasterList();
          const replacement = Array.from(
            rasterList.querySelectorAll<HTMLInputElement>('input[data-raster-no-data-key]'),
          ).find((input) => input.dataset.rasterNoDataKey === raster.key);
          replacement?.focus();
          const selectionIndex = noDataInput.selectionStart ?? noDataInput.value.length;
          replacement?.setSelectionRange(selectionIndex, selectionIndex);
        });

        const bandsContainer = document.createElement('div');
        applyRightPanelStyle(bandsContainer, "rasterBands");
        const bandCount = Math.max(1, raster.source.bandCount);
        for (let b = 1; b <= bandCount; b++) {
          const insertBtn = document.createElement('button');
          insertBtn.type = 'button';
          applyRightPanelStyle(insertBtn, "operationButton");
          const identity = raster.alias || raster.key;
          const reference = bandCount === 1 ? identity : `${identity}.band_${b}`;
          const bandLabel =
            bandCount === 1
              ? `Insert ${identity}`
              : `Insert band ${b} from ${identity}`;
          insertBtn.textContent = bandCount === 1 ? 'Insert' : `Band ${b}`;
          insertBtn.setAttribute('aria-label', bandLabel);
          insertBtn.addEventListener('click', () => {
            captureSelection();
            insertText(`"${reference}"`);
            expressionArea.focus();
          });
          bandsContainer.appendChild(insertBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        applyRightPanelStyle(deleteBtn, "button");
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('aria-label', `Delete raster ${raster.key}`);
        deleteBtn.addEventListener('click', () => {
          const idx = rasters.indexOf(raster);
          if (idx !== -1) rasters.splice(idx, 1);
          renderRasterList();
        });

        const controls = document.createElement('div');
        applyRightPanelStyle(controls, "rasterControls");
        controls.append(aliasInput, noDataInput, bandsContainer, deleteBtn);
        row.append(label, controls);
        rasterList.appendChild(row);
      });
      syncBoundingRasterSelector();
    };

    // ── File upload handler ────────────────────────────────────────────────
    uploader.addEventListener('change', () => {
      const files = Array.from(uploader.files ?? []);
      uploader.value = '';
      if (files.length === 0) return;
      // Limit to 5 rasters total
      const slots = 5 - rasters.length;
      const toLoad = files.slice(0, slots);
      if (toLoad.length === 0) {
        status.textContent = 'Maximum of 5 rasters already loaded.';
        return;
      }
      status.textContent = 'Loading rasters…';
      Promise.all(toLoad.map((f) => loadRasterFromFile(f)))
        .then((loaded) => {
          loaded.forEach((r) => {
            // Avoid duplicate keys
            if (!rasters.some((existing) => existing.key === r.key)) {
              rasters.push(r);
            }
          });
          renderRasterList();
          syncBoundingRasterSelector();
          status.textContent = `${rasters.length} raster(s) loaded.`;
        })
        .catch((err: unknown) => {
          status.textContent = `Error loading raster: ${(err as Error).message}`;
        });
    });

    // ── Calculate handler ──────────────────────────────────────────────────
    calculateBtn.addEventListener('click', () => {
      const exprText = expressionArea.value;
      if (!exprText.trim()) {
        status.textContent = 'Please enter an expression.';
        return;
      }
      if (rasters.length === 0) {
        status.textContent = 'Please upload at least one raster.';
        return;
      }
      let compiled;
      try {
        compiled = compileExpression(exprText);
      } catch (err: unknown) {
        status.textContent = `Expression error: ${(err as Error).message}`;
        return;
      }
      status.textContent = 'Calculating…';
      calculateBtn.disabled = true;
      calculateRaster(
        rasters,
        compiled,
        NAN_HANDLING_MODE,
        selectedBoundingRasterKey ?? undefined,
        missingDataSelector.value as 'NaN' | '0' | 'Skip',
      )
        .then(({ blob, warnings }) => {
          // Revoke previous object URL to free memory
          //if (resultDownloadUrl) URL.revokeObjectURL(resultDownloadUrl);
          resultDownloadUrl = URL.createObjectURL(blob);
          resultUrls.push(resultDownloadUrl);
          // Load result layer onto the map
          _app.addCogLayer?.('Raster Algebra Result', resultUrls.length > 0? resultUrls[resultUrls.length-1]: resultDownloadUrl);

          // Enable download link
          if (ENABLE_DOWNLOAD) {
            downloadLink.href = resultDownloadUrl;
            downloadLink.setAttribute('aria-disabled', 'false');
            downloadLink.removeAttribute('tabindex');
          }

          const warningText =
            warnings.length > 0 ? ` Warnings: ${warnings.join(' ')}` : '';
          status.textContent = `Done.${warningText}`;
        })
        .catch((err: unknown) => {
          status.textContent = `Calculation error: ${(err as Error).message}`;
        })
        .finally(() => {
          calculateBtn.disabled = false;
        });
    });

    // ── Assemble and append ────────────────────────────────────────────────
    syncBoundingRasterSelector();
    wrapper.append(
      status,
      uploader,
      rasterList,
      boundingRasterLabel,
      boundingRasterSelector,
      missingDataLabel,
      missingDataSelector,
      keyboardToggle,
      operationsContainer,
      expressionLabel,
      expressionArea,
      calculateBtn,
      downloadLink,
    );
  }
  else if(method === "Multi Criteria Evaluation"){
    const MAX_RASTER_COUNT = 4;
    const inputs: Array<{ file: File | null; weight: string; noData: string }> = [];
    const rowWeightControls: Array<{ number: HTMLInputElement; slider: HTMLInputElement }> = [];
    let ahpMatrix: number[][] = [];
    let selectedBandMode: MceBandMode = "first";
    let selectedMissingDataMode: MceMissingDataMode = "0";
    let selectedBoundingRasterKey: string | null = null;
    let resultUrl: string | null = null;

    const status = document.createElement("p");
    applyRightPanelStyle(status, "status");
    const countGroup = document.createElement("div");
    applyRightPanelStyle(countGroup, "countGroup");
    const countLabel = document.createElement("label");
    applyRightPanelStyle(countLabel, "label");
    countLabel.textContent = "Number of rasters";
    const countInput = document.createElement("input");
    countInput.type = "range";
    countInput.min = "1";
    countInput.max = String(MAX_RASTER_COUNT);
    countInput.value = "2";
    applyRightPanelStyle(countInput, "range");
    const countValue = document.createElement("output");
    applyRightPanelStyle(countValue, "output");
    countValue.textContent = countInput.value;
    countGroup.append(countLabel, countInput, countValue);

    const rows = document.createElement("div");
    applyRightPanelStyle(rows, "mceRows");
    const boundingRasterLabel = document.createElement("label");
    applyRightPanelStyle(boundingRasterLabel, "label");
    boundingRasterLabel.textContent = "Bounding box raster";
    const boundingRasterSelector = document.createElement("select");
    boundingRasterSelector.name = "mce-bounding-raster";
    applyRightPanelStyle(boundingRasterSelector, "methodSelect");
    boundingRasterSelector.addEventListener("change", () => {
      selectedBoundingRasterKey = boundingRasterSelector.value || null;
    });
    const missingDataLabel = document.createElement("label");
    applyRightPanelStyle(missingDataLabel, "label");
    missingDataLabel.textContent = "Missing data handling";
    const missingDataSelector = document.createElement("select");
    missingDataSelector.name = "mce-missing-data-mode";
    applyRightPanelStyle(missingDataSelector, "methodSelect");
    drawDropdownOptions(missingDataSelector, ["0", "NaN"]);
    missingDataSelector.value = "0";
    missingDataSelector.addEventListener("change", () => {
      selectedMissingDataMode = missingDataSelector.value as MceMissingDataMode;
    });
    const syncBoundingRasterSelector = () => {
      const entries = inputs
        .map((input, index) => (input.file ? { key: input.file.name, label: `Raster ${index + 1}` } : null))
        .filter((entry): entry is { key: string; label: string } => entry !== null);
      boundingRasterSelector.replaceChildren();
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Default";
      applyRightPanelStyle(emptyOption, "selectOption");
      boundingRasterSelector.appendChild(emptyOption);
      if (entries.length === 0) {
        boundingRasterSelector.disabled = true;
        selectedBoundingRasterKey = null;
        boundingRasterSelector.value = "";
        return;
      }
      entries.forEach(({ key, label }) => {
        const option = document.createElement("option");
        applyRightPanelStyle(option, "selectOption");
        option.value = key;
        option.textContent = label;
        boundingRasterSelector.appendChild(option);
      });
      const currentSelection = entries.some((entry) => entry.key === selectedBoundingRasterKey)
        ? selectedBoundingRasterKey
        : null;
      selectedBoundingRasterKey = currentSelection;
      boundingRasterSelector.value = currentSelection ?? "";
      boundingRasterSelector.disabled = false;
    };
    const ahpToggle = document.createElement("input");
    ahpToggle.type = "checkbox";
    ahpToggle.name = "mce-use-ahp";
    applyRightPanelStyle(ahpToggle, "checkbox");
    const ahpLabel = document.createElement("label");
    applyRightPanelStyle(ahpLabel, "ahpLabel");
    ahpLabel.append(ahpToggle, document.createTextNode(" Use AHP Calculator to generate weights"));
    const ahpContainer = document.createElement("div");
    applyRightPanelStyle(ahpContainer, "ahpContainer");
    setRightPanelVisibility(ahpContainer, "hidden");

    const bandGroup = document.createElement("fieldset");
    applyRightPanelStyle(bandGroup, "fieldset");
    const bandLegend = document.createElement("legend");
    applyRightPanelStyle(bandLegend, "legend");
    bandLegend.textContent = "Band processing";
    bandGroup.appendChild(bandLegend);
    ([
      ["first", "Process only the first band"],
      ["all", "Process all bands"],
      ["average", "Average bands to one band"],
    ] as Array<[MceBandMode, string]>).forEach(([value, labelText]) => {
      const label = document.createElement("label");
      applyRightPanelStyle(label, "radioLabel");
      const radio = document.createElement("input");
      radio.type = "radio";
      applyRightPanelStyle(radio, "radio");
      radio.name = "mce-band-mode";
      radio.value = value;
      radio.checked = value === selectedBandMode;
      radio.addEventListener("change", () => {
        if (radio.checked) {
          selectedBandMode = value;
          setRightPanelVisibility(averagingGroup, value === "average" ? "visibleFlex" : "hidden");
        }
      });
      label.append(radio, document.createTextNode(` ${labelText}`));
      bandGroup.appendChild(label);
    });
    const averagingGroup = document.createElement("label");
    applyRightPanelStyle(averagingGroup, "averagingGroup");
    averagingGroup.textContent = "Average bands";
    const averagingMode = document.createElement("select");
    drawDropdownOptions(averagingMode, ["before", "after"], ["Before normalization", "After normalization"]);
    applyRightPanelStyle(averagingMode, "methodSelect");
    averagingGroup.appendChild(averagingMode);
    setRightPanelVisibility(averagingGroup, "hidden");

    const calculateButton = document.createElement("button");
    calculateButton.type = "button";
    applyRightPanelStyle(calculateButton, "button");
    calculateButton.textContent = "Calculate";
    const downloadLink = document.createElement("a");
    applyRightPanelStyle(downloadLink, "downloadButton");
    downloadLink.textContent = "Download MCE raster";
    downloadLink.download = "mce-raster.tif";
    downloadLink.setAttribute("aria-disabled", "true");
    if (!ENABLE_DOWNLOAD) setRightPanelVisibility(downloadLink, "hidden");

    const clampCount = (value: number) => Math.min(MAX_RASTER_COUNT, Math.max(1, Math.trunc(value)));
    const resizeMatrix = (count: number) => {
      ahpMatrix = Array.from({ length: count }, (_, row) =>
        Array.from({ length: count }, (_, column) => {
          if (row === column) return 1;
          return ahpMatrix[row]?.[column] ?? (ahpMatrix[column]?.[row] ? 1 / ahpMatrix[column][row] : 1);
        }),
      );
    };
    const renderAhp = () => {
      const count = clampCount(Number(countInput.value));
      resizeMatrix(count);
      ahpContainer.replaceChildren();
      setRightPanelVisibility(ahpContainer, ahpToggle.checked ? "visibleFlex" : "hidden");
      if (!ahpToggle.checked) return;
      const table = document.createElement("table");
      applyRightPanelStyle(table, "table");
      const header = document.createElement("tr");
      applyRightPanelStyle(header, "tableRow");
      const emptyHeader = document.createElement("th");
      applyRightPanelStyle(emptyHeader, "tableHeader");
      header.appendChild(emptyHeader);
      for (let column = 0; column < count; column += 1) {
        const cell = document.createElement("th");
        applyRightPanelStyle(cell, "tableHeader");
        cell.textContent = `Raster ${column + 1}`;
        header.appendChild(cell);
      }
      table.appendChild(header);
      for (let row = 0; row < count; row += 1) {
        const tableRow = document.createElement("tr");
        applyRightPanelStyle(tableRow, "tableRow");
        const label = document.createElement("th");
        applyRightPanelStyle(label, "tableHeader");
        label.textContent = `Raster ${row + 1}`;
        tableRow.appendChild(label);
        for (let column = 0; column < count; column += 1) {
          const cell = document.createElement("td");
          applyRightPanelStyle(cell, "tableCell");
              const input = document.createElement("input");
          applyRightPanelStyle(input, "ahpInput");
          input.value = ahpMatrix[row][column].toFixed(2);
          input.disabled = row >= column;
          if (row >= column) {
            applyRightPanelStyle(input, "ahpInputDisabled");
          }
          input.type = row < column ? "number" : "text";
          input.dataset.row = String(row);
          input.dataset.col = String(column);
          if (row < column) {
            input.min = "0.01";
            input.addEventListener("input", () => {
              const value = Number(input.value);
              const safeValue = Number.isFinite(value) && value > 0 ? value : 1;
              ahpMatrix[row][column] = safeValue;
              ahpMatrix[column][row] = 1 / safeValue;
              const reciprocal = ahpContainer.querySelector<HTMLInputElement>(`input[data-row='${column}'][data-col='${row}']`);
              if (reciprocal) reciprocal.value = (1 / safeValue).toFixed(2);
            });
          }
          cell.appendChild(input);
          tableRow.appendChild(cell);
        }
        table.appendChild(tableRow);
      }
      const calculateAhp = document.createElement("button");
      calculateAhp.type = "button";
      applyRightPanelStyle(calculateAhp, "button");
      applyRightPanelStyle(calculateAhp, "ahpButton");
      calculateAhp.textContent = "Calculate AHP Weights";
      calculateAhp.addEventListener("click", () => {
        const weights = calculateAhpWeights(ahpMatrix);
        weights.forEach((weight, index) => {
          if (!inputs[index]) inputs[index] = { file: null, weight: "0", noData: "" };
          inputs[index].weight = weight.toFixed(2);
          rowWeightControls[index]?.number && (rowWeightControls[index].number.value = inputs[index].weight);
          rowWeightControls[index]?.slider && (rowWeightControls[index].slider.value = inputs[index].weight);
        });
        updateCalculateState();
      });
      ahpContainer.append(table, calculateAhp);
    };
    const updateCalculateState = () => {
      calculateButton.disabled = !inputs.every((input) => input.file && Number.isFinite(Number(input.weight)));
    };
    const renderRows = () => {
      const count = clampCount(Number(countInput.value));
      countInput.value = String(count);
      countValue.textContent = String(count);
      const previous = inputs.slice();
      inputs.length = 0;
      rowWeightControls.length = 0;
      rows.replaceChildren();
      for (let index = 0; index < count; index += 1) {
        const item = previous[index] ?? { file: null, weight: (1 / count).toFixed(2), noData: "" };
        inputs.push(item);
        const row = document.createElement("div");
        applyRightPanelStyle(row, "mceRow");
        const label = document.createElement("span");
        applyRightPanelStyle(label, "text");
        label.textContent = `Raster ${index + 1}`;
        const file = document.createElement("input");
        file.type = "file";
        file.accept = ".tif,.tiff,image/tiff";
        applyRightPanelStyle(file, "input");
        file.addEventListener("change", () => { inputs[index].file = file.files?.[0] ?? null; updateCalculateState(); syncBoundingRasterSelector(); });
        const noDataInput = document.createElement("input");
        noDataInput.type = "number";
        noDataInput.step = "any";
        noDataInput.placeholder = "NoData";
        noDataInput.value = item.noData;
        applyRightPanelStyle(noDataInput, "mceWeightInput");
        noDataInput.setAttribute("aria-label", `NoData value for raster ${index + 1}`);
        noDataInput.addEventListener("input", () => {
          const value = noDataInput.value.trim();
          inputs[index].noData = value;
        });
        const number = document.createElement("input");
        number.type = "number";
        applyRightPanelStyle(number, "mceWeightInput");
        number.min = "0";
        number.max = "1";
        number.step = "0.01";
        number.value = item.weight;
        const slider = document.createElement("input");
        slider.type = "range";
        slider.min = "0";
        slider.max = "1";
        slider.step = "0.01";
        slider.value = item.weight;
        applyRightPanelStyle(slider, "range");
        number.addEventListener("input", () => { inputs[index].weight = number.value; slider.value = number.value; updateCalculateState(); });
        slider.addEventListener("input", () => { inputs[index].weight = slider.value; number.value = slider.value; updateCalculateState(); });
        rowWeightControls.push({ number, slider });
        row.append(label, file, noDataInput, number, slider);
        rows.appendChild(row);
      }
      resizeMatrix(count);
      updateCalculateState();
      syncBoundingRasterSelector();
      renderAhp();
    };
    ahpToggle.addEventListener("change", renderAhp);
    countInput.addEventListener("input", renderRows);
    calculateButton.addEventListener("click", async () => {
      const entries = inputs.map((input) => ({ file: input.file, weight: Number(input.weight) }));
      if (entries.some((entry) => !entry.file || !Number.isFinite(entry.weight))) {
        status.textContent = "Please provide a valid file and weight for each raster.";
        return;
      }
      status.textContent = "Preparing MCE raster…";
      calculateButton.disabled = true;
      try {
        const blob = await buildMceRaster(entries as Array<{ file: File; weight: number }>, {
          bandMode: selectedBandMode,
          mode: averagingMode.value === "after" ? "after" : "before",
          missingDataMode: selectedMissingDataMode,
        }, selectedBoundingRasterKey ?? undefined);
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        resultUrl = URL.createObjectURL(blob);
        await _app.addCogLayer?.("Plugin-MCE-Raster", resultUrl, { opacity: 1, colormap: "terrain", rescaleMin: 0, rescaleMax: 1, bands: "1" });
        if (ENABLE_DOWNLOAD) {
          downloadLink.href = resultUrl;
          downloadLink.setAttribute("aria-disabled", "false");
        }
        status.textContent = "MCE raster generated successfully.";
      } catch (error) {
        status.textContent = `Processing failed: ${(error as Error).message}`;
      } finally {
        updateCalculateState();
      }
    });
    renderRows();
    wrapper.append(status, countGroup, rows, boundingRasterLabel, boundingRasterSelector, missingDataLabel, missingDataSelector, ahpLabel, ahpContainer, bandGroup, averagingGroup, calculateButton, downloadLink);
  }
}


function removeAllChildElements(parent:  HTMLElement){
  if(!parent) return;

  while(parent.firstChild){
    parent.removeChild(parent.firstChild);
  }
}

/**
 * Register and open the template's right-sidebar panel.
 *
 * @param app - The GeoLibre host API passed to the plugin's `activate` hook.
 * @returns A disposer that closes and unregisters the panel, or `null` when the
 *   host does not provide a right sidebar (so the caller can skip cleanup).
 */
export function registerTemplateRightPanel<TControl extends GeoLibreControl>(
  app: GeoLibreAppAPI<TControl>,
): (() => void) | null {
  // Right panels are an optional host capability; degrade gracefully when the
  // host (or standalone usage) does not provide them.
  _app = app as GeoLibreAppAPI;
  if (!app.registerRightPanel) return null;

  const unregister = app.registerRightPanel({
    id: RIGHT_PANEL_ID,
    title: "RA & MCE",
    defaultWidth: 320,
    render(container) {
      //Wrapper
      const wrap = document.createElement("div");
      applyRightPanelStyle(wrap, "panel");

      //Description
      const heading = document.createElement("h2");
      applyRightPanelStyle(heading, "heading");
      heading.textContent = "Raster Algebra & MCE Workbench";

      //Method Select
      const method = document.createElement("select");
      applyRightPanelStyle(method, "methodSelect");
      _method = method;
      drawDropdownOptions(method, BASE_METHODS, BASE_METHODS_TC);

      //Method Form Container
      const methodFormContainer = document.createElement("div");
      applyRightPanelStyle(methodFormContainer, "formContainer");
      _methodForm = methodFormContainer;
      const body = document.createElement("p");
      applyRightPanelStyle(body, "description");

      wrap.append(heading, body, method, methodFormContainer);
      container.appendChild(wrap);

      //Event: Method selected
      method.addEventListener("change", () => {
        loadOptionForm(methodFormContainer, method.value);
      })

      // Optional cleanup, run when the panel closes or is unregistered.
      return () => {
        resultUrls.forEach(resultUrl => {
          if(resultUrl) URL.revokeObjectURL(resultUrl);
        })
        wrap.remove();
      };
    },
  });

  // Open it right away so the example is visible on activation. Remove this call
  // (or gate it behind a button in your control) if you would rather open the
  // panel on demand instead of every time the plugin activates.
  app.openRightPanel?.(RIGHT_PANEL_ID);

  return () => {
    app.closeRightPanel?.(RIGHT_PANEL_ID);
    unregister();
  };
}
