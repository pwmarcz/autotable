import { ObjectView } from "./object-view";
import { World } from "./world";
import { Client } from "./client";
import { AssetLoader } from "./asset-loader";
import { Animation } from "./utils";
import { MouseUi } from "./mouse-ui";
import { MainView } from "./main-view";
import { Group } from "three";
import { ClientUi } from "./client-ui";
import { SoundPlayer } from "./sound-player";

export class Game {
  private assetLoader: AssetLoader;
  private mainGroup: Group;
  private client: Client;
  private world: World;
  private objectView: ObjectView;
  private mainView: MainView;
  private mouseUi: MouseUi;
  private clientUi: ClientUi;
  private soundPlayer: SoundPlayer;

  benchmark: boolean = false;

  private lookDown = new Animation(150);
  private zoom = new Animation(150);
  private lookDownState: number = 0;

  keys: Set<string> = new Set();

  settings: {
    perspective: HTMLInputElement;
    benchmark: HTMLInputElement;
    muted: HTMLInputElement;
  };

  constructor(assetLoader: AssetLoader) {
    this.assetLoader = assetLoader;
    this.mainGroup = new Group;
    this.client = new Client();
    this.objectView = new ObjectView(this.mainGroup, assetLoader, this.client);
    this.soundPlayer = new SoundPlayer(this.client);
    this.world = new World(this.objectView, this.soundPlayer, this.client);
    this.mainView = new MainView(this.mainGroup);
    this.mouseUi = new MouseUi(this.world, this.mainGroup);
    this.clientUi = new ClientUi(this.client);
    this.clientUi.start();

    this.settings = {
      perspective: document.getElementById('perspective') as HTMLInputElement,
      benchmark: document.getElementById('benchmark') as HTMLInputElement,
      muted: document.getElementById('muted') as HTMLInputElement,
    };

    this.setupEvents();
    this.setupDealButton();
    this.updateSettings();
  }

  private setupEvents(): void {
    window.addEventListener('keypress', this.onKeyPress.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    this.settings.perspective.addEventListener('change', this.updateSettings.bind(this));
    this.settings.benchmark.addEventListener('change', this.updateSettings.bind(this));
    this.settings.muted.addEventListener('change', this.updateSettings.bind(this));

    document.getElementById('toggle-dealer')!.onclick = () => this.world.toggleDealer();
    document.getElementById('toggle-honba')!.onclick = () => this.world.toggleHonba();
  }

  private setupDealButton(): void {
    const buttonElement = document.getElementById('deal')!;
    const progressElement = document.querySelector('#deal .btn-progress')! as HTMLElement;
    let startPressed: number | null = null;
    const transitionTime = 600;
    const waitTime = transitionTime + 0;

    const start = (): void => {
      if (startPressed === null) {
        progressElement.style.width = '100%';
        startPressed = new Date().getTime();
      }
    };
    const cancel = (): void => {
      progressElement.style.width = '0%';
      startPressed = null;
      buttonElement.blur();
    };
    const commit = (): void => {
      const deal = startPressed !== null && new Date().getTime() - startPressed > waitTime;
      progressElement.style.width = '0%';
      startPressed = null;
      buttonElement.blur();

      if (deal) {
        this.world.deal();
      }
    };

    buttonElement.onmousedown = start;
    buttonElement.onmouseup = commit;
    buttonElement.onmouseleave = cancel;
  }

  private updateSettings(): void {
    this.mainView.setPerspective(this.settings.perspective.checked);
    this.benchmark = this.settings.benchmark.checked;
    this.soundPlayer.muted = this.settings.muted.checked;
  }

  start(): void {
    this.update();
  }

  private update(): void {
    if (this.benchmark) {
      setTimeout(this.update.bind(this));
    } else {
      requestAnimationFrame(this.update.bind(this));
    }

    this.lookDown.update();
    this.zoom.update();

    this.world.updateView();
    this.mainView.updateViewport();
    this.mainView.updateCamera(this.lookDown.pos, this.zoom.pos, this.mouseUi.mouse2);
    this.mainView.updateRotation(this.world.playerNum);
    this.mainView.updateOutline(this.objectView.selectedObjects);
    this.mouseUi.setCamera(this.mainView.camera);
    this.mouseUi.update();
    this.mouseUi.updateCursors();
    this.mainView.render();
  }

  private onKeyPress(event: KeyboardEvent): void {
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (document.activeElement?.tagName === 'INPUT') {
      return;
    }

    if (this.keys.has(event.key)) {
      return;
    }

    this.keys.add(event.key);

    switch(event.key) {
      case 'f':
        this.world.onFlip(1);
        break;
      case 'r':
        this.world.onFlip(-1);
        break;
      case ' ':
        this.lookDown.start(1);
        break;
      case 'z':
        this.zoom.start(1);
        break;
      case 'x':
        this.zoom.start(-1);
        break;
      case 'q':
        this.lookDownState = 1 - this.lookDownState;
        this.lookDown.start(this.lookDownState);
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.key);

    switch(event.key) {
      case ' ':
        this.lookDown.start(0);
        break;
      case 'z':
        this.zoom.start(0);
        break;
      case 'x':
        this.zoom.start(0);
        break;
    }
  }
}
