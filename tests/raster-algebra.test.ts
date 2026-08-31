import { describe, it, expect } from "vitest";
import {
  compileExpression,
  collectExpressionReferences,
  calculateRaster,
  loadRasterFromFile,
} from "../src/lib/SpatioProcessing/raster-algebra";
import type { RasterInput } from "../src/lib/SpatioProcessing/raster-algebra";
import type { RasterSource } from "../src/lib/utils/geotiff-processor";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a minimal RasterSource for testing (1-band by default). */
function makeSource(
  width: number,
  height: number,
  data: number[],
  originX = 0,
  originY = 10,
  scaleX = 1,
  scaleY = -1,
  bandCount = 1,
): RasterSource {
  return {
    width,
    height,
    data: new Float32Array(data),
    geotransform: [originX, scaleX, 0, originY, 0, scaleY],
    crsCode: 4326,
    noDataValue: -9999,
    bandCount,
  };
}

function makeRaster(key: string, source: RasterSource, alias?: string): RasterInput {
  return { key, fileName: key, source, alias };
}

// ─── Expression parser tests ──────────────────────────────────────────────────

describe("compileExpression – arithmetic operators", () => {
  it("evaluates addition", () => {
    const expr = compileExpression('"a" + 10');
    expect(expr({ a: 5 })).toBe(15);
  });

  it("evaluates subtraction", () => {
    const expr = compileExpression('"a" - "b"');
    expect(expr({ a: 20, b: 8 })).toBe(12);
  });

  it("evaluates multiplication", () => {
    const expr = compileExpression('"a" * 3');
    expect(expr({ a: 7 })).toBe(21);
  });

  it("evaluates division", () => {
    const expr = compileExpression('"a" / 4');
    expect(expr({ a: 12 })).toBe(3);
  });

  it("division by zero yields NaN", () => {
    const expr = compileExpression('"a" / 0');
    expect(expr({ a: 5 })).toBeNaN();
  });

  it("evaluates exponentiation", () => {
    const expr = compileExpression('"a" ^ 2');
    expect(expr({ a: 3 })).toBe(9);
  });

  it("evaluates parenthesized groups", () => {
    const expr = compileExpression('("a" + 2) * 3');
    expect(expr({ a: 4 })).toBe(18);
  });
});

describe("compileExpression – comparison operators", () => {
  it("< returns 1 when true", () => {
    expect(compileExpression('"a" < 10')({ a: 5 })).toBe(1);
  });
  it("< returns 0 when false", () => {
    expect(compileExpression('"a" < 10')({ a: 15 })).toBe(0);
  });
  it(">= works", () => {
    expect(compileExpression('"a" >= 5')({ a: 5 })).toBe(1);
  });
  it("!= works", () => {
    expect(compileExpression('"a" != 3')({ a: 4 })).toBe(1);
  });
});

describe("compileExpression – math functions", () => {
  it("abs()", () => {
    expect(compileExpression('abs("a")')({ a: -7 })).toBeCloseTo(7);
  });
  it("sin()", () => {
    expect(compileExpression('sin("a")')({ a: 0 })).toBeCloseTo(0);
  });
  it("cos()", () => {
    expect(compileExpression('cos("a")')({ a: 0 })).toBeCloseTo(1);
  });
  it("log10()", () => {
    expect(compileExpression('log10("a")')({ a: 100 })).toBeCloseTo(2);
  });
  it("min() picks smaller", () => {
    expect(compileExpression('min("a", "b")')({ a: 3, b: 7 })).toBe(3);
  });
  it("max() picks larger", () => {
    expect(compileExpression('max("a", "b")')({ a: 3, b: 7 })).toBe(7);
  });
});

describe("compileExpression – IF / AND / OR", () => {
  it("IF(cond, then, else) – true branch", () => {
    const expr = compileExpression('IF("a" > 5, 100, 0)');
    expect(expr({ a: 10 })).toBe(100);
  });
  it("IF(cond, then, else) – false branch", () => {
    const expr = compileExpression('IF("a" > 5, 100, 0)');
    expect(expr({ a: 2 })).toBe(0);
  });
  it("AND() is truthy when all non-zero", () => {
    expect(compileExpression('AND("a", "b")')({ a: 1, b: 2 })).toBe(1);
  });
  it("AND() is 0 when any zero", () => {
    expect(compileExpression('AND("a", "b")')({ a: 0, b: 2 })).toBe(0);
  });
  it("OR() is 1 when any truthy", () => {
    expect(compileExpression('OR("a", "b")')({ a: 0, b: 3 })).toBe(1);
  });
});

describe("collectExpressionReferences", () => {
  it("returns quoted token names", () => {
    const refs = collectExpressionReferences('"dem.tif" + "slope.tif"');
    expect([...refs]).toEqual(expect.arrayContaining(["dem.tif", "slope.tif"]));
    expect(refs.size).toBe(2);
  });

  it("includes band references", () => {
    const refs = collectExpressionReferences('"multi.tif.band_2" * 2');
    expect(refs.has("multi.tif.band_2")).toBe(true);
  });
});

describe("compileExpression – error cases", () => {
  it("throws on empty expression", () => {
    expect(() => compileExpression("")).toThrow("Expression cannot be empty.");
  });

  it("throws on unquoted identifier", () => {
    expect(() => compileExpression("dem + 1")).toThrow(/quoted/i);
  });

  it("throws on unknown function", () => {
    expect(() => compileExpression("sqrt(4)")).toThrow(/Unknown function/i);
  });
});

// ─── Coordinate alignment tests ───────────────────────────────────────────────

describe("calculateRaster – aligned rasters", () => {
  it("adds a constant to each pixel", async () => {
    // 2×2 raster with values [1, 2, 3, 4]
    const src = makeSource(2, 2, [1, 2, 3, 4]);
    const raster = makeRaster("r.tif", src);
    const expr = compileExpression('"r.tif" + 10');
    const { blob } = await calculateRaster([raster], expr);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("multiplies two same-extent rasters pixel-wise", async () => {
    const src1 = makeSource(2, 2, [1, 2, 3, 4]);
    const src2 = makeSource(2, 2, [10, 10, 10, 10]);
    const r1 = makeRaster("a.tif", src1);
    const r2 = makeRaster("b.tif", src2);
    const expr = compileExpression('"a.tif" * "b.tif"');
    const { blob, warnings } = await calculateRaster([r1, r2], expr);
    expect(blob.size).toBeGreaterThan(0);
    expect(warnings).toHaveLength(0);
  });
});

describe("calculateRaster – mismatched extents (resampling)", () => {
  it("emits a warning when extents differ", async () => {
    const base = makeSource(2, 2, [1, 2, 3, 4], 0, 10, 1, -1);
    // target covers a different area
    const other = makeSource(2, 2, [10, 10, 10, 10], 5, 15, 1, -1);
    const r1 = makeRaster("base.tif", base);
    const r2 = makeRaster("other.tif", other);
    const expr = compileExpression('"base.tif" + "other.tif"');
    const { warnings } = await calculateRaster([r1, r2], expr);
    // The second raster requires resampling, so a warning should be present
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("uses the bbox-gap policy to convert missing pixels to zero", () => {
    const expr = compileExpression('"a.tif" + "b.tif"');
    const result = expr.evaluate?.(
      {
        'a.tif': 5,
        'b.tif': NaN,
        __bboxMissing: { 'b.tif': true },
      },
      new Map([
        ['a.tif', 'a.tif'],
        ['b.tif', 'b.tif'],
      ]),
      'DEFAULT',
      '0',
    );

    expect(result?.value).toBe(5);
  });

  it("uses skip to keep the valid value when bbox-created data is missing", () => {
    const expr = compileExpression('"a.tif" + "b.tif"');
    const result = expr.evaluate?.(
      {
        'a.tif': 5,
        'b.tif': NaN,
        __bboxMissing: { 'b.tif': true },
      },
      new Map([
        ['a.tif', 'a.tif'],
        ['b.tif', 'b.tif'],
      ]),
      'DEFAULT',
      'Skip',
    );

    expect(result?.value).toBe(5);
  });

  it("keeps true raster NaNs on the normal NAN_HANDLING_MODE path", () => {
    const expr = compileExpression('"a.tif" + "b.tif"');
    const result = expr.evaluate?.(
      {
        'a.tif': NaN,
        'b.tif': 2,
        __bboxMissing: {},
      },
      new Map([
        ['a.tif', 'a.tif'],
        ['b.tif', 'b.tif'],
      ]),
      'RASTER_PRIORITY',
      'Skip',
    );

    expect(result?.value).toBe(2);
  });
});

describe("calculateRaster – band references", () => {
  it("resolves .band_1 from multi-band interleaved data", async () => {
    // 2-band interleaved: [b1pix0, b2pix0, b1pix1, b2pix1, ...]
    const src = makeSource(2, 1, [1, 100, 2, 200], 0, 1, 1, -1, 2);
    const raster = makeRaster("multi.tif", src);
    const expr = compileExpression('"multi.tif.band_1"');
    const { blob } = await calculateRaster([raster], expr);
    expect(blob.size).toBeGreaterThan(0);
  });
});

describe("calculateRaster – error cases", () => {
  it("throws when no rasters are provided", async () => {
    const expr = compileExpression('"x.tif" + 1');
    await expect(calculateRaster([], expr)).rejects.toThrow("No raster is being processed.");
  });

  it("throws when expression has no raster references", async () => {
    const src = makeSource(2, 2, [1, 2, 3, 4]);
    const raster = makeRaster("r.tif", src);
    const expr = compileExpression("1 + 2");
    // Manually clear references to simulate a literal-only expression
    // (compileExpression won't allow a 0-reference expression to pass resolveReference)
    expr.references = new Set();
    await expect(calculateRaster([raster], expr)).rejects.toThrow(
      "Expression does not reference an uploaded raster.",
    );
  });

  it("throws on unknown raster reference", async () => {
    const src = makeSource(2, 2, [1, 2, 3, 4]);
    const raster = makeRaster("r.tif", src);
    const expr = compileExpression('"unknown.tif" + 1');
    await expect(calculateRaster([raster], expr)).rejects.toThrow(
      /Unknown raster reference/i,
    );
  });

  it("throws on out-of-range band index", async () => {
    const src = makeSource(2, 2, [1, 2, 3, 4], 0, 10, 1, -1, 1);
    const raster = makeRaster("r.tif", src);
    const expr = compileExpression('"r.tif.band_5"');
    await expect(calculateRaster([raster], expr)).rejects.toThrow(/Band 5/);
  });
});
