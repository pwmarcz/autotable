import { Slot, Thing, ThingType, Size } from "./places";
import { shuffle } from "./utils";
import { Vector3, Euler, Vector2 } from "three";
import { World } from "./world";
import { TileSet } from "./types";


const Rotation = {
  FACE_UP: new Euler(0, 0, 0),
  FACE_UP_SIDEWAYS: new Euler(0, 0, Math.PI / 2),
  STANDING: new Euler(Math.PI / 2, 0, 0),
  FACE_DOWN: new Euler(Math.PI, 0, 0),
  FACE_DOWN_REVERSE: new Euler(Math.PI, 0, Math.PI),
};

export class Setup {
  slots: Record<string, Slot> = {};
  things: Array<Thing> = [];
  pushes: Array<[Slot, Slot]> = [];
  private scoreSlots: Array<Array<Slot>> = [[], [], [], []];

  setup(tileSet: TileSet): void {
    this.addSlots();
    for (const slotName in this.slots) {
      this.slots[slotName].setLinks(this.slots);
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
          slots.push(this.slots[`wall.${j}.${i+1}@${num}`]);
        }
      }
    }
    return slots;
  }

  private addTiles(tileSet: TileSet): void {
    const slots = this.wallSlots();

    // Shuffle slots, not tiles - this way tiles are the same for everyone.
    shuffle(slots);
    for (let i = 0; i < 136; i++) {
      this.addThing(ThingType.TILE, this.tileIndex(i, tileSet), slots[i].name);
    }
  }

  updateTiles(tileSet: TileSet): void {
    for (let i = 0; i < 136; i++) {
      this.things[i].typeIndex = this.tileIndex(i, tileSet);
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

  deal(playerNum: number): void {
    const tiles = this.things.filter(thing => thing.type === ThingType.TILE);
    const slots = this.wallSlots();
    shuffle(slots);
    for (const thing of tiles) {
      thing.prepareMove();
    }
    for (let i = 0; i < 136; i++) {
      tiles[i].moveTo(slots[i]);
    }

    const slotsToDeal = this.wallSlots();
    const dice = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6);
    const wallNum = (playerNum + dice - 1) % 4;
    const deadWallBegin = 136 + (wallNum+1) * 17 * 2 - dice * 2;

    let index = deadWallBegin - 1;
    for (let num = 0; num < 4; num++) {
      for (let i = 0; i < 13; i++) {
        const slot = slotsToDeal[index % 136];
        const thing = slot.thing!;
        thing.prepareMove();
        thing.moveTo(this.slots[`hand.${i}@${num}`], 2);
        index--;
      }
    }

    // Make a gap at the end of dead wall
    const moveFrom = [
      slotsToDeal[(deadWallBegin+12)%136], slotsToDeal[(deadWallBegin+13)%136]
    ];
    let moveTo;
    if (Math.floor((deadWallBegin + 12) / 34) === Math.floor(deadWallBegin / 34)) {
      moveTo = [slotsToDeal[(deadWallBegin-2)%136], slotsToDeal[(deadWallBegin-1)%136]];
    } else {
      const endWall = Math.floor((deadWallBegin + 12) / 34) % 4;
      moveTo = [this.slots[`wall.0.0@${endWall}`], this.slots[`wall.1.0@${endWall}`]];
    }
    for (let i = 0; i < 2; i++) {
      const thing = moveFrom[i].thing!;
      thing.prepareMove();
      thing.moveTo(moveTo[i]);
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

  private addThing(type: ThingType, typeIndex: number, slotName: string): void {
    if (this.slots[slotName] === undefined) {
      throw `Unknown slot: ${slotName}`;
    }

    const thingIndex = this.things.length;
    const slot = this.slots[slotName];

    const thing = new Thing(thingIndex, type, typeIndex, slot);
    this.things.push(thing);
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
        shadowRotation: 1,
      }));
    }

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
          drawShadow: false,
          links: {
            requires: i > 0 ? `meld.${i-1}.0` : undefined,
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
          name: `wall.${j}.${i}`,
          group: `wall`,
          origin: new Vector3(
            30 + i * Size.TILE.x,
            20,
            j * Size.TILE.z,
          ),
          rotations: [Rotation.FACE_DOWN, Rotation.FACE_UP],
          drawShadow: j === 0 && i >= 1 && i < 18,
          links: {
            down: j === 1 ? `wall.0.${i}` : undefined,
            up: j === 0 ? `wall.1.${i}` : undefined,
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
          drawShadow: false,
          links: {
            shiftLeft: j > 0 ? `tray.${i}.${j-1}` : undefined,
            shiftRight: j < 9 ? `tray.${i}.${j+1}` : undefined,
          }
        }));
        for (let k = 0; k < 4; k++) {
          this.scoreSlots[k].push(this.slots[`tray.${i}.${j}@${k}`]);
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
          drawShadow: false,
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
      drawShadow: false,
    }));

    this.addSlot(new Slot({
      name: 'marker',
      group: 'marker',
      type: ThingType.MARKER,
      origin: new Vector3(
        -4, -8, 0,
      ),
      rotations: [Rotation.FACE_DOWN_REVERSE, Rotation.FACE_UP],
      drawShadow: false,
    }));
  }

  private addSlot(slot: Slot): void {
    for (let i = 0; i < 4; i++) {
      const rotated = slot.rotated('@' + i, i * Math.PI / 2, World.WIDTH);
      this.slots[rotated.name] = rotated;
    }
  }

  private addPush(source: string, target: string): void {
    for (let i = 0; i < 4; i++) {
      this.pushes.push([this.slots[`${source}@${i}`], this.slots[`${target}@${i}`]]);
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
