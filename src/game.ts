import $ from 'jquery';

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
import { SetupType } from './types';

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

  buttons: {
    deal: HTMLButtonElement;
    toggleDealer: HTMLButtonElement;
    toggleHonba: HTMLButtonElement;
    takeSeat: Array<HTMLButtonElement>;
    leaveSeat: HTMLButtonElement;
  }

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

    this.settings = {
      perspective: document.getElementById('perspective') as HTMLInputElement,
      benchmark: document.getElementById('benchmark') as HTMLInputElement,
      muted: document.getElementById('muted') as HTMLInputElement,
    };

    this.buttons = {
      deal: document.getElementById('deal') as HTMLButtonElement,
      toggleDealer: document.getElementById('toggle-dealer') as HTMLButtonElement,
      toggleHonba: document.getElementById('toggle-honba') as HTMLButtonElement,
      takeSeat: [],
      leaveSeat: document.getElementById('leave-seat') as HTMLButtonElement,
    };
    for (let i = 0; i < 4; i++) {
      this.buttons.takeSeat[i] = document.querySelector(
        `.seat-button-${i} button`) as HTMLButtonElement;
    }

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

    this.buttons.toggleDealer.onclick = () => this.world.toggleDealer();
    this.buttons.toggleHonba.onclick = () => this.world.toggleHonba();

    this.client.seats.on('update', this.updateSeats.bind(this));
    for (let i = 0; i < 4; i++) {
      this.buttons.takeSeat[i].onclick = () => {
        this.client.seats.set(this.client.playerId(), { seat: i });
      };
    }
    this.buttons.leaveSeat.onclick = () => {
      this.client.seats.set(this.client.playerId(), { seat: null });
    };

    // Hack for settings menu
    for (const menu of Array.from(document.querySelectorAll('.dropdown-menu'))) {
      $(menu.parentElement!).on('hide.bs.dropdown', (e: Event) => {
        // @ts-ignore
        const target: HTMLElement | undefined = e.clickEvent?.target;
        if (target && target.tagName === 'LABEL') {
          e.preventDefault();
        }
      });
    }
  }

  private updateSeats(): void {
    const toDisable = [
      this.buttons.deal,
      this.buttons.toggleDealer,
      this.buttons.toggleHonba,
      this.buttons.leaveSeat,
    ];
    if (this.client.seat === null) {
      (document.querySelector('.seat-buttons')! as HTMLElement).style.display = 'block';
      for (let i = 0; i < 4; i++) {
        const playerId = this.client.seatPlayers[i];
        const button = document.querySelector(`.seat-button-${i} button`) as HTMLButtonElement;
        if (playerId !== null) {
          const nick = this.client.nicks.get(playerId) || 'Player';
          button.disabled = true;
          button.className = 'btn btn-secondary';
          button.textContent = nick;
        } else {
          button.className = 'btn btn-primary';
          button.disabled = false;
          button.textContent = 'Take seat';
        }
      }
      for (const button of toDisable) {
        button.disabled = true;
      }
    } else {
      (document.querySelector('.seat-buttons')! as HTMLElement).style.display = 'none';
      for (const button of toDisable) {
        button.disabled = false;
      }
    }
  }

  private setupDealButton(): void {
    const buttonElement = document.getElementById('deal')!;
    const progressElement = document.querySelector('#deal .btn-progress')! as HTMLElement;
    const setupElement = document.getElementById('setup') as HTMLInputElement;

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
        const setupType = setupElement.value as SetupType;
        this.world.deal(setupType);
        setupElement.value = SetupType.HANDS;
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
    this.clientUi.start();
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
