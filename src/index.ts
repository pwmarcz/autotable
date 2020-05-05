import 'normalize.css';
import { World } from './world';
import { View } from './view';
import { AssetLoader } from './asset-loader';

const world = new World();

let view: View | null = null;

const assetLoader = new AssetLoader();

assetLoader.loadAll().then(() => {
  view = new View(world, assetLoader);

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
