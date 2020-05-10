import { Vector2, Euler, Vector3 } from "three";

import { Place, Slot, Thing, Size, ThingType, Movement } from "./places";
import { Client, Collection, Game } from "./client";
import { shuffle, mostCommon } from "./utils";

interface Render {
  thingIndex: number;
  place: Place;
  selected: boolean;
  hovered: boolean;
  held: boolean;
  temporary: boolean;
  bottom: boolean;
}

interface Select extends Place {
  id: any;
}

const Rotation = {
  FACE_UP: new Euler(0, 0, 0),
  FACE_UP_SIDEWAYS: new Euler(0, 0, Math.PI / 2),
  STANDING: new Euler(Math.PI / 2, 0, 0),
  FACE_DOWN: new Euler(Math.PI, 0, 0),
  FACE_DOWN_REVERSE: new Euler(Math.PI, 0, Math.PI),
};

interface PlayerInfo {
  mouse: { x: number; y: number; z: number } | null;
  heldMouse: { x: number; y: number; z: number } | null;
}

interface ThingInfo {
  slotName: string;
  rotationIndex: number;
  heldBy: number | null;
}

export interface MatchInfo {
  dealer: number;
  honba: number;
}

export class World {
  slots: Record<string, Slot> = {};
  pushes: Array<[Slot, Slot]> = [];
  things: Array<Thing> = [];

  hovered: Thing | null = null;
  selected: Array<Thing> = [];
  mouse: Vector3 | null = null;

  held: Array<Thing> = [];
  movement: Movement | null = null;
  heldMouse: Vector3 | null = null;

  scoreSlots: Array<Array<Slot>> = [[], [], [], []];
  playerNum = 0;
  playerMouses: Array<Vector3 | null> = new Array(4).fill(null);
  playerHeldMouses: Array<Vector3 | null> = new Array(4).fill(null);

  static WIDTH = 174;

  client: Client;
  clientThings: Collection<number, ThingInfo>;
  clientPlayers: Collection<number, PlayerInfo>;
  clientMatch: Collection<number, MatchInfo>;

  constructor(client: Client) {
    this.addSlots();
    this.addTiles();
    this.addSticks();
    this.addMarker();

    this.client = client;
    this.clientThings = client.collection('things');
    this.clientPlayers = client.collection('players');
    this.clientMatch = client.collection<number, MatchInfo>('match');

    this.client.on('connect', this.onConnect.bind(this));
    this.clientPlayers.on('update', this.onPlayers.bind(this));
    this.clientThings.on('update', this.onThings.bind(this));

    // TODO confirmation prompt
    document.getElementById('deal')!.onclick = this.deal.bind(this);
    document.getElementById('toggle-dealer')!.onclick = () => {
      const match = this.clientMatch.get(0) ?? { dealer: 3, honba: 0};
      match.dealer = (match.dealer + 1) % 4;
      this.clientMatch.set(0, match);
    };
    document.getElementById('toggle-honba')!.onclick = () => {
      const match = this.clientMatch.get(0) ?? { dealer: 0, honba: 0};
      match.honba = (match.honba + 1) % 8;
      this.clientMatch.set(0, match);
    };
  }

  onConnect(game: Game): void {
    this.playerNum = game.num;
  }

  onPlayers(): void {
    for (let i = 0; i < 4; i++) {
      const player = this.clientPlayers.get(i);
      if (player) {
        this.playerMouses[i] = player.mouse && new Vector3(
          player.mouse.x, player.mouse.y, player.mouse.z);
        this.playerHeldMouses[i] = player.heldMouse && new Vector3(
          player.heldMouse.x, player.heldMouse.y, player.heldMouse.z);
      } else {
        this.playerMouses[i] = null;
        this.playerHeldMouses[i] = null;
      }
    }
  }

  onThings(entries: Array<[number, ThingInfo]>, full: boolean): void {
    if (entries.length === 0 && full) {
      this.sendUpdate(this.things);
      return;
    }

    for (const [thingIndex,] of entries) {
      const thing = this.things[thingIndex];
      thing.prepareMove();
    }
    for (const [thingIndex, thingInfo] of entries) {
      const thing = this.things[thingIndex];
      const slot = this.slots[thingInfo.slotName];
      thing.moveTo(slot, thingInfo.rotationIndex);

      // TODO: remove held?
      // TODO: move targetSlots to thing.targetSlot?
      if (thing.heldBy !== thingInfo.heldBy) {
        // Someone else grabbed the thing
        if (thing.heldBy === this.playerNum) {
          const heldIndex = this.held.indexOf(thing);
          if (heldIndex !== -1) {
            this.held.splice(heldIndex, 1);
            this.movement = null;
          }
        }
        // Someone gave us the thing back - might be a conflict.
        if (thingInfo.heldBy === this.playerNum) {
          // eslint-disable-next-line no-console
          console.error(`received thing to hold: ${thing.index}, current heldBy: ${thing.heldBy}`);
          thing.heldBy = null;
          this.sendUpdate([thing]);
        }
        thing.heldBy = thingInfo.heldBy;
      }
    }
    this.checkPushes();
  }

  sendUpdate(things: Array<Thing>): void {
    const entries: Array<[number, ThingInfo]> = [];
    for (const thing of things) {
      entries.push([thing.index, this.describeThing(thing)]);
    }
    this.clientThings.update(entries);
  }

  sendPlayer(): void {
    this.clientPlayers.set(this.playerNum, {
      mouse: this.mouse && {x: this.mouse.x, y: this.mouse.y, z: this.mouse.z},
      heldMouse: this.heldMouse && {x: this.heldMouse.x, y: this.heldMouse.y, z: this.heldMouse.z},
    });
  }

  describeThing(thing: Thing): ThingInfo {
    return {
      slotName: thing.slot.name,
      rotationIndex: thing.rotationIndex,
      heldBy: thing.heldBy,
    };
  }

  wallSlots(): Array<Slot> {
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

  addTiles(): void {
    const slots = this.wallSlots();
    shuffle(slots);

    // Shuffle slots, not tiles - this way tiles are the same for everyone.
    shuffle(slots);
    for (let i = 0; i < 136; i++) {
      const tileIndex = Math.floor(i / 4);
      this.addThing(ThingType.TILE, tileIndex, slots[i].name);
    }
  }

  deal(): void {
    const tiles = this.things.filter(thing => thing.type === ThingType.TILE);
    const slots = this.wallSlots();
    shuffle(slots);
    for (const thing of tiles) {
      thing.prepareMove();
      thing.heldBy = null;
    }
    for (let i = 0; i < 136; i++) {
      tiles[i].moveTo(slots[i]);
    }

    const slotsToDeal = this.wallSlots();
    const dice = Math.floor(Math.random() * 6) + Math.floor(Math.random() * 6);
    const wallNum = (this.playerNum + dice) % 4;
    let index = wallNum * 17 * 2 - dice * 2 - 1;
    for (let num = 0; num < 4; num++) {
      for (let i = 0; i < 13; i++) {
        const slot = slotsToDeal[(index + 136) % 136];
        const thing = slot.thing!;
        thing.prepareMove();
        thing.moveTo(this.slots[`hand.${i}@${num}`], 2);
        index--;
      }
    }

    this.held.splice(0);
    this.sendUpdate(tiles);

    const match = this.clientMatch.get(0);
    let honba;
    if (!match || match.dealer === this.playerNum) {
      honba = 0;
    } else {
      honba = (match.honba + 1) % 8;
    }
    this.clientMatch.set(0, {dealer: this.playerNum, honba});
  }

  addSticks(): void {
    const add = (index: number, n: number, slot: number): void => {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < n; j++) {
          this.addThing(ThingType.STICK, index, `stick.${slot}.${j}@${i}`);
        }
      }
    };

    // Debt
    add(4, 2, 0);
    // 10k
    add(3, 1, 1);
    // 5k
    add(2, 2, 2);
    // 1k
    add(1, 4, 3);
    // 100
    add(0, 5, 4);
    add(0, 5, 5);
  }

  addMarker(): void {
    this.addThing(ThingType.MARKER, 0, 'marker@0');
  }

  addThing(type: ThingType, typeIndex: number, slotName: string): void {
    if (this.slots[slotName] === undefined) {
      throw `Unknown slot: ${slotName}`;
    }

    const thingIndex = this.things.length;
    const slot = this.slots[slotName];

    const thing = new Thing(thingIndex, type, typeIndex, slot);
    this.things.push(thing);
  }

  addSlots(): void {
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
        shiftLeft: i > 0 ? `hand.${i-1}` : null,
        shiftRight: i < 13 ? `hand.${i+1}` : null,
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
          requires: i > 0 ? `meld.${i-1}.0` : null,
          shiftLeft: j > 0 ? `meld.${i}.${j-1}` : null,
          shiftRight: j < 3 ? `meld.${i}.${j+1}` : null,
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
          group: `wall.${j}`,
          origin: new Vector3(
            30 + i * Size.TILE.x,
            20,
            j * Size.TILE.z,
          ),
          rotations: [Rotation.FACE_DOWN, Rotation.FACE_UP],
          drawShadow: j === 0 && i >= 1 && i < 18,
          down: j === 1 ? `wall.0.${i}` : null,
          up: j === 0 ? `wall.1.${i}` : null,
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
        }));
        if (j > 0) {
          this.addPush(`discard.${i}.${j-1}`, `discard.${i}.${j}`);
        }
      }
    }

    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 10; j++) {
        this.addSlot(new Slot({
          name: `stick.${i}.${j}`,
          group: `stick`,
          type: ThingType.STICK,
          origin: new Vector3(
            15 + 24 * i,
            -25 - j * (Size.STICK.y + 1),
            0,
          ),
          rotations: [Rotation.FACE_UP],
          drawShadow: false,
          shiftLeft: j > 0 ? `stick.${i}.${j-1}` : null,
          shiftRight: j < 9 ? `stick.${i}.${j+1}` : null,
        }));
        for (let k = 0; k < 4; k++) {
          if (this.scoreSlots[k] === null) {
            this.scoreSlots[k] = [];
          }
          this.scoreSlots[k].push(this.slots[`stick.${i}.${j}@${k}`]);
        }
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
      group: 'marker@',
      type: ThingType.MARKER,
      origin: new Vector3(
        -4, -8, 0,
      ),
      rotations: [Rotation.FACE_DOWN_REVERSE, Rotation.FACE_UP],
      drawShadow: false,
    }));
  }

  addSlot(slot: Slot): void {
    for (let i = 0; i < 4; i++) {
      const rotated = slot.rotated('@' + i, i * Math.PI / 2, World.WIDTH);
      this.slots[rotated.name] = rotated;
    }
  }

  addPush(source: string, target: string): void {
    for (let i = 0; i < 4; i++) {
      this.pushes.push([this.slots[`${source}@${i}`], this.slots[`${target}@${i}`]]);
    }
  }

  onHover(id: any): void {
    if (this.held.length === 0) {
      this.hovered = id === null ? null : this.things[id as number];

      if (this.hovered !== null && !this.canSelect(this.hovered, [])) {
        this.hovered = null;
      }
    }
  }

  onSelect(ids: Array<any>): void {
    this.selected = ids.map(id => this.things[id as number]);
    this.selected = this.selected.filter(
      thing => this.canSelect(thing, this.selected));

    if (this.selected.length === 0) {
      return;
    }

    // Only allow selecting one thing type at a time
    const type = mostCommon(this.selected, thing => thing.type);
    this.selected = this.selected.filter(thing => thing.type === type);
  }

  onMove(mouse: Vector3 | null): void {
    if ((this.mouse === null && mouse === null) ||
        (this.mouse !== null && mouse !== null && this.mouse.equals(mouse))) {
      return;
    }

    this.mouse = mouse;
    this.sendPlayer();

    this.drag();
  }

  drag(): void {
    if (this.mouse === null || this.heldMouse === null) {
      return;
    }

    this.movement = new Movement();

    for (let i = 0; i < this.held.length; i++) {
      const thing = this.held[i];
      const place = thing.place();
      const x = place.position.x + this.mouse.x - this.heldMouse.x;
      const y = place.position.y + this.mouse.y - this.heldMouse.y;

      const targetSlot = this.findSlot(x, y, thing.type);
      if (targetSlot === null) {
        this.movement = null;
        return;
      }
      this.movement.move(thing, targetSlot);
    }

    const relevantThings = this.things.filter(thing =>
      thing.type === this.held[0].type
    );
    if (!this.movement.findShift(relevantThings, [
      slot => slot.shiftLeft !== null ? this.slots[slot.shiftLeft] : null,
      slot => slot.shiftRight !== null ? this.slots[slot.shiftRight] : null,
    ])) {
      this.movement = null;
    }
  }

  canSelect(thing: Thing, otherSelected: Array<Thing>): boolean {
    if (thing.slot.up !== null) {
      const upSlot = this.slots[thing.slot.up];
      if (upSlot.thing !== null &&
        otherSelected.indexOf(upSlot.thing) === -1) {

        return false;
      }
    }
    return true;
  }

  findSlot(x: number, y: number, thingType: ThingType): Slot | null {
    let bestDistance = Size.TILE.z * 1.5;
    let bestSlot = null;

    // Empty slots
    for (const slotName in this.slots) {
      const slot = this.slots[slotName];
      if (slot.type !== thingType) {
        continue;
      }

      if (slot.thing !== null && slot.thing.heldBy !== this.playerNum) {
        // Occupied. But can it be potentially shifted?
        if (slot.shiftLeft === null && slot.shiftRight === null) {
          continue;
        }
      }
      // Already proposed for another thing
      if (this.movement?.hasSlot(slot)) {
        continue;
      }
      // The slot requires other slots to be occupied first
      if (slot.requires !== null && this.slots[slot.requires].thing === null) {
        continue;
      }

      const place = slot.places[0];
      const dx = Math.max(0, Math.abs(x - place.position.x) - place.size.x / 2);
      const dy = Math.max(0, Math.abs(y - place.position.y) - place.size.y / 2);
      const distance = Math.sqrt(dx*dx + dy*dy);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestSlot = slot;
      }
    }
    return bestSlot;
  }

  onDragStart(): boolean {
    if (this.hovered !== null) {
      this.held.splice(0);

      if (this.selected.indexOf(this.hovered) !== -1) {
        this.held.push(...this.selected);
      } else {
        this.held.push(this.hovered);
        this.selected.splice(0);
      }

      // Sort by (z, y, x)
      this.held.sort((a, b) => {
        const ap = a.place().position;
        const bp = b.place().position;

        if (ap.z !== bp.z) {
          return ap.z - bp.z;
        }
        if (ap.y !== bp.y) {
          return ap.y - bp.z;
        }
        if (ap.x !== bp.x) {
          return ap.x - bp.x;
        }
        return 0;
      });

      for (const thing of this.held) {
        thing.heldBy = this.playerNum;
      }
      // this.hovered = null;
      this.heldMouse = this.mouse;

      this.sendUpdate(this.held);
      this.sendPlayer();
      this.drag();

      return true;
    }
    return false;
  }

  onDragEnd(): void {
    if (this.held.length > 0) {
      if (this.heldMouse !== null && this.mouse !== null &&
          this.heldMouse.equals(this.mouse)) {

        // No movement; unselect
        this.selected.splice(0);
        this.dropInPlace();
        // if (this.hovered !== null) {
        //   this.selected.push(this.hovered);
        // }
      } else if (this.canDrop()) {
        // Successful movement
        this.drop();
      } else {
        this.dropInPlace();
      }
    }

  }

  onFlip(direction: number): void {
    if (this.held.length > 0) {
      return;
    }

    if (this.selected.length > 0) {
      const rotationIndex = mostCommon(this.selected, thing => thing.rotationIndex)!;
      for (const thing of this.selected) {
        if (this.selected.length > 1 && !thing.slot.canFlipMultiple) {
          continue;
        }
        thing.flip(rotationIndex + direction);
      }
      this.sendUpdate(this.selected);
      this.checkPushes();
      this.selected.splice(0);
    } else if (this.hovered !== null) {
      this.hovered.flip(this.hovered.rotationIndex + direction);
      this.sendUpdate([this.hovered]);
      this.checkPushes();
    }
  }

  drop(): void {
    for (const thing of this.held) {
      thing.heldBy = null;
    }
    this.movement!.apply();
    this.sendUpdate([...this.movement!.things()]);
    this.checkPushes();
    this.finishDrop();
  }

  dropInPlace(): void {
    for (const thing of this.held) {
      thing.heldBy = null;
    }
    this.finishDrop();
  }

  finishDrop(): void {
    const toDrop = this.held.slice();
    this.selected.splice(0);
    this.held.splice(0);
    this.heldMouse = null;
    this.movement = null;

    this.sendUpdate(toDrop);
    this.sendPlayer();
  }

  canDrop(): boolean {
    return this.movement ? this.movement.valid() : false;
  }

  checkPushes(): void {
    for (const [source, target] of this.pushes) {
      target?.thing?.handlePush(source.thing);
    }
  }

  toRender(): Array<Render> {
    const canDrop = this.canDrop();

    const result = [];
    for (const thing of this.things) {
      let place = thing.place();
      const held = thing.heldBy !== null;

      if (thing.heldBy !== null) {
        let mouse = null, heldMouse = null;
        if (thing.heldBy === this.playerNum) {
          mouse = this.mouse;
          heldMouse = this.heldMouse;
        } else {
          mouse = this.playerMouses[thing.heldBy];
          heldMouse = this.playerHeldMouses[thing.heldBy];
        }

        if (mouse && heldMouse) {
          place = {...place, position: place.position.clone()};
          place.position.x += mouse.x - heldMouse.x;
          place.position.y += mouse.y - heldMouse.y;
        }
      } else if (this.movement && this.movement.has(thing)) {
        const targetSlot = this.movement.get(thing)!;
        place = targetSlot.places[this.movement.rotationIndex(thing)!];
      }

      const selected = this.selected.indexOf(thing) !== -1;
      const hovered = thing === this.hovered ||
        (selected && this.selected.indexOf(this.hovered!) !== -1);
      const temporary = held && !canDrop;

      const slot = thing.slot;

      let bottom = false;
      if (this.held !== null && slot.up !== null) {
        bottom = this.slots[slot.up].thing === null;
      }

      result.push({
        place,
        thingIndex: thing.index,
        selected,
        hovered,
        held,
        temporary,
        bottom,
      });
    }
    return result;
  }

  toRenderGhosts(): Array<Render> {
    const result: Array<Render> = [];
    // if (this.targetSlot !== null) {
    //   const thingIndex = this.held;
    //   const place = this.slotPlace(this.slots[this.targetSlot]);
    //   result.push({
    //     ...place,
    //     thingIndex,
    //     selected: false,
    //     held: false,
    //   });
    // }
    return result;
  }

  toSelect(): Array<Select> {
    const result = [];
    if (this.held.length === 0) {
      // Things
      for (const thing of this.things) {
        const place = thing.place();
        result.push({...place, id: thing.index});
      }
    }
    return result;
  }

  toRenderPlaces(): Array<Place> {
    const result = [];
    for (const slotName in this.slots) {
      if (this.slots[slotName].drawShadow) {
        result.push(this.slots[slotName].places[0]);
      }
    }
    return result;
  }

  toRenderShadows(): Array<Place> {
    const result = [];
    if (this.canDrop()) {
      for (const slot of this.movement!.slots()) {
        result.push(slot!.places[0]);
      }
    }
    return result;
  }

  getScores(): Array<number> {
    const scores = new Array(4).fill(-20000);
    scores.push((25000 + 20000) * 4); // remaining
    const stickScores = [100, 1000, 5000, 10000, 10000];

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
