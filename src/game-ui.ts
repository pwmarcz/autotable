import $ from 'jquery';
import { Client } from "./client";
import { World } from "./world";
import { DealType, GameType, Conditions, Points, GAME_TYPES, ThingType } from './types';
import { DEALS } from './setup-deal';
import { MainView } from './main-view';
import { start } from 'repl';
import { Thing } from './thing';

export function setVisibility(element: HTMLElement, isVisible: boolean): void {
  if (isVisible) {
    element.setAttribute('style', '');
    return;
  }
  element.setAttribute('style', 'display:none !important');
}

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

function numberWithCommas(x: number, addSign?: boolean): string {
  let number = x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (addSign){
    if (x > 0) {
      number = "+" + number;
    }
  }
  return number;
}

export class SpectatorOverlay {
  private isEnabled: boolean = false;

  private readonly riichiNotifications: Array<number> = [];
  private riichiNotificationTimeout: NodeJS.Timeout | null = null;
  private readonly nicks: Array<string> = [];

  private readonly spectatorOverlay: HTMLDivElement;

  private readonly roundDisplay: HTMLDivElement;
  private readonly remainingSticksDisplay: HTMLDivElement;
  private readonly honbaDisplay: HTMLDivElement;
  private readonly matchStatusDisplay: HTMLDivElement;
  private readonly riichiNotification: HTMLDivElement;

  private readonly playerDisplays: Array<HTMLDivElement> = [];
  private readonly playerNames: Array<HTMLDivElement> = [];
  private readonly playerScores: Array<HTMLDivElement> = [];

  constructor(private readonly client: Client, private readonly world: World) {
    this.spectatorOverlay = document.getElementById('spectator-ui') as HTMLDivElement;

    this.roundDisplay = document.getElementById('round-display') as HTMLDivElement;
    this.remainingSticksDisplay = document.getElementById('remaining-sticks-display') as HTMLDivElement;
    this.honbaDisplay = document.getElementById('honba-display') as HTMLDivElement;
    this.matchStatusDisplay = document.getElementById('match-status-display') as HTMLDivElement;

    this.riichiNotification = document.getElementById('riichi-notification') as HTMLDivElement;

    for (let i = 0; i < 4; i++) {
      this.playerDisplays.push(document.querySelector(`.player-display [data-seat='${i}']`) as HTMLDivElement);
      this.playerNames.push(document.querySelector(`.player-display [data-seat='${i}'] .name-display`) as HTMLDivElement);
      this.playerScores.push(document.querySelector(`.player-display [data-seat='${i}'] .points`) as HTMLDivElement);
    }

    this.client.nicks.on('update', () => {
      this.updateNicks();
    });

    this.client.seats.on('update', () => {
      this.updateNicks();
    });

    this.client.match.on('update', () => {
      this.updateHonba();
      this.updateRound();
      this.updateDealer();
    });

    this.client.things.on('update', (entries, isFull) => {
      let updateScores = isFull;

      for (const [key, info] of entries) {
        if (!info) {
          return;
        }

        const thing = this.world.things.get(key);
        if (!thing) {
          continue;
        }

        if (thing.type === ThingType.MARKER) {
          const seat = parseInt(info.slotName.substring(info.slotName.indexOf('@') + 1));
          this.updateRound();
          this.updateSeatings(seat);
          continue;
        }

        if (info?.slotName.startsWith("wall") && info.rotationIndex === 1) {
          const indicator = this.matchStatusDisplay.querySelector(`[data-dora-id='${key}']`);
          if (indicator) {
            continue;
          }
          const index = thing.getTypeIndexNoFlags();
          let x = index % 9;
          const y = index % 40 / 9 | 0;
          if (y < 3) {
            x = (x + 1) % 9;
          } else if (x < 4){
            x = (x + 1) % 4;
          } else {
            x = 4 + (x - 3) % 3;
          }
          this.matchStatusDisplay.insertAdjacentHTML("beforeend", `
            <div class="dora" data-dora-id="${key}">
              <div style="background-position: ${100 / 9 * x}% ${100 / 7 * y}%"></div>
            </div>
          `);
        } else if (thing.slot.name.startsWith("wall")) {
          const indicator = this.matchStatusDisplay.querySelector(`[data-dora-id='${key}']`);
          if (indicator) {
            indicator.remove();
            continue;
          }
        }

        if (thing.type === ThingType.STICK) {
          if (!updateScores) {
            const seat = parseInt(info.slotName.substring(info.slotName.indexOf('@') + 1));
            if (seat !== thing.slot.seat || thing.slot.name.substring(3) !== info.slotName?.substring(3)) {
              updateScores = true;
            }
          }

          if (thing.slot.name.startsWith("riichi") !== info?.slotName?.startsWith("riichi")) {
            const isRemoved = thing.slot.name.startsWith("riichi");
            const slotName = isRemoved ? thing.slot.name : info.slotName;
            const seat = parseInt(slotName.substring(slotName.indexOf('@') + 1));
            if (isRemoved) {
              this.playerDisplays[seat].classList.remove("riichi");
            } else {
              this.playerDisplays[seat].classList.add("riichi");
              if (!isFull) {
                this.showRiichiNotification(seat);
              }
            }
          }
        }
      }

      if (updateScores) {
        this.updateScores(isFull);
      }
    });

    setVisibility(this.spectatorOverlay, this.isEnabled);
    setVisibility(this.riichiNotification, false);

    this.updateScores(true);
    this.updateNicks();
  }

  private readonly scores: Array<number | null> = [];
  private readonly scoreChanges: Array<number | null> = [];
  private scoreUpdateTimeout: NodeJS.Timeout | null = null;
  private isAnimatingScore: boolean = false;

  private updateScores(skipAnimation: boolean): void {
    setTimeout(() => {
      this.updateRemainingSticks();

      if (this.isAnimatingScore) {
        return;
      }

      const scores = this.world.setup.getScores().seats;
      for (let i = 0; i < 4; i++) {
        if (scores[i] === null) {
          continue;
        }

        const change = scores[i]! - (this.scores[i] ?? 0) - (this.scoreChanges[i] ?? 0);
        if (skipAnimation) {
          this.scores[i] = (this.scores[i] ?? 0) + change;
          this.playerScores[i].innerText = numberWithCommas(this.scores[i]!);
        } else {
          this.scoreChanges[i] = (this.scoreChanges[i] ?? 0) + change;
        }
      }

      if (this.scoreChanges.findIndex(s => s) === -1){
        return;
      }

      const sticksLeft = [...this.world.slots.values()].find(s => s.name.startsWith("payment") && s.thing !== null);

      if (this.scoreUpdateTimeout !== null) {
        clearTimeout(this.scoreUpdateTimeout);
      }

      this.scoreUpdateTimeout = setTimeout(() => {
        this.scoreUpdateTimeout = null;
        this.isAnimatingScore = true;
        const changes = [...this.scoreChanges];
        for (let i = 0; i < 4; i++) {
          if (this.scoreChanges[i] !== null) {
            this.scoreChanges[i] = 0;
          }

          if (!changes[i]) {
            continue;
          }

          if (changes[i]! > 0) {
            this.playerNames[i].classList.add("gain");
          } else {
            this.playerNames[i].classList.add("loss");
          }

          this.playerNames[i].innerText = numberWithCommas(changes[i]!, true);
        }

        setTimeout(() => {
          this.animateScoreChange(changes, Date.now());
        }, 2000);
      }, sticksLeft ? 5000 : 3000);
    }, 0);
  }

  private animateScoreChange(changes: Array<number | null>, startTime: number): void {
    const now = Date.now();
    const elapsedTime = now - startTime;
    let done = true;
    for (let i = 0; i < 4; i++) {
      if (changes[i] === null || this.scores[i] === null) {
        continue;
      }
      done = false;

      const change = changes[i]! > 0 ? Math.min(changes[i]!, elapsedTime * 10) : Math.max(changes[i]!, -elapsedTime * 10);
      changes[i]! -= change;
      this.scores[i] = this.scores[i]! + change;
      this.playerNames[i].innerText = numberWithCommas(changes[i]!, true);
      this.playerScores[i].innerText = numberWithCommas(this.scores[i] ?? 0);

      if (changes[i] === 0) {
        this.playerNames[i].innerText = this.nicks[i];
        this.playerNames[i].classList.remove("loss");
        this.playerNames[i].classList.remove("gain");
        changes[i] = null;
        continue;
      }
    }

    if (!done) {
      setTimeout(() => {
        this.animateScoreChange(changes, now);
      }, 10);
      return;
    }

    this.isAnimatingScore = false;
    this.updateScores(false);
  }

  private updateRemainingSticks(): void {
    this.remainingSticksDisplay.innerText = (
      (this.world.setup.getScores().remaining
        - 1000 * [...this.world.things.values()].filter(t => t.slot.name.startsWith("riichi")).length
      )
      / 1000 | 0
    ).toString();
  }

  private showRiichiNotification(seat: number): void {
    this.riichiNotifications.push(seat);

    if (this.riichiNotificationTimeout !== null) {
      return;
    }

    this.riichiNotificationTimeout = setTimeout(() => {
      this.processRiichiNotification();
    }, 0);
  }

  private processRiichiNotification(): void {
    this.riichiNotificationTimeout = null;
    const notification = this.riichiNotifications.shift();
    if (!notification) {
      return;
    }

    let delay = 3000;
    const playerName = this.riichiNotification.querySelector(".player-name") as HTMLDivElement;
    playerName.innerText = this.nicks[notification];
    if (playerName.innerText?.length !== 0) {
      setVisibility(this.riichiNotification, true);
    } else {
      delay = 0;
    }

    this.riichiNotificationTimeout = setTimeout(() => {
      setVisibility(this.riichiNotification, false);
      this.processRiichiNotification();
    }, delay);
  }

  private updateNicks(): void {
    for (let i = 0; i < 4; i++) {
      const playerId = this.client.seatPlayers[i];
      let nick = playerId !== null ? this.client.nicks.get(playerId) : null;
      if (nick === null) {
        nick = '';
      } else if (nick === '') {
        nick = 'Jyanshi';
      }

      if(this.nicks[i] === nick) {
        continue;
      }

      this.nicks[i] = nick;

      if (!this.isAnimatingScore) {
        this.playerNames[i].classList.remove("gain");
        this.playerNames[i].classList.remove("loss");
        this.playerNames[i].innerText = this.nicks[i];
      }
    }
  }

  private updateHonba(): void {
    this.honbaDisplay.innerText = (this.client.match.get(0)?.honba ?? 0).toString();
  }

  private updateSeatings(seat?: number): void {
    const marker = seat ?? [...this.world.things.values()].find(t => t.type === ThingType.MARKER)?.slot.seat;
    for (let i = 0; i < 4; i++){
      this.playerDisplays[i].classList.remove("push");
      if (i >= marker!) {
        this.playerDisplays[i].classList.add("push");
      }
    }
  }

  private updateDealer(): void {
    const dealer = this.client.match.get(0)?.dealer ?? null;
    for (let i = 0; i < 4; i++){
      this.playerDisplays[i].classList.remove("dealer");
      if (dealer === i) {
        this.playerDisplays[i].classList.add("dealer");
      }
    }
  }

  private updateRound(): void {
    const marker = [...this.world.things.values()].find(t => t.type === ThingType.MARKER);
    if (!marker) {
      return;
    }

    this.roundDisplay.innerText = marker.rotationIndex === 0 ? "東" : "南";
    const dealer = this.client.match.get(0)?.dealer ?? 0;
    this.roundDisplay.innerText += `${((4 + dealer - marker.slot.seat!) % 4) + 1}局`;
  }

  setEnabled(isEnabled: boolean): void {
    this.isEnabled = isEnabled;
    setVisibility(this.spectatorOverlay, this.isEnabled);
  }
}

export class GameUi {
  elements: {
    sidebarBody: HTMLDivElement;
    toggleSidebar: HTMLDivElement;
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
    removeSpectatorPassword: HTMLButtonElement;
    spectatorPassword: HTMLInputElement;
    spectate: HTMLButtonElement;
    stopSpectate: HTMLButtonElement;
    spectators: HTMLDivElement;

    viewTop: HTMLDivElement;
    viewDora: HTMLDivElement;
    viewAuto: HTMLDivElement;
    viewHand: Array<HTMLDivElement>;
    viewCalls: Array<HTMLDivElement>;
  }

  private isSpectating: boolean = false;
  private readonly spectatorOverlay: SpectatorOverlay;

  constructor(
    private readonly client: Client,
    private readonly world: World,
    private readonly mainView: MainView) {

    this.spectatorOverlay = new SpectatorOverlay(client, world);

    this.elements = {
      sidebarBody: document.getElementById('sidebar-body')! as HTMLDivElement,
      toggleSidebar: document.getElementById('toggle-sidebar')! as HTMLDivElement,
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
      removeSpectatorPassword: document.getElementById('remove-spectator-password') as HTMLButtonElement,
      spectatorPassword: document.getElementById('spectator-password') as HTMLInputElement,
      spectate: document.getElementById('spectate')! as HTMLButtonElement,
      stopSpectate: document.getElementById('stop-spectate')! as HTMLButtonElement,
      spectators: document.getElementById('spectators')! as HTMLDivElement,

      viewTop: document.getElementById('view-top')! as HTMLDivElement,
      viewDora: document.getElementById('view-dora')! as HTMLDivElement,
      viewAuto: document.getElementById('view-auto')! as HTMLDivElement,
      viewHand: [],
      viewCalls: [],
    };

    for (let i = 0; i < 4; i++) {
      this.elements.takeSeat.push(document.querySelector(`.seat-button-${i} button`) as HTMLButtonElement);
      this.elements.viewHand.push(document.querySelector(`.player-display [data-seat="${i}"] .hand`) as HTMLDivElement);
      this.elements.viewCalls.push(document.querySelector(`.player-display [data-seat="${i}"] .calls`) as HTMLDivElement);
    }

    this.elements.nick.value = localStorage.getItem("nick") ?? "";
    this.setupEvents();
    this.setupDealButton();
  }

  private trySetSpectating(isSpectating: boolean): void {
    this.client.auth(this.elements.spectatorPassword.value).then(isAuthed => {
      if (!isAuthed && this.client.spectators.options.writeProtected) {
        return;
      }
      const nick = this.elements.nick.value.length > 0 ? this.elements.nick.value : "不明";
      this.client.spectators.set(this.client.playerId(), isSpectating ? nick : null);
    });
  }

  private onNickChange(): void {
    const nick = this.elements.nick.value;
    localStorage.setItem("nick", nick);
    this.client.nicks.set(this.client.playerId(), nick);
  }

  private setupEvents(): void {
    this.elements.toggleDealer.onclick = () => this.world.toggleDealer();
    this.elements.toggleHonba.onclick = () => this.world.toggleHonba();

    this.client.spectators.on('optionsChanged', (options) => {
      this.elements.removeSpectatorPassword.innerText = `${options.writeProtected ? "Remove" : "Add"} Spectator Password`;
    });

    this.client.seats.on('update', this.updateSeats.bind(this));
    this.client.nicks.on('update', this.updateSeats.bind(this));
    this.client.spectators.on('update', (entries) => {
      const spectators = [...this.client.spectators.entries()].filter(([key, value]) => value !== null);
      setVisibility(this.elements.spectators, spectators.length > 0);
      for (const [key, value] of entries) {
        const element = document.querySelector(`[data-spectator-id='${key}']`)! as HTMLDivElement;
        if (value === null) {
          if (element) {
            element.remove();
          }
          continue;
        }

        if (element) {
          element.innerText = value;
          continue;
        }

        this.elements.spectators.insertAdjacentHTML("beforeend", `
          <div class="mt-2 badge badge-success w-100 py-2" data-spectator-id="${key}">${value}</div>
        `);
      }
      this.isSpectating = this.client.spectators.get(this.client.playerId()) !== null;
      this.spectatorOverlay.setEnabled(this.isSpectating);

      if (this.isSpectating) {
        this.mainView.setPerspective(true);
        this.mainView.spectateAuto();
      } else {
        this.mainView.spectateTop();
      }

      this.updateSeats();
    });

    this.client.on('connect', (_, __, password) => {
      if (!password) {
        return;
      }
      this.elements.spectatorPassword.value = password;
    });
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

    this.elements.toggleSidebar.onclick = () => {
      const isVisible = this.elements.sidebarBody.getAttribute("style")?.length! > 0;
      setVisibility(this.elements.sidebarBody, isVisible);
      this.elements.toggleSidebar.innerHTML = isVisible ? "&lsaquo;" : "&rsaquo;";
    };

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

    this.elements.viewDora.onclick = () => {
      this.mainView.spectateDora();
    };

    this.elements.nick.oninput = this.elements.nick.onchange = (event) => {
      this.onNickChange();
      if (!this.isSpectating) {
        return;
      }
      this.trySetSpectating(true);
    };

    this.elements.removeSpectatorPassword.onclick = () => {
      this.client.auth(this.elements.spectatorPassword.value).then(isAuthed => {
        if (!isAuthed) {
          return;
        }
        this.client.spectators.setOption("writeProtected", !(this.client.spectators.options.writeProtected ?? false));
      });
    };

    this.elements.spectate.onclick = this.trySetSpectating.bind(this, true);
    this.elements.stopSpectate.onclick = this.trySetSpectating.bind(this, false);

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

  private updateSeats(): void {
    const toDisable = [
      this.elements.deal,
      this.elements.toggleDealer,
      this.elements.toggleHonba,
      this.elements.toggleSetup,
    ];

    setVisibility(this.elements.spectate.parentElement!, !this.isSpectating && this.client.seat === null);
    setVisibility(this.elements.stopSpectate.parentElement!, this.isSpectating);
    setVisibility(this.elements.leaveSeat.parentElement!, this.client.seat !== null);
    for (const button of toDisable) {
      button.disabled = this.client.seat === null;
    }
    setVisibility(document.querySelector('.seat-buttons')! as HTMLElement, this.client.seat === null && !this.isSpectating);

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
