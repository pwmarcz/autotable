import { Scene, Camera, WebGLRenderer, Vector2, Vector3, Group, AmbientLight, DirectionalLight, PerspectiveCamera, OrthographicCamera } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import { World } from './world';
import { AssetLoader } from './asset-loader';
import { Client, Status } from './client';
import { MouseUi } from './mouse-ui';
import { ObjectUi } from './object-ui';
import { Animation } from './utils';

export class View {
  world: World;
  client: Client;

  main: HTMLElement;

  stats: Stats;

  perspective = false;

  scene: Scene;
  mainGroup: Group;
  renderer: WebGLRenderer;

  camera: Camera = null!;
  composer: EffectComposer = null!;
  outlinePass: OutlinePass = null!;

  width = 0;
  height = 0;
  static RATIO = 1.5;

  mouseUi: MouseUi;
  objectUi: ObjectUi;

  cameraPos = new Animation(150);

  constructor(world: World, assetLoader: AssetLoader, client: Client) {
    this.main = document.getElementById('main')!;
    this.world = world;

    this.client = client;
    this.client.on('status', this.onStatus.bind(this));

    this.scene = new Scene();
    this.mainGroup = new Group();
    this.scene.add(this.mainGroup);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.main.appendChild(this.renderer.domElement);

    this.mouseUi = new MouseUi(this.world, this.mainGroup);
    this.objectUi = new ObjectUi(this.world, this.mainGroup, assetLoader, this.client);

    this.setupLights();
    this.setupEvents();
    this.setupRendering();

    this.stats = Stats();
    this.stats.dom.style.left = 'auto';
    this.stats.dom.style.right = '0';
    this.main.appendChild(this.stats.dom);
  }

  onStatus(status: Status): void {
    if (status === Status.JOINED) {
      const playerNum = this.client.game!.num;
      this.updateRotation(playerNum);
    }
  }

  setupLights(): void {
    this.scene.add(new AmbientLight(0x888888));
    const topLight = new DirectionalLight(0x777777);
    topLight.position.set(0, 0, 1);
    this.scene.add(topLight);

    const frontLight = new DirectionalLight(0x222222);
    frontLight.position.set(0, -1, 0);
    this.scene.add(frontLight);

    const sideLight = new DirectionalLight(0x222222);
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
    this.mouseUi.setCamera(this.camera);
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

  makeCamera(perspective: boolean): Camera {
    if (perspective) {
      const camera = new PerspectiveCamera(30, 800 / 600, 0.1, 1000);
      camera.position.set(World.WIDTH/2, -World.WIDTH*0.8, World.WIDTH * 0.9);
      camera.rotateX(Math.PI * 0.3);
      return camera;
    }

    const w = World.WIDTH * 1.2;
    const h = w / View.RATIO;
    const camera = new OrthographicCamera(
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
      this.mouseUi.update();
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

  draw(): void {
    requestAnimationFrame(this.draw.bind(this));
    this.updateViewport();
    this.adjustCamera();
    this.objectUi.update();
    this.outlinePass.selectedObjects = this.objectUi.selectedObjects;
    this.mouseUi.update();
    this.mouseUi.updateCursors();
    this.composer.render();
    this.stats.update();
  }

  onMouseMove(event: MouseEvent): void {
    this.mouseUi.move(event);
  }

  onMouseLeave(event: MouseEvent): void {
    this.world.onHover(null);
    this.world.onMove(null);
  }

  onMouseDown(event: MouseEvent): void {
    if (!this.world.onDragStart()) {
      this.mouseUi.startSelect();
    }
    this.mouseUi.update();
  }

  onMouseUp(event: MouseEvent): void {
    this.mouseUi.endSelect();
    this.world.onDragEnd();
    this.mouseUi.update();
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
