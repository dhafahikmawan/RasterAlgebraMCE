### Fix and Update List 01

1. currently, when doing a comparison function in the raster calculator, it returns 0 for any comparison involving NaN. make it return NaN instead of 0.