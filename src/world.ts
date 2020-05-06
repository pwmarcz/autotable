import { Vector2, Euler, Vector3, Quaternion } from "three";

export enum ThingType {
  TILE = 'TILE',
  STICK = 'STICK',
}

export const Size = {
  TILE: new Vector3(6, 9, 4),
  STICK: new Vector3(20, 2, 1),
};

class Slot {
  name: string;
  type: ThingType;
  origin: Vector3;
  direction: Vector2;
  rotations: Array<Euler>;

  thingIndex: number | null = null;

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
  }

  rotated(suffix: string, rotation: number): Slot {
    const quat = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotation);

    const name = this.name + suffix;

    const pos = new Vector3(
      this.origin.x - World.WIDTH / 2,
      this.origin.y - World.WIDTH / 2,
      this.origin.z,
    );
    pos.applyQuaternion(quat);
    const origin = new Vector3(
      pos.x + World.WIDTH / 2,
      pos.y + World.WIDTH / 2,
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

  place(rotationIndex: number): Place {
    const rotation = this.rotations[rotationIndex];

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

interface Thing {
  index: number;
  type: ThingType;
  typeIndex: number;
  slotName: string;
  rotationIndex: number;
  place: Place;
}

interface Place {
  position: Vector3;
  rotation: Euler;
  size: Vector3;
}

interface Render {
  thingIndex: number;
  place: Place;
  selected: boolean;
  hovered: boolean;
  held: boolean;
  temporary: boolean;
  bottom: boolean;
}

interface Select extends Place {
  id: any;
}

const Rotation = {
  FACE_UP: new Euler(0, 0, 0),
  FACE_UP_SIDEWAYS: new Euler(0, 0, Math.PI / 2),
  STANDING: new Euler(Math.PI / 2, 0, 0),
  FACE_DOWN: new Euler(Math.PI, 0, 0),
};

export class World {
  slots: Record<string, Slot> = {};
  pushes: Array<[string, string]> = [];
  things: Array<Thing> = [];

  hovered: number | null = null;
  selected: Array<number> = [];
  tablePos: Vector2 | null = null;

  targetSlots: Array<string | null> = [];
  held: Array<number> = [];
  heldTablePos: Vector2 | null = null;

  scoreSlots: Array<Array<string>> = [[], [], [], []];

  static WIDTH = 174;

  constructor() {
    this.addSlots();
    this.addTiles();
    this.addSticks();
  }

  addTiles(): void {
    const tiles = [];
    for (let i = 0; i < 136; i++) {
      tiles.push(Math.floor(i / 4));
    }
    shuffle(tiles);
    for (let i = 0; i < 17; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 4; k++) {
          this.addThing(ThingType.TILE, tiles.pop()!, `wall.${i+1}.${j}.${k}`);
        }
      }
    }
  }

  addSticks(): void {
    const add = (index: number, n: number, slot: number): void => {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < n; j++) {
          this.addThing(ThingType.STICK, index, `stick.${slot}.${j}.${i}`);
        }
      }
    };

    // Debt
    add(4, 2, 0);
    // 10k
    add(3, 1, 1);
    // 5k
    add(2, 2, 2);
    // 1k
    add(1, 4, 3);
    // 100
    add(0, 5, 4);
    add(0, 5, 5);
  }

  addThing(type: ThingType, typeIndex: number, slotName: string): void {
    if (this.slots[slotName] === undefined) {
      throw `Unknown slot: ${slotName}`;
    }

    const thingIndex = this.things.length;

    const place = this.slots[slotName].place(0);
    this.things.push({
      index: thingIndex,
      type,
      typeIndex,
      slotName,
      place,
      rotationIndex: 0,
    });
    this.slots[slotName].thingIndex = thingIndex;
  }

  addSlots(): void {
    for (let i = 0; i < 14; i++) {
      this.addSlot(new Slot({
        name: `hand.${i}`,
        origin: new Vector3(
          46 + i*Size.TILE.x,
          0,
          0,
        ),
        rotations: [Rotation.STANDING, Rotation.FACE_UP],
        canFlipMultiple: true,
      }));
    }

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        this.addSlot(new Slot({
          name: `meld.${i}.${j}`,
          origin: new Vector3(
            174 - (j)*Size.TILE.x,
            i * Size.TILE.y,
            0,
          ),
          direction: new Vector2(-1, 1),
          rotations: [Rotation.FACE_UP, Rotation.FACE_UP_SIDEWAYS, Rotation.FACE_DOWN],
          drawShadow: false,
          requires: i > 0 ? `meld.${i-1}.0` : null,
        }));
        if (j < 3) {
          this.addPush(`meld.${i}.${j}`, `meld.${i}.${j+1}`);
        }
      }
    }

    for (let i = 0; i < 19; i++) {
      for (let j = 0; j < 2; j++) {
        this.addSlot(new Slot({
          name: `wall.${i}.${j}`,
          origin: new Vector3(
            30 + i * Size.TILE.x,
            20,
            j * Size.TILE.z,
          ),
          rotations: [Rotation.FACE_DOWN, Rotation.FACE_UP],
          drawShadow: j === 0 && i >= 1 && i < 18,
          down: j === 1 ? `wall.${i}.0` : null,
          up: j === 0 ? `wall.${i}.1` : null,
        }));
      }
    }

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) {
        this.addSlot(new Slot({
          name: `discard.${i}.${j}`,
          origin: new Vector3(
            69 + j * Size.TILE.x,
            60 - i * Size.TILE.y,
            0,
          ),
          direction: new Vector2(1, 1),
          rotations: [Rotation.FACE_UP, Rotation.FACE_UP_SIDEWAYS],
        }));
        if (j < 5) {
          this.addPush(`discard.${i}.${j}`, `discard.${i}.${j+1}`);
        }
      }
    }

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 10; j++) {
        this.addSlot(new Slot({
          name: `stick.${i}.${j}`,
          type: ThingType.STICK,
          origin: new Vector3(
            15 + 24 * i,
            -25 - j * (Size.STICK.y + 1),
            0,
          ),
          rotations: [Rotation.FACE_UP],
          drawShadow: false,
        }));
        for (let k = 0; k < 4; k++) {
          if (this.scoreSlots[k] === null) {
            this.scoreSlots[k] = [];
          }
          this.scoreSlots[k].push(`stick.${i}.${j}.${k}`);
        }
      }
    }

    this.addSlot(new Slot({
      name: 'riichi',
      type: ThingType.STICK,
      origin: new Vector3(
        (World.WIDTH - Size.STICK.x) / 2,
        71.5,
        1.5,
      ),
      rotations: [Rotation.FACE_UP],
      drawShadow: false,
    }));
  }

  addSlot(slot: Slot): void {
    for (let i = 0; i < 4; i++) {
      const rotated = slot.rotated('.' + i, i * Math.PI / 2);
      this.slots[rotated.name] = rotated;
    }
  }

  addPush(source: string, target: string): void {
    for (let i = 0; i < 4; i++) {
      this.pushes.push([`${source}.${i}`, `${target}.${i}`]);
    }
  }

  onHover(id: any): void {
    if (this.held.length === 0) {
      this.hovered = id as number | null;

      if (this.hovered !== null && !this.canSelect(this.hovered, [])) {
        this.hovered = null;
      }
    }
  }

  onSelect(ids: Array<any>): void {
    this.selected = ids as Array<number>;
    this.selected = this.selected.filter(
      thingIndex => this.canSelect(thingIndex, this.selected));
  }

  onMove(tablePos: Vector2 | null): void {
    this.tablePos = tablePos;
    if (this.tablePos !== null && this.heldTablePos !== null) {
      for (let i = 0; i < this.held.length; i++) {
        this.targetSlots[i] = null;
      }

      for (let i = 0; i < this.held.length; i++) {
        const thing = this.things[this.held[i]];
        const x = thing.place.position.x + this.tablePos.x - this.heldTablePos.x;
        const y = thing.place.position.y + this.tablePos.y - this.heldTablePos.y;

        this.targetSlots[i] = this.findSlot(x, y, thing.type);
      }
    }
  }

  canSelect(thingIndex: number, otherSelected: Array<number>): boolean {
    const slotName = this.things[thingIndex].slotName;
    const slot = this.slots[slotName];

    if (slot.up !== null) {
      const upSlot = this.slots[slot.up];
      if (upSlot.thingIndex !== null &&
        otherSelected.indexOf(upSlot.thingIndex) === -1) {

        return false;
      }
    }
    return true;
  }

  findSlot(x: number, y: number, thingType: ThingType): string | null {
    let bestDistance = Size.TILE.z * 1.5;
    let bestSlot = null;

    // Empty slots
    for (const slotName in this.slots) {
      const slot = this.slots[slotName];
      if (slot.type !== thingType) {
        continue;
      }

      if (slot.thingIndex !== null && this.held.indexOf(slot.thingIndex) === -1) {
        continue;
      }
      // Already proposed for another thing
      if (this.targetSlots.indexOf(slotName) !== -1) {
        continue;
      }
      // The slot requires other slots to be occupied first
      if (slot.requires !== null && this.slots[slot.requires].thingIndex === null) {
        continue;
      }

      const place = slot.place(0);
      const dx = Math.max(0, Math.abs(x - place.position.x) - place.size.x / 2);
      const dy = Math.max(0, Math.abs(y - place.position.y) - place.size.y / 2);
      const distance = Math.sqrt(dx*dx + dy*dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSlot = slotName;
      }
    }
    return bestSlot;
  }

  onDragStart(): boolean {
    if (this.hovered !== null) {
      this.held.splice(0);

      if (this.selected.indexOf(this.hovered) !== -1) {
        this.held.push(...this.selected);
      } else {
        this.held.push(this.hovered);
        this.selected.splice(0);
      }
      // this.hovered = null;
      this.heldTablePos = this.tablePos;

      this.targetSlots.length = this.held.length;
      for (let i = 0; i < this.held.length; i++) {
        this.targetSlots[i] = null;
      }

      return true;
    }
    return false;
  }

  onDragEnd(): void {
    if (this.held.length > 0) {
      if (this.heldTablePos !== null && this.tablePos !== null &&
        // No movement; unselect
        this.heldTablePos.equals(this.tablePos)) {
        this.selected.splice(0);
        // if (this.hovered !== null) {
        //   this.selected.push(this.hovered);
        // }
      } else if (this.canDrop()) {
        // Successful movement
        this.drop();
      }
    }
    this.held.splice(0);
    this.targetSlots.splice(0);
  }

  onFlip(): void {
    if (this.held.length > 0) {
      return;
    }

    if (this.selected.length > 0) {
      for (const thingIndex of this.selected) {
        const slotName = this.things[thingIndex].slotName;
        if (this.selected.length > 1 && !this.slots[slotName].canFlipMultiple) {
          continue;
        }
        this.flip(thingIndex);
      }
      this.selected.splice(0);
    } else if (this.hovered !== null) {
      this.flip(this.hovered);
    }
  }

  flip(thingIndex: number): void {
    const thing = this.things[thingIndex];
    const slot = this.slots[thing.slotName];

    thing.rotationIndex = (thing.rotationIndex + 1) % slot.rotations.length;
    thing.place = slot.place(thing.rotationIndex);

    this.checkPushes();
  }

  drop(): void {
    for (let i = 0; i < this.held.length; i++) {
      const thingIndex = this.held[i];
      const thing = this.things[thingIndex];
      const oldSlotName = thing.slotName;
      this.slots[oldSlotName].thingIndex = null;
    }
    for (let i = 0; i < this.held.length; i++) {
      const thingIndex = this.held[i];
      const thing = this.things[thingIndex];
      const targetSlot = this.targetSlots[i]!;

      thing.slotName = targetSlot;
      thing.place = this.slots[targetSlot].place(0);
      thing.rotationIndex = 0;
      this.slots[targetSlot].thingIndex = thingIndex;
    }
    this.checkPushes();
    this.selected.splice(0);
  }

  canDrop(): boolean {
    return this.targetSlots.every(s => s !== null);
  }

  checkPushes(): void {
    for (const [source, target] of this.pushes) {
      const sourceSlot = this.slots[source];
      const targetSlot = this.slots[target];
      const sourceThingIndex = sourceSlot.thingIndex;
      const targetThingIndex = targetSlot.thingIndex;

      if (targetThingIndex === null) {
        continue;
      }

      const targetThing = this.things[targetThingIndex];
      targetThing.place = targetSlot.place(targetThing.rotationIndex);

      if (sourceThingIndex === null) {
        continue;
      }

      const sourceThing = this.things[sourceThingIndex];

      // Relative slot position
      const sdx = targetSlot.origin.x - sourceSlot.origin.x;
      const sdy = targetSlot.origin.y - sourceSlot.origin.y;

      if (Math.abs(sdx) > Math.abs(sdy)) {
        const dx = targetThing.place.position.x - sourceThing.place.position.x;
        const sizex = (targetThing.place.size.x + sourceThing.place.size.x) / 2;

        const dist = sizex - Math.sign(sdx) * dx;
        if (dist > 0) {
          targetThing.place.position.x += Math.sign(sdx) * dist;
        }
      } else {
        const dy = targetThing.place.position.y - sourceThing.place.position.y;
        const sizey = (targetThing.place.size.y + sourceThing.place.size.y) / 2;

        const dist = sizey - Math.sign(sdy) * dy;
        if (dist > 0) {
          targetThing.place.position.y += Math.sign(sdy) * dist;
        }
      }
    }
  }

  toRender(): Array<Render> {
    const canDrop = this.canDrop();

    const result = [];
    for (let i = 0; i < this.things.length; i++) {
      const thing = this.things[i];
      let place = thing.place;
      const heldIndex = this.held.indexOf(i);
      const held = heldIndex !== -1;

      if (held && this.tablePos !== null && this.heldTablePos !== null) {
        place = {...place, position: place.position.clone()};
        place.position.x += this.tablePos.x - this.heldTablePos.x;
        place.position.y += this.tablePos.y - this.heldTablePos.y;
      }

      const selected = this.selected.indexOf(i) !== -1;
      const hovered = i === this.hovered ||
        (selected && this.selected.indexOf(this.hovered!) !== -1);
      const temporary = held && !canDrop;

      const slot = this.slots[thing.slotName];

      let bottom = false;
      if (this.held !== null && slot.up !== null) {
        bottom = this.slots[slot.up].thingIndex === null;
      }

      result.push({
        place,
        thingIndex: i,
        selected,
        hovered,
        held,
        temporary,
        bottom,
      });
    }
    return result;
  }

  toRenderGhosts(): Array<Render> {
    const result: Array<Render> = [];
    // if (this.targetSlot !== null) {
    //   const thingIndex = this.held;
    //   const place = this.slotPlace(this.slots[this.targetSlot]);
    //   result.push({
    //     ...place,
    //     thingIndex,
    //     selected: false,
    //     held: false,
    //   });
    // }
    return result;
  }

  toSelect(): Array<Select> {
    const result = [];
    if (this.held.length === 0) {
      // Things
      for (let i = 0; i < this.things.length; i++) {
        const thing = this.things[i];
        const place = thing.place;
        result.push({...place, id: i});
      }
    }
    return result;
  }

  toRenderPlaces(): Array<Place> {
    const result = [];
    for (const slotName in this.slots) {
      if (this.slots[slotName].drawShadow) {
        result.push(this.slots[slotName].place(0));
      }
    }
    return result;
  }

  toRenderShadows(): Array<Place> {
    const result = [];
    if (this.canDrop()) {
      for (const slotName of this.targetSlots) {
        result.push(this.slots[slotName!].place(0));
      }
    }
    return result;
  }

  getScores(): Array<number> {
    const scores = new Array(4).fill(-20000);
    const stickScores = [100, 1000, 5000, 10000, 10000];

    for (let i = 0; i < 4; i++) {
      for (const slotName of this.scoreSlots[i]) {
        const slot = this.slots[slotName];
        if (slot.thingIndex !== null) {
          const thing = this.things[slot.thingIndex];
          if (thing.type === ThingType.STICK) {
            scores[i] += stickScores[thing.typeIndex];
          }
        }
      }
    }
    return scores;
  }
}

function shuffle<T>(arr: Array<T>): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[j];
    arr[j] = arr[i];
    arr[i] = temp;
  }
}
