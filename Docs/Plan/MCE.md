# Implementation Plan: Geolibre Plugin - Multi Criteria Evaluation Function

This document details the step-by-step implementation plan for the **Multi Criteria Evaluation (MCE)** feature inside the GeoLibre plugin. This plan is designed to be executed by a junior developer or a cheaper AI agent.

---

## 1. Key Objectives & Restrictions

1. **Port Functionality**: Copy the core MCE functionality, AHP (Analytic Hierarchy Process) weights calculator, and right-panel UI from `/Docs/Samples/ExistingWorkingPlugins/mce/` into our project.
2. **Architecture Separation**:
   - `/src/lib/geolibre/right-panel.ts`: Strictly responsible for UI rendering, event handling, state management, and loading results onto the map using the host API `addCogLayer`.
   - `/src/lib/SpatioProcessing/mce.ts`: Holds the mathematical engine (raster normalization, weighted summing, and grid resampling) utilizing `/src/lib/utils/geotiff-processor.ts` for reading and writing tiled GeoTIFF files.
3. **Tiled Raster Requirement**: All calculated rasters loaded into GeoLibre must be tiled. We must use `writeFloat32TiledGeoTIFF` from `geotiff-processor.ts` to output tiled TIFFs.
4. **Developer Toggle**: Provide a global/module-level boolean variable `ENABLE_DOWNLOAD` in `/src/lib/geolibre/right-panel.ts` to easily enable or disable the download button.
5. **Form/UI Guidelines**: Use the existing UI drawing helpers (like `drawDropdownOptions`) and handle the MCE UI within the scope of:
   ```typescript
   else if(method === "Multi Criteria Evaluation"){
       // UI Code goes here
   }
   ```
   *Note: While the branch is initially around line 44 in `right-panel.ts`, once the Raster Algebra UI is fully implemented, this branch will shift down to around line 320.*

---

## 2. File Modifications and Additions

### A. Core Mathematical Engine
#### [MODIFY] [`/src/lib/SpatioProcessing/mce.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin Spatio/RasterAlgerbraandMCE/src/lib/SpatioProcessing/mce.ts)

You need to implement the normalization, band handling, resampling, and weight summing logic here.

1. **Adapt Raster Data Types**:
   - Define structures for MCE inputs and options:
     ```typescript
     import { RasterSource } from '../utils/geotiff-processor';
     export type MceBandMode = 'all' | 'average' | 'first';
     export interface MceRasterInput {
       file: File;
       weight: number;
     }
     export interface MceRasterProcessingOptions {
       bandMode?: MceBandMode;
       mode?: 'before' | 'after';
     }
     ```
2. **Resampling / Aligning logic**:
   - Since uploaded rasters might have different extents or resolutions, write nearest-neighbor resampling logic.
   - Use the `geotransform` properties from the first uploaded raster (the base raster) as the reference template.
   - Translate target coordinates to index offsets for each layer to align them to the base grid.
3. **Normalization Engine**:
   - For each pixel value $V$, normalise it to $V_{norm} = \frac{V - Min}{Max - Min}$.
   - If a pixel is equal to the `noDataValue` or is non-finite, write it as `0` or ignore it in the summing.
   - Implement the three band modes:
     - `'first'`: Only use the first band of the raster.
     - `'all'`: Process all bands.
     - `'average'`: Average bands to a single band (either before or after the normalization process, depending on the `mode` option).
4. **Summation & Output**:
   - Create a combined Float32Array where `combined[i] += normalizedLayer[i] * weight`.
   - Call `writeFloat32TiledGeoTIFF` from `geotiff-processor.ts` to output a tiled TIFF. Return the result as a `Blob`.

---

### B. User Interface
#### [MODIFY] [`/src/lib/geolibre/right-panel.ts`](file:///c:/Users/erwin/OneDrive/Documents/Learning/Plugin Spatio/RasterAlgerbraandMCE/src/lib/geolibre/right-panel.ts)

1. **State Definition**:
   Define variables to track:
   - `mceRasters: Array<{ file: File | null; weight: string }>` (up to 4 rasters).
   - `useAhp: boolean` (Analytic Hierarchy Process toggle).
   - `ahpMatrix: number[][]` (N x N relative importance matrix).
   - `selectedBandMode: MceBandMode`.
   - `averagingMode: 'before' | 'after'`.
2. **Dynamic UI Form Generation**:
   - Create a slider to set the number of rasters (range 1-4).
   - Render matching rows dynamically. Each row should contain:
     - File input for `.tif` upload.
     - Interlocked weight slider and number input box (range 0 to 1, step 0.01).
3. **AHP Calculator Table**:
   - Render a table showing a pairwise comparison matrix of size $N \times N$.
   - The user can adjust values in the upper-right triangle (comparing Raster $i$ to Raster $j$).
   - The lower-left triangle is automatically set as reciprocal: $Matrix[j][i] = 1 / Matrix[i][j]$.
   - Include a **Calculate AHP Weights** button:
     - Normalize columns: $ColSum_j = \sum_{i} Matrix[i][j]$, then $Matrix_{norm}[i][j] = Matrix[i][j] / ColSum_j$.
     - Average rows: $Weight_i = \frac{1}{N} \sum_{j} Matrix_{norm}[i][j]$.
     - Scale/adjust so weights sum to exactly `1.00`, then update UI weight inputs.
4. **Control Options**:
   - Render "Band processing" radio buttons (`first`, `all`, `average`).
   - Render a dropdown select for "Average bands" timing (`before` / `after` normalization).
5. **Calculate & Download Buttons**:
   - Render **Calculate** button (runs `buildMceRaster`, creates object URL, and calls `app.addCogLayer`).
   - Render **Download MCE raster** button. Toggle visibility/usability based on the module-level variable `const ENABLE_DOWNLOAD`.

---

## 3. Verification Plan

### Automated Tests
1. Create unit tests for AHP weight calculation logic to verify the priority vector correctly normalizes and rounds weights to sum to 1.0.
2. Test the MCE normalizer with various band mode combinations (first, all, average before, average after).
3. Test weighted raster aggregation on mismatched grids to verify proper resampling.

### Manual Testing
1. Select "Multi Criteria Evaluation" from the workbench.
2. Set number of rasters to 3, toggle "Use AHP Calculator", input comparisons, and click "Calculate AHP Weights". Verify inputs update and sum to 1.0.
3. Select files, set band processing to "Average bands to one band" / "Before normalization", and click **Calculate**.
4. Verify the output layer loads on the map with the `terrain` colormap in the `[0, 1]` rescale range.
5. Verify the download button conforms to the `ENABLE_DOWNLOAD` flag.
