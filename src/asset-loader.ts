// @ts-ignore
import tableJpg from 'url:../img/table.jpg';
// @ts-ignore
import tilesLabelsPng from 'url:../img/tiles-labels.auto.png';
// @ts-ignore
import glbModels from 'url:../img/models.auto.glb';

import { Texture, Mesh, TextureLoader, Material,
   MeshStandardMaterial, MeshLambertMaterial, PlaneGeometry, RepeatWrapping, LinearSRGBColorSpace } from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { World } from './world';
import { Size } from './types';


export class AssetLoader {
  textures: Record<string, Texture> = {};
  meshes: Record<string, Mesh> = {};

  makeTable(): Mesh {
    const tableGeometry = new PlaneGeometry(
      World.WIDTH + Size.TILE.y, World.WIDTH + Size.TILE.y);
    const tableMaterial = new MeshLambertMaterial({ map: this.textures.table });
    const tableMesh = new Mesh(tableGeometry, tableMaterial);
    return tableMesh;
  }

  makeCenter(): Mesh {
    return this.cloneMesh(this.meshes.center);
  }

  makeTray(): Mesh {
    const mesh = this.cloneMesh(this.meshes.tray);
    (mesh.material as MeshStandardMaterial).color.set(0.22, 0.22, 0.22);
    return mesh;
  }

  make(what: string): Mesh {
    return this.cloneMesh(this.meshes[what]);
  }

  makeMarker(): Mesh {
    return this.cloneMesh(this.meshes.marker);
  }

  cloneMesh(mesh: Mesh): Mesh {
    const newMesh = mesh.clone();
    if (Array.isArray(mesh.material)) {
      newMesh.material = mesh.material.map(m => m.clone());
    } else {
      newMesh.material = mesh.material.clone();
    }

    return newMesh;
  }

  loadAll(): Promise<void> {
    return Promise.all([
      this.loadTexture(tableJpg, 'table'),
      this.loadTexture(tilesLabelsPng, 'tilesLabels'),
      this.loadModels(glbModels),
      (document as any).fonts.load('40px "Segment7Standard"'),
    ]).then(() => {
      this.textures.table.wrapS = RepeatWrapping;
      this.textures.table.wrapT = RepeatWrapping;
      this.textures.table.repeat.set(3, 3);
    });
  }

  loadTexture(url: string, name: string): Promise<void> {
    const loader = new TextureLoader();
    return new Promise(resolve => {
      loader.load(url, (texture: Texture) => {
        this.textures[name] = this.processTexture(texture);
        resolve();
      });
    });
  }

  loadModels(url: string): Promise<void> {
    const loader = new GLTFLoader();
    return new Promise(resolve => {
      loader.load(url, (model: GLTF) => {
        for (const obj of model.scene.children) {
          if ((obj as Mesh).isMesh) {
            this.meshes[obj.name] = this.processMesh(obj as Mesh);
          } else {
            // eslint-disable-next-line no-console
            console.warn('unrecognized object', obj);
          }
        }
        resolve();
      });
    });
  }

  processTexture(texture: Texture): Texture {
    texture.flipY = false;
    texture.anisotropy = 4;
    texture.colorSpace = LinearSRGBColorSpace;
    return texture;
  }

  processMesh(mesh: Mesh): Mesh {
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(this.processMaterial.bind(this));
    } else {
      mesh.material = this.processMaterial(mesh.material);
    }
    return mesh;
  }

  processMaterial(material: Material): Material {
    const standard = material as MeshStandardMaterial;
    const map = standard.map;
    if (map !== null) {
      map.colorSpace = LinearSRGBColorSpace;
      map.anisotropy = 4;
    }
    return new MeshLambertMaterial({map});
  }
}
