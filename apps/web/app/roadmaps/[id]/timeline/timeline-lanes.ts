import { ymdToMs } from "./timeline-utils";

export type SegmentForLane = { key: string; start: string; end: string };

/**
 * Greedy lane packing in **caller order** (e.g. user sort). Overlapping segments
 * stack vertically; non-overlapping segments can share a lane (original bar density).
 */
export function assignLanesInDisplayOrder(segments: SegmentForLane[]): Map<string, number> {
  const laneEnds: number[] = [];
  const out = new Map<string, number>();

  for (const seg of segments) {
    const a = ymdToMs(seg.start);
    const b = ymdToMs(seg.end);
    let placed = false;
    for (let i = 0; i < laneEnds.length; i++) {
      if (a > laneEnds[i]) {
        laneEnds[i] = b;
        out.set(seg.key, i);
        placed = true;
        break;
      }
    }
    if (!placed) {
      laneEnds.push(b);
      out.set(seg.key, laneEnds.length - 1);
    }
  }
  return out;
}

export function laneCountFromMap(lanes: Map<string, number>): number {
  let m = 0;
  for (const v of lanes.values()) m = Math.max(m, v + 1);
  return Math.max(1, m);
}
