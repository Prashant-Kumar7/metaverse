/**
 * World Object type definitions
 * Represents static objects in the world (furniture, walls, etc.)
 */

export interface WorldObject {
  id: string;
  x: number; // World X coordinate (in pixels)
  y: number; // World Y coordinate (in pixels)
  width: number; // Width in pixels
  height: number; // Height in pixels
  sprite: string; // Visual identifier (CSS color or image URL)
  collidable: boolean; // Whether this object blocks movement
  name?: string; // Optional name/type
}

/**
 * Check if two axis-aligned bounding boxes (AABB) intersect
 */
export function checkAABBCollision(
  obj1X: number, obj1Y: number, obj1W: number, obj1H: number,
  obj2X: number, obj2Y: number, obj2W: number, obj2H: number
): boolean {
  return (
    obj1X < obj2X + obj2W &&
    obj1X + obj1W > obj2X &&
    obj1Y < obj2Y + obj2H &&
    obj1Y + obj1H > obj2Y
  );
}

/**
 * Check if a point intersects with a world object
 */
export function checkPointObjectCollision(
  pointX: number,
  pointY: number,
  object: WorldObject
): boolean {
  return (
    pointX >= object.x &&
    pointX <= object.x + object.width &&
    pointY >= object.y &&
    pointY <= object.y + object.height
  );
}

/**
 * Check if a circle (user) collides with a world object
 * Uses AABB collision with circle approximated as square
 */
export function checkUserObjectCollision(
  userX: number,
  userY: number,
  userRadius: number,
  object: WorldObject
): boolean {
  // Approximate user as square for simplicity (can be refined later)
  const userSize = userRadius * 2;
  return checkAABBCollision(
    userX - userRadius,
    userY - userRadius,
    userSize,
    userSize,
    object.x,
    object.y,
    object.width,
    object.height
  );
}

