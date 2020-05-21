export interface ThingInfo {
  slotName: string;
  rotationIndex: number;
  claimedBy: number | null;
  heldRotation: { x: number; y: number; z: number };
  shiftSlotName: string | null;
}

export interface MatchInfo {
  dealer: number;
  honba: number;
  tileSet: TileSet;
}

export interface Game {
  gameId: string;
  num: number;
  secret: string;
}

export enum SetupType {
  INITIAL = 'INITIAL',
  WINDS = 'WINDS',
  HANDS = 'HANDS',
}

export type Fives = '000' | '111' | '121';

export interface TileSet {
  back: number; // 0 or 1
  fives: Fives;
}

export namespace TileSet {
  export function initial(): TileSet {
    return { back: 0, fives: '111' };
  }

  export function equals(a: TileSet, b: TileSet): boolean {
    return a.back === b.back && a.fives === b.fives;
  }
}

export interface MouseInfo {
  held: {x: number; y: number; z: number} | null;
  mouse: {x: number; y: number; z: number; time: number} | null;
}

export enum SoundType {
  DISCARD = 'DISCARD',
  STICK = 'STICK',
};

export interface SoundInfo {
  type: SoundType;
  seat: number;
  side: number | null;
}

export interface SeatInfo {
  seat: number | null;
}
