import { Vector2, Euler, Vector3 } from "three";

interface Slot {
  position: Vector2;
  rotation: Euler;
}

interface Thing {
  type: 'tile';
  index: number;
  slotIndex: number;
}

export class World {
  slots: Array<Slot>;
  things: Array<Thing>;

  static TILE_WIDTH = 6;
  static TILE_HEIGHT = 9;
  static TILE_DEPTH = 4;
  static WIDTH = 100;
  static HEIGHT = 100;

  constructor() {
    this.slots = [];
    for (let i = 0; i < 10; i++) {
      this.slots.push({
        position: new Vector2(6 * i + 3, 10),
        rotation: new Euler(Math.PI/2, 0, 0),
      });
    }

    this.slots.push({
      position: new Vector2(80, 10),
      rotation: new Euler(0, 0, Math.PI / 2),
    });
    this.slots.push({
      position: new Vector2(87.5, 11.5),
      rotation: new Euler(0, 0, 0),
    });
    this.slots.push({
      position: new Vector2(93.5, 11.5),
      rotation: new Euler(0, 0, 0),
    });

    for (let i = 0; i < 15; i++) {
      this.slots.push({
        position: new Vector2(6 * i + 3, 50),
        rotation: new Euler(Math.PI, 0, 0),
      });
    }

    this.slots[18].rotation = new Euler(0, 0, 0);
    this.slots[18].rotation = new Euler(0, 0, 0);

    this.things = [];
    for (let i = 0; i < this.slots.length; i++) {
      this.things.push({ type: 'tile', index: i, slotIndex: i });
    }
  }

  thingParams(i: number): { position: Vector3; rotation: Euler } {
    const slot = this.slots[this.things[i].slotIndex];

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
