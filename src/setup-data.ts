import { Vector3, Vector2, Euler } from "three";
import { Slot, ThingType, Size } from "./places";

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

export function makeSlots(): Array<Slot> {
  const slots = [];

  for (const group of SLOT_GROUPS) {
    let current: Array<Slot> = [];
    for (const op of group) {
      current = op(current);
    }

    slots.push(...current);
  }
  return slots;
}

function start(name: string): SlotOp {
  return _ => [START[name]];
}

function repeat(count: number, offset: Vector3): SlotOp {
  return (slots: Array<Slot>) => {
    const result: Array<Slot> = [];
    for (const slot of slots) {
      const totalOffset = new Vector3(0, 0, 0);
      for (let i = 0; i < count; i++) {
        const copied = slot.copy(`.${i}`);
        copied.origin = copied.origin.clone().add(totalOffset);
        result.push(copied);
        totalOffset.add(offset);
      }
    }
    return result;
  };
}

function row(count: number, dx?: number): SlotOp {
  return repeat(count, new Vector3(dx ?? Size.TILE.x, 0, 0));
}

function column(count: number, dy?: number): SlotOp {
  return repeat(count, new Vector3(0, dy ?? Size.TILE.y, 0));
}

function stack(dz?: number): SlotOp {
  return repeat(2, new Vector3(0, 0, dz ?? Size.TILE.z));
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
    drawShadow: true,
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
    name: `discard`,
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

export const SLOT_GROUPS: Array<SlotGroup> = [
  [start('hand'), row(14), seats()],
  [start('hand.extra'), seats()],
  [start('meld'), column(4), row(4, -Size.TILE.x), seats()],
  [start('wall'), row(19), stack(), seats()],
  [start('discard'), column(3, -Size.TILE.y), row(6), seats()],
  [start('discard.extra'), row(3), seats()],
  [start('tray'), row(6, 24), column(10, -3), seats()],
  [start('payment'), row(8, 3), column(10, -3), seats()],
  [start('riichi'), seats()],
  [start('marker'), seats()],
];


type DealRange = [string, 0 | 1 | 2 | 3, number];

export interface DealPart {
  roll?: number;
  tiles?: Array<number>;
  rotationIndex?: number;
  ranges: Array<DealRange>;
}

export const DEALS: Record<string, Array<DealPart>> = {
  'INITIAL': [
    {
      ranges: [
        ['wall.1.0', 0, 34],
        ['wall.1.0', 1, 34],
        ['wall.1.0', 2, 34],
        ['wall.1.0', 3, 34],
      ]
    },
  ],
  'WINDS': [
    {
      tiles: [108, 112, 116, 120],
      ranges: [['hand.5', 0, 4]],
      rotationIndex: 2,
    },
    {
      ranges: [
        ['wall.1.0', 0, 32],
        ['wall.1.0', 1, 34],
        ['wall.1.0', 2, 32],
        ['wall.1.0', 3, 34],
      ],
    },
  ],
  'HANDS': [
    {
      ranges: [
        ['hand.0', 0, 13],
        ['hand.0', 1, 13],
        ['hand.0', 2, 13],
        ['hand.0', 3, 13],
      ],
      rotationIndex: 2,
    },

    { roll: 2, ranges: [['wall.16.0', 1, 4], ['wall.0.0', 2, 10], ['wall.6.0', 2, 24], ['wall.1.0', 3, 34], ['wall.1.0', 0, 12]] },
    { roll: 3, ranges: [['wall.15.0', 2, 6], ['wall.0.0', 3, 8], ['wall.5.0', 3, 26], ['wall.1.0', 0, 34], ['wall.1.0', 1, 10]] },
    { roll: 4, ranges: [['wall.14.0', 3, 8], ['wall.0.0', 0, 6], ['wall.4.0', 0, 28], ['wall.1.0', 1, 34], ['wall.1.0', 2, 8]] },
    { roll: 5, ranges: [['wall.13.0', 0, 10], ['wall.0.0', 1, 4], ['wall.3.0', 1, 30], ['wall.1.0', 2, 34], ['wall.1.0', 3, 6]] },
    { roll: 6, ranges: [['wall.12.0', 1, 12], ['wall.0.0', 2, 2], ['wall.2.0', 2, 32], ['wall.1.0', 3, 34], ['wall.1.0', 0, 4]] },

    { roll: 7, ranges: [['wall.11.0', 2, 14], ['wall.1.0', 3, 34], ['wall.1.0', 0, 34], ['wall.1.0', 1, 2]] },

    { roll: 8, ranges: [['wall.9.0', 3, 14], ['wall.17.0', 3, 2], ['wall.1.0', 0, 34], ['wall.1.0', 1, 34]] },
    { roll: 9, ranges: [['wall.8.0', 0, 14], ['wall.16.0', 0, 4], ['wall.1.0', 1, 34], ['wall.1.0', 2, 32]] },
    { roll: 10, ranges: [['wall.7.0', 1, 14], ['wall.15.0', 1, 6], ['wall.1.0', 2, 34], ['wall.1.0', 3, 30]] },
    { roll: 11, ranges: [['wall.6.0', 2, 14], ['wall.14.0', 2, 8], ['wall.1.0', 3, 34], ['wall.1.0', 0, 28]] },
    { roll: 12, ranges: [['wall.5.0', 3, 14], ['wall.13.0', 3, 10], ['wall.1.0', 0, 34], ['wall.1.0', 1, 26]] },
  ],
};
