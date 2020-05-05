import { AssetLoader } from "./asset-loader";
import { Mesh, CanvasTexture, Vector2, MeshLambertMaterial } from "three";

export class Center {
  mesh: Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;

  scores: Array<number> = [0, 0, 0, 0];
  dirty = true;

  constructor(loader: AssetLoader) {
    this.mesh = loader.makeCenter();
    this.canvas = document.getElementById('center')! as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    const material = this.mesh.material as MeshLambertMaterial;
    const image = material.map!.image as HTMLImageElement;

    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.ctx.drawImage(image, 0, 0);

    this.texture = new CanvasTexture(this.canvas);
    this.texture.flipY = false;
    this.texture.rotation = Math.PI;
    this.texture.center = new Vector2(0.5, 0.5);
    material.map = this.texture;
  }

  setScores(scores: Array<number>): void {
    for (let i = 0; i < 4; i++) {
      if (scores[i] !== this.scores[i]) {
        this.dirty = true;
      }
      this.scores[i] = scores[i];
    }
  }

  draw(): void {
    if (!this.dirty) {
      return;
    }
    this.dirty = false;

    const offset = 0.24 * 512;
    const width = 0.52 * 512;

    this.ctx.resetTransform();

    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(offset, offset, width, width);

    this.ctx.font = '40px Segment7Standard, monospace';
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';

    this.ctx.translate(256, 256);
    for (let i = 0; i < 4; i++) {
      const score = this.scores[i];

      if (score > 0) {
        this.ctx.fillStyle = '#eee';
      } else if (0 <= score && score <= 1000) {
        this.ctx.fillStyle = '#e80';
      } else {
        this.ctx.fillStyle = '#e00';
      }


      const scoreText = '' + score;
      this.ctx.fillText(scoreText, 60, 100);
      this.ctx.rotate(-Math.PI / 2);
    }
    this.texture.needsUpdate = true;
  }
}
