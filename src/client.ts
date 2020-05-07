/* eslint no-console: 0 */

import { Message, Player } from '../server/protocol';

interface Game {
  gameId: string;
  num: number;
  secret: string;
  players: Array<Player | null>;
}

export enum Status {
  NEW = 'NEW',
  CONNECTING = 'CONNECTING',
  JOINING = 'JOINING',
  JOINED = 'JOINED',
  DISCONNECTED = 'DISCONNECTED',
}

export class Client {
  private ws: WebSocket | null = null;
  game: Game | null = null;
  private joinGameId: string | null = null;
  private joinSecret: string | null = null;

  player: Player = {};

  handlers: Record<string, Array<Function>> = {};

  connect(url: string, gameId: string | null, secret: string | null): void {
    if (this.isConnected()) {
      return;
    }
    this.ws = new WebSocket(url);
    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onclose = this.onClose.bind(this);

    this.joinGameId = gameId;
    this.joinSecret = secret;

    this.ws.onmessage = event => {
      const message = JSON.parse(event.data as string) as Message;
      console.log('recv', message);
      this.onMessage(message);
    };

    this.event('status', f => f(this.status()));
  }

  on(what: 'status', handler: (status: Status) => void): void;
  on<T>(what: 'players', handler: (players: Array<T | null>) => void): void;

  on(what: string, handler: Function): void {
    if (this.handlers[what] === undefined) {
      this.handlers[what] = [];
    }
    this.handlers[what].push(handler);

    if (what === 'status') {
      handler(this.status());
    }
    if (what === 'players') {
      handler(this.players());
    }
  }

  private event(what: string, func: (handler: Function) => void): void {
    if (this.handlers[what] !== undefined) {
      for (const handler of this.handlers[what]) {
        func(handler);
      }
    }
  }

  status(): Status {
    if (!this.ws) {
      return Status.NEW;
    }

    if (this.isConnected() && this.game) {
      return Status.JOINED;
    }
    if (this.isConnected()) {
      return Status.JOINING;
    }
    if (this.ws.readyState === WebSocket.OPEN) {
      return Status.CONNECTING;
    }
    return Status.DISCONNECTED;
  }

  players(): Array<Player> {
    return this.game ? this.game.players : new Array(4).fill(null);
  }

  updatePlayer<T>(player: T): void {
    Object.assign(this.player, player);
    this.sendPlayer();
  }

  private send(message: any): void {
    if (!this.isConnected()) {
      return;
    }
    console.log('send', message);
    const data = JSON.stringify(message);
    this.ws!.send(data);
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private sendPlayer(): void {
    if (this.isConnected() && this.game) {
      this.send({
        type: 'PLAYER',
        num: this.game.num,
        player: this.player,
      });
    }
  }

  private onOpen(): void {
    this.send({
      type: 'JOIN',
      gameId: this.joinGameId,
      secret: this.joinSecret,
    });
    this.event('status', f => f(this.status()));
  }

  private onClose(): void {
    this.game = null;

    this.event('status', f => f(this.status()));
    this.event('players', f => f(this.players()));
  }

  private onMessage(message: Message): void {
    switch (message.type) {
      case 'JOINED':
        this.game = {
          gameId: message.gameId,
          num: message.num,
          secret: message.secret,
          players: new Array(4).fill(null),
        };
        window.location.hash = this.game.gameId;
        this.sendPlayer();
        this.event('status', f => f(this.status()));
        break;

      case 'PLAYER':
        this.game!.players[message.num] = message.player;
        this.event('players', f => f(this.players()));
        break;
    }
  }
}
