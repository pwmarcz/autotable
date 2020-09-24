import { Client } from "./client";
import { World } from "./world";
import { ThingType } from './types';
import { setVisibility } from './game-ui';

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
          } else if (x < 4) {
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

      if (this.scoreChanges.findIndex(s => s) === -1) {
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
      }, sticksLeft ? 10000 : 5000);
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

      nick = nick.substr(0, 14);

      if (this.nicks[i] === nick) {
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
    for (let i = 0; i < 4; i++) {
      this.playerDisplays[i].classList.remove("push");
      if (i >= marker!) {
        this.playerDisplays[i].classList.add("push");
      }
    }
  }

  private updateDealer(): void {
    const dealer = this.client.match.get(0)?.dealer ?? null;
    for (let i = 0; i < 4; i++) {
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
