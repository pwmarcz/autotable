import { Scene, Camera, WebGLRenderer, Vector2, Vector3, Group, AmbientLight, DirectionalLight, PerspectiveCamera, OrthographicCamera, Mesh, Object3D, PlaneBufferGeometry, WebGLRenderTarget, LinearFilter, RGBAFormat, ShaderMaterial, UniformsUtils, Uniform } from 'three';
import { EffectComposer, FullScreenQuad } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import { World } from './world';

const RATIO = 1.5;

export const LAYER_DEFAULT = 0;
export const LAYER_INSTANCED = 1;
export const LAYER_LIGHT = 2;

export class MainView {
  private main: HTMLElement;
  private stats: Stats;
  private perspective = false;

  private scene: Scene;
  private mainGroup: Group;
  private viewGroup: Group;
  private renderer: WebGLRenderer;

  camera: Camera = null!;
  private composer: EffectComposer = null!;
  private outlinePass: OutlinePass = null!;

  private width = 0;
  private height = 0;

  private dummyObject: Object3D;

  constructor(mainGroup: Group) {
    this.mainGroup = mainGroup;
    this.main = document.getElementById('main')!;

    this.scene = new Scene();
    this.scene.autoUpdate = false;
    this.viewGroup = new Group();
    this.viewGroup.position.set(World.WIDTH/2, World.WIDTH/2, 0);
    this.scene.add(this.mainGroup);
    this.scene.add(this.viewGroup);

    this.dummyObject = new Mesh(new PlaneBufferGeometry(0, 0, 0));

    this.renderer = new WebGLRenderer({
      antialias: false,
      // Apparently needed for OutlinePass not to cause glitching on some browsers.
      logarithmicDepthBuffer: true,
     });
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
    const ambientLight = new AmbientLight(0x888888);
    ambientLight.layers.set(LAYER_LIGHT);
    this.viewGroup.add(ambientLight);

    const topLight = new DirectionalLight(0x777777);
    topLight.position.set(0, 0, 10000);
    topLight.layers.set(LAYER_LIGHT);
    this.viewGroup.add(topLight);

    const frontLight = new DirectionalLight(0x222222);
    frontLight.position.set(0, -10000, 0);
    frontLight.layers.set(LAYER_LIGHT);
    this.viewGroup.add(frontLight);

    const sideLight = new DirectionalLight(0x222222);
    sideLight.position.set(-10000, -10000, 0);
    sideLight.layers.set(LAYER_LIGHT);
    this.viewGroup.add(sideLight);
  }

  private setupRendering(): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;

    if (this.camera !== null) {
      this.scene.remove(this.camera);
    }

    this.camera = this.makeCamera(this.perspective);
    this.camera.layers.mask = (1 << LAYER_DEFAULT) | (1 << LAYER_LIGHT);

    this.viewGroup.add(this.camera);
    this.composer = new EffectComposer(this.renderer);
    const instancedPass = new InstancedPass(w, h, this.scene, this.camera);
    const renderPass = new RenderPass(this.scene, this.camera);
    renderPass.clear = false;
    this.outlinePass = new OutlinePass(new Vector2(w, h), this.scene, this.camera);
    this.outlinePass.visibleEdgeColor.setHex(0xffff99);
    this.outlinePass.hiddenEdgeColor.setHex(0x333333);
    this.composer.addPass(instancedPass);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.outlinePass);

    // Force OutlinePass to precompile shadows, otherwise there is a pause when
    // you first select something.
    this.outlinePass.selectedObjects.push(this.dummyObject);
    this.composer.render();
    this.outlinePass.selectedObjects.pop();
  }

  private makeCamera(perspective: boolean): Camera {
    if (perspective) {
      const camera = new PerspectiveCamera(30, RATIO, 0.1, 1000);
      return camera;
    } else {
      const w = World.WIDTH * 1.2;
      const h = w / RATIO;
      const camera = new OrthographicCamera(
        -w / 2, w / 2,
        h / 2, -h / 2,
        0.1, 1000);
      return camera;
    }
  }

  updateCamera(seat: number | null, lookDown: number, zoom: number, mouse2: Vector2 | null): void {
    if (this.perspective) {
      this.updatePespectiveCamera(seat === null, lookDown, zoom, mouse2);
    } else {
      this.updateOrthographicCamera(seat === null, lookDown, zoom, mouse2);
    }

    const angle = (seat ?? 0) * Math.PI * 0.5;
    this.viewGroup.rotation.set(0, 0, angle);
    this.viewGroup.updateMatrixWorld();
  }

  private updatePespectiveCamera(
    fromTop: boolean,
    lookDown: number,
    zoom: number,
    mouse2: Vector2 | null): void
  {
    if (fromTop) {
      this.camera.position.set(0, 0, 400);
      this.camera.rotation.set(0, 0, 0);
    } else {
      this.camera.position.set(0, -World.WIDTH*1.44, World.WIDTH * 1.05);
      this.camera.rotation.set(Math.PI * 0.3 - lookDown * 0.2, 0, 0);
      if (zoom !== 0) {
        const dist = new Vector3(0, 1.37, -1).multiplyScalar(zoom * 55);
        this.camera.position.add(dist);
      }
      if (zoom > 0 && mouse2) {
        this.camera.position.x += mouse2.x * zoom * World.WIDTH * 0.6;
        this.camera.position.y += mouse2.y * zoom * World.WIDTH * 0.6;
      }
    }
  }

  private updateOrthographicCamera(
    fromTop: boolean,
    lookDown: number,
    zoom: number,
    mouse2: Vector2 | null): void
  {
    if (fromTop) {
      this.camera.position.set(0, 0, 100);
      this.camera.rotation.set(0, 0, 0);
      this.camera.scale.setScalar(1.55);
    } else {
      this.camera.position.set(
        0,
        -53 * lookDown - World.WIDTH,
        174);
      this.camera.rotation.set(Math.PI * 0.25, 0, 0);
      this.camera.scale.setScalar(1 - 0.45 * zoom);

      if (zoom > 0 && mouse2) {
        this.camera.position.x += mouse2.x * zoom * World.WIDTH * 0.6;
        this.camera.position.y += mouse2.y * zoom * World.WIDTH * 0.6;
      }
    }
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
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));

      this.setupRendering();
    }
  }
}

const CopyDepthShader = {
	uniforms: {
		'tDiffuse': { value: null },
		'tDepth': { value: null }
	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;

		varying vec2 vUv;

		void main() {
			gl_FragColor = texture2D( tDiffuse, vUv );
			gl_FragDepth = texture2D( tDepth, vUv );
		}`

};

class InstancedPass extends RenderPass {
  private renderTarget: WebGLRenderTarget;
  private fsQuad: FullScreenQuad;

  constructor(width: number, height: number, scene: Scene, camera: Camera) {
    super(scene, camera);
    const pars = { minFilter: LinearFilter, magFilter: LinearFilter, format: RGBAFormat }
    this.renderTarget = new WebGLRenderTarget(width, height, pars);
    const uniforms =  {
      'tDiffuse': {value: this.renderTarget.texture},
      'tDepth': {value: this.renderTarget.depthTexture},
    }
    
    const material = new ShaderMaterial({
      uniforms: uniforms,
      vertexShader: CopyDepthShader.vertexShader,
			fragmentShader: CopyDepthShader.fragmentShader
    });
    this.fsQuad = new FullScreenQuad(material);
  }

  setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
  }

  dispose(): void {
    this.renderTarget.dispose();
  }

  render(
    renderer: WebGLRenderer, 
    writeBuffer: WebGLRenderTarget, 
    readBuffer: WebGLRenderTarget,
    deltaTime: number,
    maskActive: boolean
  ): void {
    const modified = true;
    this.scene.traverseVisible((obj: Object3D): void => {
      if (obj.layers.mask & (1 << LAYER_INSTANCED)) {
        
      }
    })
    if (modified) {
      renderer.setRenderTarget(this.renderTarget);
      renderer.setClearAlpha(0);
      renderer.clear();
      renderer.clearDepth();
      const mask = this.camera.layers.mask;
      this.camera.layers.mask = (1 << LAYER_INSTANCED) | (1 << LAYER_LIGHT);
      try {
        renderer.render(this.scene, this.camera);
      } finally {
        this.camera.layers.mask = mask;
        this.camera.layers.mask =  (1 << LAYER_DEFAULT) | (1 << LAYER_LIGHT);
      }
    }
    renderer.setRenderTarget(readBuffer);
		this.fsQuad.render(renderer);
  }
}
