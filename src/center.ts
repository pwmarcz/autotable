import { AssetLoader } from "./asset-loader";
import { Mesh, CanvasTexture, Vector2, MeshLambertMaterial } from "three";

export class Center {
  mesh: Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;

  scores: Array<number> = [0, 0, 0, 0];
  nicks: Array<string> = ['', '', '', ''];
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
    this.texture.anisotropy = 16;
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

  setNicks(nicks: Array<string>): void {
    for (let i = 0; i < 4; i++) {
      if (nicks[i] !== this.nicks[i]) {
        this.dirty = true;
      }
      this.nicks[i] = nicks[i];
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

    this.ctx.textBaseline = 'middle';

    this.ctx.translate(256, 256);
    for (let i = 0; i < 4; i++) {
      this.drawScore(this.scores[i]);
      this.drawNick(this.nicks[i]);
      this.ctx.rotate(-Math.PI / 2);
    }
    this.texture.needsUpdate = true;
  }

  drawScore(score: number): void {
    this.ctx.textAlign = 'right';
    this.ctx.font = '40px Segment7Standard, monospace';
    if (score > 0) {
      this.ctx.fillStyle = '#eee';
    } else if (0 <= score && score <= 1000) {
      this.ctx.fillStyle = '#e80';
    } else {
      this.ctx.fillStyle = '#e00';
    }
    const scoreText = '' + score;
    this.ctx.fillText(scoreText, 60, 100);
  }

  drawNick(nick: string): void {
    nick = nick.substr(0, 10);

    this.ctx.textAlign = 'center';
    this.ctx.font = '20px Verdana, Arial';
    this.ctx.fillStyle = '#afa';
    this.ctx.fillText(nick, 0, 55);
  }
}
