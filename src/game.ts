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
import { GameUi } from './game-ui';
import { TileVariant } from "./types";

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
  private gameUi: GameUi;

  benchmark: boolean = false;

  settings: {
    perspective: HTMLInputElement;
    tileLabels: HTMLInputElement;
    benchmark: HTMLInputElement;
    muted: HTMLInputElement;
    sticky: HTMLInputElement;
  };

  private lookDown = new Animation(150);
  private zoom = new Animation(150);
  private lookDownState: number = 0;

  keys: Set<string> = new Set();

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
    this.gameUi = new GameUi(this.client, this.world);

    this.settings = {
      perspective: document.getElementById('perspective') as HTMLInputElement,
      tileLabels: document.getElementById('tile-labels') as HTMLInputElement,
      benchmark: document.getElementById('benchmark') as HTMLInputElement,
      muted: document.getElementById('muted') as HTMLInputElement,
      sticky: document.getElementById('sticky') as HTMLInputElement,
    };


    this.setupEvents();
    document.getElementById('loading')!.style.visibility = 'hidden';
  }

  private setupEvents(): void {
    window.addEventListener('keypress', this.onKeyPress.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    for (const key in this.settings) {
      const element = (this.settings as any)[key] as HTMLInputElement;
      element.addEventListener('change', this.updateSettings.bind(this));
    }
  }

  private updateSettings(): void {
    this.mainView.setPerspective(this.settings.perspective.checked);
    this.objectView.setTileVariant(
      this.settings.tileLabels.checked ? TileVariant.LABELS : TileVariant.NO_LABELS
    );
    this.benchmark = this.settings.benchmark.checked;
    this.soundPlayer.muted = this.settings.muted.checked;
    this.mouseUi.sticky = this.settings.sticky.checked;
  }

  start(): void {
    this.clientUi.start();
    this.updateSettings();
    this.mainLoop();
  }

  mainLoop(): void {
    requestAnimationFrame(this.mainLoop.bind(this));

    if (this.benchmark) {
      const start = new Date().getTime();
      let end;
      do {
        this.update();
        end = new Date().getTime();
      } while (end - start < 15);
    } else {
      this.update();
    }
  }

  private update(): void {
    this.lookDown.update();
    this.zoom.update();

    this.world.updateView();
    this.mainView.updateViewport();
    this.mainView.updateCamera(this.world.seat, this.lookDown.pos, this.zoom.pos, this.mouseUi.mouse2);
    this.mainView.updateOutline(this.objectView.selectedObjects);
    this.mouseUi.setCamera(this.mainView.camera);
    this.mouseUi.updateObjects();
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
      case 'F':
        this.world.onFlip(1, true);
        break;
      case 'r':
        this.world.onFlip(-1);
        break;
      case 'R':
        this.world.onFlip(-1, true);
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
        break;
      case 'p':
        this.settings.perspective.checked = !this.settings.perspective.checked;
        this.updateSettings();
        break;
      case 'l':
        this.settings.tileLabels.checked = !this.settings.tileLabels.checked;
        this.updateSettings();
        break;
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
