// @ts-ignore
import jpg from '../img/*.jpg';
// @ts-ignore
import glbModels from '../img/models.auto.glb';

import { Texture, Mesh, TextureLoader, Material, LinearEncoding,
   MeshStandardMaterial, MeshLambertMaterial, PlaneGeometry, BufferGeometry, RepeatWrapping, InstancedMesh, InstancedBufferAttribute, Float32BufferAttribute, InstancedBufferGeometry } from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader';
import { World } from './world';
import { Size } from './places';


const TILE_DU = 32 / 256;
const TILE_DV = 40 / 256;
const STICK_DV = 1 / 6;

export class AssetLoader {
  textures: Record<string, Texture> = {};
  meshes: Record<string, Mesh> = {};

  makeTable(): Mesh {
    const tableGeometry = new PlaneGeometry(
      World.WIDTH + Size.TILE.y, World.WIDTH + Size.TILE.y);
    const tableMaterial = new MeshLambertMaterial({ color: 0xeeeeee, map: this.textures.table });
    const tableMesh = new Mesh(tableGeometry, tableMaterial);
    return tableMesh;
  }

  makeCenter(): Mesh {
    return this.cloneMesh(this.meshes.center);
  }

  makeTray(): Mesh {
    const mesh = this.cloneMesh(this.meshes.tray);
    (mesh.material as MeshStandardMaterial).color.setHex(0x363636);
    return mesh;
  }

  makeStick(index: number): Mesh {
    const mesh = this.cloneMesh(this.meshes.stick);

    const geometry = mesh.geometry.clone() as BufferGeometry;
    mesh.geometry = geometry;
    const uvs: Float32Array = geometry.attributes.uv.array as Float32Array;
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i+1] += index * STICK_DV;
    }

    return mesh;
  }

  makeTile(index: number): Mesh {
    const mesh = this.cloneMesh(this.meshes.tile);

    const x = (index % 37) % 8;
    const y = Math.floor((index % 37) / 8);
    const back = Math.floor(index / 37);

    // Clone geometry and modify front face
    const geometry = mesh.geometry.clone() as BufferGeometry;
    mesh.geometry = geometry;
    const uvs: Float32Array = geometry.attributes.uv.array as Float32Array;
    for (let i = 0; i < uvs.length; i += 2) {
      if (uvs[i] <= TILE_DU && uvs[i+1] <= TILE_DV) {
        uvs[i] += x * TILE_DU;
        uvs[i+1] += y * TILE_DV;
      } else if (uvs[i+1] >= 4 * TILE_DV) {
        uvs[i+1] += back * TILE_DV;
      }
    }

    return mesh;
  }

  makeTileInstancedMesh(count: number): InstancedMesh {
    const origMaterial = this.meshes.tile.material as MeshLambertMaterial;
    const material = new MeshLambertMaterial({
      map: origMaterial.map,
      color: origMaterial.color,
    });

    const paramChunk = [
      'attribute vec2 frontOffset;',
      'attribute vec2 backOffset;',
      '#include <common>',
    ].join('\n');
    const uvChunk = [
      `#include <uv_vertex>`,
      `if (vUv.x <= ${TILE_DU} && vUv.y <= ${TILE_DV})`,
      `    vUv += frontOffset;`,
      `else if (vUv.y >= ${4*TILE_DV})`,
      `    vUv += backOffset;`
    ].join('\n');

    // Fix cache conflict: https://github.com/mrdoob/three.js/issues/19377
    material.defines = material.defines ?? {};
    material.defines.THING_TYPE = 'tile';

    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', paramChunk)
        .replace('#include <uv_vertex>', uvChunk);
    };

    const geometry = new InstancedBufferGeometry().copy(this.meshes.tile.geometry as BufferGeometry);
    geometry.setAttribute(
      'frontOffset',
      new InstancedBufferAttribute(new Float32Array(count * 2), 2));
    geometry.setAttribute(
      'backOffset',
      new InstancedBufferAttribute(new Float32Array(count * 2), 2));
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.count = 0;
    return mesh;
  }

  makeStickInstancedMesh(count: number): InstancedMesh {
    const origMaterial = this.meshes.stick.material as MeshLambertMaterial;
    const material = new MeshLambertMaterial({
      map: origMaterial.map,
      color: origMaterial.color,
    });
    const paramChunk = [
      'attribute vec2 offset;',
      '#include <common>',
    ].join('\n');
    const uvChunk = [
      `#include <uv_vertex>`,
      `vUv.y += offset.y;`,
    ].join('\n');

    // Fix cache conflict: https://github.com/mrdoob/three.js/issues/19377
    material.defines = material.defines ?? {};
    material.defines.THING_TYPE = 'stick';

    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', paramChunk)
        .replace('#include <uv_vertex>', uvChunk);
    };

    const geometry = new InstancedBufferGeometry().copy(this.meshes.stick.geometry as BufferGeometry);
    geometry.setAttribute(
      'offset',
      new InstancedBufferAttribute(new Float32Array(count * 2), 2));
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.count = 0;
    return mesh;
  }

  setTileInstanceParams(instancedMesh: InstancedMesh, i: number, index: number): void {
    const x = (index % 37) % 8;
    const y = Math.floor((index % 37) / 8);
    const back = Math.floor(index / 37);

    const geometry = instancedMesh.geometry as BufferGeometry;
    const frontOffset = geometry.attributes.frontOffset as Float32BufferAttribute;
    const backOffset = geometry.attributes.backOffset as Float32BufferAttribute;
    (frontOffset.array as Float32Array)[2 * i] = x * TILE_DU;
    (frontOffset.array as Float32Array)[2 * i + 1] = y * TILE_DV;
    (backOffset.array as Float32Array)[2 * i] = 0;
    (backOffset.array as Float32Array)[2 * i + 1] = back * TILE_DV;
    frontOffset.needsUpdate = true;
    backOffset.needsUpdate = true;
  }

  setStickInstanceParams(instancedMesh: InstancedMesh, i: number, index: number): void {
    const geometry = instancedMesh.geometry as BufferGeometry;
    const offset = geometry.attributes.offset as Float32BufferAttribute;
    (offset.array as Float32Array)[2 * i] = 0;
    (offset.array as Float32Array)[2 * i + 1] = index * STICK_DV;
    offset.needsUpdate = true;
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
      this.loadTexture(jpg['table'], 'table'),
      this.loadModels(glbModels),
      (document as any).fonts.load('40px "Segment7Standard"'),
    ]).then(() => {
      this.textures.table.wrapS = RepeatWrapping;
      this.textures.table.wrapT = RepeatWrapping;
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
    const standard = material as MeshStandardMaterial;
    const map = standard.map;
    if (map !== null) {
      map.encoding = LinearEncoding;
      map.anisotropy = 4;
    }
    return new MeshLambertMaterial({map});
  }
}
