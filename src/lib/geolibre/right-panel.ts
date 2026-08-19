import type { GeoLibreAppAPI, GeoLibreControl } from "./host-api";
import { loadRasterFromFile, compileExpression, calculateRaster } from "../SpatioProcessing/raster-algebra";
import type { RasterInput } from "../SpatioProcessing/raster-algebra";

/**
 * Set to `false` to hide the Download Result button for end-users.
 * Toggle this at the top of the file during development/deployment.
 */
const ENABLE_DOWNLOAD = true;

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
let _app : GeoLibreAppAPI;
export const RIGHT_PANEL_ID = "geolibre-plugin-template-workbench";
export const BASE_METHODS = ["", "Raster Algebra", "Multi Criteria Evaluation"];
export const BASE_METHODS_TC = ["Select Processing Function", "Raster Algebra", "Multi Criteria Evaluation"]

function drawDropdownOptions(dropdown : HTMLElement, options: string[], tcs?: string[]){
  options.forEach((option, index) =>{
    const optionElement = document.createElement("option");
    optionElement.value = option;
    if(!tcs || index >= tcs.length){
      optionElement.textContent = option;
    }else{
      optionElement.textContent = tcs[index];
    }
    dropdown.appendChild(optionElement);
  })
}


function loadOptionForm(wrapper: HTMLElement, method : string){
  removeAllChildElements(wrapper);
  if(method === "Raster Algebra"){
    // ── State ──────────────────────────────────────────────────────────────
    const rasters: RasterInput[] = [];
    let keyboardOpen = false;
    let resultDownloadUrl: string | null = null;
    let expressionSelectionStart = 0;
    let expressionSelectionEnd = 0;

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
    status.className = 'plugin-control-status';
    status.setAttribute('role', 'status');

    // ── File uploader ──────────────────────────────────────────────────────
    const uploader = document.createElement('input');
    uploader.type = 'file';
    uploader.multiple = true;
    uploader.accept = '.tif,.tiff,image/tiff';
    uploader.className = 'plugin-control-input';
    uploader.setAttribute('aria-label', 'Raster files');

    // ── Raster list container ──────────────────────────────────────────────
    const rasterList = document.createElement('div');
    rasterList.className = 'plugin-control-raster-list';

    // ── Keyboard toggle ────────────────────────────────────────────────────
    const keyboardToggle = document.createElement('button');
    keyboardToggle.type = 'button';
    keyboardToggle.className = 'plugin-control-button';
    keyboardToggle.textContent = 'Open/Close Calculator Keyboard';

    // ── Operator keyboard grid ─────────────────────────────────────────────
    const operationsContainer = document.createElement('div');
    operationsContainer.className = 'plugin-control-operations';
    operationsContainer.style.display = 'none';
    const rows: string[][] = [];
    for (let i = 0; i < OPERATIONS.length; i += 4) {
      rows.push(OPERATIONS.slice(i, i + 4));
    }

    // ── Expression textarea ────────────────────────────────────────────────
    const expressionLabel = document.createElement('label');
    expressionLabel.className = 'plugin-control-label';
    expressionLabel.textContent = 'Expression';

    const expressionArea = document.createElement('textarea');
    expressionArea.className = 'plugin-control-input plugin-control-expression';
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

    // Build operator buttons
    rows.forEach((rowOps, rowIndex) => {
      const row = document.createElement('div');
      row.className = `plugin-control-operation-row plugin-control-operation-row-${rowIndex + 1}`;
      rowOps.forEach((op) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = op;
        btn.addEventListener('click', () => insertText(op));
        row.appendChild(btn);
      });
      operationsContainer.appendChild(row);
    });

    keyboardToggle.addEventListener('click', () => {
      keyboardOpen = !keyboardOpen;
      keyboardToggle.setAttribute('aria-pressed', String(keyboardOpen));
      operationsContainer.style.display = keyboardOpen ? 'flex' : 'none';
    });

    // ── Calculate button ───────────────────────────────────────────────────
    const calculateBtn = document.createElement('button');
    calculateBtn.type = 'button';
    calculateBtn.className = 'plugin-control-button';
    calculateBtn.textContent = 'Calculate';

    // ── Download link ──────────────────────────────────────────────────────
    const downloadLink = document.createElement('a');
    downloadLink.className = 'plugin-control-button';
    downloadLink.textContent = 'Download Result';
    downloadLink.download = 'raster-algebra-result.tif';
    downloadLink.setAttribute('aria-disabled', 'true');
    downloadLink.tabIndex = -1;
    if (!ENABLE_DOWNLOAD) {
      downloadLink.style.display = 'none';
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
        row.className = 'plugin-control-raster-row';
        row.dataset.rasterKey = raster.key;

        const label = document.createElement('span');
        label.textContent = raster.key;

        const aliasInput = document.createElement('input');
        aliasInput.className = 'plugin-control-input';
        aliasInput.placeholder = 'Alias';
        aliasInput.value = raster.alias ?? '';
        aliasInput.addEventListener('input', () => {
          raster.alias = aliasInput.value || undefined;
          renderRasterList();
        });

        const bandsContainer = document.createElement('div');
        bandsContainer.className = 'plugin-control-raster-bands';
        const bandCount = Math.max(1, raster.source.bandCount);
        for (let b = 1; b <= bandCount; b++) {
          const insertBtn = document.createElement('button');
          insertBtn.type = 'button';
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
        deleteBtn.textContent = 'Delete';
        deleteBtn.setAttribute('aria-label', `Delete raster ${raster.key}`);
        deleteBtn.addEventListener('click', () => {
          const idx = rasters.indexOf(raster);
          if (idx !== -1) rasters.splice(idx, 1);
          renderRasterList();
        });

        const controls = document.createElement('div');
        controls.className = 'plugin-control-raster-controls';
        controls.append(aliasInput, bandsContainer, deleteBtn);
        row.append(label, controls);
        rasterList.appendChild(row);
      });
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
      calculateRaster(rasters, compiled, NAN_HANDLING_MODE)
        .then(({ blob, warnings }) => {
          // Revoke previous object URL to free memory
          if (resultDownloadUrl) URL.revokeObjectURL(resultDownloadUrl);
          resultDownloadUrl = URL.createObjectURL(blob);

          // Load result layer onto the map
          _app.addCogLayer?.('Raster Algebra Result', resultDownloadUrl);

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
    wrapper.append(
      status,
      uploader,
      rasterList,
      keyboardToggle,
      operationsContainer,
      expressionLabel,
      expressionArea,
      calculateBtn,
      downloadLink,
    );
  }
  else if(method === "Multi Criteria Evaluation"){
    
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
    title: "Workbench",
    defaultWidth: 320,
    render(container) {
      //Wrapper
      const wrap = document.createElement("div");
      wrap.className = "geolibre-plugin-right-panel";

      //Description
      const heading = document.createElement("h2");
      heading.textContent = "Plugin Workbench";

      //Method Select
      const method = document.createElement("select");
      method.className = "geoprocessing-method-select";
      const methodPlaceholder = document.createElement("option");
      methodPlaceholder.value = "";
      methodPlaceholder.textContent = "Select Geoprocessing function";
      methodPlaceholder.className = "geoprocessing-method-option";
      method.appendChild(methodPlaceholder);
      drawDropdownOptions(method, BASE_METHODS, BASE_METHODS_TC);

      //Method Form Container
      const methodFormContainer = document.createElement("div");
      methodFormContainer.className = "geoprocessing-method-form-container";

      const body = document.createElement("p");
      body.textContent =
        "This panel is rendered by the plugin through app.registerRightPanel(). " +
        "Replace this content with your own workbench, query review, or " +
        "dashboard UI. Drive it with app.openRightPanel(), collapseRightPanel(), " +
        "and closeRightPanel().";

      wrap.append(heading, body, method, methodFormContainer);
      container.appendChild(wrap);

      //Event: Method selected
      method.addEventListener("change", () => {
        loadOptionForm(methodFormContainer, method.value);
      })

      // Optional cleanup, run when the panel closes or is unregistered.
      return () => {
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
