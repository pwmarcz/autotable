// @ts-ignore
import jpg from '../img/*.jpg';
// @ts-ignore
import glbModels from '../img/models.auto.glb';

import { Texture, Mesh, TextureLoader, Material, LinearEncoding,
   MeshStandardMaterial, MeshLambertMaterial, PlaneGeometry, BufferGeometry } from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { World } from './world';


export class AssetLoader {
  textures: Record<string, Texture> = {};
  meshes: Record<string, Mesh> = {};

  makeTable(): Mesh {
    const tableGeometry = new PlaneGeometry(
      World.WIDTH + World.TILE_HEIGHT, World.HEIGHT + World.TILE_HEIGHT);
    const tableMaterial = new MeshLambertMaterial({ color: 0xeeeeee, map: this.textures.table });
    const tableMesh = new Mesh(tableGeometry, tableMaterial);
    return tableMesh;
  }

  makeCenter(): Mesh {
    return this.cloneMesh(this.meshes.center);
  }

  makeStick(index: number): Mesh {
    const mesh = this.cloneMesh(this.meshes.stick);

    const dv = 0.2 * index;

    const geometry = mesh.geometry.clone() as BufferGeometry;
    mesh.geometry = geometry;
    const uvs: Float32Array = geometry.attributes.uv.array as Float32Array;
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i+1] += dv;
    }

    return mesh;
  }

  makeTile(index: number): Mesh {
    const mesh = this.cloneMesh(this.meshes.tile);

    const x = index % 8;
    const y = Math.floor(index / 8);

    const du = 32 / 256;
    const dv = 47 / 256;

    // Clone geometry and modify front face
    const geometry = mesh.geometry.clone() as BufferGeometry;
    mesh.geometry = geometry;
    const uvs: Float32Array = geometry.attributes.uv.array as Float32Array;
    for (let i = 0; i < uvs.length; i += 2) {
      if (uvs[i] <= du && uvs[i+1] <= dv) {
        uvs[i] += x * du;
        uvs[i+1] += y * dv;
      }
    }

    return mesh;
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
      this.loadTexture(jpg['table'], 'table'),
      this.loadModels(glbModels),
      (document as any).fonts.load('40px "Segment7Standard"'),
    ]).then(() => {
      this.textures.table.wrapS = 3;
      this.textures.table.wrapT = 3;
      this.textures.table.repeat.set(3, 3);
      (this.meshes.tile.material as MeshStandardMaterial).color.setHex(0xeeeeee);
    });
  }

  loadTexture(url: string, name: string): Promise<void> {
    const loader = new TextureLoader();
    return new Promise(resolve => {
      loader.load(url, (texture: Texture) => {
        this.textures[name] = this.processTexture(texture);;
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
    const map = (material as MeshStandardMaterial).map;
    if (map !== null) {
      map.encoding = LinearEncoding;
      map.anisotropy = 4;
    }
    return new MeshLambertMaterial({map});
  }
}
