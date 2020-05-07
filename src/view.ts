

import * as THREE from 'three';
import { Scene, Camera, WebGLRenderer, Vector2, Raycaster, Mesh, MeshLambertMaterial, Vector3, Group } from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';

import { World } from './world';
import { ThingType, Size } from './places';
import { SelectionBox } from './selection-box';
import { AssetLoader } from './asset-loader';
import { Center } from './center';
import { Client, Status } from './client';

export class View {
  world: World;
  client: Client;

  main: HTMLElement;
  selection: HTMLElement;
  cursors: Array<HTMLElement>;

  center: Center;

  assetLoader: AssetLoader;

  perspective = false;

  scene: Scene;
  mainGroup: Group;
  renderer: WebGLRenderer;
  raycaster: Raycaster;

  // Setup in setupRendering()
  camera: Camera = null!;
  composer: EffectComposer = null!;
  outlinePass: OutlinePass = null!;
  selectionBox: SelectionBox = null!;

  objects: Array<Mesh>;
  ghostObjects: Array<Mesh>;
  shadows: Array<Mesh>;
  raycastObjects: Array<Mesh>;
  raycastTable: Mesh;

  width = 0;
  height = 0;
  static RATIO = 1.5;

  mouse: Vector2 = new Vector2();
  selectStart: Vector2 | null = null;

  cameraPos = new Animation(150);

  constructor(world: World, assetLoader: AssetLoader, client: Client) {
    this.main = document.getElementById('main')!;
    this.selection = document.getElementById('selection')!;
    this.cursors = [
      document.querySelector('.cursor.rotate-0')! as HTMLElement,
      document.querySelector('.cursor.rotate-1')! as HTMLElement,
      document.querySelector('.cursor.rotate-2')! as HTMLElement,
      document.querySelector('.cursor.rotate-3')! as HTMLElement,
    ];
    this.world = world;

    this.client = client;
    this.client.on('status', this.onStatus.bind(this));

    this.objects = [];

    this.assetLoader = assetLoader;

    this.scene = new THREE.Scene();
    this.mainGroup = new THREE.Group();
    this.scene.add(this.mainGroup);

    this.raycaster = new THREE.Raycaster();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.main.appendChild(this.renderer.domElement);

    const tableMesh = this.assetLoader.makeTable();
    tableMesh.position.set(World.WIDTH / 2, World.WIDTH / 2, 0);
    this.mainGroup.add(tableMesh);

    this.center = new Center(this.assetLoader, client);
    this.center.mesh.position.set(World.WIDTH / 2, World.WIDTH / 2, 0.75);
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


    // this.assets.stickTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    // this.assets.stickTexture.flipY = false;

    this.objects = [];
    this.ghostObjects = [];
    this.shadows = [];
    for (let i = 0; i < this.world.things.length; i++) {
      const obj = this.makeObject(this.world.things[i].type, this.world.things[i].typeIndex);
      this.objects.push(obj);
      this.mainGroup.add(obj);

      const gobj = this.makeGhostObject(this.world.things[i].type, this.world.things[i].typeIndex);
      this.ghostObjects.push(gobj);
      this.mainGroup.add(gobj);

      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
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

      const geometry = new THREE.PlaneGeometry(shadow.size.x, shadow.size.y);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.1,
        color: 0,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(shadow.position.x, shadow.position.y, 0.1);
      this.mainGroup.add(mesh);
    }

    this.raycastObjects = [];
    for (let i = 0; i < Object.keys(this.world.slots).length; i++) {
      const robj = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      robj.visible = false;
      robj.geometry.computeBoundingBox();
      this.raycastObjects.push(robj);
      this.mainGroup.add(robj);
    }

    this.raycastTable = new THREE.Mesh(new THREE.PlaneGeometry(
      World.WIDTH * 3,
      World.WIDTH * 3,
    ));
    this.raycastTable.visible = false;
    this.raycastTable.position.set(World.WIDTH / 2, World.WIDTH / 2, 0);
    this.mainGroup.add(this.raycastTable);

    this.setupLights();
    this.setupEvents();
    this.setupRendering();
  }

  onStatus(status: Status): void {
    if (status === Status.JOINED) {
      const playerNum = this.client.game!.num;
      this.updateRotation(playerNum);
    }
  }

  setupLights(): void {
    this.scene.add(new THREE.AmbientLight(0x888888));
    const topLight = new THREE.DirectionalLight(0x777777);
    topLight.position.set(0, 0, 1);
    this.scene.add(topLight);

    const frontLight = new THREE.DirectionalLight(0x222222);
    frontLight.position.set(0, -1, 0);
    this.scene.add(frontLight);

    const sideLight = new THREE.DirectionalLight(0x222222);
    sideLight.position.set(-1, -1, 0);
    this.scene.add(sideLight);
  }

  setupEvents(): void {
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    window.addEventListener('keypress', this.onKeyPress.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  setupRendering(): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;

    this.camera = this.makeCamera(this.perspective);
    this.adjustCamera();
    this.selectionBox = new SelectionBox(this.camera);
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.outlinePass = new OutlinePass(new Vector2(w, h), this.scene, this.camera);
    this.outlinePass.visibleEdgeColor.setHex(0xffff99);
    this.outlinePass.hiddenEdgeColor.setHex(0x333333);

    this.composer.addPass(renderPass);
    this.composer.addPass(this.outlinePass);

    // Force outline pass to preload shaders
    this.outlinePass.selectedObjects.push(this.mainGroup.children[0]);
    this.composer.render();
    this.outlinePass.selectedObjects.splice(0);
  }

  makeCamera(perspective: boolean): THREE.Camera {
    if (perspective) {
      const camera = new THREE.PerspectiveCamera(30, 800 / 600, 0.1, 1000);
      camera.position.set(World.WIDTH/2, -World.WIDTH*0.8, World.WIDTH * 0.9);
      camera.rotateX(Math.PI * 0.3);
      return camera;
    }

    const w = World.WIDTH * 1.2;
    const h = w / View.RATIO;
    const camera = new THREE.OrthographicCamera(
      (World.WIDTH - w) / 2, (World.WIDTH + w) / 2,
      h, 0,
      0.1, 1000);
    return camera;
  }

  adjustCamera(): void {
    if (this.perspective) {
      return;
    }

    const updated = this.cameraPos.update();

    this.camera.position.set(0, -40 - 53 * this.cameraPos.pos, 30);
    this.camera.rotation.set(Math.PI * 0.25, 0, 0);

    if (updated) {
      this.updateSelect();
    }
  }

  updateRotation(playerNum: number): void {
    const angle = playerNum * Math.PI/2;

    const adjust = new Vector3(World.WIDTH/2, World.WIDTH/2, 0);
    adjust.applyAxisAngle(new Vector3(0, 0, 1), -angle);

    this.mainGroup.position.set(World.WIDTH/2, World.WIDTH/2, 0).sub(adjust);
    this.mainGroup.rotation.set(0, 0, -angle);
  }

  setPerspective(perspective: boolean): void {
    this.perspective = perspective;
    this.setupRendering();
  }

  makeObject(type: ThingType, index: number): Mesh {
    switch (type) {
      case ThingType.TILE:
        return this.assetLoader.makeTile(index);
      case ThingType.STICK:
        return this.assetLoader.makeStick(index);
    }
  }

  makeGhostObject(type: ThingType, index: number): Mesh {
    const obj = this.makeObject(type, index);
    const material = obj.material as MeshLambertMaterial;
    material.transparent = true;
    material.opacity = 0.5;
    return obj;
  }

  draw(): void {
    requestAnimationFrame(this.draw.bind(this));
    this.updateViewport();
    this.adjustCamera();
    this.updateSelect();

    this.updateRender();
    this.updateRenderGhosts();
    this.updateRenderShadows();
    this.updateCursors();

    this.center.setScores(this.world.getScores());
    this.center.draw();

    this.composer.render();
  }

  updateSelect(): void {
    const toSelect = this.world.toSelect();
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.selectStart !== null) {
      const w = this.renderer.domElement.clientWidth;
      const h = this.renderer.domElement.clientHeight;

      const x1 = Math.min(this.selectStart.x, this.mouse.x);
      const y1 = Math.min(this.selectStart.y, this.mouse.y);
      const x2 = Math.max(this.selectStart.x, this.mouse.x);
      const y2 = Math.max(this.selectStart.y, this.mouse.y);

      const sx1 = (x1 + 1) * w / 2;
      const sx2 = (x2 + 1) * w / 2;
      const sy1 = (-y2 + 1) * h / 2;
      const sy2 = (-y1 + 1) * h / 2;

      this.selection.style.left = `${sx1}px`;
      this.selection.style.top = `${sy1}px`;
      this.selection.style.width = `${sx2-sx1}px`;
      this.selection.style.height = `${sy2-sy1}px`;
      this.selection.style.visibility = 'visible';

      this.selectionBox.update(new Vector2(x1, y1), new Vector2(x2, y2));
    } else {
      this.selection.style.visibility = 'hidden';
    }

    const robjs = [];
    for (let i = 0; i < toSelect.length; i++) {
      const select = toSelect[i];
      const robj = this.raycastObjects[i];
      robj.position.copy(select.position);
      robj.scale.copy(select.size);
      robj.updateMatrixWorld();
      robj.userData.id = select.id;
      robjs.push(robj);
    }

    const intersects = this.raycaster.intersectObjects(robjs);
    let hovered = null;
    if (intersects.length > 0) {
      hovered = intersects[0].object.userData.id;
    }
    this.world.onHover(hovered);

    const intersectsTable = this.raycaster.intersectObject(this.raycastTable);
    let tablePos = null;
    if (intersectsTable.length > 0) {
      const point = intersectsTable[0].point.clone();
      this.raycastTable.worldToLocal(point);
      tablePos = new Vector2(point.x, point.y);
    }
    this.world.onMove(tablePos);

    if (this.selectStart !== null) {
      const selected = [];
      for (const obj of this.selectionBox.select(robjs)) {
        const id = obj.userData.id;
        selected.push(id);
      }
      this.world.onSelect(selected);
    }
  }

  updateRender(): void {
    for (const obj of this.objects) {
      obj.visible = false;
    }

    this.outlinePass.selectedObjects = [];
    for (const render of this.world.toRender()) {
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
        this.outlinePass.selectedObjects.push(obj);
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

  updateRenderGhosts(): void {
    for (const obj of this.ghostObjects) {
      obj.visible = false;
    }

    for (const render of this.world.toRenderGhosts()) {
      const obj = this.ghostObjects[render.thingIndex];
      obj.visible = true;
      obj.position.copy(render.place.position);
      obj.rotation.copy(render.place.rotation);
    }
  }

  updateRenderShadows(): void {
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

  updateCursors(): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;

    for (let i = 0; i < 4; i++) {
      const j = (4 + i - this.world.playerNum) % 4;

      const cursorElement = this.cursors[j];
      const cursorPos = this.world.playerCursors[i];

      if (cursorPos && i !== this.world.playerNum) {
        const v = new Vector3(cursorPos.x, cursorPos.y, Size.TILE.y);
        this.raycastTable.localToWorld(v);
        v.project(this.camera);

        const x = Math.floor((v.x + 1) / 2 * w);
        const y = Math.floor((-v.y + 1) / 2 * h);
        cursorElement.style.visibility = 'visible';
        cursorElement.style.left = `${x}px`;
        cursorElement.style.top = `${y}px`;
      } else {
        cursorElement.style.visibility = 'hidden';
      }
    }
  }

  onMouseMove(event: MouseEvent): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;
    this.mouse.x = event.offsetX / w * 2 - 1;
    this.mouse.y = -event.offsetY / h * 2 + 1;

    this.updateSelect();
  }

  onMouseLeave(event: MouseEvent): void {
    this.world.onHover(null);
    this.world.onMove(null);
  }

  onMouseDown(event: MouseEvent): void {
    if (!this.world.onDragStart()) {
      this.selectStart = this.mouse.clone();
    }
    this.updateSelect();
  }

  onMouseUp(event: MouseEvent): void {
    this.selectStart = null;
    this.world.onDragEnd();
    this.updateSelect();
  }

  onKeyPress(event: KeyboardEvent): void {

  }

  onKeyDown(event: KeyboardEvent): void {
    if (document.activeElement?.tagName === 'INPUT') {
      return;
    }

    if (event.key === 'f') {
      this.world.onFlip();
    }
    if (event.key === ' ') {
      this.cameraPos.start(1);
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    if (event.key === ' ') {
      this.cameraPos.start(0);
    }
  }

  updateViewport(): void {
    if (this.main.parentElement!.clientWidth !== this.width ||
      this.main.parentElement!.clientHeight !== this.height) {

      this.width = this.main.parentElement!.clientWidth;
      this.height = this.main.parentElement!.clientHeight;

      let renderWidth: number, renderHeight: number;

      if (this.width / this.height > View.RATIO) {
        renderWidth = Math.floor(this.height * View.RATIO);
        renderHeight = Math.floor(this.height);
      } else {
        renderWidth = Math.floor(this.width);
        renderHeight = Math.floor(this.width / View.RATIO);
      }
      this.main.style.width = `${renderWidth}px`;
      this.main.style.height = `${renderHeight}px`;
      this.renderer.setSize(renderWidth, renderHeight);

      this.setupRendering();
    }
  }
}

class Animation {
  private startTime = 0;
  private endTime = 1;
  private startPos = 0;
  private endPos = 0;
  private period: number;
  pos = -1;

  constructor(period: number) {
    this.period = period;
  }

  start(endPos: number): void {
    this.startPos = this.pos;
    this.startTime = new Date().getTime();
    this.endPos = endPos;
    this.endTime = this.startTime + this.period * Math.abs(endPos - this.pos);
  }

  update(): boolean {
    if (this.pos === this.endPos) {
      return false;
    }

    const now = new Date().getTime();
    const delta = (now - this.startTime) / (this.endTime - this.startTime);
    this.pos = this.startPos + (this.endPos - this.startPos) * Math.min(1, delta);
    return true;
  }
}
