import {
  readRasterFromFile,
  writeFloat32TiledGeoTIFF,
  generateGeoTIFFBlobFromRaster,
} from '../utils/geotiff-processor.js';

export function createRasterAlgebraLayer(){
    
}

export async function generateTiled(input: File): Promise<Blob> {
    return generateGeoTIFFBlobFromRaster(input);
}