import * as satellite from 'satellite.js'

/** Scene units are 1 per 1000 km. */
export const SCENE_SCALE = 1 / 1000

const cache = new Map<string, satellite.SatRec | null>()

/** Parsed SGP4 record for a TLE, cached so it is parsed once rather than every frame. */
export function satrecFor(
  tle: { line1: string; line2: string } | null | undefined
): satellite.SatRec | null {
  if (!tle?.line1 || !tle?.line2) return null
  const key = `${tle.line1}\n${tle.line2}`
  if (!cache.has(key)) {
    try {
      cache.set(key, satellite.twoline2satrec(tle.line1, tle.line2))
    } catch {
      cache.set(key, null)
    }
  }
  return cache.get(key) ?? null
}

/**
 * SGP4 position (TEME, km) mapped to scene axes: x, z, -y. The Earth mesh is
 * rotated by GMST, so inertial positions line up with the ground below.
 */
export function scenePosition(
  rec: satellite.SatRec | null,
  time: Date
): [number, number, number] | null {
  if (!rec) return null
  try {
    const result = satellite.propagate(rec, time)
    const p = result?.position
    if (!p || typeof p === 'boolean') return null
    return [p.x * SCENE_SCALE, p.z * SCENE_SCALE, -p.y * SCENE_SCALE]
  } catch {
    return null
  }
}

/** Orbital period in milliseconds; satrec.no is the mean motion in rad/min. */
export function periodMs(rec: satellite.SatRec): number {
  return ((2 * Math.PI) / rec.no) * 60_000
}
