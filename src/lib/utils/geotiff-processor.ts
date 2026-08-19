import { fromBlob } from 'geotiff';

/**
 * Represents the metadata and pixel data extracted from a GeoTIFF file.
 */
export interface RasterSource {
  width: number;
  height: number;
  data: Float32Array;
  geotransform: [number, number, number, number, number, number];
  crsCode: number;
  noDataValue: number;
  bandCount: number;
}

/**
 * Reads a GeoTIFF file and extracts metadata and raster data.
 *
 * @param file - The input GeoTIFF file
 * @returns A RasterSource containing width, height, pixel data, and metadata
 */
export async function readRasterFromFile(file: File): Promise<RasterSource> {
  try {
    // 1. Open the file blob
    const tiff = await fromBlob(file);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();

    // 2. Extract metadata tags using TIFF accessors to get band count
    const fd = image.getFileDirectory();
    // SamplesPerPixel (tag 277) tells us how many bands/samples per pixel
    const bandCount = fd.hasTag(277) ? (fd.getValue(277) as number) : 1;

    // 3. Read the raster data array with all bands (interleaved)
    const rasters = await image.readRasters({ interleave: true });
    // Coerce geotiff.js typed array wrapper to Float32Array
    const rawRaster = rasters as unknown as { [index: number]: number } & { length: number };
    const elevation = new Float32Array(rawRaster.length);
    for (let i = 0; i < rawRaster.length; i++) {
      elevation[i] = rawRaster[i];
    }

    // NoData Value (GDAL_NODATA tag 42113)
    const noDataValue = fd.hasTag('GDAL_NODATA')
      ? parseFloat(String(fd.getValue('GDAL_NODATA')))
      : -9999;

    // Spatial Geotransform (ModelPixelScale and ModelTiepoint tags)
    const pixelScale = fd.getValue('ModelPixelScale') as number[] | undefined;
    const tiepoint = fd.getValue('ModelTiepoint') as number[] | undefined;
    const scaleX = pixelScale && pixelScale[0] != null ? pixelScale[0] : 1.0;
    const scaleY = pixelScale && pixelScale[1] != null ? -Math.abs(pixelScale[1]) : -1.0;
    const originX = tiepoint && tiepoint[3] != null ? tiepoint[3] : 0.0;
    const originY = tiepoint && tiepoint[4] != null ? tiepoint[4] : 0.0;
    const geotransform: [number, number, number, number, number, number] = [
      originX,
      scaleX,
      0,
      originY,
      0,
      scaleY,
    ];

    // 4. Extract EPSG code from GeoTIFF geo keys (Tag 34735)
    const geoKeys = image.getGeoKeys();
    let crsCode = 3857; // Default fallback to Web Mercator
    if (geoKeys) {
      const projectedCrs = geoKeys.ProjectedCSTypeGeoKey ?? geoKeys.GeographicTypeGeoKey;
      if (typeof projectedCrs === 'number') {
        crsCode = projectedCrs;
      }
    }

    return {
      width,
      height,
      data: elevation,
      geotransform,
      crsCode,
      noDataValue,
      bandCount,
    };
  } catch (error) {
    throw new Error(`Failed to read raster from file: ${(error as Error).message}`);
  }
}

/**
 * Writes a tiled Float32 GeoTIFF to an ArrayBuffer.
 *
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @param data - Row-major Float32 pixel data (for multi-band: width * height * bandCount samples)
 * @param geotransform - [originX, scaleX, 0, originY, 0, scaleY]
 * @param crsCode - EPSG code (default 3857 for Web Mercator)
 * @param bandCount - Number of bands in the raster (default 1)
 * @returns An ArrayBuffer containing the tiled GeoTIFF
 */
export function writeFloat32TiledGeoTIFF(
  width: number,
  height: number,
  data: Float32Array,
  geotransform: [number, number, number, number, number, number],
  crsCode: number = 3857,
  bandCount: number = 1,
): ArrayBuffer {
  const isGeographic = crsCode === 4326 || (crsCode >= 4000 && crsCode < 5000);
  const crsKey = isGeographic ? 2048 : 3072;

  // Define tile dimensions
  const TILE_W = 256;
  const TILE_H = 256;
  const tilesAcross = Math.ceil(width / TILE_W);
  const tilesDown = Math.ceil(height / TILE_H);
  const numTiles = tilesAcross * tilesDown;

  // For multi-band TIFF, we keep BitsPerSample as a single value (applies to all bands)
  // when all bands have the same bit depth
  
  // Memory offsets layout calculations
  const ifdEntriesCount = 14;
  let currentOffset = 8 + 2 + ifdEntriesCount * 12 + 4; // After IFD header, entries, and terminator
  
  const pixelScaleOffset = currentOffset;
  currentOffset += 3 * 8; // 3 doubles
  
  const tiepointOffset = currentOffset;
  currentOffset += 6 * 8; // 6 doubles
  
  const geokeysCount = 16;
  const geokeysOffset = currentOffset;
  currentOffset += geokeysCount * 2; // geokeys
  
  const tileOffsetsOffset = currentOffset;
  currentOffset += numTiles * 4;
  
  const tileByteCountsOffset = currentOffset;
  currentOffset += numTiles * 4;
  
  const pixelDataOffset = Math.ceil(currentOffset / 8) * 8;

  const singleTileBytes = TILE_W * TILE_H * 4 * bandCount; // Float32 = 4 bytes per sample, multiply by bandCount
  const totalSize = pixelDataOffset + numTiles * singleTileBytes;

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // 1. Write TIFF Header
  view.setUint8(0, 0x49); // 'I' (Little-Endian)
  view.setUint8(1, 0x49);
  view.setUint16(2, 42, true); // Magic Number
  view.setUint32(4, 8, true); // First IFD offset

  // 2. Write IFD Entries
  let offset = 8;
  view.setUint16(offset, ifdEntriesCount, true);
  offset += 2;

  const writeTag = (tag: number, type: number, count: number, valOrOffset: number) => {
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, count, true);
    view.setUint32(offset + 8, valOrOffset, true);
    offset += 12;
  };

  // IFD tags must be written in ascending numerical order!
  writeTag(256, 4, 1, width); // ImageWidth
  writeTag(257, 4, 1, height); // ImageLength
  // BitsPerSample: single value applies to all bands when they have same bit depth
  writeTag(258, 3, 1, 32); // 32 bits per sample
  writeTag(259, 3, 1, 1); // Compression
  writeTag(262, 3, 1, 1); // PhotometricInterpretation
  writeTag(277, 3, 1, bandCount); // SamplesPerPixel
  writeTag(322, 4, 1, TILE_W); // TileWidth
  writeTag(323, 4, 1, TILE_H); // TileLength
  writeTag(324, 4, numTiles, numTiles === 1 ? pixelDataOffset : tileOffsetsOffset); // TileOffsets
  writeTag(325, 4, numTiles, numTiles === 1 ? singleTileBytes : tileByteCountsOffset); // TileByteCounts
  // SampleFormat: single value applies to all bands (3 = IEEE Float)
  writeTag(339, 3, 1, 3); // SampleFormat (IEEE Float)
  writeTag(33550, 12, 3, pixelScaleOffset); // ModelPixelScaleTag
  writeTag(33922, 12, 6, tiepointOffset); // ModelTiepointTag
  writeTag(34735, 3, geokeysCount, geokeysOffset); // GeoKeyDirectoryTag

  view.setUint32(offset, 0, true); // End of IFD

  // 3. Write ModelPixelScale (scaleX, scaleY, scaleZ)
  view.setFloat64(pixelScaleOffset, geotransform[1], true);
  view.setFloat64(pixelScaleOffset + 8, Math.abs(geotransform[5]), true);
  view.setFloat64(pixelScaleOffset + 16, 0.0, true);

  // 4. Write ModelTiepoint (pixel coords mapping to georeferenced coords)
  view.setFloat64(tiepointOffset, 0.0, true);
  view.setFloat64(tiepointOffset + 8, 0.0, true);
  view.setFloat64(tiepointOffset + 16, 0.0, true);
  view.setFloat64(tiepointOffset + 24, geotransform[0], true); // Origin X
  view.setFloat64(tiepointOffset + 32, geotransform[3], true); // Origin Y
  view.setFloat64(tiepointOffset + 40, 0.0, true);

  // 5. Write GeoKeyDirectory (Projection & CRS keys)
  let kOffset = geokeysOffset;
  view.setUint16(kOffset, 1, true); // DirectoryVersion
  view.setUint16(kOffset + 2, 1, true); // Revision
  view.setUint16(kOffset + 4, 0, true); // MinorRevision
  view.setUint16(kOffset + 6, 3, true); // NumberOfKeys = 3
  kOffset += 8;

  // GTModelTypeGeoKey
  view.setUint16(kOffset, 1024, true);
  view.setUint16(kOffset + 2, 0, true);
  view.setUint16(kOffset + 4, 1, true);
  view.setUint16(kOffset + 6, isGeographic ? 2 : 1, true);
  kOffset += 8;

  // GTRasterTypeGeoKey (RasterPixelIsArea)
  view.setUint16(kOffset, 1025, true);
  view.setUint16(kOffset + 2, 0, true);
  view.setUint16(kOffset + 4, 1, true);
  view.setUint16(kOffset + 6, 1, true);
  kOffset += 8;

  // CRS Type Key
  view.setUint16(kOffset, crsKey, true);
  view.setUint16(kOffset + 2, 0, true);
  view.setUint16(kOffset + 4, 1, true);
  view.setUint16(kOffset + 6, crsCode, true);

  // 6. Populate Tile Offsets & Tile Byte Counts arrays (only written to buffer if numTiles > 1)
  if (numTiles > 1) {
    for (let i = 0; i < numTiles; i++) {
      view.setUint32(
        tileOffsetsOffset + i * 4,
        pixelDataOffset + i * singleTileBytes,
        true
      );
      view.setUint32(tileByteCountsOffset + i * 4, singleTileBytes, true);
    }
  }

  // 7. Write Pixel Data in Tile-Major layout (preserving multi-band interleaved format)
  const pixelFloatView = new Float32Array(
    buffer,
    pixelDataOffset,
    numTiles * TILE_W * TILE_H * bandCount
  );
  let destIdx = 0;
  for (let ty = 0; ty < tilesDown; ty++) {
    for (let tx = 0; tx < tilesAcross; tx++) {
      for (let y = 0; y < TILE_H; y++) {
        const imgY = ty * TILE_H + y;
        for (let x = 0; x < TILE_W; x++) {
          const imgX = tx * TILE_W + x;
          if (imgX < width && imgY < height) {
            // For multi-band data, preserve all bands per pixel (interleaved format)
            const srcPixelIdx = (imgY * width + imgX) * bandCount;
            for (let b = 0; b < bandCount; b++) {
              pixelFloatView[destIdx] = data[srcPixelIdx + b];
              destIdx++;
            }
          } else {
            // padding for partial/edge tiles
            for (let b = 0; b < bandCount; b++) {
              pixelFloatView[destIdx] = 0.0;
              destIdx++;
            }
          }
        }
      }
    }
  }

  return buffer;
}

/**
 * Retrieves the number of bands in a GeoTIFF file.
 *
 * @param file - The input GeoTIFF file
 * @returns Promise resolving to the band count (defaults to 1 if metadata is unavailable)
 */
export async function getGeoTIFFBandCount(file: File): Promise<number> {
  try {
    const tiff = await fromBlob(file);
    const image = await tiff.getImage();
    const fd = image.getFileDirectory();
    // SamplesPerPixel (tag 277) tells us how many bands/samples per pixel
    const bandCount = fd.hasTag(277) ? (fd.getValue(277) as number) : 1;
    return bandCount;
  } catch (error) {
    // Default to 1 band if metadata cannot be read
    return 1;
  }
}

/**
 * Generates a tiled GeoTIFF Blob from an input GeoTIFF file.
 * This is the main entry point for converting GeoTIFF to tiled format.
 * Preserves multi-band data if the input is multi-band.
 *
 * @param input - The input GeoTIFF file
 * @returns A Promise resolving to a Blob containing the tiled GeoTIFF
 */
export async function generateGeoTIFFBlobFromRaster(input: File): Promise<Blob> {
  const raster = await readRasterFromFile(input);
  const buffer = writeFloat32TiledGeoTIFF(
    raster.width,
    raster.height,
    raster.data,
    raster.geotransform,
    raster.crsCode,
    raster.bandCount
  );
  return new Blob([buffer], { type: 'image/tiff' });
}
