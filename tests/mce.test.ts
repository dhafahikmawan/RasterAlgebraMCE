import { describe, expect, it, vi } from "vitest";
import type { RasterSource } from "../src/lib/utils/geotiff-processor";

const { readRasterFromFile, writeFloat32TiledGeoTIFF } = vi.hoisted(() => ({
  readRasterFromFile: vi.fn(),
  writeFloat32TiledGeoTIFF: vi.fn(() => new ArrayBuffer(16)),
}));

vi.mock("../src/lib/utils/geotiff-processor.js", () => ({
  readRasterFromFile,
  writeFloat32TiledGeoTIFF,
}));

import { buildMceRaster, calculateAhpWeights } from "../src/lib/SpatioProcessing/mce";

function source(
  width: number,
  height: number,
  data: number[],
  geotransform: RasterSource["geotransform"] = [0, 1, 0, 2, 0, -1],
  bandCount = 1,
): RasterSource {
  return {
    width,
    height,
    data: new Float32Array(data),
    geotransform,
    crsCode: 4326,
    noDataValue: -9999,
    bandCount,
  };
}

describe("calculateAhpWeights", () => {
  it("normalizes pairwise comparisons to weights summing to one", () => {
    const weights = calculateAhpWeights([
      [1, 3, 5],
      [1 / 3, 1, 2],
      [1 / 5, 1 / 2, 1],
    ]);
    expect(weights.reduce((sum, value) => sum + value, 0)).toBe(1);
    expect(weights[0]).toBeGreaterThan(weights[1]);
    expect(weights[1]).toBeGreaterThan(weights[2]);
  });
});

describe("buildMceRaster", () => {
  it("averages bands before normalization and writes a tiled result", async () => {
    readRasterFromFile.mockResolvedValueOnce(source(2, 1, [1, 10, 4, 20], [0, 1, 0, 1, 0, -1], 2));
    const blob = await buildMceRaster([{ file: new File(["a"], "a.tif"), weight: 1 }], {
      bandMode: "average",
      mode: "before",
    });
    expect(blob).toBeInstanceOf(Blob);
    const output = writeFloat32TiledGeoTIFF.mock.calls[0][2] as Float32Array;
    expect(Array.from(output)).toEqual([0, 1]);
    expect(writeFloat32TiledGeoTIFF).toHaveBeenCalledWith(2, 1, expect.any(Float32Array), expect.any(Array), 4326, 1);
  });

  it("resamples a shifted raster onto the first raster grid", async () => {
    readRasterFromFile
      .mockResolvedValueOnce(source(2, 1, [0, 1], [0, 1, 0, 1, 0, -1]))
      .mockResolvedValueOnce(source(2, 1, [10, 20], [1, 1, 0, 1, 0, -1]));
    await buildMceRaster([
      { file: new File(["a"], "a.tif"), weight: 1 },
      { file: new File(["b"], "b.tif"), weight: 1 },
    ]);
    const output = writeFloat32TiledGeoTIFF.mock.calls.at(-1)?.[2] as Float32Array;
    expect(Array.from(output)).toEqual([0, 1]);
  });

  it("uses the explicitly selected bounding raster as the output grid", async () => {
    readRasterFromFile
      .mockResolvedValueOnce(source(1, 1, [1], [0, 1, 0, 1, 0, -1]))
      .mockResolvedValueOnce(source(1, 1, [9], [10, 2, 0, 20, 0, -2]));

    await buildMceRaster(
      [
        { file: new File(["a"], "a.tif"), weight: 1 },
        { file: new File(["b"], "b.tif"), weight: 1 },
      ],
      { missingDataMode: "0" },
      "b.tif",
    );

    const geotransform = writeFloat32TiledGeoTIFF.mock.calls.at(-1)?.[3] as RasterSource["geotransform"];
    expect(geotransform).toEqual([10, 2, 0, 20, 0, -2]);
  });

  it("applies NaN mode to real NoData cells after normalization", async () => {
    readRasterFromFile.mockResolvedValueOnce(source(2, 1, [5, -9999]));

    await buildMceRaster([{ file: new File(["a"], "a.tif"), weight: 1 }], { missingDataMode: "NaN" });

    const output = writeFloat32TiledGeoTIFF.mock.calls.at(-1)?.[2] as Float32Array;
    expect(Array.from(output)).toEqual([0, NaN]);
  });

  it("applies the selected mode to bbox-created gaps the same way as real NoData", async () => {
    readRasterFromFile
      .mockResolvedValueOnce(source(1, 1, [5], [0, 1, 0, 1, 0, -1]))
      .mockResolvedValueOnce(source(1, 1, [10], [2, 1, 0, 1, 0, -1]));

    await buildMceRaster([
      { file: new File(["a"], "a.tif"), weight: 1 },
      { file: new File(["b"], "b.tif"), weight: 1 },
    ], { missingDataMode: "0" });

    let output = writeFloat32TiledGeoTIFF.mock.calls.at(-1)?.[2] as Float32Array;
    expect(Array.from(output)).toEqual([0]);

    readRasterFromFile
      .mockResolvedValueOnce(source(1, 1, [5], [0, 1, 0, 1, 0, -1]))
      .mockResolvedValueOnce(source(1, 1, [10], [2, 1, 0, 1, 0, -1]));

    await buildMceRaster([
      { file: new File(["a"], "a.tif"), weight: 1 },
      { file: new File(["b"], "b.tif"), weight: 1 },
    ], { missingDataMode: "NaN" });

    output = writeFloat32TiledGeoTIFF.mock.calls.at(-1)?.[2] as Float32Array;
    expect(Array.from(output)).toEqual([NaN]);
  });
});
