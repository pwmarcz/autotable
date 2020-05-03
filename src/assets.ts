// @ts-ignore
import tilesImage from '../img/tiles.auto.png';
// @ts-ignore
import tableImage from '../img/table.jpg';
// @ts-ignore
import tileModel from '../img/tile.gltf';

import { Texture, Mesh, TextureLoader } from "three";
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';

export interface Assets {
  tileTexture: Texture;
  tableTexture: Texture;
  tileMesh: Mesh;
}

export function loadAssets(): Promise<Assets> {
  return Promise.all([
    loadTexture(tilesImage),
    loadTexture(tableImage),
    loadModel(tileModel)
  ]).then(([tileTexture, tableTexture, gltf]) => {
    const tileMesh = gltf.scene.children[0] as Mesh;
    return { tileTexture, tableTexture, tileMesh } as Assets;
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
