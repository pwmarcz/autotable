import { Group, Mesh, Vector3, PlaneGeometry, MeshBasicMaterial, MeshLambertMaterial, InstancedMesh, Object3D } from "three";

import { World } from "./world";
import { Client } from "./client";
import { AssetLoader } from "./asset-loader";
import { Center } from "./center";
import { ThingType } from "./places";

export class ObjectUi {
  private world: World;
  private mainGroup: Group;
  private assetLoader: AssetLoader;

  private center: Center;
  private objects: Array<Mesh>;
  private tileInstancedMesh: InstancedMesh;
  private shadows: Array<Mesh>;

  selectedObjects: Array<Mesh>;

  constructor(world: World, mainGroup: Group, assetLoader: AssetLoader, client: Client) {
    this.world = world;
    this.mainGroup = mainGroup;
    this.assetLoader = assetLoader;

    this.center = new Center(this.assetLoader, client);
    this.center.mesh.position.set(World.WIDTH / 2, World.WIDTH / 2, 0.75);

    this.tileInstancedMesh = this.assetLoader.makeInstancedTile(this.world.things.length);
    this.mainGroup.add(this.tileInstancedMesh);

    this.objects = [];
    this.shadows = [];
    this.selectedObjects = [];
    this.addObjects();
  }

  private addObjects(): void {
    const tableMesh = this.assetLoader.makeTable();
    tableMesh.position.set(World.WIDTH / 2, World.WIDTH / 2, 0);
    this.mainGroup.add(tableMesh);
    this.mainGroup.add(this.center.mesh);

    for (let i = 0; i < this.world.things.length; i++) {
      const obj = this.makeObject(this.world.things[i].type, this.world.things[i].typeIndex);
      this.objects.push(obj);
      this.mainGroup.add(obj);

      const geometry = new PlaneGeometry(1, 1);
      const material = new MeshBasicMaterial({
        transparent: true,
        opacity: 0.2,
        color: 0,
      });
      const shadow = new Mesh(geometry, material);
      shadow.visible = false;
      this.shadows.push(shadow);
      this.mainGroup.add(shadow);
    }

    for (const shadow of this.world.toRenderPlaces()) {
      // const w = Math.max(shadow.size.x, World.TILE_WIDTH);
      // const h = Math.max(shadow.size.y, World.TILE_WIDTH);

      const geometry = new PlaneGeometry(shadow.size.x, shadow.size.y);
      const material = new MeshBasicMaterial({
        transparent: true,
        opacity: 0.1,
        color: 0,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(shadow.position.x, shadow.position.y, 0.1);
      this.mainGroup.add(mesh);
    }

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

  update(): void {
    this.updateRender();
    this.updateRenderShadows();
    this.center.setScores(this.world.getScores());
    this.center.draw();
  }

  private updateRender(): void {
    for (const obj of this.objects) {
      obj.visible = false;
    }

    this.selectedObjects.splice(0);
    this.tileInstancedMesh.count = 0;
    const dummy = new Object3D();
    for (const render of this.world.toRender()) {
      if (this.world.things[render.thingIndex].type === ThingType.TILE &&
          !render.hovered && !render.selected && !render.held) {

        const idx = this.tileInstancedMesh.count++;

        dummy.position.copy(render.place.position);
        dummy.rotation.copy(render.place.rotation);
        dummy.updateMatrix();
        this.tileInstancedMesh.setMatrixAt(idx, dummy.matrix);
        this.tileInstancedMesh.instanceMatrix.needsUpdate = true;
        continue;
      }

      const obj = this.objects[render.thingIndex];
      obj.visible = true;
      obj.position.copy(render.place.position);
      obj.rotation.copy(render.place.rotation);

      const material = obj.material as MeshLambertMaterial;
      material.emissive.setHex(0);
      material.color.setHex(0xeeeeee);
      material.transparent = false;
      material.depthTest = true;
      obj.renderOrder = 0;

      if (render.hovered) {
        material.emissive.setHex(0x111111);
      }

      if (render.bottom) {
        material.color.setHex(0xbbbbbb);
      }

      if (render.selected) {
        this.selectedObjects.push(obj);
      }

      if (render.held) {
        material.transparent = true;
        material.opacity = render.temporary ? 0.7 : 1;
        material.depthTest = false;
        obj.position.z += 1;
        obj.renderOrder = 1;
      }
    }
  }

  private updateRenderShadows(): void {
    for (const obj of this.shadows) {
      obj.visible = false;
    }

    let i = 0;
    for (const shadow of this.world.toRenderShadows()) {
      const obj = this.shadows[i++];
      obj.visible = true;
      obj.position.set(
        shadow.position.x,
        shadow.position.y,
        shadow.position.z - shadow.size.z/2 + 0.2);
      obj.scale.set(shadow.size.x, shadow.size.y, 1);
    }
  }


}
