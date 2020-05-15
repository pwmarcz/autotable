/* eslint no-console: 0 */

import { EventEmitter, Listener } from 'events';

import { Message, Entry } from '../server/protocol';

export interface Game {
  gameId: string;
  num: number;
  secret: string;
}

export class BaseClient {
  private ws: WebSocket | null = null;
  private game: Game | null = null;
  private events: EventEmitter = new EventEmitter();
  private pending: Array<Entry> | null = null;

  constructor() {
    this.events.setMaxListeners(50);
  }

  new(url: string, num: number | null, numPlayers: number): void {
    this.connect(url, () => {
      this.send({ type: 'NEW', num, numPlayers});
    });
  }

  join(url: string, gameId: string, num: number | null): void {
    this.connect(url, () => {
      this.send({ type: 'JOIN', num, gameId });
    });
  }

  rejoin(url: string, gameId: string, num: number, secret: string): void {
    this.connect(url, () => {
      this.send({ type: 'REJOIN', num, gameId, secret });
    });
  }

  disconnect(): void {
    this.ws?.close();
  }

  private connect(url: string, start: () => void): void {
    if (this.ws) {
      return;
    }
    this.ws = new WebSocket(url);
    this.ws.onopen = start;
    this.ws.onclose = this.onClose.bind(this);

    this.ws.onmessage = event => {
      const message = JSON.parse(event.data as string) as Message;
      // console.log('recv', message);
      this.onMessage(message);
    };
  }

  on(what: 'connect', handler: (game: Game, isFirst: boolean) => void): void;
  on(what: 'disconnect', handler: () => void): void;
  on(what: 'update', handler: (things: Array<Entry>, full: boolean) => void): void;

  on(what: string, handler: Function): void {
    this.events.on(what, handler as Listener);
  }

  transaction(func: () => void): void {
    this.pending = [];
    try {
      func();
      if (this.pending !== null && this.pending.length > 0) {
        this.send({ type: 'UPDATE', entries: this.pending, full: false });
      }
    } finally {
      this.pending = null;
    }
  }

  update(entries: Array<Entry>): void {
    if (this.pending !== null) {
      this.pending.push(...entries);
    } else {
      this.send({ type: 'UPDATE', entries, full: false });
    }
  }

  private send(message: Message): void {
    if (!this.open) {
      return;
    }
    // console.log('send', message);
    const data = JSON.stringify(message);
    this.ws!.send(data);
  }

  private open(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  connected(): boolean {
    return this.open() && this.game !== null;
  }

  num(): number | undefined {
    return this.game?.num;
  }

  private onClose(): void {
    this.ws = null;
    this.game = null;
    this.events.emit('disconnect');
  }

  private onMessage(message: Message): void {
    switch (message.type) {
      case 'JOINED':
        this.game = {
          gameId: message.gameId,
          num: message.num,
          secret: message.secret,
        };
        this.events.emit('connect', this.game, message.isFirst);
        break;

      case 'UPDATE':
        this.events.emit('update', message.entries, message.full);
        break;
    }
  }
}
