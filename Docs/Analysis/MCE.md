### Geolibre Plugin - Multi Criteria Evaluation Function

We want to pretty much copy themcer function in the already implemented plugin in `/Docs/Samples/ExistingWorkingPlugins/mce/` to our plugin (named as Multi Criteria Evaluation), following our plugin's architecture. Copy only the right panel ui and the functionality, no need to copy the plugin control behavior. Additionally, Make it so that the download functionally is enabled and disabled by the developer variable in `/src/lib/geolibre/right-panel.ts`.

### Multi Criteria Evaluation porting restrictions:
1. If the porting requires drawing a dropdown for a form or loading a new form based on an input value, use the methods already available in `/src/lib/geolibre/right-panel.ts`.
2. For geotiff/raster reading from file and writing to file logic, use `/src/lib/utils/geotiff-processor` instead of the sample plugin's. Note that the rasters that is loaded to GeoLibre must be tiled rasters.
3. The processing should be done in `/src/lib/SpatioProcessing/mce.ts` which will utilize `/src/lib/utils/geotiff-processor`. `/src/lib/geolibre/right-panel.ts` should only be in charge of UI processing and loading the generated calculation result via the plugin api `addCogLayer` method. 
4. The UI logic should only be done within the scope of 
```typescript
    else if(method === "Multi Criteria Evaluation"){
        
    }
```
located in `/src/lib/geolibre/right-panel.ts` around line 320.
