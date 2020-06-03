import { shuffle } from "./utils";
import { TileSet, DealType, ThingType, GameType } from "./types";
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
    const gameType = GameType.FOUR_PLAYER;

    this.addSlots(gameType);
    this.addTiles(tileSet);
    this.addSticks();
    this.addMarker();
    this.deal(0, gameType, DealType.INITIAL);
  }

  private wallSlots(): Array<Slot> {
    return [...this.slots.values()].filter(
      slot => slot.name.startsWith('wall'));
  }

  private addTiles(tileSet: TileSet): void {
    const wallSlots = this.wallSlots().map(slot => slot.name);
    shuffle(wallSlots);
    let j = 0;
    for (let i = 0; i < 136; i++) {
      const tileIndex = this.tileIndex(i, tileSet);
      if (tileIndex !== null) {
        this.addThing(ThingType.TILE, tileIndex, wallSlots[j++]);
      }
    }
  }

  replace(tileSet: TileSet): void {
    const map = new Map<number, string>();
    for (const thing of [...this.things.values()]) {
      thing.prepareMove();
      if (thing.type === ThingType.TILE) {
        this.things.delete(thing.index);
      } else {
        map.set(thing.index, thing.slot.name);
      }
    }
    this.counters.set(ThingType.TILE, 0);
    this.addSlots(tileSet.gameType);
    this.addTiles(tileSet);
    for (const thing of this.things.values()) {
      if (thing.type !== ThingType.TILE) {
        const slotName = map.get(thing.index);
        if (slotName === undefined) {
          throw `couldn't recover slot name for thing ${thing.index}`;
        }
        const slot = this.slots.get(slotName);
        if (slot === undefined) {
          throw `trying to move thing to slot ${slotName}, but it doesn't exist`;
        }
        thing.moveTo(slot, thing.rotationIndex);
      }
    }
  }

  private tileIndex(i: number, tileSet: TileSet): number | null {
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

    if (tileSet.gameType === GameType.BAMBOO) {
      if (!(18 <= tileIndex && tileIndex < 27) && tileIndex !== 36) {
        return null;
      }
    }

    tileIndex += 37 * tileSet.back;
    return tileIndex;
  }

  deal(seat: number, gameType: GameType, dealType: DealType): void {
    const roll = Math.floor(Math.random() * 6 + 1) + Math.floor(Math.random() * 6 + 1);
    // Debug
    // const roll = (window.ROLL && window.ROLL < 12) ? window.ROLL + 1 : 2;
    // window.ROLL = roll;

    if ((gameType === GameType.BAMBOO || gameType === GameType.MINEFIELD) && (seat === 1 || seat === 3)) {
      seat = 0;
    }

    const dealParts = DEALS[gameType][dealType];

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
        const idx = tiles.findIndex(tile => tile.typeIndex === searched[i]);
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
      const effectiveSeat = dealPart.absolute ? slotSeat : (slotSeat + seat) % 4;
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

  private addSlots(gameType: GameType): void {
    this.slots.clear();
    this.slotNames.splice(0);
    this.pushes.splice(0);

    const slotNames: Set<string> = new Set();
    for (const slot of makeSlots(gameType)) {
      this.slots.set(slot.name, slot);
      const shortName = slot.name.replace(/@.*/, '');
      if (!slotNames.has(shortName)) {
        slotNames.add(shortName);
      }
    }
    this.slotNames.push(...slotNames.values());
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
