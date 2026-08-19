### Geolibre Plugin - Raster Algebra Function

We want to pretty much copy the Raster Calculator function in the already implemented plugin in `/Docs/Samples/ExistingWorkingPlugins/RasterCalculator/` to our plugin (named as Raster Algebra), following our plugin's architecture. Copy only the right panel ui and the functionality, no need to copy the plugin control behavior. Additionally, Make it so that the download functionally is enabled and disabled by a developer variable in `/src/lib/geolibre/right-panel.ts`.

### Raster Algebra porting restrictions:
1. If the porting requires drawing a dropdown for a form or loading a new form based on an input value, use the methods already available in `/src/lib/geolibre/right-panel.ts`.
2. For geotiff/raster reading from file and writing to file logic, use `/src/lib/utils/geotiff-processor` instead of the sample plugin's. Note that the rasters that is loaded to GeoLibre must be tiled rasters.
3. The processing should be done in `/src/lib/SpatioProcessing/raster-algebra.ts` which will utilize `/src/lib/utils/geotiff-processor`. `/src/lib/geolibre/right-panel.ts` should only be in charge of UI processing and loading the generated calculation result via the plugin api `addCogLayer` method. 
4. The UI logic should only be done within the scope of 
```typescript
    else if(method === "Raster Algebra"){
        
    }
```
located in `/src/lib/geolibre/right-panel.ts` around line 41.
