/**
 * Static world objects configuration
 * Gather.town-style furniture and objects
 */

import type { WorldObject } from './WorldObject';

export const WORLD_OBJECTS: WorldObject[] = [
  // Office desks
  {
    id: 'desk_1',
    x: 800,
    y: 800,
    width: 120,
    height: 80,
    sprite: '#8B4513', // Brown
    collidable: true,
    name: 'Desk',
  },
  {
    id: 'desk_2',
    x: 1000,
    y: 800,
    width: 120,
    height: 80,
    sprite: '#8B4513',
    collidable: true,
    name: 'Desk',
  },
  {
    id: 'desk_3',
    x: 800,
    y: 1000,
    width: 120,
    height: 80,
    sprite: '#8B4513',
    collidable: true,
    name: 'Desk',
  },
  {
    id: 'desk_4',
    x: 1000,
    y: 1000,
    width: 120,
    height: 80,
    sprite: '#8B4513',
    collidable: true,
    name: 'Desk',
  },
  
  // Sofas
  {
    id: 'sofa_1',
    x: 2400,
    y: 1400,
    width: 160,
    height: 80,
    sprite: '#CD5C5C', // Indian red
    collidable: true,
    name: 'Sofa',
  },
  {
    id: 'sofa_2',
    x: 2400,
    y: 1600,
    width: 160,
    height: 80,
    sprite: '#CD5C5C',
    collidable: true,
    name: 'Sofa',
  },
  
  // Tables
  {
    id: 'table_1',
    x: 1400,
    y: 2000,
    width: 100,
    height: 100,
    sprite: '#654321', // Dark brown
    collidable: true,
    name: 'Table',
  },
  {
    id: 'table_2',
    x: 3000,
    y: 2000,
    width: 100,
    height: 100,
    sprite: '#654321',
    collidable: true,
    name: 'Table',
  },
  
  // Plants (decorative, collidable)
  {
    id: 'plant_1',
    x: 600,
    y: 600,
    width: 40,
    height: 40,
    sprite: '#228B22', // Forest green
    collidable: true,
    name: 'Plant',
  },
  {
    id: 'plant_2',
    x: 3400,
    y: 600,
    width: 40,
    height: 40,
    sprite: '#228B22',
    collidable: true,
    name: 'Plant',
  },
  {
    id: 'plant_3',
    x: 600,
    y: 3400,
    width: 40,
    height: 40,
    sprite: '#228B22',
    collidable: true,
    name: 'Plant',
  },
  {
    id: 'plant_4',
    x: 3400,
    y: 3400,
    width: 40,
    height: 40,
    sprite: '#228B22',
    collidable: true,
    name: 'Plant',
  },
  
  // Whiteboard
  {
    id: 'whiteboard_1',
    x: 2800,
    y: 800,
    width: 200,
    height: 120,
    sprite: '#FFFFFF', // White
    collidable: true,
    name: 'Whiteboard',
  },
  
  // Chairs (smaller objects)
  {
    id: 'chair_1',
    x: 850,
    y: 720,
    width: 50,
    height: 50,
    sprite: '#696969', // Dim gray
    collidable: true,
    name: 'Chair',
  },
  {
    id: 'chair_2',
    x: 1050,
    y: 720,
    width: 50,
    height: 50,
    sprite: '#696969',
    collidable: true,
    name: 'Chair',
  },
  {
    id: 'chair_3',
    x: 850,
    y: 920,
    width: 50,
    height: 50,
    sprite: '#696969',
    collidable: true,
    name: 'Chair',
  },
  {
    id: 'chair_4',
    x: 1050,
    y: 920,
    width: 50,
    height: 50,
    sprite: '#696969',
    collidable: true,
    name: 'Chair',
  },
];

/**
 * Get all collidable objects
 */
export function getCollidableObjects(): WorldObject[] {
  return WORLD_OBJECTS.filter(obj => obj.collidable);
}

/**
 * Get objects visible in viewport (for rendering optimization)
 */
export function getVisibleObjects(
  cameraOffsetX: number,
  cameraOffsetY: number,
  viewportWidth: number,
  viewportHeight: number
): WorldObject[] {
  const visibleObjects: WorldObject[] = [];
  
  for (const obj of WORLD_OBJECTS) {
    // Check if object intersects with viewport
    if (
      obj.x < cameraOffsetX + viewportWidth &&
      obj.x + obj.width > cameraOffsetX &&
      obj.y < cameraOffsetY + viewportHeight &&
      obj.y + obj.height > cameraOffsetY
    ) {
      visibleObjects.push(obj);
    }
  }
  
  return visibleObjects;
}

