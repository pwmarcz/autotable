import { Vector2, Euler, Vector3, Quaternion } from "three";

export enum ThingType {
  TILE = 'TILE',
  STICK = 'STICK',
}

export const Size = {
  TILE: new Vector3(6, 9, 4),
  STICK: new Vector3(20, 2, 1),
};

export interface Place {
  position: Vector3;
  rotation: Euler;
  size: Vector3;
}

export class Slot {
  name: string;
  type: ThingType;
  origin: Vector3;
  direction: Vector2;
  rotations: Array<Euler>;

  places: Array<Place>;

  thing: Thing | null = null;

  down: string | null;
  up: string | null;
  requires: string | null;
  canFlipMultiple: boolean;
  drawShadow: boolean;

  constructor(params: {
    name: string;
    type?: ThingType;
    origin: Vector3;
    direction?: Vector2;
    rotations: Array<Euler>;
    down?: string | null;
    up?: string | null;
    requires?: string | null;
    canFlipMultiple?: boolean;
    drawShadow?: boolean;
  }) {
    this.name = params.name;
    this.type = params.type ?? ThingType.TILE;
    this.origin = params.origin;
    this.direction = params.direction ?? new Vector2(1, 1);
    this.rotations = params.rotations;
    this.down = params.down ?? null;
    this.up = params.up ?? null;
    this.requires = params.requires ?? null;
    this.canFlipMultiple = params.canFlipMultiple ?? false;
    this.drawShadow = params.drawShadow ?? true;

    this.places = this.rotations.map(this.makePlace.bind(this));
  }

  rotated(suffix: string, rotation: number, worldWidth: number): Slot {
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

    const dir = new Vector3(this.direction.x, this.direction.y, 0);
    dir.applyQuaternion(quat);
    const direction = new Vector2(dir.x, dir.y);

    const rotations = this.rotations.map(rot => {
      const q = new Quaternion().setFromEuler(rot);
      q.premultiply(quat);
      return new Euler().setFromQuaternion(q);
    });

    const slot = new Slot({name, type: this.type, origin, direction, rotations});
    slot.down = this.down && this.down + suffix;
    slot.up = this.up && this.up + suffix;
    slot.requires = this.requires && this.requires + suffix;
    slot.canFlipMultiple = this.canFlipMultiple;
    slot.drawShadow = this.drawShadow;
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
}

export class Thing {
  index: number;
  type: ThingType;
  typeIndex: number;
  _slot: Slot | null;
  rotationIndex: number;
  offset: Vector2;

  heldBy: number | null;
  // place: Place;

  constructor(index: number, type: ThingType, typeIndex: number, slot: Slot) {
    this.index = index;
    this.type = type;
    this.typeIndex = typeIndex;
    this._slot = slot;
    this.rotationIndex = 0;
    this.offset = new Vector2(0, 0);
    this.heldBy = null;

    this.slot.thing = this;
  }

  // TODO handle null slot better
  get slot(): Slot {
    if (this._slot === null) {
      throw `no slot: ${this.index}`;
    }
    return this._slot;
  }

  place(): Place {
    const place = this.slot.places[this.rotationIndex];
    if (this.offset.x === 0 && this.offset.y === 0) {
      return place;
    }
    const position = place.position.clone();
    position.x += this.offset.x;
    position.y += this.offset.y;
    return {...place, position };
  }

  handlePush(source: Thing | null): void {
    this.offset.set(0, 0);

    if (source === null) {
      return;
    }

    const place = this.slot.places[this.rotationIndex];
    const sourcePlace = source.slot.places[source.rotationIndex];

    // Relative slot position
    const sdx = this.slot.origin.x - source.slot.origin.x;
    const sdy = this.slot.origin.y - source.slot.origin.y;

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

  flip(): void {
    this.rotationIndex = (this.rotationIndex + 1) % this.slot.rotations.length;
  }

  remove(): void {
    // console.log('remove', this.index, this.slot.name);
    this.slot.thing = null;
    this._slot = null;
  }

  moveTo(target: Slot, rotationIndex?: number): void {
    // console.log('moveTo', this.index, target.name);
    if (target.thing !== null) {
      throw `slot not empty: ${this.index} ${target.name}`;
    }
    if (this._slot !== null) {
      throw `not removed: ${this.index} -> ${this.slot.name}`;
    }
    this._slot = target;
    this.rotationIndex = rotationIndex ?? 0;
    target.thing = this;
  }
}
