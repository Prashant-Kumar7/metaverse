/**
 * Tile map data - 2D array of tile IDs
 * Map size: 4000x4000px = 125x125 tiles (32px per tile)
 */

const TILE_SIZE = 32;
export const MAP_WIDTH_TILES = 125; // 4000 / 32
export const MAP_HEIGHT_TILES = 125;
export { TILE_SIZE };

/**
 * Generate a simple office/room layout map
 * This is a placeholder - replace with your actual map data
 */
function generateMapData(): number[][] {
  const map: number[][] = [];
  
  // Initialize with grass/default floor
  for (let y = 0; y < MAP_HEIGHT_TILES; y++) {
    map[y] = [];
    for (let x = 0; x < MAP_WIDTH_TILES; x++) {
      // Create some rooms/areas
      const centerX = MAP_WIDTH_TILES / 2;
      const centerY = MAP_HEIGHT_TILES / 2;
      
      // Main floor area (wood floor)
      if (x > 20 && x < 105 && y > 20 && y < 105) {
        map[y][x] = 1; // wood_floor
      } else {
        map[y][x] = 0; // grass
      }
      
      // Outer walls
      if (x === 20 || x === 104 || y === 20 || y === 104) {
        if (x >= 20 && x <= 104 && y >= 20 && y <= 104) {
          map[y][x] = 10; // wall
        }
      }
      
      // Some inner carpeted areas
      if (x > 30 && x < 50 && y > 30 && y < 50) {
        map[y][x] = 2; // carpet
      }
      if (x > 75 && x < 95 && y > 75 && y < 95) {
        map[y][x] = 2; // carpet
      }
    }
  }
  
  return map;
}

export const MAP_DATA: number[][] = generateMapData();

/**
 * Get tile ID at world coordinates (in pixels)
 */
export function getTileAtWorldPos(worldX: number, worldY: number): number {
  const tileX = Math.floor(worldX / TILE_SIZE);
  const tileY = Math.floor(worldY / TILE_SIZE);
  
  if (tileY >= 0 && tileY < MAP_DATA.length && 
      tileX >= 0 && tileX < MAP_DATA[tileY].length) {
    return MAP_DATA[tileY][tileX];
  }
  
  return 0; // Default to grass for out-of-bounds
}

/**
 * Check if a world position is walkable (tile-based)
 * Note: This function is not currently used but available for future tile-based collision
 */
export function isWorldPosWalkable(worldX: number, worldY: number): boolean {
  const tileId = getTileAtWorldPos(worldX, worldY);
  // For now, we rely on world object collision instead of tile-based collision
  // This can be extended later to check tile walkability
  return true;
}

