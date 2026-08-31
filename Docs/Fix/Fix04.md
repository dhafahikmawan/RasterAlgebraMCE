### Fix and Update List 04

### Update
1. For each raster file input, add a `NoData` field, which will decide which value (number) is treated as `NoData`/`NaN` for the corresponding raster, default is empty, which means no additional `NoData`/`NaN` treatment.

### Problems
1. The plugin uses the bounding box of a specific input raster as the bounding box. Which means that if another operand do not have a data in the specific place in the bounding box, it is currently considered as NaN. Add a dropdown after the bounding box selection which decides how the missing data due to the bounding box change is handled. The options are:
    - `NaN`: treat it as `NaN`, which is the current behavior.
    - `0` : treat the missing data as 0.
    - `Skip` : When a raster that have a value in the processed pixel in the bounding box meets a missing data that is caused by the bounding box change, any operation return the existing value, skipping the calculation.
Note that these behavior should only apply by missing data that is caused by the bounding box change. Any `NaN` that is already in the uploaded raster is subject to `NAN_HANDLING_MODE` value behavior.
