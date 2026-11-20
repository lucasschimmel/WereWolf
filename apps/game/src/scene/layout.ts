import * as T from "three";

export type Pose = { x: number; z: number; yaw: number };

export const plazaRadius = 9.6;
export const seatRadius = 6.3;
export const wellRadius = 1.75;
export const interiorOrigin = new T.Vector3(0, 0, 320);

export function seat(index: number, count: number): Pose {
  const angle = (index * 2 * Math.PI) / Math.max(count, 8);
  return {
    x: Math.sin(angle) * seatRadius,
    z: Math.cos(angle) * seatRadius,
    yaw: angle,
  };
}

export const wrap = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));

/** Yaw convention: a pose looks toward (-sin yaw, -cos yaw). */
export const facing = (yaw: number) => ({
  x: -Math.sin(yaw),
  z: -Math.cos(yaw),
});

export const yawToward = (
  from: { x: number; z: number },
  to: { x: number; z: number },
) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

export function dampAngle(
  current: number,
  target: number,
  rate: number,
  delta: number,
) {
  // Wrapped, so a yaw never grows unbounded after a few turns.
  return wrap(current + wrap(target - current) * (1 - Math.exp(-rate * delta)));
}

export function clampToPlaza(x: number, z: number) {
  const distance = Math.hypot(x, z);
  if (distance > plazaRadius) {
    const scale = plazaRadius / distance;
    return { x: x * scale, z: z * scale };
  }
  if (distance < wellRadius) {
    if (distance === 0) return { x: wellRadius, z: 0 };
    const scale = wellRadius / distance;
    return { x: x * scale, z: z * scale };
  }
  return { x, z };
}
