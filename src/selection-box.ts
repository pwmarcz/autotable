/*
  Adapted from three.js examples:

  https://github.com/mrdoob/three.js/blob/dev/examples/jsm/interactive/SelectionBox.js
*/

import { Frustum, Vector3, Vector2, OrthographicCamera, PerspectiveCamera, Mesh, Camera, Box3 } from "three";

export class SelectionBox {
  camera: OrthographicCamera | PerspectiveCamera;
  deep: number;

  frustum: Frustum;

  tmpPoint: Vector3;
  vectemp1: Vector3;
  vectemp2: Vector3;
  vectemp3: Vector3;

  vecNear: Vector3;
  vecTopLeft: Vector3;
  vecTopRight: Vector3;
  vecDownRight: Vector3;
  vecDownLeft: Vector3;

  vecFarTopLeft: Vector3;
	vecFarTopRight: Vector3;
	vecFarDownRight: Vector3;
  vecFarDownLeft: Vector3;

  enabled: boolean;

  constructor(camera: Camera) {
    this.camera = camera as (PerspectiveCamera | OrthographicCamera);
    this.deep = Number.MAX_VALUE;

    this.tmpPoint = new Vector3();
    this.vectemp1 = new Vector3();
    this.vectemp2 = new Vector3();
    this.vectemp3 = new Vector3();

    this.frustum = new Frustum();
    this.vecNear = new Vector3();
	  this.vecTopLeft = new Vector3();
	  this.vecTopRight = new Vector3();
	  this.vecDownRight = new Vector3();
	  this.vecDownLeft = new Vector3();

	  this.vecFarTopLeft = new Vector3();
	  this.vecFarTopRight = new Vector3();
	  this.vecFarDownRight = new Vector3();
    this.vecFarDownLeft = new Vector3();

    this.enabled = false;
  }

  update(startPoint: Vector2, endPoint: Vector2): void {
    if (Math.abs(startPoint.x - endPoint.x) < 0.01 ||
      Math.abs(startPoint.y - endPoint.y) < 0.01) {
      this.enabled = false;
      return;
    }
    this.enabled = true;

		this.camera.updateProjectionMatrix();
		this.camera.updateMatrixWorld();

		if ((this.camera as PerspectiveCamera).isPerspectiveCamera) {

			this.tmpPoint.set( startPoint.x, startPoint.y, 0);
			this.tmpPoint.x = Math.min( startPoint.x, endPoint.x );
			this.tmpPoint.y = Math.max( startPoint.y, endPoint.y );
			endPoint.x = Math.max( startPoint.x, endPoint.x );
			endPoint.y = Math.min( startPoint.y, endPoint.y );

			this.vecNear.copy( this.camera.position );
			this.vecTopLeft.copy( this.tmpPoint );
			this.vecTopRight.set( endPoint.x, this.tmpPoint.y, 0 );
			this.vecDownRight.set( endPoint.x, endPoint.y, 0 );
      this.vecDownLeft.set( this.tmpPoint.x, endPoint.y, 0 );

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

			if ( startPoint.equals( endPoint ) ) endPoint.addScalar( Number.EPSILON ); // avoid invalid frustum

			const left = Math.min( startPoint.x, endPoint.x );
			const top = Math.max( startPoint.y, endPoint.y );
			const right = Math.max( startPoint.x, endPoint.x );
			const down = Math.min( startPoint.y, endPoint.y );

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
    if (this.enabled) {
      const box = new Box3();
      for (const object of objects) {
        if (!object.geometry.boundingBox) {
          object.geometry.computeBoundingBox();
        }

        box.copy(object.geometry.boundingBox);
        box.applyMatrix4(object.matrixWorld);

        if (this.frustum.intersectsBox(box)) {
          result.push(object);
        }
      }
    }
    return result;
  }
}
