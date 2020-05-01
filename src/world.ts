import { Vector2, Euler, Vector3, Quaternion } from "three";

interface Slot {
  position: Vector2;
  rotation: Euler;
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
  held: boolean;
}

interface Select extends Place {
  id: string;
}

interface Shadow {
  position: Vector2;
  width: number;
  height: number;
}

export class World {
  slots: Record<string, Slot>;
  things: Array<Thing>;
  selected: number | null;
  targetSlot: string | null;
  held: number | null;

  static TILE_WIDTH = 6;
  static TILE_HEIGHT = 9;
  static TILE_DEPTH = 4;
  static WIDTH = 174;
  static HEIGHT = 174;

  constructor() {
    this.slots = {};
    const baseSlots: Record<string, Slot> = {};
    for (let i = 0; i < 14; i++) {
      baseSlots[`hand.${i}`] = {
        position: new Vector2(
          46 + i*World.TILE_WIDTH + World.TILE_WIDTH/2,
          World.TILE_DEPTH/2,
        ),
        rotation: new Euler(Math.PI / 2, 0, 0),
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
      };
      rot.premultiply(step);
      this.slots[`${slotName}.2`] = {
        position: new Vector2(World.WIDTH - slot.position.x, World.WIDTH - slot.position.y),
        rotation: new Euler().setFromQuaternion(rot),
      };
      rot.premultiply(step);
      this.slots[`${slotName}.3`] = {
        position: new Vector2(slot.position.y, World.WIDTH - slot.position.x),
        rotation: new Euler().setFromQuaternion(rot),
      };
    }

    this.things = [];
    for (let i = 0; i < 17; i++) {
      for (let j = 0; j < 4; j++) {
        const slotName = `wall.${i}.${j}`;
        this.things.push({ type: 'tile', index: i, slotName });
      }
    }

    this.selected = null;
    this.held = null;
    this.targetSlot = null;
  }

  onSelect(id: string | null): void {
    if (this.held !== null) {
      const slotName = id;
      this.targetSlot = this.slots[slotName] ? slotName : null;
    } else {
      const index = parseInt(id, 10);
      this.selected = isNaN(index) ? null : index;
    }
  }

  onMouseDown(): void {
    if (this.selected !== null) {
      this.held = this.selected;
    }
    this.selected = null;
    this.targetSlot = null;
  }

  onMouseUp(): void {
    if (this.held !== null) {
      if (this.targetSlot !== null) {
        this.things[this.held].slotName = this.targetSlot;
      }
    }
    this.held = null;
    this.targetSlot = null;
  }

  toRender(): Array<Render> {
    const result = [];
    for (let i = 0; i < this.things.length; i++) {
      const thing = this.things[i];
      const slot = this.slots[thing.slotName];
      const place = this.slotPlace(slot);
      result.push({
        ...place,
        thingIndex: i,
        selected: i === this.selected,
        held: i === this.held,
      });
    }
    return result;
  }

  toRenderGhosts(): Array<Render> {
    const result = [];
    if (this.targetSlot !== null) {
      const thingIndex = this.held;
      const place = this.slotPlace(this.slots[this.targetSlot]);
      result.push({
        ...place,
        thingIndex,
        selected: false,
        held: false,
      });
    }
    return result;
  }

  toSelect(): Array<Select> {
    const result = [];
    if (this.held !== null) {
      // Empty slots
      for (const slotName in this.slots) {
        // TODO cache that
        let occupied = false;
        for (const thing of this.things) {
          if (thing.slotName === slotName) {
            occupied = true;
            break;
          }
        }
        if (occupied) {
          continue;
        }

        const place = this.slotPlace(this.slots[slotName]);
        result.push({...place, id: slotName});
      }
    } else {
      // Things
      for (let i = 0; i < this.things.length; i++) {
        const thing = this.things[i];
        const place = this.slotPlace(this.slots[thing.slotName]);
        result.push({...place, id: `${i}`});
      }
    }
    return result;
  }

  slotPlace(slot: Slot): Place {
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

  toRenderShadows(): Array<Shadow> {
    const result = [];
    for (const slotName in this.slots) {
      result.push(this.slotShadow(this.slots[slotName]));
    }
    return result;
  }

  slotShadow(slot: Slot): Shadow {
    const xv = new Vector3(0, 0, World.TILE_DEPTH).applyEuler(slot.rotation);
    const yv = new Vector3(0, World.TILE_HEIGHT, 0).applyEuler(slot.rotation);
    const zv = new Vector3(World.TILE_WIDTH, 0, 0).applyEuler(slot.rotation);

    const width = Math.max(Math.abs(xv.x), Math.abs(yv.x), Math.abs(zv.x));
    const height = Math.max(Math.abs(xv.y), Math.abs(yv.y), Math.abs(zv.y));
    return {position: slot.position, width, height};
  }
}
