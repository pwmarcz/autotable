
import { Slot, Thing } from './places';

type SlotOp = (slot: Slot) => Slot | null;

export class Movement {
  private thingMap: Map<Thing, Slot> = new Map();
  private reverseMap: Map<Slot, Thing> = new Map();

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
      if (slot.thing !== null && !this.thingMap.has(slot.thing)) {
        return false;
      }
    }
    return true;
  }

  apply(): void {
    for (const thing of this.thingMap.keys()) {
      thing.prepareMove();
    }
    for (const [thing, slot] of this.thingMap.entries()) {
      // TODO instead of group, check if rotations are the same?
      const rotationIndex = thing.slot.group === slot.group ? thing.rotationIndex : 0;
      thing.moveTo(slot, rotationIndex);
    }
  }

  rotateHeld(held: Array<Thing>): boolean {
    let result = false;
    for (const thing of held) {
      const targetSlot = this.thingMap.get(thing);
      if (targetSlot && targetSlot.rotateHeld && thing.slot.group !== targetSlot.group) {
        if (!thing.heldRotation.equals(targetSlot.places[0].rotation)){
          thing.heldRotation.copy(targetSlot.places[0].rotation);
          result = true;
        }
      }
    }
    return result;
  }

  findShift(allThings: Array<Thing>, ops: Array<SlotOp>): boolean {
    let shift: Map<Slot, Thing> | null = new Map();
    for (const thing of allThings) {
      if (!this.thingMap.has(thing)) {
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
        this.move(thing, slot);
      }
    }
    return true;
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
