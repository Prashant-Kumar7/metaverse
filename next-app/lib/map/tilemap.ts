/**
 * Tile map rendering utilities
 */

import { MAP_DATA, MAP_WIDTH_TILES, MAP_HEIGHT_TILES, TILE_SIZE, getTileAtWorldPos } from './mapData';
import { getTile } from './tileset';

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Calculate which tiles are visible in the viewport
 * Returns tile coordinates that intersect with the viewport
 */
export function getVisibleTiles(
  cameraOffsetX: number,
  cameraOffsetY: number,
  viewportWidth: number,
  viewportHeight: number
): ViewportBounds {
  // Calculate world bounds visible in viewport
  const worldMinX = cameraOffsetX;
  const worldMaxX = cameraOffsetX + viewportWidth;
  const worldMinY = cameraOffsetY;
  const worldMaxY = cameraOffsetY + viewportHeight;
  
  // Convert to tile coordinates
  const minTileX = Math.max(0, Math.floor(worldMinX / TILE_SIZE));
  const maxTileX = Math.min(MAP_WIDTH_TILES - 1, Math.floor(worldMaxX / TILE_SIZE));
  const minTileY = Math.max(0, Math.floor(worldMinY / TILE_SIZE));
  const maxTileY = Math.min(MAP_HEIGHT_TILES - 1, Math.floor(worldMaxY / TILE_SIZE));
  
  return {
    minX: minTileX,
    maxX: maxTileX,
    minY: minTileY,
    maxY: maxTileY,
  };
}

/**
 * Get all tile data for visible tiles
 * Returns array of { tileX, tileY, tileId, worldX, worldY }
 */
export function getVisibleTileData(
  cameraOffsetX: number,
  cameraOffsetY: number,
  viewportWidth: number,
  viewportHeight: number
) {
  const bounds = getVisibleTiles(cameraOffsetX, cameraOffsetY, viewportWidth, viewportHeight);
  const tiles = [];
  
  for (let tileY = bounds.minY; tileY <= bounds.maxY; tileY++) {
    for (let tileX = bounds.minX; tileX <= bounds.maxX; tileX++) {
      const tileId = MAP_DATA[tileY][tileX];
      const worldX = tileX * TILE_SIZE;
      const worldY = tileY * TILE_SIZE;
      
      tiles.push({
        tileX,
        tileY,
        tileId,
        worldX,
        worldY,
      });
    }
  }
  
  return tiles;
}

