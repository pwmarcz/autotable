import { Group, Mesh, Vector3, MeshBasicMaterial, MeshLambertMaterial, Object3D, PlaneBufferGeometry, InstancedMesh, PlaneGeometry, CanvasTexture, Vector2 } from "three";

import { World } from "./world";
import { Client } from "./client";
import { AssetLoader } from "./asset-loader";
import { Center } from "./center";
import { ThingParams, ThingGroup, TileThingGroup, StickThingGroup, MarkerThingGroup } from "./thing-group";
import { ThingType, Place, Size } from "./types";

export interface Render {
  type: ThingType;
  thingIndex: number;
  place: Place;
  selected: boolean;
  hovered: boolean;
  held: boolean;
  temporary: boolean;
  bottom: boolean;
  hidden: boolean;
}

const MAX_SHADOWS = 300;

export class ObjectView {
  mainGroup: Group;
  private assetLoader: AssetLoader;

  private center: Center;

  private thingGroups: Map<ThingType, ThingGroup>;

  private shadowObject: InstancedMesh;
  private dropShadowProto: Mesh;
  private dropShadowObjects: Array<Mesh>;

  private readonly namePlateSize = new Vector2(World.WIDTH + Size.TILE.y, World.WIDTH / 16);

  selectedObjects: Array<Mesh>;
  private readonly namePlateContexts: Array<CanvasRenderingContext2D> = [];
  private readonly namePlateCanvases: Array<HTMLCanvasElement> = [];
  private readonly namePlateTextures: Array<CanvasTexture> = [];

  constructor(mainGroup: Group, assetLoader: AssetLoader, client: Client) {
    this.mainGroup = mainGroup;
    this.assetLoader = assetLoader;

    this.center = new Center(this.assetLoader, client);
    this.center.mesh.position.set(World.WIDTH / 2, World.WIDTH / 2, 0.75);
    this.dropShadowObjects = [];
    this.selectedObjects = [];

    this.thingGroups = new Map();
    this.thingGroups.set(ThingType.TILE, new TileThingGroup(this.assetLoader, this.mainGroup));
    this.thingGroups.set(ThingType.STICK, new StickThingGroup(this.assetLoader, this.mainGroup));
    this.thingGroups.set(ThingType.MARKER, new MarkerThingGroup(this.assetLoader, this.mainGroup));

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

    for (let i = 0; i < 4; i++) {
      this.namePlateCanvases[i] = document.getElementById(`name-plate-${i}`)! as HTMLCanvasElement;
      this.namePlateCanvases[i].width = this.namePlateSize.x * 10;
      this.namePlateCanvases[i].height = this.namePlateSize.y * 10;
      this.namePlateContexts[i] = this.namePlateCanvases[i].getContext('2d')!;
    }

    this.addStatic();
  }

  replaceThings(params: Map<number, ThingParams>): void {
    for (const type of [ThingType.TILE, ThingType.STICK, ThingType.MARKER]) {
      const typeParams = [...params.values()].filter(p => p.type === type);
      typeParams.sort((a, b) => a.index - b.index);

      if (typeParams.length === 0) {
        continue;
      }
      const startIndex = typeParams[0].index;
      const thingGroup = this.thingGroups.get(type)!;
      thingGroup.replace(startIndex, typeParams);
    }
  }

  replaceShadows(places: Array<Place>): void {
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

  private createNamePlate(): Mesh {
    const tableGeometry = new PlaneGeometry(
      this.namePlateSize.x,
      this.namePlateSize.y
    );

    const tableMaterial = new MeshLambertMaterial({ color: 0xeeeeee, map: this.assetLoader.textures.table });
    const tableMesh = new Mesh(tableGeometry, tableMaterial);
    return tableMesh;
  }

  private updateNamePlate(seat: number, nick: string) {
    this.namePlateContexts[seat].resetTransform();
    this.namePlateContexts[seat].fillStyle = '#000';
    this.namePlateContexts[seat].fillRect(0, 0, this.namePlateSize.x * 10, this.namePlateSize.y * 10);
    this.namePlateContexts[seat].textAlign = 'center';
    this.namePlateContexts[seat].font = `${this.namePlateSize.y * 5}px Koruri`;
    this.namePlateContexts[seat].fillStyle = '#afa';
    this.namePlateContexts[seat].textBaseline = 'middle';
    this.namePlateContexts[seat].translate(this.namePlateSize.x * 5, this.namePlateSize.y * 5);
    this.namePlateContexts[seat].fillText(nick + seat, 0, 0);
    this.namePlateTextures[seat].needsUpdate = true;
  }

  private addStatic(): void {
    const tableMesh = this.assetLoader.makeTable();
    tableMesh.position.set(World.WIDTH / 2, World.WIDTH / 2, -0.01);

    for (let i = 0; i < 4; i++){
      const namePlateMesh = this.createNamePlate();
      namePlateMesh.rotation.set(Math.PI / 2, 0, 0);
      namePlateMesh.position.set(0, -World.WIDTH / 2 -Size.TILE.y / 2, -this.namePlateSize.y / 2);

      const material = namePlateMesh.material as MeshLambertMaterial;
      const texture = new CanvasTexture(this.namePlateCanvases[i]);
      this.namePlateTextures.push(texture);
      texture.flipY = true;
      texture.center = new Vector2(0.5, 0.5);
      texture.anisotropy = 16;
      material.map = texture;

      this.updateNamePlate(i, "hierarch");

      const group = new Group();
      group.add(namePlateMesh);
      this.mainGroup.add(group);
      group.position.set(World.WIDTH / 2, World.WIDTH / 2, 0);
      group.rotateZ(Math.PI * i / 2);
      group.updateMatrixWorld(true);
    }

    this.mainGroup.add(tableMesh);
    this.mainGroup.add(this.center.mesh);

    tableMesh.updateMatrixWorld();
    this.center.mesh.updateMatrixWorld();

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
        tray.updateMatrixWorld();
      }
    }
  }

  updateScores(scores: Array<number | null>): void {
    this.center.setScores(scores);
    this.center.draw();
  }

  updateThings(things: Array<Render>): void {
    this.selectedObjects.splice(0);
    for (const thing of things) {
      const thingGroup = this.thingGroups.get(thing.type)!;
      const custom = thing.hovered || thing.selected || thing.held || thing.bottom || thing.hidden;
      if (!custom && thingGroup.canSetSimple()) {
        thingGroup.setSimple(thing.thingIndex, thing.place.position, thing.place.rotation);
        continue;
      }

      const obj = thingGroup.setCustom(
        thing.thingIndex, thing.place.position, thing.place.rotation);

      const material = obj.material as MeshLambertMaterial;
      material.emissive.setHex(0);
      material.color.setHex(0xeeeeee);

      if (thing.hidden) {
        material.transparent = true;
        material.opacity = 0.0;
      }

      obj.renderOrder = 0;
      material.depthTest = true;

      if (thing.hovered) {
        material.emissive.setHex(0x111111);
      }

      if (thing.bottom) {
        material.color.setHex(0xbbbbbb);
      }

      if (thing.selected && !thing.hidden) {
        this.selectedObjects.push(obj);
      }

      if (thing.held) {
        material.transparent = true;
        material.opacity = thing.temporary ? 0.7 : 1;
        material.depthTest = false;
        obj.position.z += 1;
        obj.renderOrder = 2;
      }

      obj.updateMatrix();
      obj.updateMatrixWorld();
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
      obj.updateMatrixWorld();
    }
  }
}
