export const TILE_WIDTH = 6;
export const TILE_HEIGHT = 9;
export const TILE_DEPTH = 4;

export class World {
  constructor() {
    this.slots = [];
    for (let i = 0; i < 10; i++) {
      this.slots.push({
        x: 6 * i,
        y: 10,
      });
    }

    this.things = [];
    this.things.push({ type: 'tile', index: 0, slotIndex: 0 });
    this.things.push({ type: 'tile', index: 1, slotIndex: 2 });
    this.things.push({ type: 'tile', index: 2, slotIndex: 4 });
  }

  thingParams(i) {
    const slot = this.slots[this.things[i].slotIndex];

    return {
      x: slot.x,
      y: slot.y,
    };
  }
}
