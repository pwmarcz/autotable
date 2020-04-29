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

export class World {
  slots: Record<string, Slot>;
  things: Array<Thing>;

  static TILE_WIDTH = 6;
  static TILE_HEIGHT = 9;
  static TILE_DEPTH = 4;
  static WIDTH = 174;
  static HEIGHT = 174;

  constructor() {
    this.slots = {};
    const baseSlots: Record<string, Slot> = {};
    for (let i = 0; i < 14; i++) {
      baseSlots[`table.${i}`] = {
        position: new Vector2(
          46 + i*World.TILE_WIDTH + World.TILE_WIDTH/2,
          World.TILE_DEPTH/2,
        ),
        rotation: new Euler(Math.PI / 2, 0, 0),
      };
    }

    for (let i = 0; i < 12; i++) {
      baseSlots[`meld.${i}`] = {
        position: new Vector2(
          174 - (i+1)*World.TILE_WIDTH + World.TILE_WIDTH/2,
          World.TILE_HEIGHT/2,
        ),
        rotation: new Euler(0, 0, 0),
      };
    }

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

      this.slots[`${slotName}.a`] = slot;
      rot.premultiply(step);
      this.slots[`${slotName}.b`] = {
        position: new Vector2(World.WIDTH - slot.position.y, slot.position.x),
        rotation: new Euler().setFromQuaternion(rot),
      };
      rot.premultiply(step);
      this.slots[`${slotName}.c`] = {
        position: new Vector2(World.WIDTH - slot.position.x, World.WIDTH - slot.position.y),
        rotation: new Euler().setFromQuaternion(rot),
      };
      rot.premultiply(step);
      this.slots[`${slotName}.d`] = {
        position: new Vector2(slot.position.y, World.WIDTH - slot.position.x),
        rotation: new Euler().setFromQuaternion(rot),
      };
    }

    this.things = [];
    let i = 0;
    for (const slotName in this.slots) {
      if (/^meld/.exec(slotName))
        continue;
      this.things.push({ type: 'tile', index: i, slotName });
      i = (i + 5) % 36;
    }
  }

  thingParams(i: number): { position: Vector3; rotation: Euler } {
    const slot = this.slots[this.things[i].slotName];

    const xv = new Vector3(0, 0, World.TILE_DEPTH).applyEuler(slot.rotation);
    const yv = new Vector3(0, World.TILE_HEIGHT, 0).applyEuler(slot.rotation);
    const zv = new Vector3(World.TILE_WIDTH, 0, 0).applyEuler(slot.rotation);
    const maxz = Math.max(Math.abs(xv.z), Math.abs(yv.z), Math.abs(zv.z));

    return {
      position: new Vector3(slot.position.x, slot.position.y, maxz/2),
      rotation: slot.rotation,
    };
  }
}
