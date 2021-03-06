import { Vector3 } from "three";

export function shuffle<T>(arr: Array<T>): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[j];
    arr[j] = arr[i];
    arr[i] = temp;
  }
}

export function filterMostCommon<T, R>(arr: Array<T>, func: (elem: T) => R): Array<T> {
  const result = mostCommon(arr, func);
  if (result === null) {
    return [];
  }
  return arr.filter(elem => func(elem) === result);
}

export function mostCommon<T, R>(arr: Array<T>, func: (elem: T) => R): R | null {
  if (arr.length === 0) {
    return null;
  }

  const counts: Map<R, number> = new Map();
  for (const elem of arr) {
    const result = func(elem);
    const current = counts.get(result);
    if (current !== undefined) {
      counts.set(result, current + 1);
    } else {
      counts.set(result, 1);
    }
  }

  const allResults = Array.from(counts.keys());
  allResults.sort((a, b) => counts.get(b)! - counts.get(a)!);
  return allResults[0];
}

// Overlap of two rectangles, given by midpoint and size
export function rectangleOverlap(
  x1: number, y1: number, w1: number, h1: number,
  x2: number, y2: number, w2: number, h2: number
): number {
  const xa = Math.max(x1 - w1/2, x2 - w2/2);
  const xb = Math.min(x1 + w1/2, x2 + w2/2);
  const ya = Math.max(y1 - h1/2, y2 - h2/2);
  const yb = Math.min(y1 + h1/2, y2 + h2/2);

  return Math.max(0, xb - xa) * Math.max(0, yb - ya);
}

export class Animation {
  private startTime = 0;
  private endTime = 1;
  private startPos = 0;
  private endPos = 0;
  private period: number;
  pos = -1;

  constructor(period: number) {
    this.period = period;
  }

  start(endPos: number): void {
    this.startPos = this.pos;
    this.startTime = new Date().getTime();
    this.endPos = endPos;
    this.endTime = this.startTime + this.period * Math.abs(endPos - this.pos);
  }

  update(): boolean {
    if (this.pos === this.endPos) {
      return false;
    }

    const now = new Date().getTime();
    const delta = (now - this.startTime) / (this.endTime - this.startTime);
    this.pos = this.startPos + (this.endPos - this.startPos) * Math.min(1, delta);
    return true;
  }
}

export function round3(vec: Vector3, factor: number): void {
  vec.x = Math.round(vec.x * factor) / factor;
  vec.y = Math.round(vec.y * factor) / factor;
  vec.z = Math.round(vec.z * factor) / factor;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

export function compareZYX(a: Vector3, b: Vector3): number {
  if (a.z !== b.z) {
    return a.z - b.z;
  }
  if (a.y !== b.y) {
    return a.y - b.z;
  }
  if (a.x !== b.x) {
    return a.x - b.x;
  }
  return 0;
}
