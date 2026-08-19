import {
  readRasterFromFile,
  writeFloat32TiledGeoTIFF,
  generateGeoTIFFBlobFromRaster,
} from '../utils/geotiff-processor.js';


export function createMCELayer(){
    
}
export async function generateTiled(input: File): Promise<Blob> {
  return generateGeoTIFFBlobFromRaster(input);
}