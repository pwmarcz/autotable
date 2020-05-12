import { Vector2, Euler, Vector3, Quaternion } from "three";
import { round3 } from "./utils";

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

export class Slot {
  name: string;
  group: string;
  type: ThingType;
  origin: Vector3;
  direction: Vector2;
  rotations: Array<Euler>;

  places: Array<Place>;
  offset: Vector2;

  thing: Thing | null = null;

  down: string | null;
  up: string | null;
  requires: string | null;
  shiftLeft: string | null;
  shiftRight: string | null;
  canFlipMultiple: boolean;
  drawShadow: boolean;
  shadowRotation: number;

  constructor(params: {
    name: string;
    group: string;
    type?: ThingType;
    origin: Vector3;
    direction?: Vector2;
    rotations: Array<Euler>;
    down?: string | null;
    up?: string | null;
    requires?: string | null;
    shiftLeft?: string | null;
    shiftRight?: string | null;
    canFlipMultiple?: boolean;
    drawShadow?: boolean;
    shadowRotation?: number;
  }) {
    this.name = params.name;
    this.group = params.group;
    this.type = params.type ?? ThingType.TILE;
    this.origin = params.origin;
    this.direction = params.direction ?? new Vector2(1, 1);
    this.rotations = params.rotations;
    this.down = params.down ?? null;
    this.up = params.up ?? null;
    this.requires = params.requires ?? null;
    this.shiftLeft = params.shiftLeft ?? null;
    this.shiftRight = params.shiftRight ?? null;
    this.canFlipMultiple = params.canFlipMultiple ?? false;
    this.drawShadow = params.drawShadow ?? true;
    this.shadowRotation = params.shadowRotation ?? 0;

    this.places = this.rotations.map(this.makePlace.bind(this));
    this.offset = new Vector2(0, 0);
  }

  rotated(suffix: string, rotation: number, worldWidth: number): Slot {
    const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotation);

    const name = this.name + suffix;
    const group = /@/.exec(this.group) ? this.group : this.group + suffix;

    const pos = new Vector3(
      this.origin.x - worldWidth / 2,
      this.origin.y - worldWidth / 2,
      this.origin.z,
    );
    pos.applyQuaternion(quat);
    const origin = new Vector3(
      pos.x + worldWidth / 2,
      pos.y + worldWidth / 2,
      pos.z,
    );

    round3(pos, 16);
    round3(origin, 16);

    const dir = new Vector3(this.direction.x, this.direction.y, 0);
    dir.applyQuaternion(quat);
    const direction = new Vector2(dir.x, dir.y);

    const rotations = this.rotations.map(rot => {
      const q = new Quaternion().setFromEuler(rot);
      q.premultiply(quat);
      return new Euler().setFromQuaternion(q);
    });

    const slot = new Slot({name, group, type: this.type, origin, direction, rotations});
    slot.down = this.down && this.down + suffix;
    slot.up = this.up && this.up + suffix;
    slot.requires = this.requires && this.requires + suffix;
    slot.shiftLeft = this.shiftLeft && this.shiftLeft + suffix;
    slot.shiftRight = this.shiftRight && this.shiftRight + suffix;
    slot.canFlipMultiple = this.canFlipMultiple;
    slot.drawShadow = this.drawShadow;
    slot.shadowRotation = this.shadowRotation;
    return slot;
  }

  makePlace(rotation: Euler): Place {
    const dim = Size[this.type];

    const xv = new Vector3(0, 0, dim.z).applyEuler(rotation);
    const yv = new Vector3(0, dim.y, 0).applyEuler(rotation);
    const zv = new Vector3(dim.x, 0, 0).applyEuler(rotation);
    const maxx = Math.max(Math.abs(xv.x), Math.abs(yv.x), Math.abs(zv.x));
    const maxy = Math.max(Math.abs(xv.y), Math.abs(yv.y), Math.abs(zv.y));
    const maxz = Math.max(Math.abs(xv.z), Math.abs(yv.z), Math.abs(zv.z));

    const size = new Vector3(maxx, maxy, maxz);

    return {
      position: new Vector3(
        this.origin.x + maxx / 2 * this.direction.x,
        this.origin.y + maxy / 2 * this.direction.y,
        this.origin.z + maxz/2,
      ),
      rotation: rotation,
      size,
    };
  }

  canBeUsed(playerNum: number): boolean {
    return this.thing === null || this.thing.heldBy === playerNum;
  }

  placeWithOffset(rotationIndex: number): Place {
    const place = this.places[rotationIndex];
    if (this.offset.x === 0 && this.offset.y === 0) {
      return place;
    }
    const position = place.position.clone();
    position.x += this.offset.x;
    position.y += this.offset.y;
    return {...place, position };
  }

  handlePush(source: Slot): void {
    this.offset.copy(source.offset);

    if (source.thing === null) {
      return;
    }
    const rotationIndex = this.thing ? this.thing.rotationIndex : 0;

    const place = this.places[rotationIndex];
    const sourcePlace = source.places[source.thing.rotationIndex];

    // Relative slot position
    const sdx = this.origin.x - source.origin.x;
    const sdy = this.origin.y - source.origin.y;

    if (Math.abs(sdx) > Math.abs(sdy)) {
      const dx = place.position.x - sourcePlace.position.x - source.offset.x;
      const sizex = (place.size.x + sourcePlace.size.x) / 2;

      const dist = sizex - Math.sign(sdx) * dx;
      if (dist > 0) {
        this.offset.x = Math.sign(sdx) * dist;
      }
    } else {
      const dy = place.position.y - sourcePlace.position.y - source.offset.y;
      const sizey = (place.size.y + sourcePlace.size.y) / 2;

      const dist = sizey - Math.sign(sdy) * dy;
      if (dist > 0) {
        this.offset.y = Math.sign(sdy) * dist;
      }
    }
  }


}

export class Thing {
  index: number;
  type: ThingType;
  typeIndex: number;
  slot: Slot;
  rotationIndex: number;

  heldBy: number | null;
  // place: Place;

  constructor(index: number, type: ThingType, typeIndex: number, slot: Slot) {
    this.index = index;
    this.type = type;
    this.typeIndex = typeIndex;
    this.slot = slot;
    this.rotationIndex = 0;
    this.heldBy = null;

    this.slot.thing = this;
  }

  place(): Place {
    return this.slot.placeWithOffset(this.rotationIndex);
  }

  flip(rotationIndex?: number): void {
    if (rotationIndex === undefined) {
      rotationIndex = this.rotationIndex + 1;
    }
    const r = this.slot.rotations.length;
    this.rotationIndex = (rotationIndex + r) % r;
  }

  prepareMove(): void {
    // console.log('remove', this.index, this.slot.name);
    this.slot.thing = null;
  }

  moveTo(target: Slot, rotationIndex?: number): void {
    // console.log('moveTo', this.index, target.name);
    if (target.thing !== null) {
      throw `slot not empty: ${this.index} ${target.name}`;
    }
    this.slot = target;
    this.rotationIndex = rotationIndex ?? 0;
    target.thing = this;
  }
}

type SlotOp = (slot: Slot) => Slot | null;

export class Movement {
  private thingMap: Map<Thing, Slot> = new Map();
  private reverseMap: Map<Slot, Thing> = new Map();

  move(thing: Thing, slot: Slot): void {
    if (this.reverseMap.has(slot)) {
      throw `move(): conflict`;
    }
    const oldSlot = this.thingMap.get(thing);
    if (oldSlot !== undefined) {
      this.reverseMap.delete(oldSlot);
    }
    this.thingMap.set(thing, slot);
    this.reverseMap.set(slot, thing);
  }

  has(thing: Thing): boolean {
    return this.thingMap.has(thing);
  }

  get(thing: Thing): Slot | null {
    return this.thingMap.get(thing) ?? null;
  }

  rotationIndex(thing: Thing): number {
    const slot = this.thingMap.get(thing);
    if (slot === undefined) {
      return 0;
    }
    return thing.slot.group === slot.group ? thing.rotationIndex : 0;
  }

  slots(): Iterable<Slot> {
    return this.thingMap.values();
  }

  things(): Iterable<Thing> {
    return this.thingMap.keys();
  }

  hasSlot(slot: Slot): boolean {
    return this.reverseMap.has(slot);
  }

  valid(): boolean {
    for (const slot of this.reverseMap.keys()) {
      if (slot.thing !== null && !this.thingMap.has(slot.thing)) {
        return false;
      }
    }
    return true;
  }

  apply(): void {
    for (const thing of this.thingMap.keys()) {
      thing.prepareMove();
    }
    for (const [thing, slot] of this.thingMap.entries()) {
      // TODO instead of group, check if rotations are the same?
      const rotationIndex = thing.slot.group === slot.group ? thing.rotationIndex : 0;
      thing.moveTo(slot, rotationIndex);
    }
  }

  findShift(allThings: Array<Thing>, ops: Array<SlotOp>): boolean {
    let shift: Map<Slot, Thing> | null = new Map();
    for (const thing of allThings) {
      if (!this.thingMap.has(thing)) {
        shift.set(thing.slot, thing);
      }
    }

    for (const slot of this.thingMap.values()) {
      if (shift.has(slot)) {
        shift = this.findShiftFor(slot, ops, shift);
        if (shift === null) {
          return false;
        }
      }
    }
    for (const [slot, thing] of shift.entries()) {
      if (slot.thing !== thing) {
        this.move(thing, slot);
      }
    }
    return true;
  }

  private findShiftFor(
    slot: Slot, ops: Array<SlotOp>, shift: Map<Slot, Thing>
  ): Map<Slot, Thing> | null {
    // console.log('findShiftFor', slot.name);
    if (!shift.has(slot)) {
      return null;
    }

    // Prefer moving to the left
    for (const op of ops) {
      const cloned = new Map(shift.entries());
      if (this.tryShift(slot, op, cloned)) {
        return cloned;
      }
    }
    return null;
  }

  private tryShift(initialSlot: Slot, op: SlotOp, shift: Map<Slot, Thing>): boolean {
    let slot = initialSlot;
    const thing = shift.get(initialSlot)!;
    // console.log('tryShift start', thing.index, slot.name);
    while (slot === initialSlot || this.reverseMap.has(slot)) {
      const nextSlot = op(slot);
      if (nextSlot === null) {
        return false;
      }

      if (shift.has(nextSlot)) {
        if (!this.tryShift(nextSlot, op, shift)) {
          return false;
        }
      }
      shift.delete(slot);
      shift.set(nextSlot, thing);
      slot = nextSlot;
    }
    // console.log('tryShift end', thing.index, slot.name);
    return true;
  }
}
