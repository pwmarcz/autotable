import $ from 'jquery';
import { Client } from "./client";
import { World } from "./world";
import { DealType, Fives, GameType, Conditions, Points, GAME_TYPES } from './types';
import { DEALS } from './setup-deal';

export class GameUi {
  private client: Client;
  private world: World;

  elements: {
    deal: HTMLButtonElement;
    toggleDealer: HTMLButtonElement;
    toggleHonba: HTMLButtonElement;
    takeSeat: Array<HTMLButtonElement>;
    kick: Array<HTMLButtonElement>;
    leaveSeat: HTMLButtonElement;
    toggleSetup: HTMLButtonElement;
    dealType: HTMLSelectElement;
    gameType: HTMLSelectElement;
    setupDesc: HTMLElement;
    fives: HTMLSelectElement;
    points: HTMLSelectElement;
  }

  constructor(client: Client, world: World) {
    this.client = client;
    this.world = world;

    this.elements = {
      deal: document.getElementById('deal') as HTMLButtonElement,
      toggleDealer: document.getElementById('toggle-dealer') as HTMLButtonElement,
      toggleHonba: document.getElementById('toggle-honba') as HTMLButtonElement,
      takeSeat: [],
      kick: [],
      leaveSeat: document.getElementById('leave-seat') as HTMLButtonElement,
      toggleSetup: document.getElementById('toggle-setup') as HTMLButtonElement,
      dealType: document.getElementById('deal-type') as HTMLSelectElement,
      gameType: document.getElementById('game-type') as HTMLSelectElement,
      setupDesc: document.getElementById('setup-desc') as HTMLElement,
      fives: document.getElementById('fives') as HTMLSelectElement,
      points: document.getElementById('points') as HTMLSelectElement,
    };
    for (let i = 0; i < 4; i++) {
      this.elements.takeSeat[i] = document.querySelector(
        `.seat-button-${i} .take-seat`) as HTMLButtonElement;

      this.elements.kick[i] = document.querySelector(
        `.seat-button-${i} .kick`) as HTMLButtonElement;
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
        this.client.seats.set(this.client.playerId(), { seat: i });
      };
    }
    for (let i = 0; i < 4; i++) {
      this.setupProgressButton(this.elements.kick[i], 1500, () => {
        const kickedId = this.client.seatPlayers[i];
        if (kickedId !== null) {
          this.client.seats.set(kickedId, { seat: null });
        }
      });
    }
    this.elements.leaveSeat.onclick = () => {
      this.client.seats.set(this.client.playerId(), { seat: null });
    };

    this.client.match.on('update', this.updateSetup.bind(this));
    this.elements.gameType.onchange = () => {
      this.updateVisibility();
      this.resetPoints();
    };
    this.updateSetup();

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

    // @ts-ignore
    $('[data-toggle="tooltip"]').tooltip();
  }

  private updateSetup(): void {
    const match = this.client.match.get(0);
    const conditions = match?.conditions ?? Conditions.initial();

    this.elements.fives.value = conditions.fives;
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

  private updateSeats(): void {
    const toDisable = [
      this.elements.deal,
      this.elements.toggleDealer,
      this.elements.toggleHonba,
      this.elements.leaveSeat,
      this.elements.toggleSetup,
    ];
    if (this.client.seat === null) {
      (document.querySelector('.seat-buttons')! as HTMLElement).style.display = 'block';
      for (let i = 0; i < 4; i++) {
        const playerId = this.client.seatPlayers[i];
        if (playerId !== null) {
          this.elements.takeSeat[i].style.display = 'none';
          this.elements.kick[i].style.display = '';

          const nick = this.client.nicks.get(playerId) || 'Player';
          const textElement = this.elements.kick[i].querySelector('.btn-progress-text')!;
          textElement.textContent = nick;
        } else {
          this.elements.takeSeat[i].style.display = '';
          this.elements.kick[i].style.display = 'none';
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
    const buttonElement = document.getElementById('deal')! as HTMLButtonElement;

    this.setupProgressButton(buttonElement, 600, () => {
      const dealType = this.elements.dealType.value as DealType;
      const gameType = this.elements.gameType.value as GameType;
      const fives = this.elements.fives.value as Fives;
      const points = this.elements.points.value as Points;

      this.world.deal(dealType, gameType, fives, points);
      this.resetDealType();
      this.hideSetup();
    });
  }

  private setupProgressButton(
      buttonElement: HTMLButtonElement,
      transitionTime: number, onSuccess: () => void): void {
    const progressElement = buttonElement.querySelector('.btn-progress')! as HTMLElement;

    progressElement.style.transitionDuration = `${transitionTime}ms`;

    let startPressed: number | null = null;
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
      const success = startPressed !== null && new Date().getTime() - startPressed > waitTime;
      progressElement.style.width = '0%';
      startPressed = null;
      buttonElement.blur();

      if (success) {
        onSuccess();
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
