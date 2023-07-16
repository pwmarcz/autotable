import { Vector3, Mesh, Group, Material, InstancedMesh, Matrix4, BufferGeometry, MeshLambertMaterial, InstancedBufferGeometry, InstancedBufferAttribute, Quaternion } from "three";
import { AssetLoader } from "./asset-loader";
import { ThingType } from "./types";
import { rotEquals } from "./utils";

const TILE_DU = 32 / 256;
const TILE_DV = 40 / 256;
const STICK_DV = 1 / 6;

export interface ThingParams {
  type: ThingType;
  typeIndex: number;
  index: number;
}

export abstract class ThingGroup {
  protected assetLoader: AssetLoader;
  protected startIndex: number = 0;
  protected meshes: Array<Mesh> = [];
  protected group: Group;

  abstract createMesh(typeIndex: number): Mesh;

  constructor(assetLoader: AssetLoader, group: Group) {
    this.assetLoader = assetLoader;
    this.group = group;
  }

  canSetSimple(): boolean {
    return false;
  }

  setSimple(index: number, position: Vector3, rotation: Quaternion): void {}

  setCustom(index: number, position: Vector3, rotation: Quaternion): Mesh {
    const mesh = this.meshes[index - this.startIndex];
    mesh.position.copy(position);
    mesh.setRotationFromQuaternion(rotation);
    return mesh;
  }

  replace(startIndex: number, params: Array<ThingParams>): void {
    for (const mesh of this.meshes) {
      (mesh.material as Material).dispose();
      mesh.geometry.dispose();
      this.group.remove(mesh);
    }
    this.meshes.splice(0);

    for (const p of params) {
      const mesh = this.createMesh(p.typeIndex);
      mesh.matrixAutoUpdate = false;
      this.meshes.push(mesh);
      this.group.add(mesh);
    }
    this.startIndex = startIndex;
  }
}

export class MarkerThingGroup extends ThingGroup {
  createMesh(typeIndex: number): Mesh {
    return this.assetLoader.makeMarker();
  }
}

abstract class InstancedThingGroup extends ThingGroup {
  protected instancedMesh: InstancedMesh = null!;
  private zero: Matrix4 = new Matrix4().makeScale(0, 0, 0);

  abstract getOriginalMesh(): Mesh;
  abstract getUvChunk(): string;
  abstract getOffset(typeIndex: number): Vector3;

  canSetSimple(): boolean {
    return true;
  }

  createInstancedMesh(params: Array<ThingParams>): InstancedMesh {
    const origMesh = this.getOriginalMesh();

    const origMaterial = origMesh.material as MeshLambertMaterial;
    const material = new MeshLambertMaterial({
      map: origMaterial.map,
      color: origMaterial.color,
    });

    const paramChunk = `
attribute vec3 offset;
#include <common>
`;
    const uvChunk = this.getUvChunk();
    material.onBeforeCompile = shader => {
      // console.log(shader.vertexShader);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', paramChunk)
        .replace('#include <uv_vertex>', uvChunk);
    };

    // Fix cache conflict: https://github.com/mrdoob/three.js/issues/19377
    material.defines = material.defines ?? {};
    material.defines.THING_TYPE = origMesh.name;

    const data = new Float32Array(params.length * 3);
    for (let i = 0; i < params.length; i++) {
      const v = this.getOffset(params[i].typeIndex);
      data[3 * i] = v.x;
      data[3 * i + 1] = v.y;
      data[3 * i + 2] = v.z;
    }

    // the cast to InstancedBufferGeometry is a lie, but the copy works
    const geometry = new InstancedBufferGeometry().copy(origMesh.geometry as InstancedBufferGeometry);
    geometry.setAttribute('offset', new InstancedBufferAttribute(data, 3));
    const instancedMesh = new InstancedMesh(geometry, material, params.length);
    instancedMesh.frustumCulled = false;
    return instancedMesh;
  }

  replace(startIndex: number, params: Array<ThingParams>): void {
    super.replace(startIndex, params);

    if (this.instancedMesh !== null) {
      (this.instancedMesh.material as Material).dispose();
      this.instancedMesh.geometry.dispose();
      this.group.remove(this.instancedMesh);
    }
    this.instancedMesh = this.createInstancedMesh(params);
    this.group.add(this.instancedMesh);
  }

  setSimple(index: number, position: Vector3, rotation: Quaternion): void {
    const i = index - this.startIndex;
    const mesh = this.meshes[i];
    if (!mesh.visible && mesh.position.equals(position) && rotEquals(mesh.quaternion, rotation)) {
      return;
    }
    mesh.position.copy(position);
    mesh.setRotationFromQuaternion(rotation);
    mesh.updateMatrix();
    mesh.visible = false;
    this.instancedMesh.setMatrixAt(i, mesh.matrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  setCustom(index: number, position: Vector3, rotation: Quaternion): Mesh {
    const i = index - this.startIndex;
    const mesh = this.meshes[i];
    mesh.position.copy(position);
    mesh.setRotationFromQuaternion(rotation);
    mesh.visible = true;
    this.instancedMesh.setMatrixAt(i, this.zero);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
}

export class TileThingGroup extends InstancedThingGroup {
  protected name: string = 'tile';

  getOriginalMesh(): Mesh {
    return this.assetLoader.meshes.tile;
  }

  getUvChunk(): string {
    return `
#include <uv_vertex>
if (vMapUv.x <= ${TILE_DU} && vMapUv.y <= ${TILE_DV}) {
  vMapUv.x += offset.x;
  vMapUv.y += offset.y;
} else if (vMapUv.y >= ${4*TILE_DV}) {
  vMapUv.y += offset.z;
}
`;
  }

  getOffset(typeIndex: number): Vector3 {
    const x = (typeIndex % 37) % 8;
    const y = Math.floor((typeIndex % 37) / 8);
    const back = Math.floor(typeIndex / 37);
    return new Vector3(x * TILE_DU, y * TILE_DV, back * TILE_DV);
  }

  createMesh(typeIndex: number): Mesh {
    const mesh = this.assetLoader.make('tile');

    const x = (typeIndex % 37) % 8;
    const y = Math.floor((typeIndex % 37) / 8);
    const back = Math.floor(typeIndex / 37);

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
}

export class StickThingGroup extends InstancedThingGroup {
  getOriginalMesh(): Mesh {
    return this.assetLoader.meshes.stick;
  }

  getUvChunk(): string {
    return `
#include <uv_vertex>
vMapUv += offset.xy;
`;
  }

  getOffset(typeIndex: number): Vector3 {
    return new Vector3(0, typeIndex * STICK_DV, 0);
  }

  createMesh(typeIndex: number): Mesh {
    const mesh = this.assetLoader.make('stick');

    const geometry = mesh.geometry.clone() as BufferGeometry;
    mesh.geometry = geometry;
    const uvs: Float32Array = geometry.attributes.uv.array as Float32Array;
    for (let i = 0; i < uvs.length; i += 2) {
      uvs[i+1] += typeIndex * STICK_DV;
    }

    return mesh;
  }
}
