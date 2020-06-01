import { Slot, Thing, ThingType, Size } from "./places";
import { shuffle } from "./utils";
import { Vector3, Euler, Vector2 } from "three";
import { World } from "./world";
import { TileSet, SetupType } from "./types";
import { DEALS, DealPart } from "./setup-data";


const Rotation = {
  FACE_UP: new Euler(0, 0, 0),
  FACE_UP_SIDEWAYS: new Euler(0, 0, Math.PI / 2),
  STANDING: new Euler(Math.PI / 2, 0, 0),
  FACE_DOWN: new Euler(Math.PI, 0, 0),
  FACE_DOWN_REVERSE: new Euler(Math.PI, 0, Math.PI),
};

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
  private scoreSlots: Array<Array<Slot>> = [[], [], [], []];

  setup(tileSet: TileSet): void {
    this.addSlots();
    for (const slot of this.slots.values()) {
      slot.setLinks(this.slots);
    }
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
    for (let i = 0; i < 14; i++) {
      this.addSlot(new Slot({
        name: `hand.${i}`,
        group: `hand`,
        origin: new Vector3(
          46 + i*Size.TILE.x,
          0,
          0,
        ),
        rotations: [Rotation.STANDING, Rotation.FACE_UP, Rotation.FACE_DOWN],
        canFlipMultiple: true,
        links: {
          shiftLeft: i > 0 ? `hand.${i-1}` : undefined,
          shiftRight: i < 13 ? `hand.${i+1}` : undefined,
        },
        drawShadow: true,
        shadowRotation: 1,
        rotateHeld: true,
      }));
    }

    this.addSlot(new Slot({
      name: `hand.extra`,
      group: `hand`,
      origin: new Vector3(
        46 + 14.5*Size.TILE.x,
        0,
        0,
      ),
      rotations: [Rotation.STANDING, Rotation.FACE_UP, Rotation.FACE_DOWN],
      canFlipMultiple: true,
      rotateHeld: true,
    }));

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        this.addSlot(new Slot({
          name: `meld.${i}.${j}`,
          group: `meld`,
          origin: new Vector3(
            174 - (j)*Size.TILE.x,
            i * Size.TILE.y,
            0,
          ),
          direction: new Vector2(-1, 1),
          rotations: [Rotation.FACE_UP, Rotation.FACE_UP_SIDEWAYS, Rotation.FACE_DOWN],
          links: {
            // Hack: This requires the second slot, not first, in case someone
            // put a pon/chi starting from the second slot.
            requires: i > 0 ? `meld.${i-1}.1` : undefined,
            shiftLeft: j > 0 ? `meld.${i}.${j-1}` : undefined,
            shiftRight: j < 3 ? `meld.${i}.${j+1}` : undefined,
          }
        }));
        if (j > 0) {
          this.addPush(`meld.${i}.${j-1}`, `meld.${i}.${j}`);
        }
      }
    }

    for (let i = 0; i < 19; i++) {
      for (let j = 0; j < 2; j++) {
        this.addSlot(new Slot({
          name: `wall.${i}.${j}`,
          group: `wall`,
          origin: new Vector3(
            30 + i * Size.TILE.x,
            20,
            j * Size.TILE.z,
          ),
          rotations: [Rotation.FACE_DOWN, Rotation.FACE_UP],
          drawShadow: j === 0 && i >= 1 && i < 18,
          links: {
            down: j === 1 ? `wall.${i}.0` : undefined,
            up: j === 0 ? `wall.${i}.1` : undefined,
          }
        }));
      }
    }

    for (let i = 0; i < 3; i++) {
      const n = i < 2 ? 6 : 10;
      for (let j = 0; j < n; j++) {
        this.addSlot(new Slot({
          name: `discard.${i}.${j}`,
          group: `discard`,
          origin: new Vector3(
            69 + j * Size.TILE.x,
            60 - i * Size.TILE.y,
            0,
          ),
          direction: new Vector2(1, 1),
          rotations: [Rotation.FACE_UP, Rotation.FACE_UP_SIDEWAYS],
          drawShadow: j < 6,
          links: {
            requires: j < 6 ? undefined : `discard.${i}.${j-1}`,
      },
        }));
        if (j > 0) {
          this.addPush(`discard.${i}.${j-1}`, `discard.${i}.${j}`);
        }
      }
    }

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 10; j++) {
        this.addSlot(new Slot({
          name: `tray.${i}.${j}`,
          group: `tray`,
          type: ThingType.STICK,
          origin: new Vector3(
            15 + 24 * i,
            -25 - j * 3,
            0,
          ),
          rotations: [Rotation.FACE_UP],
          links: {
            shiftLeft: j > 0 ? `tray.${i}.${j-1}` : undefined,
            shiftRight: j < 9 ? `tray.${i}.${j+1}` : undefined,
          }
        }));
        for (let k = 0; k < 4; k++) {
          this.scoreSlots[k].push(this.slots.get(`tray.${i}.${j}@${k}`)!);
        }
      }
    }

    for (let i = 0; i < 1; i++) {
      for (let j = 0; j < 8; j++) {
        this.addSlot(new Slot({
          name: `payment.${i}.${j }`,
          group: `payment.${i}`,
          type: ThingType.STICK,
          origin: new Vector3(
            42 + (1-i) * j * 3,
            42 + i * j * 3,
            0
          ),
          rotations: [i === 0 ? Rotation.FACE_UP_SIDEWAYS : Rotation.FACE_UP],
          links: {
            shiftLeft: i > 0 ? `payment.${i}.${j-1}` : undefined,
            shiftRight: i < 0 ? `payment.${i}.${j+1}` : undefined,
          },
        }));
      }
    }

    this.addSlot(new Slot({
      name: 'riichi',
      group: 'riichi',
      type: ThingType.STICK,
      origin: new Vector3(
        (World.WIDTH - Size.STICK.x) / 2,
        71.5,
        1.5,
      ),
      rotations: [Rotation.FACE_UP],
    }));

    this.addSlot(new Slot({
      name: 'marker',
      group: 'marker',
      type: ThingType.MARKER,
      origin: new Vector3(
        166, -8, 0,
      ),
      rotations: [Rotation.FACE_DOWN_REVERSE, Rotation.FACE_UP],
    }));
  }

  private addSlot(slot: Slot): void {
    for (let i = 0; i < 4; i++) {
      const rotated = slot.rotated(i, World.WIDTH);
      this.slots.set(rotated.name, rotated);
    }
    this.slotNames.push(slot.name);
  }

  private addPush(source: string, target: string): void {
    for (let i = 0; i < 4; i++) {
      this.pushes.push([this.slots.get(`${source}@${i}`)!, this.slots.get(`${target}@${i}`)!]);
    }
  }

  getScores(): Array<number> {
    const scores = new Array(4).fill(-20000);
    scores.push((25000 + 20000) * 4); // remaining
    const stickScores = [100, 500, 1000, 5000, 10000, 10000];

    for (let i = 0; i < 4; i++) {
      for (const slot of this.scoreSlots[i]) {
        if (slot.thing !== null) {
          if (slot.thing.type === ThingType.STICK) {
            const score = stickScores[slot.thing.typeIndex];
            scores[i] += score;
            scores[4] -= score;
          }
        }
      }
    }
    return scores;
  }
}
