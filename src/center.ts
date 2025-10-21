import { AssetLoader } from "./asset-loader";
import { Mesh, CanvasTexture, Vector2, MeshLambertMaterial } from "three";
import { Client } from "./client";
import { DiceInfo } from "./types";

export class Center {
  mesh: Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;

  scores: Array<number | null> = new Array(5).fill(null);
  nicks: Array<string | null> = new Array(4).fill(null);
  dealer: number | null = null;
  honba = 0;
  diceInfo: DiceInfo = {dice: [1, 1], state: 'ignore'};
  shouldDrawDice = false;

  diceImg: HTMLImageElement;

  client: Client;

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
    this.client.nicks.on('update', this.update.bind(this));
    this.client.match.on('update', this.update.bind(this));
    this.client.seats.on('update', this.update.bind(this));
    this.client.dice.on('update', this.updateDice.bind(this));

    this.diceImg = document.getElementById('dice-img')! as HTMLImageElement;

    client.on('disconnect', this.update.bind(this));
  }

  update(): void {
    for (let i = 0; i < 4; i++) {
      if (this.client.connected()) {
        const playerId = this.client.seatPlayers[i];
        const nick = playerId !== null ? this.client.nicks.get(playerId) : null;
        this.nicks[i] = nick ?? null;
      } else {
        this.nicks[i] = null;
      }
    }

    this.dealer = this.client.match.get(0)?.dealer ?? null;
    this.honba = this.client.match.get(0)?.honba ?? 0;

    this.dirty = true;
  }

  updateDice(): void {
    this.diceInfo = this.client.dice.get(0) ?? {dice: [1, 1], state: 'ignore'};
    if (this.diceInfo.state == 'rolled') {
      this.shouldDrawDice = true;
      this.dirty = true;
      setTimeout(() => {
        this.shouldDrawDice = false;
        this.dirty = true;
        this.draw();
      }, 1000);
    }
  }

  setScores(scores: Array<number | null>): void {
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

    if (this.shouldDrawDice) {
      this.ctx.rotate(Math.PI / 4);
      this.drawDice();
    }

    this.texture.needsUpdate = true;
  }

  drawScore(score: number | null): void {
    if (score === null) {
      return;
    }

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

  drawDice(): void {
    let [a, b] = this.diceInfo.dice;

    // Animate
    // const t = Math.floor(new Date().getTime() / 100);
    // a = t % 6 + 1;
    // // https://en.wikipedia.org/wiki/Linear_congruential_generator
    // b = (t * 1664525 + 1013904223) % 6 + 1;

    this.drawDie(a, -44, -20, 40);
    this.drawDie(b, 4, -20, 40);
  }

  drawDie(n: number, dx: number, dy: number, dstSize: number) {
    const srcSize = this.diceImg.naturalHeight;
    this.ctx.drawImage(
      this.diceImg,
      (n - 1) * srcSize, 0,
      srcSize, srcSize,
      dx, dy,
      dstSize, dstSize,
    );
  }
}
