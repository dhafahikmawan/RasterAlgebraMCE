# Implementation Plan: Resolve Fix 02

## 1. Problem

The Raster Algebra form currently stores only one result URL in `resultDownloadUrl`. After a second calculation it revokes the previous object URL, replaces it with the new one, and passes the replacement to GeoLibre. Any previously added GeoLibre layer still points at the revoked URL, so its values are no longer readable. The download link must continue to point to the most recently generated result.

## 2. Desired Behavior

- Every successful Raster Algebra calculation receives its own object URL and remains usable by the GeoLibre layer created for that calculation.
- A new calculation does not revoke URLs that have already been handed to GeoLibre.
- The Download Result link always targets the latest successful calculation.
- Failed calculations do not add a result URL or change the current download target.
- URLs retained by the form are revoked during cleanup when the form is discarded or the right panel is unregistered, preventing unbounded memory usage during the plugin session.

## 3. Implementation Scope

### A. Update Raster Algebra result state

Modify `src/lib/geolibre/right-panel.ts` inside the `method === "Raster Algebra"` branch.

1. Replace the single `resultDownloadUrl` variable with an ordered collection of generated results, for example `resultUrls: string[]`, and a separate `latestResultUrl: string | null`.
2. Keep the array entry that was just appended as the source passed to `_app.addCogLayer`:
   - create the blob URL after `calculateRaster` succeeds;
   - append it to `resultUrls`;
   - set `latestResultUrl` to that appended entry;
   - call `addCogLayer("Raster Algebra Result", latestResultUrl)`.
3. Update the download link from `latestResultUrl` only after the layer has been successfully created or accepted according to the existing host API behavior.
4. Remove the current per-calculation `URL.revokeObjectURL(resultDownloadUrl)` logic. Revoking an earlier result during the next calculation is the source of the bug.
5. Add a local cleanup function for the Raster Algebra form that revokes every URL in `resultUrls` exactly once and clears the collection. Ensure cleanup is invoked when the form is replaced by selecting another method and when the panel render cleanup runs.
6. Preserve the existing download guard behavior: before a successful result, the link remains disabled; when `ENABLE_DOWNLOAD` is false, it remains hidden; after success, it downloads the newest result.

### B. Keep result ownership explicit

Treat the result URL collection as the owner of URLs created by this form. Do not store only the latest URL in a shared module-level variable, and do not revoke URLs that were not created by this form. Keep the change limited to Raster Algebra; the separate MCE result lifecycle is outside Fix 02 unless the same ownership pattern is intentionally reused without changing MCE behavior.

### C. Handle asynchronous calculations

The current Calculate handler is asynchronous. Define the expected behavior for multiple clicks/calculations and implement it consistently:

- either keep the existing disabled-button behavior and verify that only sequential calculations are possible;
- or, if concurrent calculations are allowed later, associate each completion with its own newly created URL and append results in completion order without revoking earlier URLs.

In either case, a completion must never overwrite or revoke a URL already supplied to GeoLibre. A stale or failed completion must not replace the download link for a newer successful result.

## 4. Tests

Extend `tests/right-panel.test.ts` with a focused Raster Algebra regression test.

1. Mock the raster-loading and calculation dependencies at the module boundary so the test does not need real GeoTIFF files or browser processing.
2. Mock `URL.createObjectURL` to return distinct URLs such as `blob:result-1` and `blob:result-2`, and spy on `URL.revokeObjectURL`.
3. Render the registered right panel, select Raster Algebra, trigger two successful calculations, and await both handlers.
4. Assert that `addCogLayer` is called twice and receives the distinct URL from each calculation, including the second array entry rather than a reused/revoked URL.
5. Assert that the download link points to `blob:result-2` after the second calculation.
6. Assert that the first URL is not revoked when the second result is generated.
7. Invoke the relevant panel/form cleanup and assert that both retained URLs are revoked once.
8. Add a failure case, if practical, proving that a rejected calculation leaves the existing latest download URL unchanged and does not create an extra retained URL.

If the existing test setup makes DOM cleanup inaccessible, extract a small testable result-store/cleanup helper from `right-panel.ts` or expose cleanup through the registered panel render disposer. Keep the production API unchanged.

## 5. Verification

Run the narrow regression test first:

```text
npx vitest run tests/right-panel.test.ts
```

Then run the full test suite and type/build checks:

```text
npm test
npm run build
```

Manual verification in GeoLibre:

1. Open Raster Algebra and load one or more rasters.
2. Calculate a result and confirm the layer displays readable values.
3. Change the expression and calculate again.
4. Confirm both map layers still have readable values, not just the latest layer.
5. Click Download Result and confirm it downloads the second, latest result.
6. Switch away from Raster Algebra or close/unregister the panel, then confirm retained object URLs are released through the cleanup path.

## 6. Acceptance Criteria

- Multiple generated Raster Algebra layers remain readable in GeoLibre.
- Each `addCogLayer` call receives the URL belonging to that calculation.
- The download link always downloads the latest successful result.
- No earlier result URL is revoked while its layer may still use it.
- All URLs owned by the form are eventually revoked during teardown.
- Existing Raster Algebra validation, warning display, download toggle, and MCE behavior remain unchanged.
