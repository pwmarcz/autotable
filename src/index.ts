//import 'normalize.css';
import 'bootstrap/dist/css/bootstrap.css';
import { AssetLoader } from './asset-loader';
import { Game } from './game';

// UI
document.getElementById('showMore')!.onclick = event => {
  event.preventDefault();
  document.getElementById('sidebar')!.classList.remove('collapsed');
};
document.getElementById('hideMore')!.onclick = event => {
  event.preventDefault();
  document.getElementById('sidebar')!.classList.add('collapsed');
};

const assetLoader = new AssetLoader();

assetLoader.loadAll().then(() => {
  const game = new Game(assetLoader);
  // for debugging
  Object.assign(window, {game});
  game.start();
});
