import { AssetLoader } from "./asset-loader";
import { Mesh, CanvasTexture, Vector2, MeshLambertMaterial } from "three";
import { Client, Collection } from "./client";
import { MatchInfo } from './world';

export class Center {
  mesh: Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;

  scores: Array<number> = new Array(5).fill(0);
  nicks: Array<string | null> = new Array(4).fill(null);
  dealer: number | null = null;
  honba = 0;

  client: Client;
  clientNicks: Collection<number, string>;
  clientOnline: Collection<number, string>;
  clientMatch: Collection<number, MatchInfo>;

  dirty = true;

  constructor(loader: AssetLoader, client: Client) {
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

    this.client = client;
    this.clientOnline = client.collection('online');
    this.clientOnline.on('update', this.update.bind(this));

    this.clientNicks = client.collection('nicks');
    this.clientNicks.on('update', this.update.bind(this));

    this.clientMatch = client.collection('nicks');
    this.clientMatch.on('update', this.update.bind(this));

    client.on('disconnect', this.update.bind(this));
  }

  update(): void {
    for (let i = 0; i < 4; i++) {
      if (this.client.connected() && this.clientOnline.get(i)) {
        const nick = this.clientNicks.get(i);
        this.nicks[i] = nick ?? null;
      } else {
        this.nicks[i] = null;
      }
    }

    this.dealer = this.clientMatch.get(0)?.dealer ?? null;
    this.honba = this.clientMatch.get(0)?.honba ?? 0;

    this.dirty = true;
  }

  setScores(scores: Array<number>): void {
    for (let i = 0; i < 5; i++) {
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

    this.ctx.textBaseline = 'middle';

    this.ctx.translate(256, 256);

    for (let i = 0; i < 4; i++) {
      this.drawScore(this.scores[i]);
      this.drawNick(this.nicks[i]);
      if (this.dealer === i) {
        this.drawDealer();
      }
      this.ctx.rotate(-Math.PI / 2);
    }
    this.ctx.rotate(Math.PI/4);
    this.texture.needsUpdate = true;
  }

  drawRemainingScore(score: number): void {
    if (score === 0) {
      return;
    }

    this.ctx.textAlign = 'right';
    this.ctx.font = '30px Segment7Standard, monospace';

    this.ctx.fillStyle = '#e80';
    const text = `${score}.`;
    this.ctx.fillText(text, 40, 0);
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
    const text = '' + score;
    this.ctx.fillText(text, 60, 100);
  }

  drawNick(nick: string | null): void {
    let text;
    if (nick === null) {
      text = '';
    } else if (nick === '') {
      text = 'Player';
    } else {
      text = nick.substr(0, 10);
    }

    this.ctx.textAlign = 'center';
    this.ctx.font = '20px Verdana, Arial';
    this.ctx.fillStyle = '#afa';
    this.ctx.fillText(text, 0, 55);
  }

  drawDealer(): void {
    this.ctx.fillStyle = '#a60';
    this.ctx.fillRect(-132, 132, 264, -13);
    if (this.honba > 0) {
      this.ctx.textAlign = 'right';
      this.ctx.font = '40px Segment7Standard, monospace';
      this.ctx.fillText('' + this.honba, -90, 100);
    }
  }
}
