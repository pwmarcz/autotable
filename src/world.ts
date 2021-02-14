import { Vector3 } from "three";

import { Movement } from "./movement";
import { Client } from "./client";
import { mostCommon, rectangleOverlap, filterMostCommon, compareZYX } from "./utils";
import { MouseTracker } from "./mouse-tracker";
import { Setup } from './setup';
import { ObjectView, Render } from "./object-view";
import { SoundPlayer } from "./sound-player";
import { Conditions, ThingInfo, SoundType, Fives, Place, ThingType, Size, DealType, GameType, Points } from "./types";
import { Slot } from "./slot";
import { Thing } from "./thing";


interface Select extends Place {
  id: any;
}

const SHIFT_TIME = 100;

export class World {
  private setup: Setup;

  private objectView: ObjectView;

  slots: Map<string, Slot>;
  things: Map<number, Thing>;
  private pushes: Array<[Slot, Slot]>;

  private hovered: Thing | null = null;
  private selected: Array<Thing> = [];
  private mouse: Vector3 | null = null;

  private movement: Movement | null = null;
  private heldMouse: Vector3 | null = null;
  mouseTracker: MouseTracker;

  soundPlayer: SoundPlayer;

  seat: number | null = 0;

  static WIDTH = 174;

  private client: Client;

  conditions: Conditions;

  constructor(objectView: ObjectView, soundPlayer: SoundPlayer, client: Client) {
    this.setup = new Setup();
    this.slots = this.setup.slots;
    this.things = this.setup.things;
    this.pushes = this.setup.pushes;
    this.conditions = Conditions.initial();
    this.setup.setup(this.conditions);

    this.objectView = objectView;
    this.setupView();

    this.client = client;
    this.mouseTracker = new MouseTracker(this.client);

    this.soundPlayer = soundPlayer;

    this.client.seats.on('update', this.onSeat.bind(this));
    this.client.things.on('update', this.onThings.bind(this));
    this.client.match.on('update', this.onMatch.bind(this));
    this.sendUpdate();
  }

  toggleDealer(): void {
    const match = this.client.match.get(0) ?? { dealer: 3, honba: 0, conditions: Conditions.initial()};
    match.dealer = (match.dealer - 1) % 4; //LG EDIT change direction
    if (match.dealer<0) match.dealer = 3; //LG EDIT catch % not working for negative values
    this.client.match.set(0, match);
  }

  toggleHonba(): void {
    const match = this.client.match.get(0) ?? { dealer: 0, honba: 0, conditions: Conditions.initial()};
    match.honba = (match.honba + 1) % 8;
    this.client.match.set(0, match);
  };

  private onSeat(): void {
    this.seat = this.client.seat;
  }

  private onThings(entries: Array<[number, ThingInfo | null]>): void {
    const now = new Date().getTime();

    for (const [thingIndex, thingInfo] of entries) {
      // TODO handle deletion
      if (thingInfo === null) {
        continue;
      }

      const thing = this.things.get(thingIndex)!;
      thing.prepareMove();
    }
    for (const [thingIndex, thingInfo] of entries) {
      if (thingInfo === null) {
        continue;
      }

      const thing = this.things.get(thingIndex)!;
      const slot = this.slots.get(thingInfo.slotName)!;
      thing.moveTo(slot, thingInfo.rotationIndex);
      thing.sent = true;

      thing.claimedBy = thingInfo.claimedBy;
      thing.heldRotation.set(
        thingInfo.heldRotation.x,
        thingInfo.heldRotation.y,
        thingInfo.heldRotation.z,
      );

      const shiftSlot = thingInfo.shiftSlotName ? this.slots.get(thingInfo.shiftSlotName)! : null;
      if (thing.shiftSlot !== shiftSlot) {
        thing.lastShiftSlot = thing.shiftSlot;
        thing.lastShiftSlotTime = now;
        thing.shiftSlot = shiftSlot;
      }
    }
    this.checkPushes();
    this.sendUpdate();
  }

  private onMatch(): void {
    const match = this.client.match.get(0);
    if (!match) {
      return;
    }

    const conditions = match.conditions;
    if (!Conditions.equals(conditions, this.conditions)) {
      this.updateConditions(conditions);

      // Prevent selection persisting after deal
      this.selected.splice(0);
    }
  }

  updateConditions(conditions: Conditions): void {
    this.conditions = conditions;
    this.setup.replace(conditions);
    this.setupView();
  }

  private sendUpdate(full?: boolean): void {
    const entries: Array<[number, ThingInfo | null]> = [];
    if (full) {
      for (const thing of this.things.values()) {
        entries.push([thing.index, this.describeThing(thing)]);
        thing.sent = true;
      }
      for (const [index,] of this.client.things.entries()) {
        if (!this.things.has(index)) {
          entries.push([index, null]);
        }
      }
      this.client.things.update(entries);
    } else {
      for (const thing of this.things.values()) {
        if (!thing.sent) {
          const desc = this.describeThing(thing);
          if (JSON.stringify(desc) !== JSON.stringify(this.client.things.get(thing.index))) {
            entries.push([thing.index, desc]);
          }
          thing.sent = true;
        }
      }
      if (entries.length > 0) {
        this.client.things.update(entries);
      }
    }
  }

  private sendMouse(): void {
    if (this.seat !== null) {
      this.mouseTracker.update(this.mouse, this.heldMouse);
    }
  }

  private describeThing(thing: Thing): ThingInfo {
    return {
      slotName: thing.slot.name,
      rotationIndex: thing.rotationIndex,
      claimedBy: thing.claimedBy,
      heldRotation:
        {
          x: thing.heldRotation.x,
          y: thing.heldRotation.y,
          z: thing.heldRotation.z,
      },
      shiftSlotName: thing.shiftSlot?.name ?? null,
    };
  }

  deal(dealType: DealType, gameType: GameType, fives: Fives, points: Points): void {
    if (this.seat === null) {
      return;
    }

    for (const thing of this.things.values()) {
      thing.release();
    }
    this.selected.splice(0);
    this.checkPushes();

    const back = 0; //1 - this.conditions.back; //LG Change to only use back 0, not toggle between 0 and 1, so we can use the texture space for more tile faces
    const conditions = { ...this.conditions, back, gameType, fives, points };

    let match = this.client.match.get(0);
    let honba;
    if (!match || match.dealer !== this.seat) {
      honba = 0;
    } else if (dealType === DealType.HANDS) {
      honba = (match.honba + 1) % 8;
    } else {
      honba = match.honba;
    }

    match = {dealer: this.seat, honba, conditions};

    this.updateConditions(conditions);
    this.setup.deal(this.seat, gameType, dealType);

    this.client.transaction(() => {
      this.client.match.set(0, match!);
      this.sendUpdate(true);
    });
  }

  private isHolding(): boolean {
    if (this.seat === null) {
      return false;
    }

    for (const thing of this.things.values()) {
      if (thing.claimedBy === this.seat) {
        return true;
      }
    }
    return false;
  }

  onHover(id: any): void {
    if (!this.isHolding()) {
      this.hovered = id === null ? null : this.things.get(id as number)!;

      if (this.hovered !== null && !this.canSelect(this.hovered, [])) {
        this.hovered = null;
      }
    }
  }

  onSelect(ids: Array<any>): void {
    this.selected = ids.map(id => this.things.get(id as number)!);
    this.selected = this.selected.filter(
      thing => this.canSelect(thing, this.selected));

    if (this.selected.length === 0) {
      return;
    }

    this.selected = filterMostCommon(this.selected, thing => thing.slot.group + '@' + thing.slot.seat);
  }

  onMove(mouse: Vector3 | null): void {
    if ((this.mouse === null && mouse === null) ||
        (this.mouse !== null && mouse !== null && this.mouse.equals(mouse))) {
      return;
    }

    this.mouse = mouse;
    this.sendMouse();

    this.drag();
    this.sendUpdate();
  }

  private drag(): void {
    if (this.mouse === null || this.heldMouse === null) {
      return;
    }

    this.movement = new Movement();

    const held: Array<Thing> = [];

    for (const thing of this.things.values()) {
      if (thing.claimedBy === this.seat) {
        if (thing.shiftSlot !== null) {
          thing.release();
        } else {
          held.push(thing);
        }
      }
    }
    // this.things.filter(thing => thing.claimedBy === this.seat);
    held.sort((a, b) => compareZYX(a.slot.origin, b.slot.origin));

    for (let i = 0; i < held.length; i++) {
      const thing = held[i];
      const place = thing.place();
      const x = place.position.x + this.mouse.x - this.heldMouse.x;
      const y = place.position.y + this.mouse.y - this.heldMouse.y;

      const targetSlot = this.findSlot(x, y, place.size.x, place.size.y, thing.type);
      if (targetSlot === null) {
        this.movement = null;
        return;
      }
      this.movement.move(thing, targetSlot);
    }

    const relevantThings = [...this.things.values()].filter(thing =>
      thing.type === held[0].type
    );
    if (!this.movement.findShift(relevantThings, [
      slot => slot.links.shiftLeft ?? null,
      slot => slot.links.shiftRight ?? null,
    ])) {
      this.movement = null;
      return;
    }
    this.movement.rotateHeld();
    this.movement.applyShift(this.seat!);
  }

  private canSelect(thing: Thing, otherSelected: Array<Thing>): boolean {
    const upSlot = thing.slot.links.up;
    if (upSlot) {
      if (upSlot.thing !== null &&
        otherSelected.indexOf(upSlot.thing) === -1) {

        return false;
      }
    }
    return true;
  }

  private findSlot(x: number, y: number, w: number, h: number, thingType: ThingType): Slot | null {
    const minOverlap = 1;
    let bestOverlap = minOverlap ;
    let bestSlot = null;

    // Empty slots
    for (const slot of this.slots.values()) {
      if (slot.type !== thingType) {
        continue;
      }

      if (slot.thing !== null && slot.thing.claimedBy !== this.seat) {
        // Occupied. But can it be potentially shifted?
        if (!slot.links.shiftLeft && !slot.links.shiftRight) {
          continue;
        }
      }
      // Already proposed for another thing
      if (this.movement?.hasSlot(slot)) {
        continue;
      }
      // The slot requires other slots to be occupied first
      if (slot.links.requires && slot.links.requires.thing === null) {
        continue;
      }

      const place = slot.placeWithOffset(0);

      const margin = Size.TILE.x / 2;
      const overlap1 = rectangleOverlap(
        x, y, w, h,
        place.position.x, place.position.y, place.size.x, place.size.y,
      );
      const overlap2 = rectangleOverlap(
        x, y, w + margin, h + margin,
        place.position.x, place.position.y, place.size.x + margin, place.size.y + margin,
      );
      const overlap = overlap1 + overlap2 * 0.5;
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestSlot = slot;
      }
    }
    return bestSlot;
  }

  onDragStart(): boolean {
    if (this.seat === null) {
      return false;
    }

    if (this.hovered !== null && !this.isHolding()) {
      let toHold;
      if (this.selected.indexOf(this.hovered) !== -1) {
        toHold = [...this.selected];
      } else {
        toHold = [this.hovered];
        this.selected.splice(0);
      }

      toHold = toHold.filter(thing => thing.claimedBy === null);

      for (const thing of toHold) {
        thing.hold(this.seat);
      }
      this.hovered = null;
      this.heldMouse = this.mouse;

      this.drag();
      this.sendMouse();
      this.sendUpdate();

      return true;
    }
    return false;
  }

  onDragEnd(): void {
    if (this.isHolding()) {
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

  onFlip(direction: number, animated?: boolean): void {
    if (this.isHolding()) {
      return;
    }

    if (this.selected.length > 0) {
      const rotationIndex = mostCommon(this.selected, thing => thing.rotationIndex)!;
      const toFlip = [];
      for (const thing of this.selected) {
        if (this.selected.length === 1 || thing.slot.canFlipMultiple) {
          toFlip.push(thing);
        }
      }
      if (toFlip.length > 1 && animated) {
        toFlip.sort((a, b) => a.slot.name.localeCompare(b.slot.name, undefined, { numeric: true }));
        this.flipAnimated(toFlip, 0, rotationIndex + direction);
      } else {
        for (const thing of toFlip) {
          thing.flip(rotationIndex + direction);
        }
        this.checkPushes();
        this.selected.splice(0);
      }
    } else if (this.hovered !== null) {
      this.hovered.flip(this.hovered.rotationIndex + direction);
      this.sendUpdate();
      this.checkPushes();
    }
    this.sendUpdate();

  }

  private flipAnimated(things: Array<Thing>, i: number, rotationIndex: number): void {
    const thing = things[i];
    if (this.selected.indexOf(things[i]) === -1) {
      this.selected.splice(0);
      return;
    }
    thing.flip(rotationIndex);
    this.sendUpdate();
    if (i + 1 < things.length) {
      setTimeout(() => this.flipAnimated(things, i + 1, rotationIndex), 100);
    } else {
      this.selected.splice(0);
    }
  }

  private drop(): void {
    if(!this.movement) {
      return;
    }

    let discardSide = null;
    let hasStick = false;
    for (const thing of this.movement.things()) {
      const source = thing.slot;
      const target = this.movement.get(thing)!;
      if (target.group === 'discard' &&
        !(source.group === 'discard' && source.seat === target.seat)) {
        discardSide = target.seat;
      } else if (target.group === 'riichi') {
        hasStick = true;
      }
    }

    this.movement.apply();
    this.checkPushes();
    this.finishDrop();

    if (discardSide !== null) {
      this.soundPlayer.play(SoundType.DISCARD, discardSide);
    }
    if (hasStick) {
      this.soundPlayer.play(SoundType.STICK, null);
    }
  }

  private dropInPlace(): void {
    this.finishDrop();
  }

  private finishDrop(): void {
    for (const thing of this.things.values()) {
      if (thing.claimedBy === this.seat) {
        thing.release();
      }
    }

    this.selected.splice(0);
    this.heldMouse = null;
    this.movement = null;

    this.sendUpdate();
    this.sendMouse();
  }

  private canDrop(): boolean {
    return this.movement ? this.movement.valid() : false;
  }

  private checkPushes(): void {
    for (const [source, target] of this.pushes) {
      target.handlePush(source);
    }
  }

  updateView(): void {
    this.updateViewThings();
    this.updateViewDropShadows();
    this.objectView.updateScores(this.setup.getScores());
  }

  private updateViewThings(): void {
    const toRender: Array<Render> = [];
    const canDrop = this.canDrop();
    const now = new Date().getTime();

    for (const thing of this.things.values()) {
      let place = thing.place();

      if (thing.claimedBy !== null && thing.shiftSlot === null) {
        let mouse = null, heldMouse = null;
        if (thing.claimedBy === this.seat) {
          mouse = this.mouse;
          heldMouse = this.heldMouse;
        } else {
          mouse = this.mouseTracker.getMouse(thing.claimedBy, now);
          heldMouse = this.mouseTracker.getHeld(thing.claimedBy);
        }

        if (mouse && heldMouse) {
          place = {
            ...place,
            position: place.position.clone(),
            rotation: thing.heldRotation.clone(),
          };
          place.position.x += mouse.x - heldMouse.x;
          place.position.y += mouse.y - heldMouse.y;
        }
      } else if (thing.lastShiftSlotTime >= now - SHIFT_TIME) {
        if (thing.lastShiftSlot !== null) {
          place = thing.lastShiftSlot.places[thing.rotationIndex];
        }
      } else if (thing.claimedBy !== null && thing.shiftSlot !== null) {
        place = thing.shiftSlot.places[thing.rotationIndex];
      }

      const held = thing.claimedBy !== null && thing.shiftSlot === null;
      const selected = this.selected.indexOf(thing) !== -1;
      const hovered = thing === this.hovered ||
        (selected && this.selected.indexOf(this.hovered!) !== -1);
      const temporary = held && thing.claimedBy === this.seat && !canDrop;

      const slot = thing.slot;

      const bottom =
        !held &&
        slot.links.up !== undefined &&
        (slot.links.up.thing === null ||
         slot.links.up.thing.claimedBy !== null);

      toRender.push({
        type: thing.type,
        thingIndex: thing.index,
        place,
        selected,
        hovered,
        held,
        temporary,
        bottom,
      });
    }
    this.objectView.updateThings(toRender);
  }

  private updateViewDropShadows(): void {
    const places = [];
    if (this.canDrop()) {
      for (const slot of this.movement!.slots()) {
        places.push(slot.placeWithOffset(0));
      }
    }
    this.objectView.updateDropShadows(places);
  }

  toSelect(): Array<Select> {
    const result = [];
    if (this.seat !== null && !this.isHolding()) {
      for (const thing of this.things.values()) {
        if (thing.claimedBy === null) {
          const place = thing.place();
          result.push({...place, id: thing.index});
        }
      }
    }
    return result;
  }

  setupView(): void {
    this.objectView.replaceThings(this.things);

    const places = [];
    for (const slot of this.slots.values()) {
      if (slot.drawShadow) {
        places.push(slot.places[slot.shadowRotation]);
      }
    }
    this.objectView.replaceShadows(places);
  }
}
