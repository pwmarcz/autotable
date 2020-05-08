import { Vector2, Euler, Vector3 } from "three";

import { Place, Slot, Thing, Size, ThingType } from "./places";
import { Client, Status } from "./client";
import { shuffle } from "./utils";

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
};

interface PlayerInfo {
  mouse: { x: number; y: number; z: number } | null;
}

interface ThingInfo {
  slotName: string;
  rotationIndex: number;
}

export class World {
  slots: Record<string, Slot> = {};
  pushes: Array<[Slot, Slot]> = [];
  things: Array<Thing> = [];

  hovered: Thing | null = null;
  selected: Array<Thing> = [];
  mouse: Vector3 | null = null;

  targetSlots: Array<Slot | null> = [];
  held: Array<Thing> = [];
  heldMouse: Vector3 | null = null;

  scoreSlots: Array<Array<Slot>> = [[], [], [], []];
  playerNum = 0;
  playerCursors: Array<Vector3 | null> = new Array(4).fill(null);

  static WIDTH = 174;

  client: Client;

  constructor(client: Client) {
    this.addSlots();
    this.addTiles();
    this.addSticks();

    this.client = client;

    this.client.on('status', this.onStatus.bind(this));
    this.client.on('players', this.onPlayers.bind(this));
    this.client.on('update', this.onUpdate.bind(this));
    this.client.on('replace', this.onReplace.bind(this));
  }

  onStatus(status: Status): void {
    if (status === Status.JOINED) {
      this.playerNum = this.client.game!.num;
    }
  }

  onPlayers(players: Array<PlayerInfo | null>): void {
    for (let i = 0; i < 4; i++) {
      const player = players[i];
      if (player && player.mouse) {
        this.playerCursors[i] = new Vector3(player.mouse.x, player.mouse.y, player.mouse.z);
      } else {
        this.playerCursors[i] = null;
      }
    }
  }

  onUpdate(thingInfos: Record<number, ThingInfo>): void {
    // TODO conflicts!
    const indexes = Object.keys(thingInfos).map(k => parseInt(k, 10));
    indexes.sort((a, b) => a - b);

    for (const thingIndex of indexes) {
      const thing = this.things[thingIndex];
      thing.remove();
    }
    for (const thingIndex of indexes) {
      const thing = this.things[thingIndex];
      const thingInfo = thingInfos[thingIndex];
      const slot = this.slots[thingInfo.slotName];
      thing.moveTo(slot, thingInfo.rotationIndex);
    }
    this.checkPushes();
  }

  onReplace(allThings: Array<ThingInfo>): void {
    // TODO conflicts?
    if (allThings.length === 0) {
      this.client.replace(this.things.map(this.describeThing.bind(this)));
    } else {
      this.onUpdate(allThings);
    }
  }

  sendUpdate(things: Array<Thing>): void {
    const update: Record<number, ThingInfo> = {};
    for (const thing of things) {
      update[thing.index] = this.describeThing(thing);
    }
    this.client.update(update);
  }

  describeThing(thing: Thing): ThingInfo {
    return {
      slotName: thing.slot.name,
      rotationIndex: thing.rotationIndex,
    };
  }

  addTiles(): void {
    const slots = [];

    for (let i = 0; i < 17; i++) {
      for (let j = 0; j < 2; j++) {
        for (let k = 0; k < 4; k++) {
          slots.push(`wall.${i+1}.${j}.${k}`);
        }
      }
    }

    // Shuffle slots, not tiles - this way tiles are the same for everyone.
    shuffle(slots);
    for (let i = 0; i < 136; i++) {
      const tileIndex = Math.floor(i / 4);
      this.addThing(ThingType.TILE, tileIndex, slots[i]);
    }
  }

  addSticks(): void {
    const add = (index: number, n: number, slot: number): void => {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < n; j++) {
          this.addThing(ThingType.STICK, index, `stick.${slot}.${j}.${i}`);
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
        origin: new Vector3(
          46 + i*Size.TILE.x,
          0,
          0,
        ),
        rotations: [Rotation.STANDING, Rotation.FACE_UP],
        canFlipMultiple: true,
      }));
    }

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        this.addSlot(new Slot({
          name: `meld.${i}.${j}`,
          origin: new Vector3(
            174 - (j)*Size.TILE.x,
            i * Size.TILE.y,
            0,
          ),
          direction: new Vector2(-1, 1),
          rotations: [Rotation.FACE_UP, Rotation.FACE_UP_SIDEWAYS, Rotation.FACE_DOWN],
          drawShadow: false,
          requires: i > 0 ? `meld.${i-1}.0` : null,
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
          origin: new Vector3(
            30 + i * Size.TILE.x,
            20,
            j * Size.TILE.z,
          ),
          rotations: [Rotation.FACE_DOWN, Rotation.FACE_UP],
          drawShadow: j === 0 && i >= 1 && i < 18,
          down: j === 1 ? `wall.${i}.0` : null,
          up: j === 0 ? `wall.${i}.1` : null,
        }));
      }
    }

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 6; j++) {
        this.addSlot(new Slot({
          name: `discard.${i}.${j}`,
          origin: new Vector3(
            69 + j * Size.TILE.x,
            60 - i * Size.TILE.y,
            0,
          ),
          direction: new Vector2(1, 1),
          rotations: [Rotation.FACE_UP, Rotation.FACE_UP_SIDEWAYS],
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
          type: ThingType.STICK,
          origin: new Vector3(
            15 + 24 * i,
            -25 - j * (Size.STICK.y + 1),
            0,
          ),
          rotations: [Rotation.FACE_UP],
          drawShadow: false,
        }));
        for (let k = 0; k < 4; k++) {
          if (this.scoreSlots[k] === null) {
            this.scoreSlots[k] = [];
          }
          this.scoreSlots[k].push(this.slots[`stick.${i}.${j}.${k}`]);
        }
      }
    }

    this.addSlot(new Slot({
      name: 'riichi',
      type: ThingType.STICK,
      origin: new Vector3(
        (World.WIDTH - Size.STICK.x) / 2,
        71.5,
        1.5,
      ),
      rotations: [Rotation.FACE_UP],
      drawShadow: false,
    }));
  }

  addSlot(slot: Slot): void {
    for (let i = 0; i < 4; i++) {
      const rotated = slot.rotated('.' + i, i * Math.PI / 2, World.WIDTH);
      this.slots[rotated.name] = rotated;
    }
  }

  addPush(source: string, target: string): void {
    for (let i = 0; i < 4; i++) {
      this.pushes.push([this.slots[`${source}.${i}`], this.slots[`${target}.${i}`]]);
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
    const counts: Map<ThingType, number> = new Map();
    for (const thing of this.selected) {
      counts.set(thing.type, (counts.get(thing.type) ?? 0) + 1);
    }
    const allTypes = Array.from(counts.keys());
    allTypes.sort((a, b) => counts.get(b)! - counts.get(a)!);
    this.selected = this.selected.filter(thing => thing.type === allTypes[0]);
  }

  onMove(mouse: Vector3 | null): void {
    if ((this.mouse === null && mouse === null) ||
        (this.mouse !== null && mouse !== null && this.mouse.equals(mouse))) {
      return;
    }

    this.client.updatePlayer<PlayerInfo>({
      mouse: this.mouse ? {x: this.mouse.x, y: this.mouse.y, z: this.mouse.z} : null,
    });
    this.mouse = mouse;

    this.drag();
  }

  drag(): void {
    if (this.mouse === null || this.heldMouse === null) {
      return;
    }

    for (let i = 0; i < this.held.length; i++) {
      this.targetSlots[i] = null;
    }

    for (let i = 0; i < this.held.length; i++) {
      const thing = this.held[i];
      const place = thing.place();
      const x = place.position.x + this.mouse.x - this.heldMouse.x;
      const y = place.position.y + this.mouse.y - this.heldMouse.y;

      this.targetSlots[i] = this.findSlot(x, y, thing.type);
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

      if (slot.thing !== null && this.held.indexOf(slot.thing) === -1) {
        continue;
      }
      // Already proposed for another thing
      if (this.targetSlots.indexOf(slot) !== -1) {
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
      // this.hovered = null;
      this.heldMouse = this.mouse;

      this.targetSlots.length = this.held.length;
      for (let i = 0; i < this.held.length; i++) {
        this.targetSlots[i] = null;
      }

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
        // if (this.hovered !== null) {
        //   this.selected.push(this.hovered);
        // }
      } else if (this.canDrop()) {
        // Successful movement
        this.drop();
      }
    }
    this.held.splice(0);
    this.targetSlots.splice(0);
  }

  onFlip(): void {
    if (this.held.length > 0) {
      return;
    }

    if (this.selected.length > 0) {
      for (const thing of this.selected) {
        if (this.selected.length > 1 && !thing.slot.canFlipMultiple) {
          continue;
        }
        thing.flip();
        this.sendUpdate(this.selected);
      }
      this.checkPushes();
      this.selected.splice(0);
    } else if (this.hovered !== null) {
      this.hovered.flip();
      this.sendUpdate([this.hovered]);
      this.checkPushes();
    }
  }

  drop(): void {
    for (const thing of this.held) {
      thing.remove();
    }
    for (let i = 0; i < this.held.length; i++) {
      const thing = this.held[i];
      const targetSlot = this.targetSlots[i]!;
      thing.moveTo(targetSlot);
    }
    this.sendUpdate(this.held);
    this.checkPushes();
    this.selected.splice(0);
  }

  canDrop(): boolean {
    return this.targetSlots.every(s => s !== null);
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
      const held = this.held.indexOf(thing) !== -1;

      if (held && this.mouse !== null && this.heldMouse !== null) {
        place = {...place, position: place.position.clone()};
        place.position.x += this.mouse.x - this.heldMouse.x;
        place.position.y += this.mouse.y - this.heldMouse.y;
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
      for (const slot of this.targetSlots) {
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
