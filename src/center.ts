import { AssetLoader } from "./asset-loader";
import { Mesh, CanvasTexture, Vector2, MeshLambertMaterial, PlaneGeometry, Group } from "three";
import { Client } from "./client";
import { World } from "./world";
import { Size } from "./types";

export class Center {
  private mesh: Mesh;
  group: Group;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;

  scores: Array<number | null> = new Array(5).fill(null);
  nicks: Array<string | null> = new Array(4).fill(null);
  dealer: number | null = null;
  honba = 0;
  remainingTiles = 0;

  client: Client;

  private readonly namePlateSize = new Vector2(World.WIDTH + Size.TILE.y, World.WIDTH / 16);
  private readonly namePlateContexts: Array<CanvasRenderingContext2D> = [];
  private readonly namePlateCanvases: Array<HTMLCanvasElement> = [];
  private readonly namePlateTextures: Array<CanvasTexture> = [];

  dirty = true;

  constructor(loader: AssetLoader, client: Client) {
    this.group = new Group();
    this.mesh = loader.makeCenter();
    this.mesh.position.set(0, 0, 0.75);
    this.group.add(this.mesh);
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
    this.client.things.on('update', this.update.bind(this));

    for (let i = 0; i < 4; i++) {
      this.namePlateCanvases[i] = document.getElementById(`name-plate-${i}`)! as HTMLCanvasElement;
      this.namePlateCanvases[i].width = this.namePlateSize.x * 10;
      this.namePlateCanvases[i].height = this.namePlateSize.y * 10;
      this.namePlateContexts[i] = this.namePlateCanvases[i].getContext('2d')!;
    }

    for (let i = 0; i < 4; i++){
      const group = new Group();
      this.group.add(group);
      group.rotateZ(Math.PI * i / 2);

      const wallMesh = new Mesh(
        new PlaneGeometry(
          this.namePlateSize.x,
          Size.TILE.z,
        ),
        new MeshLambertMaterial({ color: 0xeeeeee })
      );
      wallMesh.rotation.set(-Math.PI / 2, 0, 0);
      wallMesh.position.set(0, (-World.WIDTH - Size.TILE.y / 2 - Size.TILE.z) / 2, Size.TILE.z / 2 + 0.3);
      group.add(wallMesh);

      const namePlateGeometry = new PlaneGeometry(
        this.namePlateSize.x,
        this.namePlateSize.y
      );

      const material = new MeshLambertMaterial({ color: 0xeeeeee });
      const namePlateMesh = new Mesh(namePlateGeometry, material);
      group.add(namePlateMesh);
      namePlateMesh.position.set(0, (-World.WIDTH - Size.TILE.y - this.namePlateSize.y) / 2, Size.TILE.z);

      const texture = new CanvasTexture(this.namePlateCanvases[i]);
      this.namePlateTextures.push(texture);
      texture.flipY = true;
      texture.center = new Vector2(0.5, 0.5);
      texture.anisotropy = 16;
      material.map = texture;

      this.updateNamePlate(i, this.nicks[i]);
    }

    client.on('disconnect', this.update.bind(this));
  }

  private updateNamePlate(seat: number, nick: string | null): void {
    this.namePlateContexts[seat].resetTransform();

    this.namePlateContexts[seat].fillStyle = '#fefefe';
    this.namePlateContexts[seat].fillRect(0, 0, this.namePlateSize.x * 10, this.namePlateSize.y * 10);

    this.namePlateContexts[seat].fillStyle = '#ba7329';
    this.namePlateContexts[seat].fillRect(this.namePlateSize.x * 10 / 5 * 2, this.namePlateSize.y * 10 / 4 , this.namePlateSize.x * 10 / 5, this.namePlateSize.y * 10 / 2);

    this.namePlateContexts[seat].textAlign = 'center';
    this.namePlateContexts[seat].font = `${this.namePlateSize.y * 5 / 2}px Koruri`;
    this.namePlateContexts[seat].fillStyle = '#fff';
    this.namePlateContexts[seat].textBaseline = 'middle';
    this.namePlateContexts[seat].translate(this.namePlateSize.x * 5, this.namePlateSize.y * 5);
    this.namePlateContexts[seat].fillText(nick ?? "", 0, 0);
    this.namePlateTextures[seat].needsUpdate = true;
  }

  update(): void {
    for (let i = 0; i < 4; i++) {
      const playerId = this.client.seatPlayers[i];
      const nick = playerId !== null ? this.client.nicks.get(playerId) : null;

      if (nick === null) {
        this.nicks[i] = '';
        continue;
      }

      if (nick === '') {
        this.nicks[i] = 'Jyanshi';
        continue;
      }

      this.nicks[i] = nick;
    }

    this.dealer = this.client.match.get(0)?.dealer ?? null;
    this.honba = this.client.match.get(0)?.honba ?? 0;
    this.remainingTiles = [...this.client.things.entries()].filter(([i, t]) =>
      t.slotName.startsWith("washizu.bag") && t.claimedBy === null).length;

    this.dirty = true;
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
      this.updateNamePlate(i, this.nicks[i]);
      if (this.dealer === i) {
        this.drawDealer();
      }
      this.ctx.rotate(-Math.PI / 2);
    }
    this.ctx.rotate(Math.PI/4);
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
    const text = (nick ?? "").substr(0, 10);
    this.ctx.textAlign = 'center';
    this.ctx.font = '20px Verdana, Arial';
    this.ctx.fillStyle = '#afa';
    this.ctx.fillText(text ?? "", 0, 55);
  }

  drawDealer(): void {
    this.ctx.fillStyle = '#a60';
    this.ctx.fillRect(-132, 132, 264, -13);
    if (this.honba > 0) {
      this.ctx.textAlign = 'right';
      this.ctx.font = '40px Segment7Standard, monospace';
      this.ctx.fillText('' + this.honba, -90, 100);
    }

    if (this.remainingTiles > 0) {
      if(this.remainingTiles < 14) {
        this.ctx.fillStyle = '#f44';
      } else {
        this.ctx.fillStyle = '#88f';
      }
      this.ctx.textAlign = 'center';
      this.ctx.font = '40px Segment7Standard, monospace';
      this.ctx.fillText('' + this.remainingTiles, 0, 5);
    }
  }
}
