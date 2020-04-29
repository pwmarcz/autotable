// @ts-ignore
import tilesPng from '../img/tiles-bare.png';

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

    // this.camera = new THREE.PerspectiveCamera(30, 800 / 600, 0.1, 1000);
    // this.camera.position.set(World.WIDTH/2, -World.WIDTH*0.8, 120);
    // this.camera.rotateX(Math.PI * 0.25);

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
    this.tileTexture.anisotropy = this.renderer.getMaxAnisotropy();

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
    const backGeometry = new THREE.BoxGeometry(
      World.TILE_WIDTH,
      World.TILE_HEIGHT,
      World.TILE_DEPTH * 0.4);
    const frontGeometry = new THREE.BoxGeometry(
      World.TILE_WIDTH,
      World.TILE_HEIGHT,
      World.TILE_DEPTH * 0.6);

    for (let i = 0; i < 12; i++) {
      for (let j = 0; j < 3; j++) {
        frontGeometry.faceVertexUvs[0][i][j].set(0, 0);
      }
    }

    const i = index % 9;
    const j = Math.floor(index / 9);
    const u0 = i / 9;
    const u1 = (i + 1) / 9;
    const v0 = 1 - (j / 4);
    const v1 = 1 - (j + 1) / 4;

    frontGeometry.faceVertexUvs[0][8][0].set(u0, v0);
    frontGeometry.faceVertexUvs[0][8][1].set(u0, v1);
    frontGeometry.faceVertexUvs[0][8][2].set(u1, v0);

    frontGeometry.faceVertexUvs[0][9][0].set(u0, v1);
    frontGeometry.faceVertexUvs[0][9][1].set(u1, v1);
    frontGeometry.faceVertexUvs[0][9][2].set(u1, v0);

    const backMaterial = new THREE.MeshStandardMaterial({color: 0xffd003});
    const frontMaterial = new THREE.MeshStandardMaterial({color: 0xeeeeee, map: this.tileTexture });

    const backMesh = new THREE.Mesh(backGeometry, backMaterial);
    const frontMesh = new THREE.Mesh(frontGeometry, frontMaterial);

    backMesh.position.set (0, 0, World.TILE_DEPTH * -0.3);
    frontMesh.position.set (0, 0, World.TILE_DEPTH * 0.2);

    const tileGroup = new THREE.Group();
    tileGroup.add(backMesh);
    tileGroup.add(frontMesh);
    tileGroup.scale.setScalar(0.97);
    return tileGroup;
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
      if (this.width / this.height > View.RATIO) {
        this.width = this.height * View.RATIO;
      } else {
        this.height = this.width / View.RATIO;
      }
      this.renderer.setSize(this.width, this.height);
    }
  }
}
