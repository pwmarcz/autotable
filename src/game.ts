import { ObjectView } from "./object-view";
import { World } from "./world";
import { Client } from "./client";
import { AssetLoader } from "./asset-loader";
import { Animation } from "./utils";
import { MouseUi } from "./mouse-ui";
import { MainView } from "./main-view";
import { Group } from "three";
import { ClientUi } from "./client-ui";

export class Game {
  private assetLoader: AssetLoader;
  private mainGroup: Group;
  private client: Client;
  private world: World;
  private objectView: ObjectView;
  private mainView: MainView;
  private mouseUi: MouseUi;
  private clientUi: ClientUi;

  benchmark: boolean = false;

  private lookDown = new Animation(150);
  private zoom = new Animation(150);

  settings: {
    perspective: HTMLInputElement;
    benchmark: HTMLInputElement;
  };

  constructor(assetLoader: AssetLoader) {
    this.assetLoader = assetLoader;
    this.mainGroup = new Group;
    this.client = new Client();
    this.objectView = new ObjectView(this.mainGroup, assetLoader, this.client);
    this.world = new World(this.objectView, this.client);
    this.mainView = new MainView(this.mainGroup);
    this.mouseUi = new MouseUi(this.world, this.mainGroup);
    this.clientUi = new ClientUi(this.client);
    this.clientUi.start();

    this.settings = {
      perspective: document.getElementById('perspective') as HTMLInputElement,
      benchmark: document.getElementById('benchmark') as HTMLInputElement,
    };

    this.setupEvents();
  }

  private setupEvents(): void {
    window.addEventListener('keypress', this.onKeyPress.bind(this));
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));
    this.settings.perspective.addEventListener('change', this.updateSettings.bind(this));
    this.settings.benchmark.addEventListener('change', this.updateSettings.bind(this));
  }

  private updateSettings(): void {
    this.mainView.setPerspective(this.settings.perspective.checked);
    this.benchmark = this.settings.benchmark.checked;
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
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
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
