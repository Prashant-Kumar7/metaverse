/**
 * Tileset definitions for the 2D tile map
 * Maps tile IDs to visual representations
 */

export interface TileDefinition {
  id: number;
  name: string;
  color: string; // CSS color for rendering (can be replaced with sprite URL later)
  walkable: boolean;
}

export const TILESET: Record<number, TileDefinition> = {
  // Floor tiles
  0: { id: 0, name: 'grass', color: '#90EE90', walkable: true },
  1: { id: 1, name: 'wood_floor', color: '#DEB887', walkable: true },
  2: { id: 2, name: 'carpet', color: '#CD5C5C', walkable: true },
  3: { id: 3, name: 'tile_floor', color: '#F5F5DC', walkable: true },
  4: { id: 4, name: 'concrete', color: '#C0C0C0', walkable: true },
  
  // Walls (non-walkable)
  10: { id: 10, name: 'wall', color: '#654321', walkable: false },
  11: { id: 11, name: 'brick_wall', color: '#8B4513', walkable: false },
  
  // Special tiles
  20: { id: 20, name: 'water', color: '#4169E1', walkable: false },
};

/**
 * Get tile definition by ID
 */
export function getTile(id: number): TileDefinition {
  return TILESET[id] || TILESET[0]; // Default to grass if tile not found
}

/**
 * Check if a tile is walkable
 */
export function isTileWalkable(tileId: number): boolean {
  const tile = getTile(tileId);
  return tile.walkable;
}

