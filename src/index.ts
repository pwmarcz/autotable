import 'normalize.css';
import { World } from './world';
import { View } from './view';
import { loadAssets } from './assets';

const main = document.getElementById('main')!;
const selection = document.getElementById('selection')!;

const world = new World();

let view: View | null = null;

loadAssets().then(assets => {
  view = new View(main, selection, world, assets);

  // Debugging
  // @ts-ignore
  window.world = world;
  // @ts-ignore
  window.view = view;

  updateSettings();
  view.draw();
});

const perspectiveCheckbox = document.getElementById('perspective') as HTMLInputElement;
perspectiveCheckbox.addEventListener('change', updateSettings);

function updateSettings(): void {
  const perspective = perspectiveCheckbox.checked;
  if (view) {
    view.setPerspective(perspective);
  }
}
