// @ts-ignore
import tilesPng from '../img/tiles.auto.png';
// @ts-ignore
import tableJpg from '../img/table.jpg';

import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';

import { World } from './world';
import { Object3D, Scene, Camera, WebGLRenderer, Texture, Vector2, Raycaster, Mesh, MeshLambertMaterial } from 'three';
import { SelectionBox } from './selection-box';

export class View {
  world: World;

  main: HTMLElement;
  selection: HTMLElement;

  perspective = false;

  scene: Scene;
  camera: Camera;
  composer: EffectComposer;
  outlinePass: OutlinePass;
  renderer: WebGLRenderer;
  raycaster: Raycaster;
  selectionBox: SelectionBox;

  objects: Array<Mesh>;
  ghostObjects: Array<Mesh>;
  shadows: Array<Mesh>;
  raycastObjects: Array<Mesh>;
  raycastTable: Object3D;
  tileTexture: Texture;

  width: number;
  height: number;
  static RATIO = 1.5;

  mouse: Vector2;
  selectStart: Vector2 | null;

  constructor(main: HTMLElement, selection: HTMLElement, world: World) {
    this.main = main;
    this.selection = selection;
    this.world = world;
    this.objects = [];

    this.scene = new THREE.Scene();
    this.camera = this.makeCamera(false);
    this.selectionBox = new SelectionBox(this.camera);

    this.raycaster = new THREE.Raycaster();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    main.appendChild(this.renderer.domElement);

    const tableTexture = new THREE.TextureLoader().load(tableJpg);
    tableTexture.wrapS = THREE.RepeatWrapping;
    tableTexture.wrapT = THREE.RepeatWrapping;
    tableTexture.repeat.set(3, 3);
    const tableGeometry = new THREE.PlaneGeometry(
      World.WIDTH + World.TILE_DEPTH, World.HEIGHT + World.TILE_DEPTH);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, map: tableTexture });
    const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
    tableMesh.position.set(World.WIDTH / 2, World.HEIGHT / 2, 0);
    this.scene.add(tableMesh);

    this.tileTexture = new THREE.TextureLoader().load(tilesPng);
    // this.tileTexture.minFilter = THREE.LinearMipmapNearestFilter;
    // this.tileTexture.minFilter = THREE.LinearFilter;
    // this.tileTexture.generateMipmaps = false;
    this.tileTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.objects = [];
    this.ghostObjects = [];
    this.shadows = [];
    for (let i = 0; i < this.world.things.length; i++) {
      const obj = this.makeTileObject(this.world.things[i].index);
      this.objects.push(obj);
      this.scene.add(obj);

      const gobj = this.makeGhostObject(this.world.things[i].index);
      this.ghostObjects.push(gobj);
      this.scene.add(gobj);

      const geometry = new THREE.PlaneGeometry(1, 1);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.2,
        color: 0,
      });
      const shadow = new Mesh(geometry, material);
      shadow.visible = false;
      this.shadows.push(shadow);
      this.scene.add(shadow);
    }

    for (const shadow of this.world.toRenderPlaces()) {
      const w = Math.max(shadow.width, World.TILE_WIDTH);
      const h = Math.max(shadow.height, World.TILE_WIDTH);

      const geometry = new THREE.PlaneGeometry(w, h);
      const material = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.1,
        color: 0,
      });
      const mesh = new Mesh(geometry, material);
      mesh.position.set(shadow.position.x, shadow.position.y, 0.1);
      this.scene.add(mesh);
    }

    this.raycastObjects = [];
    for (let i = 0; i < Object.keys(this.world.slots).length; i++) {
      const robj = new THREE.Mesh(new THREE.BoxGeometry(
        World.TILE_WIDTH,
        World.TILE_HEIGHT,
        World.TILE_DEPTH)
      );
      robj.visible = false;
      robj.geometry.computeBoundingBox();
      this.raycastObjects.push(robj);
      this.scene.add(robj);
    }

    this.raycastTable = new THREE.Mesh(new THREE.PlaneGeometry(
      World.WIDTH * 3,
      World.HEIGHT * 3,
    ));
    this.raycastTable.visible = false;
    this.raycastTable.position.set(World.WIDTH / 2, World.HEIGHT / 2, 0);
    this.scene.add(this.raycastTable);

    this.scene.add(new THREE.AmbientLight(0xcccccc));
    const dirLight = new THREE.DirectionalLight(0x3333333);
    this.scene.add(dirLight);
    dirLight.position.set(0, 0, 999);

    this.mouse = new Vector2();
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));

    this.selectStart = null;

    this.setupRendering();
  }

  setupRendering(): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;

    this.camera = this.makeCamera(this.perspective);
    this.selectionBox = new SelectionBox(this.camera);
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.outlinePass = new OutlinePass(new Vector2(w, h), this.scene, this.camera);
    this.outlinePass.visibleEdgeColor.setHex(0xffff99);
    this.outlinePass.hiddenEdgeColor.setHex(0x333333);

    this.composer.addPass(renderPass);
    this.composer.addPass(this.outlinePass);
  }

  makeCamera(perspective: boolean): THREE.Camera {
    if (perspective) {
      const camera = new THREE.PerspectiveCamera(30, 800 / 600, 0.1, 1000);
      camera.position.set(World.WIDTH/2, -World.WIDTH*0.8, World.WIDTH * 0.9);
      camera.rotateX(Math.PI * 0.3);
      return camera;
    }

    const camera = new THREE.OrthographicCamera(
      -4, World.WIDTH + 4,
      (World.WIDTH + 8) / View.RATIO, 0,
      0.1, 1000);
    camera.position.set(0, -18, 2);
    camera.rotateX(Math.PI * 0.3);
    return camera;
  }

  setPerspective(perspective: boolean): void {
    this.perspective = perspective;
    this.setupRendering();

  }

  makeTileObject(index: number): Mesh {
    const geometry = new THREE.BoxGeometry(
      World.TILE_WIDTH,
      World.TILE_HEIGHT,
      World.TILE_DEPTH
    );

    function setFace(ia: number, ib: number,
      u0: number, v0: number, w: number, h: number): void {

      u0 /= 256;
      v0 /= 256;
      const u1 = u0 + w/256;
      const v1 = v0 + h/256;

      geometry.faceVertexUvs[0][ia][0].set(u0, v0);
      geometry.faceVertexUvs[0][ia][1].set(u0, v1);
      geometry.faceVertexUvs[0][ia][2].set(u1, v0);

      geometry.faceVertexUvs[0][ib][0].set(u0, v1);
      geometry.faceVertexUvs[0][ib][1].set(u1, v1);
      geometry.faceVertexUvs[0][ib][2].set(u1, v0);
    }

    // const u0 = 224 / 256;
    // const v0 = 188 / 256;
    // const u1 = 256 / 256;
    // const v1 = 235 / 256;

    const i = index % 8;
    const j = Math.floor(index / 8);

    // long side
    setFace(0, 1, 216, 21, -24, 47);
    setFace(2, 3, 192, 21, 24, 47);

    // short side
    setFace(4, 5, 160, 68, 32, -24);
    setFace(6, 7, 160, 44, 32, 24);

    // back
    setFace(10, 11, 224, 21, 32, 47);

    // front
    setFace(8, 9, i * 32, 256 - j * 47, 32, -47);

    const bufferGeometry = new THREE.BufferGeometry().fromGeometry(geometry);

    const frontMaterial = new THREE.MeshLambertMaterial({color: 0xeeeeee, map: this.tileTexture });

    const mesh = new THREE.Mesh(bufferGeometry, frontMaterial);

    return mesh;
  }

  makeGhostObject(index: number): Mesh {
    const obj = this.makeTileObject(index);
    const material = obj.material as MeshLambertMaterial;
    material.transparent = true;
    material.opacity = 0.5;
    return obj;
  }

  draw(): void {
    requestAnimationFrame(this.draw.bind(this));

    this.updateRender();
    this.updateRenderGhosts();
    this.updateRenderShadows();

    this.composer.render();
    this.updateViewport();
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
      robj.rotation.copy(select.rotation);
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
      const point = intersectsTable[0].point;
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
      obj.position.copy(render.position);
      obj.rotation.copy(render.rotation);

      const material = obj.material as MeshLambertMaterial;
      material.emissive.setHex(0);
      material.transparent = false;
      material.depthTest = true;
      obj.renderOrder = 0;

      if (render.hovered) {
        material.emissive.setHex(0x111111);
      }

      if (render.selected) {
        this.outlinePass.selectedObjects.push(obj);
      }

      if (render.held) {
        material.transparent = true;
        material.opacity = render.temporary ? 0.7 : 1;
        material.depthTest = false;
        obj.position.z += 2;
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
      obj.position.copy(render.position);
      obj.rotation.copy(render.rotation);
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
      obj.position.set(shadow.position.x, shadow.position.y, 0.2);
      obj.scale.set(shadow.width, shadow.height, 1);
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

  updateViewport(): void {
    if (this.main.parentElement.clientWidth !== this.width ||
      this.main.parentElement.clientHeight !== this.height) {

      this.width = this.main.parentElement.clientWidth;
      this.height = this.main.parentElement.clientHeight;

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
