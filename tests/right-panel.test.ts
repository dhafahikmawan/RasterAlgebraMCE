import { describe, it, expect, vi } from "vitest";
import type {
  GeoLibreAppAPI,
  GeoLibreControl,
  GeoLibreRightPanelRegistration,
} from "../src/lib/geolibre/host-api";
import {
  RIGHT_PANEL_ID,
  registerTemplateRightPanel,
} from "../src/lib/geolibre/right-panel";

/**
 * Minimal stub of the host API. Captures the right-panel registration so the
 * test can drive its `render` callback the way GeoLibre would.
 */
function createApp(withRightPanel = true) {
  let registered: GeoLibreRightPanelRegistration | null = null;
  const unregister = vi.fn();
  const app: GeoLibreAppAPI<GeoLibreControl> = {
    addMapControl: () => true,
    removeMapControl: () => undefined,
  };

  if (withRightPanel) {
    app.registerRightPanel = (panel) => {
      registered = panel;
      return unregister;
    };
    app.openRightPanel = vi.fn(() => true);
    app.closeRightPanel = vi.fn();
  }

  return {
    app,
    unregister,
    getRegistered: () => registered,
  };
}

describe("registerTemplateRightPanel", () => {
  it("registers and opens the panel, and renders into the container", () => {
    const { app, getRegistered } = createApp();

    const dispose = registerTemplateRightPanel(app);
    expect(dispose).toBeTypeOf("function");

    const panel = getRegistered();
    expect(panel?.id).toBe(RIGHT_PANEL_ID);
    expect(app.openRightPanel).toHaveBeenCalledWith(RIGHT_PANEL_ID);

    const container = document.createElement("div");
    const cleanup = panel?.render(container);
    expect(container.querySelector("h2")?.textContent).toBe("Plugin Workbench");

    // The returned cleanup removes the plugin's own DOM.
    expect(cleanup).toBeTypeOf("function");
    (cleanup as () => void)();
    expect(container.querySelector("h2")).toBeNull();
  });

  it("closes and unregisters the panel when disposed", () => {
    const { app, unregister } = createApp();
    const dispose = registerTemplateRightPanel(app);

    dispose?.();
    expect(app.closeRightPanel).toHaveBeenCalledWith(RIGHT_PANEL_ID);
    expect(unregister).toHaveBeenCalledOnce();
  });

  it("returns null when the host has no right sidebar", () => {
    const { app } = createApp(false);
    expect(registerTemplateRightPanel(app)).toBeNull();
  });

  it("uses registry styles without changing Raster Algebra control types", () => {
    const { app, getRegistered } = createApp();
    registerTemplateRightPanel(app);

    const panel = getRegistered();
    const container = document.createElement("div");
    panel?.render(container);
    const method = container.querySelector<HTMLSelectElement>("select");
    method!.value = "Raster Algebra";
    method!.dispatchEvent(new Event("change"));

    const uploader = container.querySelector<HTMLInputElement>('input[type="file"]');
    const expression = container.querySelector("textarea");
    const calculate = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Calculate",
    );
    const download = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent === "Download Result",
    );
    const options = Array.from(method!.options);

    expect(method?.tagName).toBe("SELECT");
    expect(method?.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(method?.style.border).toContain("1px solid");
    expect(options.every((option) => option.style.backgroundColor === "rgb(255, 255, 255)")).toBe(true);
    expect(options.every((option) => option.style.color === "rgb(0, 0, 0)")).toBe(true);
    expect(uploader?.type).toBe("file");
    expect(uploader?.style.border).toContain("1px solid");
    expect(expression?.tagName).toBe("TEXTAREA");
    expect(expression?.style.border).toContain("1px solid");
    expect(calculate?.tagName).toBe("BUTTON");
    expect(calculate?.style.border).toContain("1px solid");
    expect(download?.style.border).toContain("1px solid");
    expect(container.firstElementChild?.style.padding).toBe("16px");
    expect(container.firstElementChild?.style.boxSizing).toBe("border-box");
  });

  it("renders the missing-data policy selector after the bounding raster selector", () => {
    const { app, getRegistered } = createApp();
    registerTemplateRightPanel(app);

    const panel = getRegistered();
    const container = document.createElement("div");
    panel?.render(container);

    const method = container.querySelector<HTMLSelectElement>("select");
    method!.value = "Raster Algebra";
    method!.dispatchEvent(new Event("change"));

    const boundingSelector = container.querySelector<HTMLSelectElement>('select[name="raster-algebra-bounding-raster"]');
    const missingDataSelector = container.querySelector<HTMLSelectElement>('select[name="raster-algebra-missing-data-mode"]');

    expect(boundingSelector).not.toBeNull();
    expect(missingDataSelector).not.toBeNull();
    expect(Array.from(missingDataSelector!.options).map((option) => option.value)).toEqual(["NaN", "0", "Skip"]);
    expect(missingDataSelector!.value).toBe("Skip");
    expect(boundingSelector!.compareDocumentPosition(missingDataSelector!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("styles MCE controls and preserves dynamic visibility", () => {
    const { app, getRegistered } = createApp();
    registerTemplateRightPanel(app);

    const panel = getRegistered();
    const container = document.createElement("div");
    panel?.render(container);
    const method = container.querySelector<HTMLSelectElement>("select");
    method!.value = "Multi Criteria Evaluation";
    method!.dispatchEvent(new Event("change"));

    const count = container.querySelector<HTMLInputElement>('input[type="range"]');
    const file = container.querySelector<HTMLInputElement>('input[type="file"]');
    const weight = container.querySelector<HTMLInputElement>('input[type="number"]');
    const ahpToggle = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    const ahpContainer = container.querySelector<HTMLElement>(".spazio-ahp-container");
    const averageRadio = container.querySelector<HTMLInputElement>('input[value="average"]');
    const averagingGroup = container.querySelector<HTMLElement>(".spazio-averaging-group");
    const boundingSelector = container.querySelector<HTMLSelectElement>('select[name="mce-bounding-raster"]');

    expect(count?.type).toBe("range");
    expect(count?.style.accentColor).toBe("rgb(29, 78, 216)");
    expect(file?.type).toBe("file");
    expect(file?.style.border).toContain("1px solid");
    expect(weight?.type).toBe("number");
    expect(weight?.style.border).toContain("1px solid");
    expect(ahpToggle?.type).toBe("checkbox");
    expect(ahpContainer?.style.display).toBe("none");
    expect(averagingGroup?.style.display).toBe("none");
    expect(boundingSelector).not.toBeNull();
    expect(boundingSelector?.options.length).toBeGreaterThan(0);
    expect(boundingSelector?.value).toBe(boundingSelector?.options[0]?.value);

    ahpToggle!.checked = true;
    ahpToggle!.dispatchEvent(new Event("change"));
    expect(ahpContainer?.style.display).toBe("flex");
    expect(ahpContainer?.querySelector("table")).not.toBeNull();
    const disabledAhpCell = ahpContainer?.querySelector<HTMLInputElement>('input[data-row="1"][data-col="0"]');
    expect(disabledAhpCell?.disabled).toBe(true);
    expect(disabledAhpCell?.classList.contains("spazio-ahp-input-disabled")).toBe(true);

    averageRadio!.checked = true;
    averageRadio!.dispatchEvent(new Event("change"));
    expect(averagingGroup?.style.display).toBe("flex");
  });
});
