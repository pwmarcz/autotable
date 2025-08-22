import { Vector3, Quaternion } from "three";

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
  rotation: Quaternion;
  size: Vector3;
}

export interface ThingInfo {
  slotName: string;
  rotationIndex: number;
  claimedBy: number | null;
  heldRotation: { x: number; y: number; z: number, w: number };
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
  UNSHUFFLED = 'UNSHUFFLED',
}

export type Fives = '000' | '111' | '121';

export enum GameType {
  FOUR_PLAYER = 'FOUR_PLAYER',
  FOUR_PLAYER_DEMO = 'FOUR_PLAYER_DEMO',
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
  FOUR_PLAYER_DEMO: { points: '25', seats: [0, 1, 2, 3]},
  THREE_PLAYER: { points: '35', seats: [0, 1, 2]},
  BAMBOO: { points: '100', seats: [0, 2]},
  MINEFIELD: { points: '25', seats: [0, 2]},
};

export type Points = '25' | '30' | '35' | '40' | '100';

export interface Conditions {
  gameType: GameType;
  back: number; // 0 or 1
  fives: Fives;
  points: Points;
  dealType: DealType;
}

export namespace Conditions {
  export function initial(): Conditions {
    return {
      gameType: GameType.FOUR_PLAYER,
      back: 0,
      fives: '111',
      points: '25',
      dealType: DealType.INITIAL
    };
  }

  export function equals(a: Conditions, b: Conditions): boolean {
    return a.gameType === b.gameType && a.back === b.back && a.fives === b.fives && a.points === b.points && a.dealType === b.dealType;
  }

  export function describe(ts: Conditions): string {
    const game = {
      'FOUR_PLAYER': '4p',
      'FOUR_PLAYER_DEMO': 'demo',
      'THREE_PLAYER': '3p',
      'BAMBOO': 'b',
      'MINEFIELD': 'm',
    }[ts.gameType];
    const fives = {'000': 'no red', '111': '1-1-1', '121': '1-2-1'}[ts.fives];
    return `${game}, ${fives}`;
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

export enum TileVariant {
  NO_LABELS = 'NO_LABELS',
  LABELS = 'LABELS',
}
