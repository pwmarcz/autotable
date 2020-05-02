import { Vector2, Euler, Vector3, Quaternion } from "three";

interface Slot {
  position: Vector2;
  rotation: Euler;
  thingIndex: number | null;
}

interface Thing {
  type: 'tile';
  index: number;
  slotName: string;
}

interface Place {
  type: 'tile';
  position: Vector3;
  rotation: Euler;
}

interface Render extends Place {
  thingIndex: number;
  selected: boolean;
  hovered: boolean;
  held: boolean;
  temporary: boolean;
}

interface Select extends Place {
  id: any;
}

interface Shadow {
  position: Vector2;
  width: number;
  height: number;
}

export class World {
  slots: Record<string, Slot> = {};
  things: Array<Thing> = [];

  hovered: number | null = null;
  selected: Array<number> = [];
  tablePos: Vector2 | null = null;

  targetSlots: Array<string | null> = [];
  held: Array<number> = [];
  heldTablePos: Vector2 | null = null;

  static TILE_WIDTH = 6;
  static TILE_HEIGHT = 9;
  static TILE_DEPTH = 4;
  static WIDTH = 174;
  static HEIGHT = 174;

  constructor() {
    const baseSlots: Record<string, Slot> = {};
    for (let i = 0; i < 14; i++) {
      baseSlots[`hand.${i}`] = {
        position: new Vector2(
          46 + i*World.TILE_WIDTH + World.TILE_WIDTH/2,
          World.TILE_DEPTH/2,
        ),
        rotation: new Euler(Math.PI / 2, 0, 0),
        thingIndex: null,
      };
    }

    /*
    for (let i = 0; i < 12; i++) {
      baseSlots[`meld.${i}`] = {
        position: new Vector2(
          174 - (i+1)*World.TILE_WIDTH + World.TILE_WIDTH/2,
          World.TILE_HEIGHT/2,
        ),
        rotation: new Euler(0, 0, 0),
      };
    }
    */

    for (let i = 0; i < 17; i++) {
      baseSlots[`wall.${i}`] = {
        position: new Vector2(
          36 + i * World.TILE_WIDTH + World.TILE_WIDTH / 2,
          24 + World.TILE_HEIGHT/2,
        ),
        rotation: new Euler(Math.PI, 0, 0),
        thingIndex: null,
      };
    }

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) {
        const n = 6 * i + j;
        baseSlots[`discard.${n}`] = {
          position: new Vector2(
            69 + j * World.TILE_WIDTH + World.TILE_WIDTH / 2,
            60 - i * World.TILE_HEIGHT + World.TILE_HEIGHT/2,
          ),
          rotation: new Euler(0, 0, 0),
          thingIndex: null,
        };
      }
    }

    for (const slotName in baseSlots) {
      const slot = baseSlots[slotName];
      const rot = new Quaternion().setFromEuler(slot.rotation);
      const step = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI/2);

      this.slots[`${slotName}.0`] = slot;
      rot.premultiply(step);
      this.slots[`${slotName}.1`] = {
        position: new Vector2(World.WIDTH - slot.position.y, slot.position.x),
        rotation: new Euler().setFromQuaternion(rot),
        thingIndex: null,
      };
      rot.premultiply(step);
      this.slots[`${slotName}.2`] = {
        position: new Vector2(World.WIDTH - slot.position.x, World.WIDTH - slot.position.y),
        rotation: new Euler().setFromQuaternion(rot),
        thingIndex: null,
      };
      rot.premultiply(step);
      this.slots[`${slotName}.3`] = {
        position: new Vector2(slot.position.y, World.WIDTH - slot.position.x),
        rotation: new Euler().setFromQuaternion(rot),
        thingIndex: null,
      };
    }

    for (let i = 0; i < 17; i++) {
      for (let j = 0; j < 4; j++) {
        const index = j * 17 + i;
        const slotName = `wall.${i}.${j}`;
        this.things[index] = { type: 'tile', index: i, slotName };
        this.slots[slotName].thingIndex = index;
      }
    }
  }

  onHover(id: any): void {
    this.hovered = id as number;
  }

  onSelect(ids: Array<any>): void {
    this.selected = ids as Array<number>;
  }

  onMove(tablePos: Vector2 | null): void {
    this.tablePos = tablePos;
    if (this.tablePos !== null && this.heldTablePos !== null) {
      for (let i = 0; i < this.held.length; i++) {
        this.targetSlots[i] = null;
      }

      for (let i = 0; i < this.held.length; i++) {
        const thing = this.things[this.held[i]];
        const place = this.slotPlace(thing.slotName);
        place.position.x += this.tablePos.x - this.heldTablePos.x;
        place.position.y += this.tablePos.y - this.heldTablePos.y;

        this.targetSlots[i] = this.findSlot(place.position.x, place.position.y);
      }
    }
  }

  findSlot(x: number, y: number): string | null {
    let bestDistance = World.TILE_DEPTH;
    let bestSlot = null;

    // Empty slots
    for (const slotName in this.slots) {
      const slot = this.slots[slotName];
      if (slot.thingIndex !== null && this.held.indexOf(slot.thingIndex) === -1) {
        continue;
      }
      // Already proposed for another thing
      if (this.targetSlots.indexOf(slotName) !== -1) {
        continue;
      }
      const shadow = this.slotShadow(slotName);
      const dx = Math.abs(x - slot.position.x) - shadow.width/2;
      const dy = Math.abs(y - slot.position.y) - shadow.height/2;
      const distance = Math.max(0, dx, dy);
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
      this.hovered = null;
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
      if (this.targetSlots.every(s => s !== null)) {
        for (let i = 0; i < this.held.length; i++) {
          const oldSlotName = this.things[this.held[i]].slotName;
          this.slots[oldSlotName].thingIndex = null;
        }
        for (let i = 0; i < this.held.length; i++) {
          this.things[this.held[i]].slotName = this.targetSlots[i]!;
          this.slots[this.targetSlots[i]!].thingIndex = this.held[0];
        }
      }
    }
    this.held.splice(0);
    this.targetSlots.splice(0);
  }

  toRender(): Array<Render> {
    const result = [];
    for (let i = 0; i < this.things.length; i++) {
      const thing = this.things[i];
      const place = this.slotPlace(thing.slotName);
      const heldIndex = this.held.indexOf(i);
      const held = heldIndex !== -1;

      if (held && this.tablePos !== null && this.heldTablePos !== null) {
        place.position.x += this.tablePos.x - this.heldTablePos.x;
        place.position.y += this.tablePos.y - this.heldTablePos.y;
      }

      const selected = this.selected.indexOf(i) !== -1;
      const hovered = i === this.hovered ||
        (selected && this.selected.indexOf(this.hovered!) !== -1);
      const temporary = held && this.targetSlots[heldIndex] === null;

      result.push({
        ...place,
        thingIndex: i,
        selected,
        hovered,
        held,
        temporary,
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
        const place = this.slotPlace(thing.slotName);
        result.push({...place, id: i});
      }
    }
    return result;
  }

  slotPlace(slotName: string): Place {
    const slot = this.slots[slotName];

    const xv = new Vector3(0, 0, World.TILE_DEPTH).applyEuler(slot.rotation);
    const yv = new Vector3(0, World.TILE_HEIGHT, 0).applyEuler(slot.rotation);
    const zv = new Vector3(World.TILE_WIDTH, 0, 0).applyEuler(slot.rotation);
    const maxz = Math.max(Math.abs(xv.z), Math.abs(yv.z), Math.abs(zv.z));

    return {
      type: 'tile',
      position: new Vector3(slot.position.x, slot.position.y, maxz/2),
      rotation: slot.rotation,
    };
  }

  toRenderPlaces(): Array<Shadow> {
    const result = [];
    for (const slotName in this.slots) {
      result.push(this.slotShadow(slotName));
    }
    return result;
  }

  toRenderShadows(): Array<Shadow> {
    const result = [];
    for (const slotName of this.targetSlots) {
      if (slotName !== null) {
        result.push(this.slotShadow(slotName));
      }
    }
    return result;
  }

  slotShadow(slotName: string): Shadow {
    const slot = this.slots[slotName];

    const xv = new Vector3(0, 0, World.TILE_DEPTH).applyEuler(slot.rotation);
    const yv = new Vector3(0, World.TILE_HEIGHT, 0).applyEuler(slot.rotation);
    const zv = new Vector3(World.TILE_WIDTH, 0, 0).applyEuler(slot.rotation);

    const width = Math.max(Math.abs(xv.x), Math.abs(yv.x), Math.abs(zv.x));
    const height = Math.max(Math.abs(xv.y), Math.abs(yv.y), Math.abs(zv.y));
    return {position: slot.position, width, height};
  }
}
