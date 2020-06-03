import { Vector3, Vector2, Euler } from "three";
import { Slot } from "./slot";
import { Size, ThingType, GameType } from "./types";

const WORLD_SIZE = 174;

const Rotation = {
  FACE_UP: new Euler(0, 0, 0),
  FACE_UP_SIDEWAYS: new Euler(0, 0, Math.PI / 2),
  STANDING: new Euler(Math.PI / 2, 0, 0),
  FACE_DOWN: new Euler(Math.PI, 0, 0),
  FACE_DOWN_REVERSE: new Euler(Math.PI, 0, Math.PI),
};

type SlotOp = (slots: Array<Slot>) => Array<Slot>;
type SlotGroup = Array<SlotOp>;

export function makeSlots(gameType: GameType): Array<Slot> {
  const slots = [];

  for (const group of SLOT_GROUPS[gameType]) {
    let current: Array<Slot> = [];
    for (const op of group) {
      current = op(current);
    }
    slots.push(...current);
  }

  fixupSlots(slots, gameType);
  return slots;
}

function start(name: string): SlotOp {
  return _ => [START[name]];
}

interface RepeatOptions {
  stack?: boolean;
  shift?: boolean;
  push?: boolean;
}

function repeat(count: number, offset: Vector3, options: RepeatOptions = {}): SlotOp {
  return (slots: Array<Slot>) => {
    const result: Array<Slot> = [];
    for (const slot of slots) {
      const totalOffset = new Vector3(0, 0, 0);
      for (let i = 0; i < count; i++) {
        const copied = slot.copy(`.${i}`);
        copied.origin = copied.origin.clone().add(totalOffset);
        copied.indexes.push(i);
        result.push(copied);
        totalOffset.add(offset);

        if (i < count - 1) {
          const next = `${slot.name}.${i+1}`;
          if (options.stack) copied.linkDesc.up = next;
          if (options.shift) copied.linkDesc.shiftRight = next;
          if (options.push) copied.linkDesc.push = next;
        }

        if (i > 0) {
          const prev = `${slot.name}.${i-1}`;
          if (options.stack) copied.linkDesc.down = prev;
          if (options.shift) copied.linkDesc.shiftLeft = prev;
        }
      }
    }
    return result;
  };
}

function row(count: number, dx?: number, options: RepeatOptions = {}): SlotOp {
  return repeat(count, new Vector3(dx ?? Size.TILE.x, 0, 0), options);
}

function column(count: number, dy?: number): SlotOp {
  return repeat(count, new Vector3(0, dy ?? Size.TILE.y, 0));
}

function stack(dz?: number): SlotOp {
  return repeat(2, new Vector3(0, 0, dz ?? Size.TILE.z), {stack: true});
}

function seats(which?: Array<number>): SlotOp {
  const seats = which ?? [0, 1, 2, 3];
  return (slots: Array<Slot>) => {
    const result: Array<Slot> = [];
    for (const seat of seats) {
      for (const slot of slots) {
        const copied = slot.copy(`@${seat}`);
        copied.rotate(seat, WORLD_SIZE);
        result.push(copied);
      }
    }
    return result;
  };
}

const START: Record<string, Slot> = {
  'hand': new Slot({
    name: 'hand',
    group: 'hand',
    origin: new Vector3(46, 0, 0),
    rotations: [Rotation.STANDING, Rotation.FACE_UP, Rotation.FACE_DOWN],
    canFlipMultiple: true,
    drawShadow: true,
    shadowRotation: 1,
    rotateHeld: true,
  }),

  'hand.extra': new Slot({
    name: `hand.extra`,
    group: `hand`,
    origin: new Vector3(
      46 + 14.5*Size.TILE.x,
      0,
      0,
    ),
    rotations: [Rotation.STANDING, Rotation.FACE_UP, Rotation.FACE_DOWN],
    canFlipMultiple: true,
    rotateHeld: true,
  }),

  'meld': new Slot({
    name: `meld`,
    group: `meld`,
    origin: new Vector3(174, 0, 0),
    direction: new Vector2(-1, 1),
    rotations: [Rotation.FACE_UP, Rotation.FACE_UP_SIDEWAYS, Rotation.FACE_DOWN],
  }),

  'wall': new Slot({
    name: 'wall',
    group: 'wall',
    origin: new Vector3(30, 20, 0),
    rotations: [Rotation.FACE_DOWN, Rotation.FACE_UP],
  }),

  'wall.open': new Slot({
    name: 'wall.open',
    group: 'wall.open',
    origin: new Vector3(36, 14, 0),
    rotations: [Rotation.STANDING, Rotation.FACE_DOWN],
    canFlipMultiple: true,
  }),

  'discard': new Slot({
    name: `discard`,
    group: `discard`,
    origin: new Vector3(69, 60, 0),
    direction: new Vector2(1, 1),
    rotations: [Rotation.FACE_UP, Rotation.FACE_UP_SIDEWAYS],
    drawShadow: true,
  }),

  'discard.extra': new Slot({
    name: `discard.extra`,
    group: `discard`,
    origin: new Vector3(69 + 6 * Size.TILE.x, 60 - 2 * Size.TILE.y, 0),
    direction: new Vector2(1, 1),
    rotations: [Rotation.FACE_UP, Rotation.FACE_UP_SIDEWAYS],
  }),

  'tray': new Slot({
    name: `tray`,
    group: `tray`,
    type: ThingType.STICK,
    origin: new Vector3(15, -25, 0),
    rotations: [Rotation.FACE_UP],
  }),

  'payment': new Slot({
    name: 'payment',
    group: 'payment',
    type: ThingType.STICK,
    origin: new Vector3(42, 42, 0),
    rotations: [Rotation.FACE_UP_SIDEWAYS],
  }),

  'riichi': new Slot({
    name: 'riichi',
    group: 'riichi',
    type: ThingType.STICK,
    origin: new Vector3(
      (WORLD_SIZE - Size.STICK.x) / 2,
      71.5,
      1.5,
    ),
    rotations: [Rotation.FACE_UP],
  }),

  'marker': new Slot({
    name: 'marker',
    group: 'marker',
    type: ThingType.MARKER,
    origin: new Vector3(
      166, -8, 0,
    ),
    rotations: [Rotation.FACE_DOWN_REVERSE, Rotation.FACE_UP],
  }),
};

export const SLOT_GROUPS: Record<GameType, Array<SlotGroup>> = {
  FOUR_PLAYER: [
    [start('hand'), row(14, undefined, {shift: true}), seats()],
    [start('hand.extra'), seats()],
    [start('meld'), column(4), row(4, -Size.TILE.x, {push: true, shift: true}), seats()],
    [start('wall'), row(19), stack(), seats()],
    [start('discard'), column(3, -Size.TILE.y), row(6, undefined, {push: true}), seats()],
    [start('discard.extra'), row(4, undefined, {push: true}), seats()],

    [start('tray'), row(6, 24), column(10, -3), seats()],
    [start('payment'), row(8, 3), column(10, -3), seats()],
    [start('riichi'), seats()],
    [start('marker'), seats()],
  ],

  BAMBOO: [
    [start('hand'), row(14, undefined, {shift: true}), seats([0, 2])],
    [start('hand.extra'), seats([0, 2])],
    [start('meld'), column(4), row(4, -Size.TILE.x, {push: true, shift: true}), seats([0, 2])],
    [start('wall'), row(19), stack(), seats([0, 2])],
    [start('discard'), column(3, -Size.TILE.y), row(6, undefined, {push: true}), seats([0, 2])],

    [start('tray'), row(6, 24), column(10, -3), seats()],
    [start('payment'), row(8, 3), column(10, -3), seats()],
    [start('riichi'), seats()],
    [start('marker'), seats()],
  ],

  MINEFIELD: [
    [start('hand'), row(14, undefined, {shift: true}), seats([0, 2])],
    [start('hand.extra'), seats([0, 2])],
    [start('wall'), row(19), stack(), seats([1, 3])],
    [start('wall.open'), column(2, Size.TILE.y * 1.6), row(17, undefined, {shift: true}), seats([0, 2])],
    [start('discard'), column(3, -Size.TILE.y), row(6, undefined, {push: true}), seats([0, 2])],

    [start('tray'), row(6, 24), column(10, -3), seats()],
    [start('payment'), row(8, 3), column(10, -3), seats()],
    [start('riichi'), seats()],
    [start('marker'), seats()],
  ],
};

function fixupSlots(slots: Array<Slot>, gameType: GameType): void {
  for (const slot of slots) {
    if (slot.name.startsWith('discard.extra')) {
      slot.linkDesc.requires = `discard.2.5@${slot.seat}`;
    }
    if (slot.name.startsWith('discard.2.5')) {
      slot.linkDesc.push = `discard.extra.0@${slot.seat}`;
    }
    if (slot.group === 'wall' &&
        slot.indexes[0] !== 0 && slot.indexes[0] !== 18 && slot.indexes[1] === 0) {
      slot.drawShadow = true;
    }
    if (slot.group === 'meld' && slot.indexes[0] > 0) {
      slot.linkDesc.requires = `meld.${slot.indexes[0]-1}.1@${slot.seat}`;
    }
    if (slot.group === 'wall.open' && slot.indexes[0] === 1 && slot.indexes[1] === 16) {
      slot.linkDesc.shiftRight = `wall.open.0.0@${slot.seat}`;
    }
    if (slot.group === 'wall.open' && slot.indexes[0] === 0 && slot.indexes[1] === 0) {
      slot.linkDesc.shiftLeft = `wall.open.1.16@${slot.seat}`;
    }
  }
}
