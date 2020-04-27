import 'normalize.css';
import * as PIXI from 'pixi.js';

import { World } from './world';
import { loadTextures, View } from './view';

const main = document.getElementById('main');

const app = new PIXI.Application({width: 800, height: 600});

main.appendChild(app.view);

const world = new World();

window.world = world;

loadTextures().then(textures => {
  const view = new View(textures, app, world);

  window.view = view;

  view.draw();
});
