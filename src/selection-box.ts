/*
  Adapted from three.js examples:

  https://github.com/mrdoob/three.js/blob/dev/examples/jsm/interactive/SelectionBox.js
*/

import { Frustum, Vector3, Vector2, OrthographicCamera, PerspectiveCamera, Mesh, Camera, Box3 } from "three";

export class SelectionBox {
  camera: OrthographicCamera | PerspectiveCamera;
  deep: number = Number.MAX_VALUE;

  frustum: Frustum = new Frustum();

  vectemp1 = new Vector3();
  vectemp2 = new Vector3();
  vectemp3 = new Vector3();

  vecNear = new Vector3();
  vecTopLeft = new Vector3();
  vecTopRight = new Vector3();
  vecDownRight = new Vector3();
  vecDownLeft = new Vector3();

  vecFarTopLeft = new Vector3();
  vecFarTopRight = new Vector3();
  vecFarDownRight = new Vector3();
  vecFarDownLeft = new Vector3();

  constructor(camera: Camera) {
    this.camera = camera as (PerspectiveCamera | OrthographicCamera);
    this.deep = Number.MAX_VALUE;
  }

  update(startPoint: Vector2, endPoint: Vector2): void {
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    let left = Math.min(startPoint.x, endPoint.x);
    let right = Math.max(startPoint.x, endPoint.x);
    let down = Math.min(startPoint.y, endPoint.y);
    let top = Math.max(startPoint.y, endPoint.y);
    const eps = 0.01;

    // Fix narrow / empty selection breaking
    if (right - left < eps) {
      left -= eps / 2;
      right += eps / 2;
    }
    if (top - down < eps) {
      down -= eps / 2;
      top += eps / 2;
    }

    if ((this.camera as PerspectiveCamera).isPerspectiveCamera) {
      this.camera.getWorldPosition(this.vecNear);
      this.vecTopLeft.set( left, top, 0 );
      this.vecTopRight.set( right, top, 0 );
      this.vecDownRight.set( right, down, 0 );
      this.vecDownLeft.set( left, down, 0 );

      this.vecTopLeft.unproject( this.camera );
      this.vecTopRight.unproject( this.camera );
      this.vecDownRight.unproject( this.camera );
      this.vecDownLeft.unproject( this.camera );

      this.vectemp1.copy(this.vecTopLeft ).sub(this.vecNear );
      this.vectemp2.copy(this.vecTopRight ).sub(this.vecNear );
      this.vectemp3.copy(this.vecDownRight ).sub(this.vecNear );
      this.vectemp1.normalize();
      this.vectemp2.normalize();
      this.vectemp3.normalize();

      this.vectemp1.multiplyScalar( this.deep );
      this.vectemp2.multiplyScalar( this.deep );
      this.vectemp3.multiplyScalar( this.deep );
      this.vectemp1.add(this.vecNear );
      this.vectemp2.add(this.vecNear );
      this.vectemp3.add(this.vecNear );

      const planes = this.frustum.planes;

      planes[ 0 ].setFromCoplanarPoints(this.vecNear,this.vecTopLeft,this.vecTopRight );
      planes[ 1 ].setFromCoplanarPoints(this.vecNear,this.vecTopRight,this.vecDownRight );
      planes[ 2 ].setFromCoplanarPoints(this.vecDownRight,this.vecDownLeft,this.vecNear );
      planes[ 3 ].setFromCoplanarPoints(this.vecDownLeft,this.vecTopLeft,this.vecNear );
      planes[ 4 ].setFromCoplanarPoints(this.vecTopRight,this.vecDownRight,this.vecDownLeft );
      planes[ 5 ].setFromCoplanarPoints(this.vectemp3,this.vectemp2,this.vectemp1 );
      planes[ 5 ].normal.multiplyScalar( - 1 );

    } else if ( (this.camera as OrthographicCamera).isOrthographicCamera ) {

      this.vecTopLeft.set( left, top, - 1 );
      this.vecTopRight.set( right, top, - 1 );
      this.vecDownRight.set( right, down, - 1 );
      this.vecDownLeft.set( left, down, - 1 );

      this.vecFarTopLeft.set( left, top, 1 );
      this.vecFarTopRight.set( right, top, 1 );
      this.vecFarDownRight.set( right, down, 1 );
      this.vecFarDownLeft.set( left, down, 1 );

      this.vecTopLeft.unproject( this.camera );
      this.vecTopRight.unproject( this.camera );
      this.vecDownRight.unproject( this.camera );
      this.vecDownLeft.unproject( this.camera );

      this.vecFarTopLeft.unproject( this.camera );
      this.vecFarTopRight.unproject( this.camera );
      this.vecFarDownRight.unproject( this.camera );
      this.vecFarDownLeft.unproject( this.camera );

      const planes = this.frustum.planes;

      planes[ 0 ].setFromCoplanarPoints( this.vecTopLeft, this.vecFarTopLeft, this.vecFarTopRight );
      planes[ 1 ].setFromCoplanarPoints( this.vecTopRight, this.vecFarTopRight, this.vecFarDownRight );
      planes[ 2 ].setFromCoplanarPoints( this.vecFarDownRight, this.vecFarDownLeft, this.vecDownLeft );
      planes[ 3 ].setFromCoplanarPoints( this.vecFarDownLeft, this.vecFarTopLeft, this.vecTopLeft );
      planes[ 4 ].setFromCoplanarPoints( this.vecTopRight, this.vecDownRight, this.vecDownLeft );
      planes[ 5 ].setFromCoplanarPoints( this.vecFarDownRight, this.vecFarTopRight, this.vecFarTopLeft );
      planes[ 5 ].normal.multiplyScalar( - 1 );

    } else {
      throw 'SelectionBox: Unsupported camera type';
    }
  }

  select(objects: Array<Mesh>): Array<Mesh> {
    const result = [];
    const box = new Box3();
    for (const object of objects) {
      if (!object.geometry.boundingBox) {
        object.geometry.computeBoundingBox();
      }

      box.copy(object.geometry.boundingBox!);
      box.applyMatrix4(object.matrixWorld);

      if (this.frustum.intersectsBox(box)) {
        result.push(object);
      }
    }
    return result;
  }
}
