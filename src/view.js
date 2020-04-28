import * as PIXI from 'pixi.js';
import tilesSvg from '../img/tiles.svg';

import { TILE_WIDTH, TILE_HEIGHT, TILE_DEPTH } from './world';

export class View {
  constructor(textures, app, world) {
    this.textures = textures;
    this.app = app;
    this.world = world;

    this.scale = 15;
    this.shorten = 0.5;

    this.objects = [];
    this.setup();
  }

  setup() {
    const g = new PIXI.Graphics();
    g.beginFill(0x007000, 1);
    g.drawRect(0, 0, 800, 600);
    this.app.stage.addChild(g);

    for (let i = 0; i < this.world.things.length; i++) {
      const thing = this.world.things[i];
      this.objects[i] = this.makeObject(thing);
      this.objects[i].visible = false;
      this.app.stage.addChild(this.objects[i]);
    }
  }

  draw() {
    for (let i = 0; i < this.world.things.length; i++) {
      const params = this.world.thingParams(i);
      this.objects[i].position.x = this.scale * params.x;
      this.objects[i].position.y = this.scale * params.y;
      this.objects[i].visible = true;
    }
  }

  makeObject(thing) {
    if (thing.type === 'tile') {
      const container = new PIXI.Container();
      container.scale.x = this.scale;
      container.scale.y = this.scale;

      const graphics = new PIXI.Graphics();
      container.addChild(graphics);

      const margin = 0.08;

      graphics.lineStyle(0.2, 0xaaaaaa);
      graphics.beginFill(0xcccccc);
      graphics.drawRoundedRect(
        margin, margin,
        TILE_WIDTH - 2*margin,
        TILE_HEIGHT + TILE_DEPTH * this.shorten - 2*margin,
        0.5);

      graphics.lineStyle(0);
      graphics.beginFill(0xffd003);
      graphics.drawRoundedRect(
        margin,
        margin,
        TILE_WIDTH - 2*margin,
        TILE_DEPTH * this.shorten - 2*margin,
        0.5);
      graphics.beginFill(0xffffff);
      graphics.drawRoundedRect(
        margin,
        TILE_DEPTH * this.shorten * 0.3 + margin,
        TILE_WIDTH - 2*margin,
        TILE_DEPTH * this.shorten * 0.7 - 2*margin,
        0.5);

      graphics.beginFill(0xe6e6e6);
      graphics.drawRoundedRect(
        margin,
        TILE_DEPTH * this.shorten + margin,
        TILE_WIDTH - 2*margin,
        TILE_HEIGHT - 2*margin,
        0.5);

      const sprite = new PIXI.Sprite(this.textures[thing.index]);
      container.addChild(sprite);
      sprite.position.x = 0;
      sprite.position.y = TILE_DEPTH * this.shorten;
      sprite.width = TILE_WIDTH;
      sprite.height = TILE_HEIGHT;

      return container;
    }
    throw `unknown type: ${thing.type}`;
  }
}

const TEXTURE_TIMEOUT = 5*1000;

export function loadTextures() {
  const resource = new PIXI.resources.SVGResource(tilesSvg, {
    scale: 4,
  });
  const tileTexture = new PIXI.BaseTexture(resource, {
    mipmap: PIXI.MIPMAP_MODES.ON,
  });

  return waitUntilLoaded(tileTexture).then(tileTexture => {
    const textures = [];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 9; j++) {
        const w = 30 * 4;
        const h = 44 * 4;
        const texture = new PIXI.Texture(
          tileTexture,
          new PIXI.Rectangle(j * w, i * h, w, h)
        );
        textures.push(texture);
      }
    }
    return textures;
  });
}

function waitUntilLoaded(t) {
  return new Promise((resolve, reject) => {
    let rejected = false;
    const timeoutId = setTimeout(() => {
      rejected = true;
      reject(`Error loading texture`);
    }, TEXTURE_TIMEOUT);

    // For some reason, t.valid is true even before the texture is actually
    // loaded, so we always wait for an event.
    t.on('update', () => {
      if (t.valid && !rejected) {
        clearTimeout(timeoutId);
        resolve(t);
      }
    });
  });
}
