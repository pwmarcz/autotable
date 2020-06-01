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

interface SlotLinks {
  down?: Slot;
  up?: Slot;
  requires?: Slot;
  shiftLeft?: Slot;
  shiftRight?: Slot;
}

type SlotLinkDesc = Partial<Record<keyof SlotLinks, string>>;

export class Slot {
  name: string;
  group: string;
  type: ThingType;
  origin: Vector3;
  direction: Vector2;
  rotations: Array<Euler>;

  seat: number | null = null;

  places: Array<Place>;
  offset: Vector2;

  thing: Thing | null = null;

  links: SlotLinks;
  linkDesc: SlotLinkDesc;
  canFlipMultiple: boolean;
  drawShadow: boolean;
  shadowRotation: number;
  rotateHeld: boolean;

  constructor(params: {
    name: string;
    group: string;
    type?: ThingType;
    origin: Vector3;
    direction?: Vector2;
    rotations: Array<Euler>;
    links?: SlotLinkDesc;
    canFlipMultiple?: boolean;
    drawShadow?: boolean;
    shadowRotation?: number;
    rotateHeld?: boolean;
  }) {
    this.name = params.name;
    this.group = params.group;
    this.type = params.type ?? ThingType.TILE;
    this.origin = params.origin;
    this.direction = params.direction ?? new Vector2(1, 1);
    this.rotations = params.rotations;
    this.linkDesc = params.links ?? {};
    this.canFlipMultiple = params.canFlipMultiple ?? false;
    this.drawShadow = params.drawShadow ?? false;
    this.shadowRotation = params.shadowRotation ?? 0;
    this.rotateHeld = params.rotateHeld ?? false;

    this.places = this.rotations.map(this.makePlace.bind(this));
    this.offset = new Vector2(0, 0);
    this.links = {};
  }

  setLinks(slots: Map<string, Slot>): void {
    for (const key in this.linkDesc) {
      const linkName = key as keyof SlotLinks;
      const linkTarget = this.linkDesc[linkName];
      if (linkTarget !== undefined) {
        this.links[linkName] = slots.get(linkTarget);
      }
    }
  }

  rotated(seat: number, worldWidth: number): Slot {
    const suffix = '@' + seat;
    const rotation = seat * Math.PI / 2;

    const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotation);

    const name = this.name + suffix;

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

    const linkDesc: SlotLinkDesc = {};
    for (const key in this.linkDesc) {
      const linkName = key as keyof SlotLinks;
      const linkTarget = this.linkDesc[linkName];
      if (linkTarget !== undefined) {
        linkDesc[linkName] = linkTarget + suffix;
      }
    }

    const slot = new Slot({name, group: this.group, type: this.type, origin, direction, rotations});
    slot.seat = seat;
    slot.linkDesc = linkDesc;
    slot.canFlipMultiple = this.canFlipMultiple;
    slot.drawShadow = this.drawShadow;
    slot.shadowRotation = this.shadowRotation;
    slot.rotateHeld = this.rotateHeld;
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
    return this.thing === null || this.thing.claimedBy === playerNum;
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

  claimedBy: number | null;
  // used when claimedBy !== null:
  readonly heldRotation: Euler;
  shiftSlot: Slot | null;

  // For animation
  lastShiftSlot: Slot | null;
  lastShiftSlotTime: number;

  sent: boolean;

  constructor(index: number, type: ThingType, typeIndex: number, slot: Slot) {
    this.index = index;
    this.type = type;
    this.typeIndex = typeIndex;
    this.slot = slot;
    this.rotationIndex = 0;
    this.claimedBy = null;
    this.heldRotation = new Euler();
    this.shiftSlot = null;

    this.lastShiftSlot = null;
    this.lastShiftSlotTime = 0;

    this.sent = false;

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
    this.sent = false;
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

    this.sent = false;
  }

  hold(seat: number): void {
    this.claimedBy = seat;
    this.heldRotation.copy(this.place().rotation);
    this.sent = false;
  }

  shiftTo(seat: number, slot: Slot): void {
    this.claimedBy = seat;
    this.shiftSlot = slot;
    this.sent = false;
  }

  release(): void {
    this.claimedBy = null;
    this.shiftSlot = null;
    this.sent = false;
  }
}
