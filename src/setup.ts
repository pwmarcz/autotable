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
  private previousLearningSeats: Array<number> = [];

  setup(conditions: Conditions): void {
    this.conditions = conditions;

    this.addSlots(conditions.gameType);
    this.addTiles(conditions);
    this.addSticks(conditions.gameType, conditions.points);
    this.addMarker();
    this.deal(0);
  }

  private wallSlots(): Array<Slot> {
    return [...this.slots.values()].filter(
      slot => slot.name.startsWith('wall'));
  }

  private addTiles(conditions: Conditions): void {
    const wallSlots = this.wallSlots().map(slot => slot.name);
    this.maybeShuffle(wallSlots, conditions);
    let j = 0;
    for (let i = 0; i < 136; i++) {
      const tileIndex = this.tileIndex(i, conditions);
      if (tileIndex !== null) {
        this.addThing(ThingType.TILE, tileIndex, wallSlots[j++]);
      }
    }
  }

  private maybeShuffle<T>(array: Array<T>, conditions?: Conditions): void {
    if ((conditions ?? this.conditions).dealType !== DealType.UNSHUFFLED) {
      shuffle(array);
    }
  }

  replace(conditions: Conditions, replacePoints: boolean): void {
    // console.log('replace', conditions);

    // Check if seats changed (for learning mode player count changes)
    const seatsChanged = conditions.gameType === GameType.LEARNING && 
                         this.conditions.gameType === GameType.LEARNING &&
                         JSON.stringify(GAME_TYPES[GameType.LEARNING].seats) !== 
                         JSON.stringify(this.previousLearningSeats);

    const whatReplace: Record<ThingType, boolean> = {
      TILE: (
        conditions.gameType !== this.conditions.gameType ||
        conditions.back !== this.conditions.back ||
        conditions.fives !== this.conditions.fives
      ),
      STICK: (
        replacePoints ||
        conditions.gameType !== this.conditions.gameType ||
        conditions.points !== this.conditions.points ||
        seatsChanged
      ),
      MARKER: conditions.gameType !== this.conditions.gameType,
    };

    const map = new Map<number, string>();
    for (const thing of [...this.things.values()]) {
      thing.prepareMove();
      if (whatReplace[thing.type]) {
        this.things.delete(thing.index);
      } else {
        map.set(thing.index, thing.slot.name);
      }
    }
    this.addSlots(conditions.gameType);
    if (whatReplace.TILE) {
      this.counters.set(ThingType.TILE, 0);
      this.addTiles(conditions);
    }
    if (whatReplace.STICK) {
      this.counters.set(ThingType.STICK, 0);
      this.addSticks(conditions.gameType, conditions.points);
    }
    if (whatReplace.MARKER) {
      this.counters.set(ThingType.MARKER, 0);
      this.addMarker();
    }

    for (const thing of this.things.values()) {
      if (!whatReplace[thing.type]) {
        const slotName = map.get(thing.index);
        if (slotName === undefined) {
          throw `couldn't recover slot name for thing ${thing.index}`;
        }
        const slot = this.slots.get(slotName);
        if (slot === undefined) {
          // Slot no longer exists - this shouldn't happen if whatReplace is set correctly
          // but handle it gracefully by deleting the thing
          this.things.delete(thing.index);
          continue;
        }
        // If thing is already in the correct slot, skip
        if (thing.slot === slot) {
          continue;
        }
        // If slot is occupied by a different thing, skip - it will be handled by sync
        if (slot.thing !== null && slot.thing !== thing) {
          continue;
        }
        // Move to slot if it's empty
        if (slot.thing === null) {
          thing.moveTo(slot, thing.rotationIndex);
        }
      }
    }
    this.conditions = conditions;
    
    // Store current learning seats for next comparison
    if (conditions.gameType === GameType.LEARNING) {
      this.previousLearningSeats = [...GAME_TYPES[GameType.LEARNING].seats];
    } else {
      this.previousLearningSeats = [];
    }
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

    // Filter by suit for learning modes
    // Tile index order: manzu (0-8), pinzu (9-17), souzu (18-26)
    // Red fives: manzu 5 -> 34, pinzu 5 -> 35, souzu 5 -> 36
    if (conditions.gameType === GameType.LEARNING) {
      if (conditions.dealType === DealType.LEARNING_ONE_SUIT_FOUR || 
          conditions.dealType === DealType.LEARNING_ONE_SUIT_SEVEN) {
        // Only souzu (18-26) and red five for souzu (36)
        if (!(tileIndex >= 18 && tileIndex < 27) && tileIndex !== 36) {
          return null;
        }
      } else if (conditions.dealType === DealType.LEARNING_TWO_SUIT_SEVEN ||
                 conditions.dealType === DealType.LEARNING_TWO_SUIT_TEN ||
                 conditions.dealType === DealType.LEARNING_TWO_SUIT_THIRTEEN) {
        // Only souzu (18-26), pinzu (9-17), and red fives for souzu (36) and pinzu (35)
        if (!((tileIndex >= 18 && tileIndex < 27) || (tileIndex >= 9 && tileIndex < 18)) && 
            tileIndex !== 36 && tileIndex !== 35) {
          return null;
        }
      } else if (conditions.dealType === DealType.LEARNING_THREE_SUIT_TEN ||
                 conditions.dealType === DealType.LEARNING_THREE_SUIT_THIRTEEN) {
        // Only souzu (18-26), pinzu (9-17), manzu (0-8), and red fives (36, 35, 34)
        if (!((tileIndex >= 18 && tileIndex < 27) || (tileIndex >= 9 && tileIndex < 18) || (tileIndex >= 0 && tileIndex < 9)) &&
            tileIndex !== 36 && tileIndex !== 35 && tileIndex !== 34) {
          return null;
        }
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

  deal(seat: number): [number, number] {
    const gameType = this.conditions.gameType;
    const dealType = this.conditions.dealType;
    // console.log('deal', gameType, dealType);

    const dice: [number, number] = [
      Math.floor(Math.random() * 6 + 1),
      Math.floor(Math.random() * 6 + 1)
    ];
    const roll = dice[0] + dice[1];
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

    this.maybeShuffle(tiles);

    // For learning mode, deal hands to all players
    const isLearning = gameType === GameType.LEARNING;
    if (isLearning) {
      const learningSeats = GAME_TYPES[GameType.LEARNING].seats;
      const playerCount = learningSeats.length;
      
      // Calculate total tiles available based on deal type
      let totalTiles = 0;
      if (dealType === DealType.LEARNING_ONE_SUIT_FOUR || dealType === DealType.LEARNING_ONE_SUIT_SEVEN) {
        totalTiles = 36; // One suit: 9 tiles * 4
      } else if (dealType === DealType.LEARNING_TWO_SUIT_SEVEN || 
                 dealType === DealType.LEARNING_TWO_SUIT_TEN ||
                 dealType === DealType.LEARNING_TWO_SUIT_THIRTEEN) {
        totalTiles = 72; // Two suits: 18 tiles * 4
      } else if (dealType === DealType.LEARNING_THREE_SUIT_TEN ||
                 dealType === DealType.LEARNING_THREE_SUIT_THIRTEEN) {
        totalTiles = 108; // Three suits: 27 tiles * 4
      }
      
      // Calculate tiles per hand from the first hand part
      const handPart = dealParts.find(part => part.ranges.some(([slotName]) => slotName.startsWith('hand.')));
      const tilesPerHand = handPart ? handPart.ranges.find(([slotName]) => slotName.startsWith('hand.'))?.[2] ?? 0 : 0;
      const totalHandTiles = tilesPerHand * playerCount;
      const wallTiles = totalTiles - totalHandTiles;
      
      for (const part of dealParts) {
        // Check if this part deals to hand slots
        const isHandPart = part.ranges.some(([slotName]) => slotName.startsWith('hand.'));
        if (isHandPart) {
          // Deal to all learning seats
          for (const learningSeat of learningSeats) {
            // Create a modified part that deals to this seat
            const modifiedPart = {
              ...part,
              ranges: part.ranges.map(([slotName, slotSeat, n]) => [slotName, learningSeat as 0 | 1 | 2 | 3, n] as [string, 0 | 1 | 2 | 3, number]),
            };
            this.dealPart(modifiedPart, tiles, roll, learningSeat);
          }
        } else if (part.ranges.some(([slotName]) => slotName.startsWith('wall.'))) {
          // For wall, update the tile count based on number of players
          const modifiedPart = {
            ...part,
            ranges: part.ranges.map(([slotName, slotSeat, n]) => {
              if (slotName.startsWith('wall.')) {
                return [slotName, slotSeat, wallTiles] as [string, 0 | 1 | 2 | 3, number];
              }
              return [slotName, slotSeat, n] as [string, 0 | 1 | 2 | 3, number];
            }),
          };
          this.dealPart(modifiedPart, tiles, roll, seat);
        } else {
          // For other slots, use original part
          this.dealPart(part, tiles, roll, seat);
        }
      }
    } else {
      // Normal deal for non-learning modes
      for (const part of dealParts) {
        this.dealPart(part, tiles, roll, seat);
      }
    }

    if (tiles.length !== 0) {
      throw `bad deal: ${tiles.length} remaining`;
    }

    return dice;
  }

  usesDice(): boolean {
    const gameType = this.conditions.gameType;
    const dealType = this.conditions.dealType;
    const dealParts = DEALS[gameType][dealType]!;
    for (const part of dealParts) {
      if (part.roll) return true;
    }
    return false;
  }

  private dealPart(dealPart: DealPart, tiles: Array<Thing>, roll: number, seat: number): void {
    if (dealPart.roll !== undefined && dealPart.roll !== roll) {
      return;
    }
    if (dealPart.tiles !== undefined) {
      const searched = [...dealPart.tiles];
      this.maybeShuffle(searched);

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

      const effectiveSeat = dealPart.absolute ? slotSeat : (slotSeat + seat) % 4;
      const baseSlotName = slotName + '@' + effectiveSeat;
      const baseSlot = this.slots.get(baseSlotName);
      if (baseSlot === undefined) {
        throw `slot not found: ${baseSlotName}`;
      }

      // Find consecutive slots with the same group and seat
      // For wall slots in learning mode, use slots from all seats if needed
      const matchingSlots: Array<Slot> = [];
      const useAllSeats = baseSlot.group === 'wall' && this.conditions.gameType === GameType.LEARNING;
      
      for (const slot of this.slots.values()) {
        if (slot.group === baseSlot.group) {
          // For wall in learning mode, use all seats; otherwise use only the effective seat
          if (!useAllSeats && slot.seat !== effectiveSeat) {
            continue;
          }
          // Exclude hand.extra slots when dealing to hand
          if (baseSlot.group === 'hand' && slot.name.includes('hand.extra')) {
            continue;
          }
          matchingSlots.push(slot);
        }
      }
      // Sort by seat first (for learning mode wall), then by indexes to get consecutive order
      matchingSlots.sort((a, b) => {
        // For learning mode wall, prioritize the effective seat, then use other seats
        if (useAllSeats && a.seat !== b.seat) {
          // Put effective seat first, then others in order
          if (a.seat === effectiveSeat) return -1;
          if (b.seat === effectiveSeat) return 1;
          return (a.seat ?? 0) - (b.seat ?? 0);
        }
        // Then sort by indexes
        for (let i = 0; i < Math.max(a.indexes.length, b.indexes.length); i++) {
          const ai = a.indexes[i] ?? 0;
          const bi = b.indexes[i] ?? 0;
          if (ai !== bi) return ai - bi;
        }
        return 0;
      });

      // Find the starting slot in the sorted list
      const startIdx = matchingSlots.findIndex(s => s.name === baseSlotName);
      if (startIdx === -1) {
        throw `starting slot not found in group: ${baseSlotName}`;
      }

      for (let i = 0; i < n; i++) {
        const slot = matchingSlots[startIdx + i];
        if (slot === undefined) {
          throw `not enough slots in group ${baseSlot.group} starting from ${baseSlotName}`;
        }
        if (slot.thing !== null) {
          throw `slot occupied: ${slot.name}`;
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
    // Stick typeIndex: 0=100, 1=500, 2=1000, 3=5000, 4=10000, 5=-10000 (debt)
    const stickScores = [100, 500, 1000, 5000, 10000, 10000];

    // Check all things, not just slots, to ensure we find sticks even if slot.thing is out of sync
    for (const thing of this.things.values()) {
      if (thing.type === ThingType.STICK) {
        const slot = thing.slot;
        if (slot && slot.group === 'tray' && slot.seat !== null) {
          const typeIndex = thing.typeIndex;
          if (typeIndex >= 0 && typeIndex < stickScores.length) {
            const score = stickScores[typeIndex];
            scores[slot.seat] += score;
            scores[4] -= score;
          }
        }
      }
    }

    const result = new Array(4).fill(null);
    for (const seat of GAME_TYPES[this.conditions.gameType].seats) {
      result[seat] = scores[seat];
    }

    return result;
  }
}
