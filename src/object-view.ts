import { Group, Mesh, Vector3, MeshBasicMaterial, MeshLambertMaterial, Material, Object3D, PlaneBufferGeometry, InstancedMesh } from "three";

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

interface ThingParams {
  type: ThingType;
  typeIndex: number;
}

const MAX_SHADOWS = 300;
const MAX_TILES = 136;
const MAX_STICKS = 60;

export class ObjectView {
  mainGroup: Group;
  private assetLoader: AssetLoader;

  private center: Center;
  private thingObjects: Array<Mesh>;
  private thingParams: Array<ThingParams>;

  private instancedObjects: Map<ThingType, InstancedMesh>;

  private shadowObject: InstancedMesh;
  private dropShadowProto: Mesh;
  private dropShadowObjects: Array<Mesh>;

  selectedObjects: Array<Mesh>;

  constructor(mainGroup: Group, assetLoader: AssetLoader, client: Client) {
    this.mainGroup = mainGroup;
    this.assetLoader = assetLoader;

    this.center = new Center(this.assetLoader, client);
    this.center.mesh.position.set(World.WIDTH / 2, World.WIDTH / 2, 0.75);
    this.thingObjects = [];
    this.dropShadowObjects = [];
    this.selectedObjects = [];

    this.thingParams = [];

    this.instancedObjects = new Map();
    this.instancedObjects.set(
      ThingType.TILE, assetLoader.makeTileInstancedMesh(MAX_TILES),
    );
    this.instancedObjects.set(
      ThingType.STICK, assetLoader.makeStickInstancedMesh(MAX_STICKS),
    );
    for (const instancedMesh of this.instancedObjects.values()) {
      this.mainGroup.add(instancedMesh);
    }

    const plane = new PlaneBufferGeometry(1, 1, 1);
    let material = new MeshBasicMaterial({
      transparent: true,
      opacity: 0.1,
      color: 0,
      depthWrite: false,
    });
    this.shadowObject = new InstancedMesh(plane, material, MAX_SHADOWS);
    this.shadowObject.visible = true;
    this.mainGroup.add(this.shadowObject);

    material = material.clone();
    material.opacity = 0.2;

    this.dropShadowProto = new Mesh(plane, material);
    this.dropShadowProto.name = 'dropShadow';

    this.addStatic();
  }

  replaceThings(things: Array<ThingParams>): void {
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

    this.thingParams = things;
  }

  addShadows(places: Array<Place>): void {
    const dummy = new Object3D();

    this.shadowObject.count = 0;
    for (const place of places) {
      dummy.position.set(place.position.x, place.position.y, 0.1);
      dummy.scale.set(place.size.x, place.size.y, 1);
      dummy.updateMatrix();

      const idx = this.shadowObject.count++;
      this.shadowObject.setMatrixAt(idx, dummy.matrix);
    }
    this.shadowObject.instanceMatrix.needsUpdate = true;
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
    for (const instancedMesh of this.instancedObjects.values()) {
      instancedMesh.count = 0;
    }
    for (const thing of things) {
      const obj = this.thingObjects[thing.thingIndex];
      obj.position.copy(thing.place.position);
      obj.rotation.copy(thing.place.rotation);

      const custom = thing.hovered || thing.selected || thing.held || thing.bottom;
      if (!custom) {
        const thingParams = this.thingParams[thing.thingIndex];
        const instancedMesh = this.instancedObjects.get(thingParams.type);
        if (instancedMesh !== undefined) {
          const idx = instancedMesh.count++;
          obj.updateMatrix();
          obj.visible = false;
          obj.matrixAutoUpdate = false;
          instancedMesh.setMatrixAt(idx, obj.matrix);
          instancedMesh.instanceMatrix.needsUpdate = true;
          if (thingParams.type === ThingType.TILE) {
            this.assetLoader.setTileInstanceParams(instancedMesh, idx, thingParams.typeIndex);
          } else if (thingParams.type === ThingType.STICK) {
            this.assetLoader.setStickInstanceParams(instancedMesh, idx, thingParams.typeIndex);
          }
          continue;
        }
      }
      obj.visible = true;
      obj.matrixAutoUpdate = true;

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
