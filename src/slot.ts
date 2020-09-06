import { ThingType, Place, Size } from "./types";
import { Vector3, Vector2, Euler, Quaternion } from "three";
import { Thing } from "./thing";
import { round3 } from "./utils";


interface SlotLinks {
  // A slot stacked above/below current one, in a wall.
  down?: Slot;
  up?: Slot;

  // You have to fill that slot before current one becomes usable.
  requires?: Slot;

  // Move things in this slot to left/right when dropping. Used for example for
  // sorting your hand.
  shiftLeft?: Slot;
  shiftRight?: Slot;

  // A rotated tile in current slot pushes this one. Used for riichi.
  push?: Slot;
}

type SlotLinkDesc = Partial<Record<keyof SlotLinks, string>>;

export class Slot {
  // Full name: 'wall.1.1@3'
  name: string;

  // Group: 'wall'
  group: string;

  type: ThingType;

  origin: Vector3;
  direction: Vector2;

  // Permitted rotations for things in this slot
  readonly rotationOptions: Array<Euler>;
  rotations: Array<Euler>;

  // Coordinates of this slot, e.g. 'wall.1.2@3' has indexes [1, 2]
  indexes: Array<number> = [];

  // Player number
  seat: number | null = null;

  // Places (box parameters) corresponding to rotations
  places: Array<Place>;

  // Offset from origin, recomputed when pushing
  offset: Vector2;

  // Current thing in this slot
  thing: Thing | null = null;

  // Slots related to this one - first as strings, then as references
  links: SlotLinks;
  linkDesc: SlotLinkDesc;

  // Can select and filp multiple of this kind
  canFlipMultiple: boolean;

  // Draw a permanent shadow for this slot
  drawShadow: boolean;

  // Rotation to use for this shadow (for example, 'hand' slots have shadows
  // for tiles lying down, even though the tiles are standing by default)
  shadowRotation: number;

  // Rotate a tile hovered over this slot. Used for hand.
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
    this.rotationOptions = params.rotations;
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

  static setLinks(slots: Map<string, Slot>): void {
    for (const slot of slots.values()) {
      for (const key in slot.linkDesc) {
        const linkName = key as keyof SlotLinks;
        const linkTarget = slot.linkDesc[linkName];
        if (linkTarget !== undefined) {
          slot.links[linkName] = slots.get(linkTarget);
        }
      }
    }
  }

  static computePushes(slots: Array<Slot>): Array<[Slot, Slot]> {
    const result: Array<[Slot, Slot]> = [];
    const seen: Set<Slot> = new Set();

    function recurse(slot: Slot): void {
      if (seen.has(slot)) {
        return;
      }
      seen.add(slot);

      if (slot.links.push) {
        recurse(slot.links.push);
        result.push([slot, slot.links.push]);
      }
    }

    for (const slot of slots) {
      recurse(slot);
    }
    result.reverse();
    return result;
  }

  copy(suffix: string): Slot {
    const name = this.name + suffix;
    const linkDesc: SlotLinkDesc = {};
    for (const key in this.linkDesc) {
      const linkName = key as keyof SlotLinks;
      const linkTarget = this.linkDesc[linkName];
      if (linkTarget !== undefined) {
        linkDesc[linkName] = linkTarget + suffix;
      }
    }

    const slot = new Slot({
      name,
      group: this.group,
      type: this.type,
      origin: this.origin,
      direction: this.direction,
      rotations: this.rotations,
    });
    slot.linkDesc = linkDesc;
    slot.canFlipMultiple = this.canFlipMultiple;
    slot.drawShadow = this.drawShadow;
    slot.shadowRotation = this.shadowRotation;
    slot.rotateHeld = this.rotateHeld;
    slot.indexes = this.indexes.slice();
    return slot;
  }

  rotate(seat: number, worldWidth: number): void {
    const rotation = seat * Math.PI / 2;

    const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotation);

    const pos = new Vector3(
      this.origin.x - worldWidth / 2,
      this.origin.y - worldWidth / 2,
      this.origin.z,
    );
    pos.applyQuaternion(quat);
    this.origin = new Vector3(
      pos.x + worldWidth / 2,
      pos.y + worldWidth / 2,
      pos.z,
    );

    round3(this.origin, 16);

    const dir = new Vector3(this.direction.x, this.direction.y, 0);
    dir.applyQuaternion(quat);
    this.direction = new Vector2(dir.x, dir.y);

    this.rotations = this.rotations.map(rot => {
      const q = new Quaternion().setFromEuler(rot);
      q.premultiply(quat);
      return new Euler().setFromQuaternion(q);
    });

    this.places = this.rotations.map(this.makePlace.bind(this));

    this.seat = seat;
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
