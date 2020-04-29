import tilesPng from '../img/tiles-bare.png';

import * as THREE from 'three';
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { TILE_WIDTH, TILE_HEIGHT, TILE_DEPTH, WORLD_WIDTH, WORLD_HEIGHT } from './world';

export class View {
  constructor(main, world) {
    this.main = main;
    this.world = world;

    this.margin = 0.1;

    this.objects = [];

    this.scene = new THREE.Scene();
    // this.camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 100);
    this.camera = new THREE.OrthographicCamera(
      0, WORLD_WIDTH,
      WORLD_WIDTH * 600 / 800, 0,
      0.1, 1000);
    this.camera.rotateX(Math.PI * 0.35);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(800, 600);
    main.appendChild(this.renderer.domElement);

    const tableGeometry = new THREE.PlaneGeometry(WORLD_WIDTH, WORLD_HEIGHT);
    const tableMaterial = new THREE.MeshStandardMaterial({ color: 0x005000 });
    const tableMesh = new THREE.Mesh(tableGeometry, tableMaterial);
    tableMesh.position.set(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 0);
    this.scene.add(tableMesh);

    this.tileTexture = new THREE.TextureLoader().load(tilesPng);

    this.objects = [];
    for (let i = 0; i < this.world.things.length; i++) {
      const obj = this.makeTileObject(i);
      obj.visible = false;
      this.objects.push(obj);
      this.scene.add(obj);
    }

    this.scene.add(new THREE.AmbientLight(0xcccccc));
    const dirLight = new THREE.DirectionalLight(0xeeeeee);
    this.scene.add(dirLight);
    dirLight.position.set(0, 0, 999);

    // this.controls = new OrbitControls( this.camera, this.renderer.domElement );

    // this.camera.position.x = WORLD_WIDTH / 2;
    // this.camera.position.z = 45;
    // this.camera.position.y = -WORLD_WIDTH / 3;
    // this.camera.rotateX(Math.PI * 0.3);


  }

  makeTileObject(index) {
    const backGeometry = new THREE.BoxGeometry(
      TILE_WIDTH - this.margin * 2,
      TILE_HEIGHT - this.margin * 2,
      TILE_DEPTH * 0.4 - this.margin * 2);
    const frontGeometry = new THREE.BoxGeometry(
      TILE_WIDTH - this.margin * 2,
      TILE_HEIGHT - this.margin * 2,
      TILE_DEPTH * 0.6 - this.margin * 2);

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

    backMesh.position.set (this.margin, this.margin, this.margin);
    frontMesh.position.set (this.margin, this.margin, TILE_DEPTH * 0.4 + this.margin);

    const tileGroup = new THREE.Group();
    tileGroup.add(backMesh);
    tileGroup.add(frontMesh);
    return tileGroup;
  }

  draw() {
    requestAnimationFrame(this.draw.bind(this));

    // this.controls.update();

    for (let i = 0; i < this.world.things.length; i++) {
      const params = this.world.thingParams(i);
      const obj = this.objects[i];
      obj.position.set(params.x + TILE_WIDTH / 2, params.y + TILE_DEPTH / 2, TILE_HEIGHT / 2);
      obj.rotation.set(Math.PI/2, 0, 0);
      obj.visible = true;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
