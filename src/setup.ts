import { shuffle } from "./utils";
import { Conditions, DealType, ThingType, GameType, Points, GAME_TYPES } from "./types";
import { DEALS, DealPart, POINTS } from "./setup-deal";
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
  conditions!: Conditions;

  setup(conditions: Conditions): void {
    this.conditions = conditions;

    this.addSlots(conditions.gameType);
    this.addTiles(conditions);
    this.addSticks(conditions.gameType, conditions.points);
    this.addMarker();
    this.deal(0, conditions.gameType, DealType.INITIAL);
  }

  private wallSlots(): Array<Slot> {
    return [...this.slots.values()].filter(
      slot => slot.name.startsWith('wall'));
  }

  private addTiles(conditions: Conditions): void {
    const wallSlots = this.wallSlots().map(slot => slot.name);
    shuffle(wallSlots);
    let j = 0;
    for (let i = 0; i < 136; i++) {
      const tileIndex = this.tileIndex(i, conditions);
      if (tileIndex !== null) {
        this.addThing(ThingType.TILE, tileIndex, wallSlots[j++]);
      }
    }
  }

  replace(conditions: Conditions): void {
    // console.log('replace', conditions);

    const replaceSticks = (
      conditions.gameType !== this.conditions.gameType ||
      conditions.points !== this.conditions.points
    );

    const map = new Map<number, string>();
    for (const thing of [...this.things.values()]) {
      thing.prepareMove();
      if (thing.type === ThingType.TILE || (thing.type === ThingType.STICK && replaceSticks)) {
        this.things.delete(thing.index);
      } else {
        map.set(thing.index, thing.slot.name);
      }
    }
    this.counters.set(ThingType.TILE, 0);
    this.addSlots(conditions.gameType);
    this.addTiles(conditions);
    if (replaceSticks) {
      this.addSticks(conditions.gameType, conditions.points);
    }
    for (const thing of this.things.values()) {
      if (!(thing.type === ThingType.TILE || (thing.type === ThingType.STICK && replaceSticks))) {
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
    this.conditions = conditions;
  }

  private tileIndex(i: number, conditions: Conditions): number | null {
    let tileIndex = Math.floor(i / 4);

    if (conditions.fives !== '000') {
      if (tileIndex === 4 && i % 4 === 0) {
        tileIndex = 34;
      } else if (tileIndex === 13 &&
          (i % 4 === 0 || (i % 4 === 1 && conditions.fives === '121'))) {
        tileIndex = 35;
      } else if (tileIndex === 22 && i % 4 === 0) {
        tileIndex = 36;
      }
    }

    if (conditions.gameType === GameType.BAMBOO) {
      if (!((18 <= tileIndex && tileIndex < 27) || tileIndex === 36)) {
        return null;
      }
    }

    if (conditions.gameType === GameType.THREE_PLAYER) {
      if ((1 <= tileIndex && tileIndex < 8) || tileIndex === 34) {
        return null;
      }
    }

    tileIndex += 37 * conditions.back;
    return tileIndex;
  }

  deal(seat: number, gameType: GameType, dealType: DealType): void {
    // console.log('deal', gameType, dealType);

    const roll = Math.floor(Math.random() * 6 + 1) + Math.floor(Math.random() * 6 + 1);
    // Debug
    // const roll = (window.ROLL && window.ROLL < 12) ? window.ROLL + 1 : 2;
    // window.ROLL = roll;

    if (GAME_TYPES[gameType].seats.indexOf(seat) === -1) {
      seat = 0;
    }

    const dealParts = DEALS[gameType][dealType]!;

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
        // HACK: typeIndex includes back color
        const idx = tiles.findIndex(tile =>
          (tile.typeIndex === searched[i] || tile.typeIndex === searched[i] + 37));
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

  private addSticks(gameType: GameType, points: Points): void {
    const seats = GAME_TYPES[gameType].seats;
    const add = (index: number, n: number, slot: number): void => {
      for (const seat of seats) {
        for (let j = 0; j < n; j++) {
          this.addThing(ThingType.STICK, index, `tray.${slot}.${j}@${seat}`);
        }
      }
    };

    // Debt
    add(5, POINTS[points][0], 0);
    // 10k
    add(4, POINTS[points][1], 1);
    // 5k
    add(3, POINTS[points][2], 2);
    // 1k
    add(2, POINTS[points][3], 3);
    // 500
    add(1, POINTS[points][4], 4);
    // 100
    add(0, POINTS[points][5], 5);
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

  getScores(): Array<number | null> {
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

    const result = new Array(4).fill(null);
    for (const seat of GAME_TYPES[this.conditions.gameType].seats) {
      result[seat] = scores[seat];
    }

    return result;
  }
}
