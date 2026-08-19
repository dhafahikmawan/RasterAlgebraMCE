# Implementation Plan: Geolibre Plugin - Raster Algebra Function

This document details the step-by-step implementation plan for the **Raster Algebra** feature inside the GeoLibre plugin. This plan is designed to be executed by a junior developer or a cheaper AI agent.

---

## 1. Key Objectives & Restrictions

1. **Port Functionality**: Copy the core functionality and right-panel UI from the existing sample plugin `/Docs/Samples/ExistingWorkingPlugins/RasterCalculator/` into our project.
2. **Architecture Separation**:
   - `/src/lib/geolibre/right-panel.ts`: Strictly responsible for UI rendering, event handling, state management, and loading results to the map using the host API `addCogLayer`.
   - `/src/lib/SpatioProcessing/raster-algebra.ts`: Holds the mathematical engine (expression compilation, tokenizer, AST parser, raster alignment, and calculation logic) utilizing `/src/lib/utils/geotiff-processor.ts` for file processing.
3. **Tiled Raster Requirement**: All calculated rasters loaded into GeoLibre must be tiled. We must use `writeFloat32TiledGeoTIFF` from `geotiff-processor.ts` to output tiled TIFFs.
4. **Developer Toggle**: Provide a global/module-level boolean variable `ENABLE_DOWNLOAD` in `/src/lib/geolibre/right-panel.ts` to easily enable or disable the download button.
5. **Form/UI Guidelines**: Use the existing UI drawing helpers (like `drawDropdownOptions`) and handle the Raster Algebra UI within the scope of:
   ```typescript
   if (method === "Raster Algebra") {
       // Code goes here
   }
   ```
   *Note:  the actual target branch for Raster Algebra is `if(method === "Raster Algebra")` is around line 41.*

---

## 2. File Modifications and Additions

### A. Core Mathematical Engine
#### [MODIFY] [`/src/lib/SpatioProcessing/raster-algebra.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin Spatio/RasterAlgerbraandMCE/src/lib/SpatioProcessing/raster-algebra.ts)

You need to port the expression compiler and math executor to this file, adapting it to work with interleaved `RasterSource` structures returned by `/src/lib/utils/geotiff-processor.ts`.

1. **Expression Tokenizer & Parser**:
   - Port `tokenize`, `Parser` class, and `compileExpression` from the sample's `expression-parser.ts`.
   - Support operators (`+`, `-`, `*`, `/`, `^`), comparisons (`<`, `<=`, `=`, `!=`, `>=`, `>`), basic functions (`min`, `max`, `abs`), trigonometric functions (`sin`, `cos`, etc.), logs (`ln`, `log`, `log10`), and control flow (`IF`, `AND`, `OR`).
2. **Adapt Raster Data Types**:
   - Define a structure for loaded rasters, for example:
     ```typescript
     import { RasterSource } from '../utils/geotiff-processor';
     export interface RasterInput {
       key: string;
       fileName: string;
       alias?: string;
       source: RasterSource;
     }
     ```
3. **Resampling / Aligning logic**:
   - Write resampling logic utilizing the `geotransform` coordinates:
     - `geotransform[0]` = originX
     - `geotransform[1]` = scaleX (pixel width)
     - `geotransform[3]` = originY
     - `geotransform[5]` = scaleY (pixel height, typically negative)
   - Coordinate translation formulas:
     - $X_{geo} = originX + (col + 0.5) \times scaleX$
     - $Y_{geo} = originY + (row + 0.5) \times scaleY$
     - Corresponding pixel column in another raster: $col_{target} = \lfloor \frac{X_{geo} - targetOriginX}{targetScaleX} \rfloor$
     - Corresponding pixel row in another raster: $row_{target} = \lfloor \frac{Y_{geo} - targetOriginY}{targetScaleY} \rfloor$
   - Implement `alignedValues` to map coordinates from a base raster to a target raster using nearest-neighbor sampling.
   - For multi-band rasters, remember that pixel data in `RasterSource.data` is interleaved: the index for pixel `(col, row)` at band `b` (0-indexed) is `(row * width + col) * bandCount + b`.
4. **Calculations**:
   - Implement `calculateRaster(rasters: RasterInput[], expression: CompiledExpression, nanHandlingMode: 'DEFAULT' | 'RASTER_PRIORITY')`.
   - Iterate over the base raster pixels, evaluate the expression in the pixel context, and write the output Float32 array.
   - Run `writeFloat32TiledGeoTIFF` to compile the final ArrayBuffer, and wrap it into a `Blob`.

---

### B. User Interface
#### [MODIFY] [`/src/lib/geolibre/right-panel.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin Spatio/RasterAlgerbraandMCE/src/lib/geolibre/right-panel.ts)

Implement the full controller UI within the `if(method === "Raster Algebra")` block inside `loadOptionForm`.

1. **State Definition**:
   Define a local UI state structure (or component-level variables) to manage:
   - `rasters: RasterInput[]` (up to 5 loaded rasters)
   - `expression: string`
   - `statusMessage: string`
   - `resultDownloadUrl: string | null`
   - `keyboardOpen: boolean`
2. **UI Generation (DOM creation)**:
   - Create a file input element (`<input type="file" multiple accept=".tif,.tiff">`).
   - Create a container for the loaded raster list. For each raster:
     - Display filename key.
     - Add a text input to set/modify the alias.
     - Render buttons to insert the raster bands (`Insert` or `Band X`) at the cursor position.
     - Add a Delete button.
   - Create a collapsible keyboard grid for mathematical operators.
   - Create the expression `textarea`.
   - Create a Calculate button.
   - Create a Download button link.
3. **Developer Variable**:
   - Define a constant `const ENABLE_DOWNLOAD = true;` (or `false`) at the top of `/src/lib/geolibre/right-panel.ts`.
   - If `ENABLE_DOWNLOAD` is `false`, hide or disable the download button.
4. **Actions**:
   - **Upload**: Read file, call `readRasterFromFile` from `geotiff-processor.ts`, populate a `RasterInput` entry, and update the UI.
   - **Calculate**: Compile the text expression, run `calculateRaster` from `raster-algebra.ts`, generate a blob URL via `URL.createObjectURL(blob)`, and load it to the map using `app.addCogLayer('Raster Algebra Result', objectUrl)`.

---

## 3. Verification Plan

### Automated Tests
Create or update tests to verify:
1. Mathematical expression parsing and evaluation (operators, trigonometric functions, ternary conditionals).
2. Raster coordinate alignment using simulated rasters with mismatched extents.
3. Successful generation of tiled TIFF array buffers.

### Manual Testing
1. Activate the plugin, select "Raster Algebra" from the dropdown.
2. Upload test `.tif` rasters.
3. Give aliases to the rasters, click the band buttons to insert them into the expression textarea.
4. Enter an expression (e.g., `"${dem.tif}" + 10`) and click **Calculate**.
5. Verify the layer is added to the map.
6. Verify the download button is enabled/disabled correctly depending on the `ENABLE_DOWNLOAD` variable value.
