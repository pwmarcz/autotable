// @ts-ignore
import png from '../img/*.png';
// @ts-ignore
import jpg from '../img/*.jpg';
// @ts-ignore
import gltf from '../img/*.gltf';


import { Texture, Mesh, TextureLoader } from "three";
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';

export interface Assets {
  tileTexture: Texture;
  tableTexture: Texture;
  stickTexture: Texture;
  tileMesh: Mesh;
  stickMesh: Mesh;
}

export function loadAssets(): Promise<Assets> {
  return Promise.all([
    loadTexture(png['tiles.auto']),
    loadTexture(jpg['table']),
    loadTexture(png['sticks.auto']),
    loadModel(gltf['tile']),
    loadModel(gltf['stick']),
  ]).then(([
    tileTexture,
    tableTexture,
    stickTexture,
    tileModel,
    stickModel,
  ]) => {
    const tileMesh = tileModel.scene.children[0] as Mesh;
    const stickMesh = stickModel.scene.children[0] as Mesh;
    return { tileTexture, tableTexture, stickTexture, tileMesh, stickMesh } as Assets;
  });
}


function loadTexture(url: string): Promise<Texture> {
  const loader = new TextureLoader();
  return new Promise(resolve => {
    loader.load(url, resolve);
  });
}

function loadModel(url: string): Promise<GLTF> {
  const loader = new GLTFLoader;
  return new Promise(resolve => {
    loader.load(url, resolve);
 });
}
