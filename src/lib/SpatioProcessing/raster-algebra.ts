import { readRasterFromFile, writeFloat32TiledGeoTIFF } from '../utils/geotiff-processor.js';
import type { RasterSource } from '../utils/geotiff-processor.js';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface RasterInput {
  key: string;
  fileName: string;
  alias?: string;
  noData?: number | null;
  source: RasterSource;
}

export type PixelContext = Record<string, number | Record<string, boolean> | undefined> & {
  __bboxMissing?: Record<string, boolean>;
};

export type EvaluationResult = {
  value: number;
  rasterReferences: ReadonlySet<string>;
};

export type MissingDataMode = 'NaN' | '0' | 'Skip';

export type CompiledExpression = ((context: PixelContext) => number) & {
  references?: ReadonlySet<string>;
  evaluate?: (
    context: PixelContext,
    rasterIdentities?: ReadonlyMap<string, string>,
    nanHandlingMode?: 'DEFAULT' | 'RASTER_PRIORITY',
    missingDataMode?: MissingDataMode,
  ) => EvaluationResult;
};

// ─────────────────────────────────────────────────────────────────────────────
// Expression parser (ported from sample expression-parser.ts)
// ─────────────────────────────────────────────────────────────────────────────

type NanHandlingMode = 'DEFAULT' | 'RASTER_PRIORITY';
type Evaluator = (
  context: PixelContext,
  rasterIdentities?: ReadonlyMap<string, string>,
  nanHandlingMode?: NanHandlingMode,
  missingDataMode?: MissingDataMode,
) => EvaluationResult;

function mergeReferences(...results: EvaluationResult[]): ReadonlySet<string> {
  const references = new Set<string>();
  results.forEach((result) =>
    result.rasterReferences.forEach((reference) => references.add(reference)),
  );
  return references;
}

function hasDifferentRasterReferences(
  left: ReadonlySet<string>,
  right: ReadonlySet<string>,
): boolean {
  if (left.size === 0 || right.size === 0) return false;
  return (
    [...left].some((reference) => !right.has(reference)) ||
    [...right].some((reference) => !left.has(reference))
  );
}

function applyNanFallback(
  operator: '+' | '-' | '*',
  left: EvaluationResult,
  right: EvaluationResult,
  nanHandlingMode?: NanHandlingMode,
  context?: PixelContext,
  missingDataMode: MissingDataMode = 'NaN',
): number {
  const bboxMissing = context?.__bboxMissing ?? {};
  const leftBBoxMissing = [...left.rasterReferences].some((reference) => !!bboxMissing[reference]);
  const rightBBoxMissing = [...right.rasterReferences].some((reference) => !!bboxMissing[reference]);

  if (missingDataMode === 'Skip') {
    if (Number.isNaN(left.value) && leftBBoxMissing && !Number.isNaN(right.value)) return right.value;
    if (Number.isNaN(right.value) && rightBBoxMissing && !Number.isNaN(left.value)) return left.value;
    if (Number.isNaN(left.value) && Number.isNaN(right.value)) return NaN;
  }

  if (missingDataMode === '0') {
    const leftValue = Number.isNaN(left.value) && leftBBoxMissing ? 0 : left.value;
    const rightValue = Number.isNaN(right.value) && rightBBoxMissing ? 0 : right.value;
    return operator === '+'
      ? leftValue + rightValue
      : operator === '-'
        ? leftValue - rightValue
        : leftValue * rightValue;
  }

  if (nanHandlingMode !== 'RASTER_PRIORITY') {
    return operator === '+'
      ? left.value + right.value
      : operator === '-'
        ? left.value - right.value
        : left.value * right.value;
  }
  if (!hasDifferentRasterReferences(left.rasterReferences, right.rasterReferences)) {
    return operator === '+'
      ? left.value + right.value
      : operator === '-'
        ? left.value - right.value
        : left.value * right.value;
  }
  if (Number.isNaN(left.value) && Number.isNaN(right.value)) return NaN;
  const leftValue = Number.isNaN(left.value) ? 0 : left.value;
  const rightValue = Number.isNaN(right.value) ? 0 : right.value;
  return operator === '+'
    ? leftValue + rightValue
    : operator === '-'
      ? leftValue - rightValue
      : leftValue * rightValue;
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'string' | 'identifier' | 'operator'; value: string }
  | { type: 'eof'; value: '' };

const FUNCTIONS = new Set([
  'min',
  'max',
  'abs',
  'sin',
  'cos',
  'tan',
  'arcsin',
  'arccos',
  'arctan',
  'ln',
  'log',
  'log10',
  'IF',
  'AND',
  'OR',
]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") {
      const quote = character;
      let value = '';
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\' && index + 1 < source.length) index += 1;
        value += source[index++];
      }
      if (source[index] !== quote) throw new Error('Unterminated string literal.');
      index += 1;
      tokens.push({ type: 'string', value });
      continue;
    }
    const number = source
      .slice(index)
      .match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      tokens.push({ type: 'number', value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    const identifier = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_.]*/);
    if (identifier) {
      tokens.push({ type: 'identifier', value: identifier[0] });
      index += identifier[0].length;
      continue;
    }
    const operator = source
      .slice(index)
      .match(/^(?:<=|>=|!=|==|[+\-*/^<>=(),])/);
    if (!operator) throw new Error(`Unexpected character '${character}'.`);
    tokens.push({ type: 'operator', value: operator[0] });
    index += operator[0].length;
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
}

class Parser {
  private index = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Evaluator {
    const expression = this.parseComparison();
    this.expect('eof');
    return expression;
  }

  private parseComparison(): Evaluator {
    let left = this.parseAdditive();
    while (
      this.peekValue() &&
      ['<', '<=', '=', '==', '!=', '>=', '>'].includes(this.peekValue())
    ) {
      const operator = this.consume().value;
      const right = this.parseAdditive();
      const previous = left;
      left = (
        context: PixelContext,
        rasterIdentities?: ReadonlyMap<string, string>,
        nanHandlingMode?: NanHandlingMode,
        missingDataMode?: MissingDataMode,
      ) => {
        const a = previous(context, rasterIdentities, nanHandlingMode, missingDataMode);
        const b = right(context, rasterIdentities, nanHandlingMode, missingDataMode);
        switch (operator) {
          case '<':
            return {
              value: Number(a.value < b.value),
              rasterReferences: mergeReferences(a, b),
            };
          case '<=':
            return {
              value: Number(a.value <= b.value),
              rasterReferences: mergeReferences(a, b),
            };
          case '=':
          case '==':
            return {
              value: Number(a.value === b.value),
              rasterReferences: mergeReferences(a, b),
            };
          case '!=':
            return {
              value: Number(a.value !== b.value),
              rasterReferences: mergeReferences(a, b),
            };
          case '>=':
            return {
              value: Number(a.value >= b.value),
              rasterReferences: mergeReferences(a, b),
            };
          default:
            return {
              value: Number(a.value > b.value),
              rasterReferences: mergeReferences(a, b),
            };
        }
      };
    }
    return left;
  }

  private parseAdditive(): Evaluator {
    let left = this.parseMultiplicative();
    while (this.peekValue() === '+' || this.peekValue() === '-') {
      const operator = this.consume().value;
      const right = this.parseMultiplicative();
      const previous = left;
      left = (
        context: PixelContext,
        rasterIdentities?: ReadonlyMap<string, string>,
        nanHandlingMode?: NanHandlingMode,
        missingDataMode?: MissingDataMode,
      ) => {
        const a = previous(context, rasterIdentities, nanHandlingMode, missingDataMode);
        const b = right(context, rasterIdentities, nanHandlingMode, missingDataMode);
        return {
          value: applyNanFallback(operator as '+' | '-', a, b, nanHandlingMode, context, missingDataMode),
          rasterReferences: mergeReferences(a, b),
        };
      };
    }
    return left;
  }

  private parseMultiplicative(): Evaluator {
    let left = this.parsePower();
    while (this.peekValue() === '*' || this.peekValue() === '/') {
      const operator = this.consume().value;
      const right = this.parsePower();
      const previous = left;
      left = (
        context: PixelContext,
        rasterIdentities?: ReadonlyMap<string, string>,
        nanHandlingMode?: NanHandlingMode,
        missingDataMode?: MissingDataMode,
      ) => {
        const a = previous(context, rasterIdentities, nanHandlingMode, missingDataMode);
        const b = right(context, rasterIdentities, nanHandlingMode, missingDataMode);
        const value =
          operator === '/'
            ? b.value === 0 || Number.isNaN(b.value)
              ? NaN
              : a.value / b.value
            : applyNanFallback('*', a, b, nanHandlingMode, context, missingDataMode);
        return { value, rasterReferences: mergeReferences(a, b) };
      };
    }
    return left;
  }

  private parsePower(): Evaluator {
    const left = this.parseUnary();
    if (this.peekValue() !== '^') return left;
    this.consume();
    const right = this.parsePower();
    return (
      context: PixelContext,
      rasterIdentities?: ReadonlyMap<string, string>,
      nanHandlingMode?: NanHandlingMode,
      missingDataMode?: MissingDataMode,
    ) => {
      const a = left(context, rasterIdentities, nanHandlingMode, missingDataMode);
      const b = right(context, rasterIdentities, nanHandlingMode, missingDataMode);
      return {
        value: Math.pow(a.value, b.value),
        rasterReferences: mergeReferences(a, b),
      };
    };
  }

  private parseUnary(): Evaluator {
    if (this.peekValue() === '-') {
      this.consume();
      const value = this.parseUnary();
      return (
        context: PixelContext,
        rasterIdentities?: ReadonlyMap<string, string>,
        nanHandlingMode?: NanHandlingMode,
        missingDataMode?: MissingDataMode,
      ) => {
        const result = value(context, rasterIdentities, nanHandlingMode, missingDataMode);
        return { value: -result.value, rasterReferences: result.rasterReferences };
      };
    }
    if (this.peekValue() === '+') {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Evaluator {
    const token = this.consume();
    if (token.type === 'number')
      return () => ({ value: token.value, rasterReferences: new Set<string>() });
    if (token.type === 'string' || token.type === 'identifier') {
      if (this.peekValue() === '(') {
        if (token.type !== 'identifier' || !FUNCTIONS.has(token.value))
          throw new Error(`Unknown function '${token.value}'.`);
        return this.parseFunction(token.value);
      }
      if (token.type === 'identifier')
        throw new Error(`Raster references must be quoted: "${token.value}".`);
      return (context: PixelContext, rasterIdentities?: ReadonlyMap<string, string>) => {
        const rawValue = context[token.value];
        return {
          value: typeof rawValue === 'number' ? rawValue : NaN,
          rasterReferences: new Set([
            rasterIdentities?.get(token.value) ?? token.value,
          ]),
        };
      };
    }
    if (token.value === '(') {
      const value = this.parseComparison();
      this.expectValue(')');
      return value;
    }
    throw new Error('Expected a number, variable, or parenthesized expression.');
  }

  private parseFunction(name: string): Evaluator {
    this.expectValue('(');
    const args: Evaluator[] = [];
    if (this.peekValue() !== ')') {
      do {
        args.push(this.parseComparison());
      } while (this.consumeIf(','));
    }
    this.expectValue(')');
    return (
      context: PixelContext,
      rasterIdentities?: ReadonlyMap<string, string>,
      nanHandlingMode?: NanHandlingMode,
      missingDataMode?: MissingDataMode,
    ) => {
      const results = args.map((argument) =>
        argument(context, rasterIdentities, nanHandlingMode, missingDataMode),
      );
      const values = results.map((result) => result.value);
      const rasterReferences = mergeReferences(...results);
      switch (name) {
        case 'min':
          return { value: Math.min(...values), rasterReferences };
        case 'max':
          return { value: Math.max(...values), rasterReferences };
        case 'abs':
          return { value: Math.abs(values[0]), rasterReferences };
        case 'sin':
          return { value: Math.sin(values[0]), rasterReferences };
        case 'cos':
          return { value: Math.cos(values[0]), rasterReferences };
        case 'tan':
          return { value: Math.tan(values[0]), rasterReferences };
        case 'arcsin':
          return { value: Math.asin(values[0]), rasterReferences };
        case 'arccos':
          return { value: Math.acos(values[0]), rasterReferences };
        case 'arctan':
          return { value: Math.atan(values[0]), rasterReferences };
        case 'ln':
          return { value: Math.log(values[0]), rasterReferences };
        case 'log':
          return {
            value:
              values.length === 1
                ? Math.log(values[0])
                : Math.log(values[0]) / Math.log(values[1]),
            rasterReferences,
          };
        case 'log10':
          return { value: Math.log10(values[0]), rasterReferences };
        case 'IF':
          return { value: values[0] ? values[1] : values[2], rasterReferences };
        case 'AND':
          return { value: Number(values.every(Boolean)), rasterReferences };
        case 'OR':
          return { value: Number(values.some(Boolean)), rasterReferences };
        default:
          return { value: NaN, rasterReferences };
      }
    };
  }

  private peekValue(): string {
    return String(this.tokens[this.index].value);
  }
  private consume(): Token {
    return this.tokens[this.index++];
  }
  private consumeIf(value: string): boolean {
    if (this.peekValue() !== value) return false;
    this.index += 1;
    return true;
  }
  private expect(type: Token['type']): void {
    if (this.consume().type !== type) throw new Error('Unexpected trailing input.');
  }
  private expectValue(value: string): void {
    if (this.consume().value !== value) throw new Error(`Expected '${value}'.`);
  }
}

/**
 * Compiles a raster expression string into an evaluatable function.
 * Quoted strings (e.g. "dem.tif") are treated as raster references.
 */
export function compileExpression(source: string): CompiledExpression {
  if (!source.trim()) throw new Error('Expression cannot be empty.');
  const tokens = tokenize(source);
  const references = new Set<string>();
  tokens.forEach((token) => {
    if (token.type === 'string') {
      references.add(token.value);
    }
  });
  const evaluator = new Parser(tokens).parse();
  const compiled = ((context: PixelContext) =>
    evaluator(context).value) as CompiledExpression;
  compiled.references = references;
  compiled.evaluate = evaluator;
  return compiled;
}

/**
 * Returns the set of raster references in an expression string
 * (i.e. the quoted tokens, e.g. "dem.tif", "slope.tif.band_2").
 */
export function collectExpressionReferences(source: string): Set<string> {
  return new Set(compileExpression(source).references ?? []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Raster alignment helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the value of raster `source` at the geographic coordinate (geoX, geoY)
 * using nearest-neighbor sampling.
 *
 * Data layout in RasterSource.data is interleaved:
 *   index = (row * width + col) * bandCount + bandIndex
 */
function sampleNearest(
  source: RasterSource,
  geoX: number,
  geoY: number,
  bandIndex: number = 0,
): number {
  const { width, height, geotransform, bandCount, data } = source;
  const [originX, scaleX, , originY, , scaleY] = geotransform;
  // scaleY is negative for north-up rasters
  const col = Math.floor((geoX - originX) / scaleX);
  const row = Math.floor((geoY - originY) / scaleY);
  if (col < 0 || row < 0 || col >= width || row >= height) return NaN;
  const pixelIndex = (row * width + col) * bandCount + bandIndex;
  return data[pixelIndex];
}

/**
 * Resamples `target` to align with `base` using nearest-neighbor interpolation.
 * Returns a flat Float32Array of length base.width * base.height for a single band.
 *
 * Coordinate translation (plan §2.A.3):
 *   Xgeo = originX + (col + 0.5) * scaleX
 *   Ygeo = originY + (row + 0.5) * scaleY
 */
function alignedValuesWithMissing(
  base: RasterSource,
  target: RasterSource,
  bandIndex: number = 0,
): { values: Float32Array; syntheticMissing: Uint8Array } {
  const { width, height, geotransform } = base;
  const [originX, scaleX, , originY, , scaleY] = geotransform;
  const values = new Float32Array(width * height);
  const syntheticMissing = new Uint8Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const geoX = originX + (col + 0.5) * scaleX;
      const geoY = originY + (row + 0.5) * scaleY;
      const index = row * width + col;
      const sample = sampleNearest(target, geoX, geoY, bandIndex);
      values[index] = sample;
      syntheticMissing[index] = Number.isNaN(sample) ? 1 : 0;
    }
  }
  return { values, syntheticMissing };
}

/**
 * Checks whether two RasterSources are spatially identical
 * (same dimensions + same geotransform origin and scale).
 */
function isAligned(a: RasterSource, b: RasterSource): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.geotransform[0] === b.geotransform[0] &&
    a.geotransform[1] === b.geotransform[1] &&
    a.geotransform[3] === b.geotransform[3] &&
    a.geotransform[5] === b.geotransform[5]
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference resolution
// ─────────────────────────────────────────────────────────────────────────────

interface ResolvedReference {
  raster: RasterInput;
  bandIndex: number; // 0-based
  reference: string;
}

/**
 * Resolves a quoted expression reference (e.g. "dem.tif" or "dem.tif.band_2")
 * to a specific RasterInput and band index (0-based).
 */
function resolveReference(reference: string, rasters: RasterInput[]): ResolvedReference {
  // Try exact key or alias match first (single-band or default band 1)
  const raster = rasters.find(
    (candidate) => candidate.key === reference || candidate.alias === reference,
  );
  if (raster) return { raster, bandIndex: 0, reference };

  // Try band suffix: "key.band_N" or "alias.band_N"
  const bandMatch = reference.match(/^(.*?)\.band_(\d+)$/);
  if (bandMatch) {
    const [, baseRef, bandText] = bandMatch;
    const bandNumber = Number(bandText); // 1-based from user
    const baseRaster = rasters.find(
      (candidate) => candidate.key === baseRef || candidate.alias === baseRef,
    );
    if (!baseRaster) throw new Error(`Unknown raster reference: "${reference}".`);
    const bandIndex = bandNumber - 1;
    if (bandIndex < 0 || bandIndex >= baseRaster.source.bandCount) {
      throw new Error(
        `Band ${bandNumber} does not exist for raster "${baseRef}"; available bands: 1-${baseRaster.source.bandCount}.`,
      );
    }
    return { raster: baseRaster, bandIndex, reference };
  }

  if (reference.includes('.band_'))
    throw new Error(`Invalid band reference "${reference}".`);
  throw new Error(`Unknown raster reference: "${reference}".`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main calculation entry point
// ─────────────────────────────────────────────────────────────────────────────

export interface RasterCalculationResult {
  blob: Blob;
  warnings: string[];
}

/**
 * Evaluates `expression` pixel-by-pixel over the aligned rasters and returns a
 * tiled Float32 GeoTIFF Blob ready to be loaded via `addCogLayer`.
 *
 * @param rasters - Loaded raster inputs (at least one required)
 * @param expression - Compiled expression (from `compileExpression`)
 * @param nanHandlingMode - How to handle NaN when combining bands from different rasters
 */
export async function calculateRaster(
  rasters: RasterInput[],
  expression: CompiledExpression,
  nanHandlingMode?: 'DEFAULT' | 'RASTER_PRIORITY',
  referenceRasterKey?: string,
  missingDataMode: MissingDataMode = 'Skip',
): Promise<RasterCalculationResult> {
  if (rasters.length === 0) throw new Error('No raster is being processed.');
  const references = expression.references ?? new Set<string>();
  if (references.size === 0)
    throw new Error('Expression does not reference an uploaded raster.');

  const resolved = [...references].map((ref) => resolveReference(ref, rasters));
  const baseRaster = referenceRasterKey
    ? resolved.find(({ raster }) => raster.key === referenceRasterKey) ?? resolved[0]
    : resolved[0];
  const base = baseRaster.raster.source;

  // CRS check
  const crsMismatch = resolved.find(
    ({ raster }) => raster.source.crsCode !== base.crsCode,
  );
  if (crsMismatch) {
    throw new Error(
      `Incompatible CRS: base raster uses EPSG:${base.crsCode}, ` +
        `"${crsMismatch.raster.fileName}" uses EPSG:${crsMismatch.raster.source.crsCode}.`,
    );
  }

  const warnings: string[] = [];

  // Align each resolved reference to the base raster grid
  const alignedArrays = resolved.map(({ raster, bandIndex }) => {
    if (isAligned(base, raster.source)) {
      // Extract just the single band from interleaved data
      if (raster.source.bandCount === 1) {
        const values = raster.source.data;
        return { values, syntheticMissing: new Uint8Array(values.length) };
      }
      const { width, height, bandCount, data } = raster.source;
      const values = new Float32Array(width * height);
      const syntheticMissing = new Uint8Array(width * height);
      for (let i = 0; i < width * height; i++) {
        values[i] = data[i * bandCount + bandIndex];
      }
      return { values, syntheticMissing };
    }
    warnings.push(
      `Raster "${raster.fileName}" was clipped/resampled to match the base raster; outside pixels are NaN.`,
    );
    return alignedValuesWithMissing(base, raster.source, bandIndex);
  });

  // Evaluate expression for each pixel
  const pixelCount = base.width * base.height;
  const output = new Float32Array(pixelCount);
  const rasterIdentities = new Map<string, string>();
  resolved.forEach(({ raster, reference }) => {
    rasterIdentities.set(reference, raster.key);
  });

  for (let i = 0; i < pixelCount; i++) {
    const context: PixelContext = { __bboxMissing: {} as Record<string, boolean> };
    resolved.forEach(({ reference, raster }, refIndex) => {
      const value = alignedArrays[refIndex].values[i];
      const noDataOverride = raster.noData != null ? raster.noData : undefined;
      const normalizedValue =
        typeof noDataOverride === 'number' && Number.isFinite(noDataOverride) && value === noDataOverride
          ? NaN
          : value;
      context[reference] = normalizedValue;
      (context.__bboxMissing as Record<string, boolean>)[reference] =
        alignedArrays[refIndex].syntheticMissing[i] === 1;
    });
    output[i] =
      expression.evaluate?.(context, rasterIdentities, nanHandlingMode, missingDataMode).value ??
      expression(context);
  }

  // Write tiled GeoTIFF
  const buffer = writeFloat32TiledGeoTIFF(
    base.width,
    base.height,
    output,
    base.geotransform,
    base.crsCode,
    1, // output is always single-band (expression result)
  );

  return {
    blob: new Blob([buffer], { type: 'image/tiff' }),
    warnings,
  };
}

/**
 * Reads a GeoTIFF file and wraps it in a RasterInput.
 */
export async function loadRasterFromFile(file: File): Promise<RasterInput> {
  const source = await readRasterFromFile(file);
  return {
    key: file.name,
    fileName: file.name,
    source,
  };
}