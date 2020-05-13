/* eslint no-console: 0 */

import { EventEmitter, Listener } from 'events';

import { Message, Entry } from '../server/protocol';

export interface Game {
  gameId: string;
  num: number;
  secret: string;
}

export class Client {
  private ws: WebSocket | null = null;
  private game: Game | null = null;
  private events: EventEmitter = new EventEmitter();
  private collections: Record<string, Collection<any, any>>;
  private pending: Array<Entry> | null = null;

  constructor() {
    this.collections = {
      things: new Collection('things', this, { unique: 'slotName' }),
      nicks: new Collection('nicks', this),
      mouse: new Collection('mouse', this, { rateLimit: 100 }),
      online: new Collection('online', this),
      match: new Collection('match', this),
      sound: new Collection('sound', this, { ephemeral: true }),
    };
    this.events.setMaxListeners(50);
  }

  collection<K extends string | number, V>(name: string): Collection<K, V> {
    return this.collections[name];
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

interface CollectionOptions {
  rateLimit?: number;
  unique?: string;
  ephemeral?: boolean;
}

export class Collection<K extends string | number, V> {
  private kind: string;
  private client: Client;
  private map: Map<K, V> = new Map();
  private pending: Map<K, V> = new Map();
  private events: EventEmitter = new EventEmitter;
  private options: CollectionOptions;
  private intervalId: number | null = null;
  private lastUpdate: number = 0;

  constructor(
    kind: string,
    client: Client,
    options?: CollectionOptions) {

    this.kind = kind;
    this.client = client;
    this.options = options ?? {};

    this.client.on('update', this.onUpdate.bind(this));
    this.client.on('connect', this.onConnect.bind(this));
    this.client.on('disconnect', this.onDisconnect.bind(this));
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  update(localEntries: Array<[K, V]>): void {

    if (!this.client.connected()) {
      for (const [key, value] of localEntries) {
        this.map.set(key, value);
      }
      this.events.emit('update', localEntries, false);
    } else {
      const now = new Date().getTime();
      for (const [key, value] of localEntries) {
        this.pending.set(key, value);
      }
      if (!this.options.rateLimit || now > this.lastUpdate + this.options.rateLimit) {
        this.sendPending();
      }
    }
  }

  set(key: K, value: V): void {
    this.update([[key, value]]);
  }

  on(what: 'update', handler: (localEntries: Array<[K, V]>, full: boolean) => void): void;
  on(what: string, handler: Function): void {
    this.events.on(what, handler as Listener);
  }

  private onUpdate(entries: Array<Entry>, full: boolean): void {
    if (full) {
      this.map.clear();
    }
    const localEntries = [];
    for (const [kind, key, value] of entries) {
      if (kind === this.kind) {
        localEntries.push([key, value]);
        this.map.set(key as K, value);
      }
    }
    if (full || localEntries.length > 0) {
      console.log(full ? 'full update' : 'update', this.kind, localEntries.length);
      this.events.emit('update', localEntries, full);
    }
  }

  private onConnect(game: Game, isFirst: boolean): void {
    if (isFirst && this.options.unique) {
      this.client.update([['unique', this.kind, this.options.unique]]);
    }
    if (isFirst && this.options.ephemeral) {
      this.client.update([['ephemeral', this.kind, true]]);
    }
    if (this.options.rateLimit) {
      this.intervalId = setInterval(this.sendPending.bind(this), this.options.rateLimit);
    }
  }

  private onDisconnect(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private sendPending(): void {
    if (this.pending.size > 0) {
      const entries: Array<Entry> = [];
      for (const [k, v] of this.pending.entries()) {
        entries.push([this.kind, k, v]);
      }
      this.client.update(entries);
      this.lastUpdate = new Date().getTime();
      this.pending.clear();
    }
  }
}
