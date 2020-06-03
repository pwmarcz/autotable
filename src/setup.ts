import { shuffle } from "./utils";
import { TileSet, SetupType, ThingType } from "./types";
import { DEALS, DealPart } from "./setup-deal";
import { makeSlots } from "./setup-slots";
import { Slot } from "./slot";
import { Thing } from "./thing";


export class Setup {
  slots: Map<string, Slot> = new Map();
  slotNames: Array<string> = [];
  things: Map<number, Thing> = new Map();
  counters: Map<ThingType, number> = new Map();
  start: Record<ThingType, number> = {
    'TILE': 0,
    'STICK': 1000,
    'MARKER': 2000,
  }
  pushes: Array<[Slot, Slot]> = [];

  setup(tileSet: TileSet): void {
    this.addSlots();
    this.addTiles(tileSet);
    this.addSticks();
    this.addMarker();
  }

  private wallSlots(): Array<Slot> {
    const slots = [];

    for (let num = 0; num < 4; num++) {
      for (let i = 0; i < 17; i++) {
        for (let j = 0; j < 2; j++) {
          slots.push(this.slots.get(`wall.${i+1}.${j}@${num}`)!);
        }
      }
    }
    return slots;
  }

  private addTiles(tileSet: TileSet): void {
    const wallSlots = this.wallSlots().map(slot => slot.name);
    shuffle(wallSlots);
    for (let i = 0; i < 136; i++) {
      const tileIndex = this.tileIndex(i, tileSet);
      this.addThing(ThingType.TILE, tileIndex, wallSlots[i]);
    }
  }

  updateTiles(tileSet: TileSet): void {
    for (let i = 0; i < 136; i++) {
      this.things.get(i)!.typeIndex = this.tileIndex(i, tileSet);
    }
  }

  private tileIndex(i: number, tileSet: TileSet): number {
    let tileIndex = Math.floor(i / 4);

    if (tileSet.fives !== '000') {
      if (tileIndex === 4 && i % 4 === 0) {
        tileIndex = 34;
      } else if (tileIndex === 13 &&
          (i % 4 === 0 || (i % 4 === 1 && tileSet.fives === '121'))) {
        tileIndex = 35;
      } else if (tileIndex === 22 && i % 4 === 0) {
        tileIndex = 36;
      }
    }

    tileIndex += 37 * tileSet.back;
    return tileIndex;
  }

  deal(seat: number, setupType: SetupType): void {
    const roll = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6);
    // Debug
    // const roll = (window.ROLL && window.ROLL < 12) ? window.ROLL + 1 : 2;
    // window.ROLL = roll;

    const dealParts = DEALS[setupType as string];

    const tiles = [...this.things.values()].filter(thing => thing.type === ThingType.TILE);
    for (const thing of tiles) {
      thing.prepareMove();
    }

    shuffle(tiles);
    for (const part of dealParts) {
      this.dealPart(part, tiles, roll, seat);
    }

    if (tiles.length !== 0) {
      throw `bad deal: ${tiles.length} remaining`;
    }
  }

  private dealPart(dealPart: DealPart, tiles: Array<Thing>, roll: number, seat: number): void {
    if (dealPart.roll !== undefined && dealPart.roll !== roll) {
      return;
    }
    if (dealPart.tiles !== undefined) {
      const searched = [...dealPart.tiles];
      shuffle(searched);

      for (let i = 0; i < searched.length; i++) {
        const idx = tiles.findIndex(tile => tile.index === searched[i]);
        if (idx === -1) {
          throw `not found: ${searched[i]}`;
        }
        const targetIdx = tiles.length - i - 1;
        const temp = tiles[targetIdx];
        tiles[targetIdx] = tiles[idx];
        tiles[idx] = temp;
      }
    }

    for (const [slotName, slotSeat, n] of dealPart.ranges) {
      if (tiles.length < n) {
        throw `tile underflow at ${slotName}`;
      }

      const idx = this.slotNames.indexOf(slotName);
      if (idx === -1) {
        throw `slot not found: ${slotName}`;
      }
      const effectiveSeat = (slotSeat + seat) % 4;
      for (let i = idx; i < idx + n; i++) {
        const targetSlotName = this.slotNames[i] + '@' + effectiveSeat;
        const slot = this.slots.get(targetSlotName);
        if (slot === undefined) {
          throw `slot not found: ${targetSlotName}`;
        }
        if (slot.thing !== null) {
          throw `slot occupied: ${targetSlotName}`;
        }

        const thing = tiles.pop()!;
        thing.moveTo(slot, dealPart.rotationIndex);
      }
    }
  }

  private addSticks(): void {
    const add = (index: number, n: number, slot: number): void => {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < n; j++) {
          this.addThing(ThingType.STICK, index, `tray.${slot}.${j}@${i}`);
        }
      }
    };

    // Debt
    add(5, 2, 0);
    // 10k
    add(4, 1, 1);
    // 5k
    add(3, 2, 2);
    // 1k
    add(2, 4, 3);
    // 500
    add(1, 1, 4);
    // 100
    add(0, 5, 5);
  }

  private addMarker(): void {
    this.addThing(ThingType.MARKER, 0, 'marker@0');
  }

  private addThing(
    type: ThingType,
    typeIndex: number,
    slotName: string,
    rotationIndex?: number
  ): void {
    if (this.slots.get(slotName) === undefined) {
      throw `Unknown slot: ${slotName}`;
    }

    const counter = this.counters.get(type) ?? 0;
    this.counters.set(type, counter + 1);
    const thingIndex = this.start[type] + counter;
    const slot = this.slots.get(slotName)!;

    const thing = new Thing(thingIndex, type, typeIndex, slot);
    this.things.set(thingIndex, thing);
    if (rotationIndex !== undefined) {
      thing.rotationIndex = rotationIndex;
    }
  }

  private addSlots(): void {
    this.slots.clear();
    this.slotNames.splice(0);
    this.pushes.splice(0);

    for (const slot of makeSlots()) {
      this.slots.set(slot.name, slot);
      if (slot.name.endsWith('@0')) {
        this.slotNames.push(slot.name.replace('@0', ''));
      }
    }
    Slot.setLinks(this.slots);

    this.pushes.push(...Slot.computePushes([...this.slots.values()]));
  }

  getScores(): Array<number> {
    const scores = new Array(4).fill(-20000);
    scores.push((25000 + 20000) * 4); // remaining
    const stickScores = [100, 500, 1000, 5000, 10000, 10000];

    for (const slot of this.slots.values()) {
      if (slot.group === 'tray' && slot.thing !== null) {
        const score = stickScores[slot.thing.typeIndex];
        scores[slot.seat!] += score;
        scores[4] -= score;
      }
    }
    return scores;
  }
}
