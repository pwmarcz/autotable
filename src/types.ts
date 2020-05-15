export interface ThingInfo {
  slotName: string;
  rotationIndex: number;
  heldBy: number | null;
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

export interface TileSet {
  back: number; // 0 or 1
  fives: '000' | '111' | '121';
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
  playerNum: number;
  side: number;
}
