// @ts-ignore
import tilesPng from '../img/tiles.auto.png';

import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { World } from './world';
import { Object3D, Scene, Camera, WebGLRenderer, Texture } from 'three';

export class View {
  world: World;

  main: Element;
  scene: Scene;
  camera: Camera;
  renderer: WebGLRenderer;

  objects: Array<Object3D>;
  tileTexture: Texture;

  width: number;
  height: number;
  static RATIO = 1.5;

  constructor(main: Element, world: World) {
    this.main = main;
    this.world = world;
    this.objects = [];

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -2, World.WIDTH + 2,
      (World.WIDTH + 4) / View.RATIO, 0,
      0.1, 1000);
    this.camera.position.set(0, -8, 2);
    this.camera.rotateX(Math.PI * 0.3);

    if (/perspective/.exec(window.location.href)) {
      this.camera = new THREE.PerspectiveCamera(30, 800 / 600, 0.1, 1000);
      this.camera.position.set(World.WIDTH/2, -World.WIDTH*0.8, World.WIDTH * 0.9);
      this.camera.rotateX(Math.PI * 0.3);
    }

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    main.appendChild(this.renderer.domElement);

    const tableGeometry = new THREE.PlaneGeometry(World.WIDTH, World.HEIGHT);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x005000 });
    const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
    tableMesh.position.set(World.WIDTH / 2, World.HEIGHT / 2, 0);
    this.scene.add(tableMesh);

    this.tileTexture = new THREE.TextureLoader().load(tilesPng);
    // this.tileTexture.minFilter = THREE.LinearMipmapNearestFilter;
    // this.tileTexture.minFilter = THREE.LinearFilter;
    // this.tileTexture.generateMipmaps = false;
    this.tileTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.objects = [];
    for (let i = 0; i < this.world.things.length; i++) {
      const obj = this.makeTileObject(this.world.things[i].index);
      obj.visible = false;
      this.objects.push(obj);
      this.scene.add(obj);
    }

    this.scene.add(new THREE.AmbientLight(0xcccccc));
    const dirLight = new THREE.DirectionalLight(0x3333333);
    this.scene.add(dirLight);
    dirLight.position.set(0, 0, 999);
  }

  makeTileObject(index: number): Object3D {
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

  draw(): void {
    requestAnimationFrame(this.draw.bind(this));

    this.updateViewport();

    // this.controls.update();

    for (let i = 0; i < this.world.things.length; i++) {
      const { position, rotation } = this.world.thingParams(i);
      const obj = this.objects[i];
      obj.position.copy(position);;
      obj.rotation.copy(rotation);
      obj.visible = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateViewport(): void {
    if (this.main.clientWidth !== this.width ||
      this.main.clientHeight !== this.height) {

      this.width = this.main.clientWidth;
      this.height = this.main.clientHeight;

      let renderWidth: number, renderHeight: number;

      if (this.width / this.height > View.RATIO) {
        renderWidth = Math.floor(this.height * View.RATIO);
        renderHeight = Math.floor(this.height);
      } else {
        renderWidth = Math.floor(this.width);
        renderHeight = Math.floor(this.width / View.RATIO);
      }
      this.renderer.setSize(renderWidth, renderHeight);
    }
  }
}
