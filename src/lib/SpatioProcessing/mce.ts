import {
    readRasterFromFile,
    writeFloat32TiledGeoTIFF,
} from '../utils/geotiff-processor.js';
import type { RasterSource } from '../utils/geotiff-processor.js';

export type MceBandMode = "all" | "average" | "first";

export interface MceRasterInput {
    file: File;
    weight: number;
}

export interface MceRasterProcessingOptions {
    bandMode?: MceBandMode;
    mode?: "before" | "after";
}

export function calculateAhpWeights(matrix: number[][]): number[] {
    const count = matrix.length;
    if (count === 0 || matrix.some((row) => row.length !== count)) return [];

    const columnSums = Array.from({ length: count }, (_, column) =>
        matrix.reduce((sum, row) => sum + row[column], 0),
    );
    const weights = matrix.map((row) =>
        row.reduce((sum, value, column) => sum + value / columnSums[column], 0) / count,
    );
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (!Number.isFinite(total) || total <= 0) return weights.map(() => 1 / count);

    const rounded = weights.map((weight) => Number((weight / total).toFixed(2)));
    const difference = Number((1 - rounded.reduce((sum, weight) => sum + weight, 0)).toFixed(2));
    rounded[rounded.length - 1] = Number((rounded[rounded.length - 1] + difference).toFixed(2));
    return rounded;
}

interface ProcessedRaster {
    data: Float32Array;
    valid: Uint8Array;
    width: number;
    height: number;
    bandCount: number;
    geotransform: RasterSource["geotransform"];
    crsCode: number;
}

function isValid(value: number, noDataValue: number): boolean {
    return Number.isFinite(value) && value !== noDataValue;
}

function normalize(values: Float32Array, valid: Uint8Array): Float32Array {
    let min = Infinity;
    let max = -Infinity;
    for (let index = 0; index < values.length; index += 1) {
        if (!valid[index]) continue;
        min = Math.min(min, values[index]);
        max = Math.max(max, values[index]);
    }
    const result = new Float32Array(values.length);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return result;
    for (let index = 0; index < values.length; index += 1) {
        if (valid[index]) result[index] = (values[index] - min) / (max - min);
    }
    return result;
}

function averageBands(
    values: Float32Array,
    valid: Uint8Array,
    width: number,
    height: number,
    bandCount: number,
): { values: Float32Array; valid: Uint8Array } {
    const averaged = new Float32Array(width * height);
    const averagedValid = new Uint8Array(width * height);
    for (let pixel = 0; pixel < averaged.length; pixel += 1) {
        let sum = 0;
        let count = 0;
        for (let band = 0; band < bandCount; band += 1) {
            const index = pixel * bandCount + band;
            if (!valid[index]) continue;
            sum += values[index];
            count += 1;
        }
        if (count > 0) {
            averaged[pixel] = sum / count;
            averagedValid[pixel] = 1;
        }
    }
    return { values: averaged, valid: averagedValid };
}

async function processRaster(
    file: File,
    options: MceRasterProcessingOptions,
): Promise<ProcessedRaster> {
    const source = await readRasterFromFile(file);
    const pixels = source.width * source.height;
    const bandMode = options.bandMode ?? "first";
    const averagingMode = options.mode === "after" ? "after" : "before";
    const raw = source.data;
    const rawValid = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
        rawValid[index] = isValid(raw[index], source.noDataValue) ? 1 : 0;
    }

    if (bandMode === "first") {
        const values = new Float32Array(pixels);
        const valid = new Uint8Array(pixels);
        for (let pixel = 0; pixel < pixels; pixel += 1) {
            values[pixel] = raw[pixel * source.bandCount];
            valid[pixel] = rawValid[pixel * source.bandCount];
        }
        return { ...source, data: normalize(values, valid), valid, bandCount: 1 };
    }

    if (bandMode === "average" && averagingMode === "before") {
        const averaged = averageBands(raw, rawValid, source.width, source.height, source.bandCount);
        return { ...source, data: normalize(averaged.values, averaged.valid), valid: averaged.valid, bandCount: 1 };
    }

    const normalized = new Float32Array(raw.length);
    if (bandMode === "all") {
        normalized.set(normalize(raw, rawValid));
        return { ...source, data: normalized, valid: rawValid, bandCount: source.bandCount };
    }

    const normalizedBands = new Float32Array(raw.length);
    for (let band = 0; band < source.bandCount; band += 1) {
        const values = new Float32Array(pixels);
        const valid = new Uint8Array(pixels);
        for (let pixel = 0; pixel < pixels; pixel += 1) {
            const index = pixel * source.bandCount + band;
            values[pixel] = raw[index];
            valid[pixel] = rawValid[index];
        }
        const bandResult = normalize(values, valid);
        for (let pixel = 0; pixel < pixels; pixel += 1) normalizedBands[pixel * source.bandCount + band] = bandResult[pixel];
    }
    const averaged = averageBands(normalizedBands, rawValid, source.width, source.height, source.bandCount);
    return { ...source, data: averaged.values, valid: averaged.valid, bandCount: 1 };
}

function sampleRaster(raster: ProcessedRaster, x: number, y: number): number[] | null {
    const [originX, scaleX, , originY, , scaleY] = raster.geotransform;
    const column = Math.round((x - originX) / scaleX - 0.5);
    const row = Math.round((y - originY) / scaleY - 0.5);
    if (column < 0 || column >= raster.width || row < 0 || row >= raster.height) return null;
    const pixel = row * raster.width + column;
    const values: number[] = [];
    for (let band = 0; band < raster.bandCount; band += 1) {
        const index = pixel * raster.bandCount + band;
        values.push(raster.valid[index] ? raster.data[index] : 0);
    }
    return values;
}

export async function buildMceRaster(
    inputs: MceRasterInput[],
    options: MceRasterProcessingOptions = {},
): Promise<Blob> {
    if (inputs.length === 0) throw new Error("At least one raster is required.");
    if (inputs.some((input) => !Number.isFinite(input.weight))) throw new Error("Raster weights must be finite numbers.");

    const layers = await Promise.all(inputs.map((input) => processRaster(input.file, options)));
    const base = layers[0];
    const combined = new Float32Array(base.width * base.height * base.bandCount);
    for (let row = 0; row < base.height; row += 1) {
        for (let column = 0; column < base.width; column += 1) {
            const basePixel = row * base.width + column;
            const [originX, scaleX, , originY, , scaleY] = base.geotransform;
            const coordinateX = originX + (column + 0.5) * scaleX;
            const coordinateY = originY + (row + 0.5) * scaleY;
            for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
                const layer = layers[layerIndex];
                if (layer.bandCount !== base.bandCount) throw new Error("All rasters must use the same band processing mode.");
                const values = sampleRaster(layer, coordinateX, coordinateY);
                if (!values) continue;
                for (let band = 0; band < base.bandCount; band += 1) combined[basePixel * base.bandCount + band] += values[band] * inputs[layerIndex].weight;
            }
        }
    }
    const buffer = writeFloat32TiledGeoTIFF(base.width, base.height, combined, base.geotransform, base.crsCode, base.bandCount);
    return new Blob([buffer], { type: "image/tiff" });
}
