import { Group, Mesh, Vector3, PlaneGeometry, MeshBasicMaterial, MeshLambertMaterial, Material } from "three";

import { World } from "./world";
import { Client } from "./client";
import { AssetLoader } from "./asset-loader";
import { Center } from "./center";
import { ThingType, Place } from "./places";

export interface Render {
  thingIndex: number;
  place: Place;
  selected: boolean;
  hovered: boolean;
  held: boolean;
  temporary: boolean;
  bottom: boolean;
}

export class ObjectView {
  mainGroup: Group;
  private assetLoader: AssetLoader;

  private center: Center;
  private thingObjects: Array<Mesh>;

  private shadowProto: Mesh;
  private dropShadowProto: Mesh;

  private shadowObjects: Array<Mesh>;
  private dropShadowObjects: Array<Mesh>;

  selectedObjects: Array<Mesh>;

  constructor(mainGroup: Group, assetLoader: AssetLoader, client: Client) {
    this.mainGroup = mainGroup;
    this.assetLoader = assetLoader;

    this.center = new Center(this.assetLoader, client);
    this.center.mesh.position.set(World.WIDTH / 2, World.WIDTH / 2, 0.75);
    this.thingObjects = [];
    this.shadowObjects = [];
    this.dropShadowObjects = [];
    this.selectedObjects = [];

    const geometry = new PlaneGeometry(1, 1);
    let material = new MeshBasicMaterial({
      transparent: true,
      opacity: 0.1,
      color: 0,
      depthWrite: false,
    });
    this.shadowProto = new Mesh(geometry, material);
    material = material.clone();
    material.opacity = 0.2;
    this.dropShadowProto = new Mesh(geometry, material);

    this.addStatic();
  }

  replaceThings(things: Array<{type: ThingType; typeIndex: number}>): void {
    for (const obj of this.thingObjects) {
      (obj.material as Material).dispose();
      obj.geometry.dispose();
      this.mainGroup.remove(obj);
    }
    this.thingObjects.splice(0);

    for (const thing of things) {
      const obj = this.makeObject(thing.type, thing.typeIndex);
      this.thingObjects.push(obj);
      this.mainGroup.add(obj);
    }
  }

  addShadows(places: Array<Place>): void {
    for (const place of places) {
      const object = this.shadowProto.clone();
      object.position.set(place.position.x, place.position.y, 0.1);
      object.scale.set(place.size.x, place.size.y, 1);
      this.shadowObjects.push(object);
      this.mainGroup.add(object);
    }
  }

  private addStatic(): void {
    const tableMesh = this.assetLoader.makeTable();
    tableMesh.position.set(World.WIDTH / 2, World.WIDTH / 2, 0);
    this.mainGroup.add(tableMesh);
    this.mainGroup.add(this.center.mesh);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 6; j++) {
        const trayPos = new Vector3(
          25 + 24 * j - World.WIDTH / 2,
          -33 - World.WIDTH / 2,
          0
        );
        trayPos.applyAxisAngle(new Vector3(0, 0, 1), Math.PI * i / 2);

        const tray = this.assetLoader.makeTray();
        tray.rotation.z = Math.PI * i / 2;
        tray.position.set(
          trayPos.x + World.WIDTH / 2,
          trayPos.y + World.WIDTH / 2,
          0);
        this.mainGroup.add(tray);
      }
    }
  }

  private makeObject(type: ThingType, index: number): Mesh {
    switch (type) {
      case ThingType.TILE:
        return this.assetLoader.makeTile(index);
      case ThingType.STICK:
        return this.assetLoader.makeStick(index);
      case ThingType.MARKER:
        return this.assetLoader.makeMarker();
    }
  }

  updateScores(scores: Array<number>): void {
    this.center.setScores(scores);
    this.center.draw();
  }

  updateThings(things: Array<Render>): void {
    this.selectedObjects.splice(0);
    for (const thing of things) {
      const obj = this.thingObjects[thing.thingIndex];
      obj.visible = true;
      obj.position.copy(thing.place.position);
      obj.rotation.copy(thing.place.rotation);

      const material = obj.material as MeshLambertMaterial;
      material.emissive.setHex(0);
      material.color.setHex(0xeeeeee);
      material.transparent = false;
      material.depthTest = true;
      obj.renderOrder = 0;

      if (thing.hovered) {
        material.emissive.setHex(0x111111);
      }

      if (thing.bottom) {
        material.color.setHex(0xbbbbbb);
      }

      if (thing.selected) {
        this.selectedObjects.push(obj);
      }

      if (thing.held) {
        material.transparent = true;
        material.opacity = thing.temporary ? 0.7 : 1;
        material.depthTest = false;
        obj.position.z += 1;
        obj.renderOrder = 1;
      }
    }
  }

  updateDropShadows(places: Array<Place>): void {
    for (const obj of this.dropShadowObjects) {
      this.mainGroup.remove(obj);
    }
    this.dropShadowObjects.splice(0);

    for (const place of places) {
      const obj = this.dropShadowProto.clone();
      obj.position.set(
        place.position.x,
        place.position.y,
        place.position.z - place.size.z/2 + 0.2);
      obj.scale.set(place.size.x, place.size.y, 1);
      this.dropShadowObjects.push(obj);
      this.mainGroup.add(obj);
    }
  }
}
