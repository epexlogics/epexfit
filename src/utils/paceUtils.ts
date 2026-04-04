import { LocationPoint } from '../types';

/** Returns pace as "M:SS" string (per km) */
export function formatPace(distKm: number, elapsedSec: number): string {
  if (distKm < 0.01 || elapsedSec < 1) return '--:--';
  const paceSecPerKm = elapsedSec / distKm;
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.round(paceSecPerKm % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Haversine distance between two GPS points in km */
export function haversineKm(a: LocationPoint, b: LocationPoint): number {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

export interface KmSplit {
  km: number;
  paceStr: string;
  durationSec: number;
  isBest?: boolean;
  isWorst?: boolean;
}

/** Returns per-km split array from GPS points */
export function calculateSplits(points: LocationPoint[]): KmSplit[] {
  if (points.length < 2) return [];
  const splits: KmSplit[] = [];
  let kmAccum = 0;
  let splitStartTime = new Date(points[0].timestamp).getTime();
  let kmCount = 1;

  for (let i = 1; i < points.length; i++) {
    kmAccum += haversineKm(points[i - 1], points[i]);
    if (kmAccum >= 1.0) {
      const dur =
        (new Date(points[i].timestamp).getTime() - splitStartTime) / 1000;
      splits.push({
        km: kmCount,
        paceStr: formatPace(1, dur),
        durationSec: dur,
      });
      kmAccum -= 1.0;
      splitStartTime = new Date(points[i].timestamp).getTime();
      kmCount++;
    }
  }

  // Mark best/worst
  if (splits.length > 1) {
    const sorted = [...splits].sort((a, b) => a.durationSec - b.durationSec);
    const bestDur = sorted[0].durationSec;
    const worstDur = sorted[sorted.length - 1].durationSec;
    return splits.map((s) => ({
      ...s,
      isBest: s.durationSec === bestDur,
      isWorst: s.durationSec === worstDur,
    }));
  }
  return splits;
}
