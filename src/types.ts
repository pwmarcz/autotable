import { Vector3, Euler } from "three";
import { tileMapToString, parseTileString } from "./game-ui";

export enum ThingType {
  TILE = 'TILE',
  STICK = 'STICK',
  MARKER = 'MARKER',
}

export const Size = {
  TILE: new Vector3(6, 9, 4),
  STICK: new Vector3(20, 2, 1),
  MARKER: new Vector3(12, 6, 1),
};

export interface Place {
  position: Vector3;
  rotation: Euler;
  size: Vector3;
}

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
  conditions: Conditions;
}

export interface Game {
  gameId: string;
  num: number;
}

export enum DealType {
  INITIAL = 'INITIAL',
  WINDS = 'WINDS',
  HANDS = 'HANDS',
}

export enum GameType {
  FOUR_PLAYER = 'FOUR_PLAYER',
  THREE_PLAYER = 'THREE_PLAYER',
  BAMBOO = 'BAMBOO',
  MINEFIELD = 'MINEFIELD',
}

interface GameTypeMeta {
  points: Points;
  seats: Array<number>;
}

export const GAME_TYPES: Record<GameType, GameTypeMeta> = {
  FOUR_PLAYER: { points: '25', seats: [0, 1, 2, 3]},
  THREE_PLAYER: { points: '35', seats: [0, 1, 2]},
  BAMBOO: { points: '100', seats: [0, 2]},
  MINEFIELD: { points: '25', seats: [0, 2]},
};

export type Points = '25' | '30' | '35' | '40' | '100';

export interface Conditions {
  gameType: GameType;
  back: number; // 0 or 1
  aka: Record<string, number>;
  points: Points;
}

export namespace Conditions {
  export function initial(): Conditions {
    return { gameType: GameType.FOUR_PLAYER, back: 0, aka: parseTileString('5m5p5s'), points: '25' };
  }

  export function equals(a: Conditions, b: Conditions): boolean {
    return a.gameType === b.gameType && a.back === b.back && tileMapToString(a.aka) === tileMapToString(b.aka);
  }

  export function describe(ts: Conditions): string {
    const game = {'FOUR_PLAYER': '4p', 'THREE_PLAYER': '3p', 'BAMBOO': 'b', 'MINEFIELD': 'm'}[ts.gameType];
    let aka = tileMapToString(ts.aka);
    if (ts.aka === undefined || aka === "") {
      aka = "no aka";
    }
    return `${game}, ${aka}`;
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
