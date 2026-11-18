import * as T from "three";

export type Pose = { x: number; z: number; yaw: number };

export const plazaRadius = 9.6;
export const seatRadius = 6.3;
export const wellRadius = 1.75;
export const interiorOrigin = new T.Vector3(0, 0, 320);
export const towerPosition = new T.Vector3(0, 0, -21.5);

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
  return current + wrap(target - current) * (1 - Math.exp(-rate * delta));
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

export function terrainHeight(x: number, z: number) {
  const distance = Math.hypot(x, z);
  const rise = T.MathUtils.smoothstep(distance, 24, 70);
  const hills =
    Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.052 - 0.4) * 2.6 +
    Math.sin(x * 0.11 - z * 0.08) * 0.9 +
    Math.cos(z * 0.13 + x * 0.03) * 0.6;
  return rise * (hills + 1.2 + (distance - 24) * 0.05);
}
