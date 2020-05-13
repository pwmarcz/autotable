import { Scene, Camera, WebGLRenderer, Vector2, Vector3, Group, AmbientLight, DirectionalLight, PerspectiveCamera, OrthographicCamera, Mesh } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import { World } from './world';

const RATIO = 1.5;

export class MainView {
  private main: HTMLElement;
  private stats: Stats;
  private perspective = false;

  private scene: Scene;
  private mainGroup: Group;
  private renderer: WebGLRenderer;

  camera: Camera = null!;
  private composer: EffectComposer = null!;
  private outlinePass: OutlinePass = null!;

  private width = 0;
  private height = 0;

  constructor(mainGroup: Group) {
    this.mainGroup = mainGroup;

    this.main = document.getElementById('main')!;

    this.scene = new Scene();
    this.scene.add(this.mainGroup);

    this.renderer = new WebGLRenderer({ antialias: true });
    this.main.appendChild(this.renderer.domElement);

    this.setupLights();
    this.setupRendering();

    this.stats = Stats();
    this.stats.dom.style.left = 'auto';
    this.stats.dom.style.right = '0';
    const full = document.getElementById('full')!;
    full.appendChild(this.stats.dom);
  }

  private setupLights(): void {
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

  private setupRendering(): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;

    this.camera = this.makeCamera(this.perspective);
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.outlinePass = new OutlinePass(new Vector2(w, h), this.scene, this.camera);
    this.outlinePass.visibleEdgeColor.setHex(0xffff99);
    this.outlinePass.hiddenEdgeColor.setHex(0x333333);

    this.composer.addPass(renderPass);
    this.composer.addPass(this.outlinePass);
  }

  private makeCamera(perspective: boolean): Camera {
    if (perspective) {
      const camera = new PerspectiveCamera(30, 800 / 600, 0.1, 1000);
      camera.position.set(World.WIDTH/2, -World.WIDTH*0.8, World.WIDTH * 0.9);
      camera.rotateX(Math.PI * 0.3);
      return camera;
    }

    const w = World.WIDTH * 1.2;
    const h = w / RATIO;
    const camera = new OrthographicCamera(
      -w / 2, w / 2,
      h / 2, -h / 2,
      0.1, 1000);
    return camera;
  }

  updateCamera(lookDown: number, zoom: number, mouse2: Vector2 | null): void {
    if (this.perspective) {
      return;
    }

    this.camera.position.set(
      World.WIDTH / 2,
      -53 * lookDown - World.WIDTH / 2,
      174);
    this.camera.rotation.set(Math.PI * 0.25, 0, 0);

    this.camera.scale.setScalar(1 - 0.45 * zoom);
    if (zoom > 0 && mouse2) {
      this.camera.position.x += mouse2.x * zoom * World.WIDTH * 0.6;
      this.camera.position.y += mouse2.y * zoom * World.WIDTH * 0.6;
    }
  }

  updateRotation(playerNum: number): void {
    const angle = playerNum * Math.PI/2;

    const adjust = new Vector3(World.WIDTH/2, World.WIDTH/2, 0);
    adjust.applyAxisAngle(new Vector3(0, 0, 1), -angle);

    this.mainGroup.position.set(World.WIDTH/2, World.WIDTH/2, 0).sub(adjust);
    this.mainGroup.rotation.set(0, 0, -angle);
  }

  updateOutline(selectedObjects: Array<Mesh>): void {
    this.outlinePass.selectedObjects = selectedObjects;
  }

  setPerspective(perspective: boolean): void {
    this.perspective = perspective;
    this.setupRendering();
  }

  render(): void {
    this.composer.render();
    this.stats.update();
  }

  updateViewport(): void {
    if (this.main.parentElement!.clientWidth !== this.width ||
      this.main.parentElement!.clientHeight !== this.height) {

      this.width = this.main.parentElement!.clientWidth;
      this.height = this.main.parentElement!.clientHeight;

      let renderWidth: number, renderHeight: number;

      if (this.width / this.height > RATIO) {
        renderWidth = Math.floor(this.height * RATIO);
        renderHeight = Math.floor(this.height);
      } else {
        renderWidth = Math.floor(this.width);
        renderHeight = Math.floor(this.width / RATIO);
      }
      this.main.style.width = `${renderWidth}px`;
      this.main.style.height = `${renderHeight}px`;
      this.renderer.setSize(renderWidth, renderHeight);
      this.renderer.setPixelRatio(window.devicePixelRatio);

      this.setupRendering();
    }
  }
}
