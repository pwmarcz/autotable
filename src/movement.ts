import { Slot } from "./slot";
import { Thing } from "./thing";
import { Euler } from "three";

type SlotOp = (slot: Slot) => Slot | null;

// Represents a group of things that will be moved to different slots when
// dragging.
// Includes both things dragged directly (thingMap), and shifted to make space
// (shiftMap).
export class Movement {
  private thingMap: Map<Thing, Slot> = new Map();
  private reverseMap: Map<Slot, Thing> = new Map();
  private shiftMap: Map<Thing, Slot> = new Map();
  private heldRotation: Euler | null = null;

  move(thing: Thing, slot: Slot): void {
    if (this.reverseMap.has(slot)) {
      throw `move(): conflict`;
    }
    const oldSlot = this.thingMap.get(thing);
    if (oldSlot !== undefined) {
      this.reverseMap.delete(oldSlot);
    }
    this.thingMap.set(thing, slot);
    this.reverseMap.set(slot, thing);
  }

  private shift(thing: Thing, slot: Slot): void {
    this.shiftMap.set(thing, slot);
    this.reverseMap.set(slot, thing);
  }

  has(thing: Thing): boolean {
    return this.thingMap.has(thing);
  }

  get(thing: Thing): Slot | null {
    return this.thingMap.get(thing) ?? null;
  }

  rotationIndex(thing: Thing): number {
    const slot = this.thingMap.get(thing);
    if (slot === undefined) {
      return 0;
    }
    return thing.slot.group === slot.group ? thing.rotationIndex : 0;
  }

  slots(): Iterable<Slot> {
    return this.thingMap.values();
  }

  things(): Iterable<Thing> {
    return this.thingMap.keys();
  }

  hasSlot(slot: Slot): boolean {
    return this.reverseMap.has(slot);
  }

  valid(): boolean {
    for (const slot of this.reverseMap.keys()) {
      if (slot.thing !== null && !this.thingMap.has(slot.thing) && !this.shiftMap.has(slot.thing)) {
        return false;
      }
    }
    return true;
  }

  apply(): void {
    for (const thing of this.thingMap.keys()) {
      thing.prepareMove();
    }
    for (const thing of this.shiftMap.keys()) {
      thing.prepareMove();
    }
    for (const [thing, slot] of this.thingMap.entries()) {
      let rotationIndex = 0;
      if (this.heldRotation !== null) {
        const matchingIndex = slot.rotationOptions.findIndex(o => o.equals(this.heldRotation!));
        if (matchingIndex >= 0) {
          rotationIndex = matchingIndex;
        }
      } else {
        rotationIndex = thing.slot.group === slot.group
         ? thing.rotationIndex
         : Math.max(0, slot.rotationOptions.findIndex(r => r.equals(thing.slot.rotationOptions[thing.rotationIndex])));
      }

      if (slot.group === 'hand' && slot.group !== thing.slot.group) {
        rotationIndex = 0;
      }

      thing.moveTo(slot, rotationIndex);
      thing.release();
    }
    for (const [thing, slot] of this.shiftMap.entries()) {
      const rotationIndex = thing.rotationIndex;
      thing.moveTo(slot, rotationIndex);
      thing.release();
    }
  }

  setHeldRotation(heldRotation: Euler): void {
    this.heldRotation = heldRotation;
  }

  rotateHeld(): Euler | null {
    // Don't rotate more than 1 tile, they may collide
    if (this.thingMap.size > 1) {
      return null;
    }

    for (const [thing, slot] of this.thingMap.entries()) {
      if (!slot.rotateHeld) {
        return null;
      }

      const rotationIndex = thing.slot.group === slot.group ? thing.rotationIndex : 0;
      const rotation = slot.rotations[rotationIndex];
      if (!thing.heldRotation.equals(rotation)) {
        thing.heldRotation.copy(rotation);
        thing.sent = false;
      }
      return slot.rotationOptions[rotationIndex];
    }

    return null;
  }

  findShift(allThings: Array<Thing>, ops: Array<SlotOp>): boolean {
    let shift: Map<Slot, Thing> | null = new Map();
    for (const thing of allThings) {
      if (!this.thingMap.has(thing) && thing.slot?.phantom !== true) {
        shift.set(thing.slot, thing);
      }
    }

    for (const slot of this.thingMap.values()) {
      if (shift.has(slot)) {
        shift = this.findShiftFor(slot, ops, shift);
        if (shift === null) {
          return false;
        }
      }
    }
    for (const [slot, thing] of shift.entries()) {
      if (slot.thing !== thing) {
        this.shift(thing, slot);
      }
    }
    return true;
  }

  applyShift(seat: number): void {
    for (const [thing, slot] of this.shiftMap.entries()) {
      thing.shiftTo(seat, slot);
    }
  }

  private findShiftFor(
    slot: Slot, ops: Array<SlotOp>, shift: Map<Slot, Thing>
  ): Map<Slot, Thing> | null {
    // console.log('findShiftFor', slot.name);
    if (!shift.has(slot)) {
      return null;
    }

    // Prefer moving to the left
    for (const op of ops) {
      const cloned = new Map(shift.entries());
      if (this.tryShift(slot, op, cloned)) {
        return cloned;
      }
    }
    return null;
  }

  private tryShift(initialSlot: Slot, op: SlotOp, shift: Map<Slot, Thing>): boolean {
    let slot = initialSlot;
    const thing = shift.get(initialSlot)!;
    if (thing.claimedBy !== null) {
      return false;
    }
    // console.log('tryShift start', thing.index, slot.name);
    while (slot === initialSlot || this.reverseMap.has(slot)) {
      const nextSlot = op(slot);
      if (nextSlot === null) {
        return false;
      }

      if (shift.has(nextSlot)) {
        if (!this.tryShift(nextSlot, op, shift)) {
          return false;
        }
      }
      shift.delete(slot);
      shift.set(nextSlot, thing);
      slot = nextSlot;
    }
    // console.log('tryShift end', thing.index, slot.name);
    return true;
  }
}
