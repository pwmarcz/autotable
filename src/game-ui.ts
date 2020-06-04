import $ from 'jquery';
import { Client } from "./client";
import { World } from "./world";
import { DealType, Fives, GameType, TileSet } from './types';
import { DEALS } from './setup-deal';

export class GameUi {
  private client: Client;
  private world: World;

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
    fives: HTMLSelectElement;
  }

  constructor(client: Client, world: World) {
    this.client = client;
    this.world = world;

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
      fives: document.getElementById('fives') as HTMLSelectElement,
    };
    for (let i = 0; i < 4; i++) {
      this.elements.takeSeat[i] = document.querySelector(
        `.seat-button-${i} button`) as HTMLButtonElement;
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
    this.elements.leaveSeat.onclick = () => {
      this.client.seats.set(this.client.playerId(), { seat: null });
    };

    this.client.match.on('update', this.updateSetup.bind(this));
    this.elements.gameType.onchange = this.updateVisibility.bind(this);
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
  }

  private updateSetup(): void {
    const match = this.client.match.get(0);
    const tileSet = match?.tileSet ?? TileSet.initial();

    this.elements.fives.value = tileSet.fives;
    this.elements.gameType.value = tileSet.gameType;
    this.elements.setupDesc.textContent = TileSet.describe(tileSet);

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
        const fives = this.elements.fives.value as Fives;

        this.world.deal(dealType, gameType, fives);
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
