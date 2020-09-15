import $ from 'jquery';
import { Client } from "./client";
import { World } from "./world";
import { DealType, GameType, Conditions, Points, GAME_TYPES } from './types';
import { DEALS } from './setup-deal';
import { MainView } from './main-view';

export function parseTileString(tiles: string): Record<string, number> {
  const tileMap: Record<string, number> = {};
  for (const result of [..."mpsz"].map(g => new RegExp(`[1-9]+${g}`).exec(tiles))) {
    if(result === null) {
      continue;
    }
    const group = result[0];
    for (let i = 0; i < group.length - 1; i++) {
      const tile = group[i] + group[group.length - 1];
      tileMap[tile] = (tileMap[tile] ?? 0) + 1;
    }
  }
  return tileMap;
}

export function tileMapToString(tileMap: Record<string, number>): string {
  const groups: Record<string, string> = {};
  for (const [key, value] of Object.entries(tileMap).sort((a, b) => a[0].codePointAt(0) - b[0].codePointAt(0))) {
    groups[key[1]] = (groups[key[1]] ?? "") + key[0].repeat(value);
  }
  let desc = "";
  for (const group of ["m", "p", "s", "z"]) {
    if (!(group in groups)) {
      continue;
    }
    desc += groups[group] + group;
  }
  return desc;
}

enum SeatWind {
  East = 0,
  South,
  West,
  North,
}

export class GameUi {
  elements: {
    deal: HTMLButtonElement;
    toggleDealer: HTMLButtonElement;
    toggleHonba: HTMLButtonElement;
    takeSeat: Array<HTMLButtonElement>;
    leaveSeat: HTMLButtonElement;
    toggleSetup: HTMLButtonElement;
    dealType: HTMLSelectElement;
    gameType: HTMLSelectElement;
    setupDesc: HTMLElement;
    aka: HTMLSelectElement;
    akaText: HTMLInputElement;
    points: HTMLSelectElement;
    nick: HTMLInputElement;
    spectate: HTMLButtonElement;
    stopSpectate: HTMLButtonElement;
    spectateOptions: HTMLDivElement;
    viewTop: HTMLButtonElement;
    viewAuto: HTMLButtonElement;
    viewHand: Array<HTMLButtonElement>;
    viewCalls: Array<HTMLButtonElement>;
  }

  private isSpectating: boolean = false;

  constructor(
    private readonly client: Client,
    private readonly world: World,
    private readonly mainView: MainView) {

    this.elements = {
      deal: document.getElementById('deal') as HTMLButtonElement,
      toggleDealer: document.getElementById('toggle-dealer') as HTMLButtonElement,
      toggleHonba: document.getElementById('toggle-honba') as HTMLButtonElement,
      takeSeat: [],
      leaveSeat: document.getElementById('leave-seat') as HTMLButtonElement,
      toggleSetup: document.getElementById('toggle-setup') as HTMLButtonElement,
      dealType: document.getElementById('deal-type') as HTMLSelectElement,
      gameType: document.getElementById('game-type') as HTMLSelectElement,
      setupDesc: document.getElementById('setup-desc') as HTMLElement,
      aka: document.getElementById('aka') as HTMLSelectElement,
      akaText: document.getElementById('aka-text') as HTMLInputElement,
      points: document.getElementById('points') as HTMLSelectElement,
      nick: document.getElementById('nick')! as HTMLInputElement,

      spectate: document.getElementById('spectate')! as HTMLButtonElement,
      stopSpectate: document.getElementById('stop-spectate')! as HTMLButtonElement,
      spectateOptions: document.getElementById('spectate-options')! as HTMLDivElement,
      viewTop: document.getElementById('view-top')! as HTMLButtonElement,
      viewAuto: document.getElementById('view-auto')! as HTMLButtonElement,
      viewHand: [],
      viewCalls: [],
    };

    for (let i = 0; i < 4; i++) {
      this.elements.takeSeat.push(document.querySelector(`.seat-button-${i} button`) as HTMLButtonElement);
      this.elements.viewHand.push(document.querySelector(`.view-hand[data-seat="${i}"]`) as HTMLButtonElement);
      this.elements.viewCalls.push(document.querySelector(`.view-calls[data-seat="${i}"]`) as HTMLButtonElement);
    }

    this.setupEvents();
    this.setupDealButton();
  }

  private setupEvents(): void {
    this.elements.toggleDealer.onclick = () => this.world.toggleDealer();
    this.elements.toggleHonba.onclick = () => this.world.toggleHonba();

    this.client.seats.on('update', this.updateSeats.bind(this));
    this.client.nicks.on('update', this.updateSeats.bind(this));
    for (let i = 0; i < 4; i++) {
      this.elements.takeSeat[i].onclick = () => {
        this.client.nicks.set(this.client.playerId(), this.elements.nick.value);
        this.client.seats.set(this.client.playerId(), { seat: i });
      };

      this.elements.viewHand[i].onclick = () => {
        this.mainView.spectateHand(i);
      };

      this.elements.viewCalls[i].onclick = () => {
        this.mainView.spectateCall(i);
      };
    }

    this.elements.leaveSeat.onclick = () => {
      this.client.seats.set(this.client.playerId(), { seat: null });
    };

    this.elements.viewTop.onclick = () => {
      this.mainView.spectateTop();
    };

    this.elements.viewAuto.onclick = () => {
      this.mainView.spectateAuto();
      this.updateSeats();
    };

    this.elements.spectate.onclick = () => {
      this.mainView.setPerspective(true);
      this.isSpectating = true;
      this.mainView.spectateAuto();
      this.updateSeats();
    };

    this.elements.stopSpectate.onclick = () => {
      this.mainView.spectateTop();
      this.isSpectating = false;
      this.updateSeats();
    };

    this.client.match.on('update', this.updateSetup.bind(this));
    this.elements.gameType.onchange = () => {
      this.updateVisibility();
      this.resetPoints();
    };
    this.updateSetup();

    this.elements.aka.onchange = this.updateAka.bind(this);
    this.elements.akaText.onblur = this.updateAkaText.bind(this);

    // Hack for settings menu
    const doNotClose = ['LABEL', 'SELECT', 'OPTION'];
    for (const menu of Array.from(document.querySelectorAll('.dropdown-menu'))) {
      $(menu.parentElement!).on('hide.bs.dropdown', (e: Event) => {
        // @ts-ignore
        const target: HTMLElement | undefined = e.clickEvent?.target;
        if (target && doNotClose.indexOf(target.tagName) !== -1) {
          e.preventDefault();
        }
      });
    }
  }

  private updateSetup(): void {
    const match = this.client.match.get(0);
    const conditions = match?.conditions ?? Conditions.initial();

    this.elements.aka.value = tileMapToString(conditions.aka);
    if (this.elements.aka.selectedIndex === -1) {
      this.elements.aka.value = "-";
    }
    this.elements.akaText.value = tileMapToString(conditions.aka);

    this.elements.points.value = conditions.points;
    this.elements.gameType.value = conditions.gameType;
    this.elements.setupDesc.textContent = Conditions.describe(conditions);

    this.updateVisibility();
  }

  private updateVisibility(): void {
    const gameType = this.elements.gameType.value as GameType;

    for (const option of Array.from(this.elements.dealType.querySelectorAll('option'))) {
      const dealType = option.value as DealType;
      if (DEALS[gameType][dealType] === undefined) {
        option.style.display = 'none';
      } else {
        option.style.display = 'block';
      }
    }

    const dealType = this.elements.dealType.value as DealType;
    if (DEALS[gameType][dealType] === undefined) {
      this.resetDealType();
    }
  }

  private resetPoints(): void {
    const gameType = this.elements.gameType.value as GameType;
    this.elements.points.value = GAME_TYPES[gameType].points;
  }

  private resetDealType(): void {
    const gameType = this.elements.gameType.value as GameType;

    for (const option of Array.from(this.elements.dealType.querySelectorAll('option'))) {
      const dealType = option.value as DealType;
      if (DEALS[gameType][dealType] !== undefined) {
        this.elements.dealType.value = dealType;
        break;
      }
    }
  }

  private updateAka(event: Event): void {
    if (this.elements.aka.value === "-") {
      return;
    }

    this.elements.akaText.value = this.elements.aka.value;
  }

  private updateAkaText(event: FocusEvent): void {
    this.elements.aka.value = "-";
    this.elements.akaText.value = tileMapToString(parseTileString(this.elements.akaText.value));
  }

  private setVisibility(element: HTMLElement, isVisible: boolean): void {
    if (isVisible) {
      element.setAttribute('style', '');
      return;
    }
    element.setAttribute('style', 'display:none !important');
  }

  private updateSeats(): void {
    const toDisable = [
      this.elements.deal,
      this.elements.toggleDealer,
      this.elements.toggleHonba,
      this.elements.toggleSetup,
    ];

    this.setVisibility(this.elements.spectate.parentElement!, !this.isSpectating && this.client.seat === null);
    this.setVisibility(this.elements.stopSpectate.parentElement!, this.isSpectating);
    this.setVisibility(this.elements.spectateOptions, this.isSpectating);
    this.setVisibility(this.elements.leaveSeat.parentElement!, this.client.seat !== null);
    for (const button of toDisable) {
      button.disabled = this.client.seat === null;
    }
    this.setVisibility(document.querySelector('.seat-buttons')! as HTMLElement, this.client.seat === null && !this.isSpectating);

    if (this.client.seat === null) {
      for (let i = 0; i < 4; i++) {
        const playerId = this.client.seatPlayers[i];
        const button = document.querySelector(`.seat-button-${i} button`) as HTMLButtonElement;
        if (playerId !== null) {
          const nick = this.client.nicks.get(playerId) || 'Jyanshi';
          button.disabled = true;
          button.className = 'btn btn-secondary';
          button.textContent = nick;
        } else {
          button.className = 'btn btn-primary';
          button.disabled = false;
          button.textContent = 'Take seat';
        }
      }
    }
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
        const dealType = this.elements.dealType.value as DealType;
        const gameType = this.elements.gameType.value as GameType;
        const aka = parseTileString(this.elements.akaText.value);
        const points = this.elements.points.value as Points;

        this.world.deal(dealType, gameType, aka, points);
        this.resetDealType();
        this.hideSetup();
      }
    };

    buttonElement.onmousedown = start;
    buttonElement.onmouseup = commit;
    buttonElement.onmouseleave = cancel;
  }

  private showSetup(): void {
    // @ts-ignore
    $('#setup-group').collapse('show');
  }

  private hideSetup(): void {
    // @ts-ignore
    $('#setup-group').collapse('hide');
  }

}
