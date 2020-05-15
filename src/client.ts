/* eslint no-console: 0 */

import { EventEmitter, Listener } from 'events';

import { Entry } from '../server/protocol';

import { BaseClient, Game } from './base-client';
import { ThingInfo, MatchInfo, MouseInfo, SoundInfo } from './types';


export class Client extends BaseClient {
  things: Collection<number, ThingInfo>;
  match: Collection<number, MatchInfo>;
  nicks: Collection<number, string>;
  mouse: Collection<number, MouseInfo>;
  sound: Collection<number, SoundInfo>;

  constructor() {
    super();
    this.things = new Collection('things', this, { unique: 'slotName', sendOnConnect: true });
    this.match = new Collection('match', this, { sendOnConnect: true }),
    this.nicks = new Collection('nicks', this, { perPlayer: true });
    this.mouse = new Collection('mouse', this, { rateLimit: 100, perPlayer: true });
    this.sound = new Collection('sound', this, { ephemeral: true });
  }
}

interface CollectionOptions {
  unique?: string;
  ephemeral?: boolean;
  perPlayer?: boolean;

  rateLimit?: number;
  sendOnConnect?: boolean;
}

export class Collection<K extends string | number, V> {
  private kind: string;
  private client: Client;
  private map: Map<K, V> = new Map();
  private pending: Map<K, V | null> = new Map();
  private events: EventEmitter = new EventEmitter();
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

  get(key: K): V | null {
    return this.map.get(key) ?? null;
  }

  update(localEntries: Array<[K, V | null]>): void {
    if (!this.client.connected()) {
      for (const [key, value] of localEntries) {
        if (value !== null) {
          this.map.set(key, value);
        } else {
          this.map.delete(key);
        }
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

  set(key: K, value: V | null): void {
    this.update([[key, value]]);
  }

  on(what: 'update', handler: (localEntries: Array<[K, V | null]>, full: boolean) => void): void;
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
        if (value !== null) {
          this.map.set(key as K, value);
        } else {
          this.map.delete(key as K);
        }
      }
    }
    if (full || localEntries.length > 0) {
      console.log(full ? 'full update' : 'update', this.kind, localEntries.length);
      this.events.emit('update', localEntries, full);
    }
  }

  private onConnect(game: Game, isFirst: boolean): void {
    if (isFirst) {
      if (this.options.unique) {
        this.client.update([['unique', this.kind, this.options.unique]]);
      }
      if (this.options.ephemeral) {
        this.client.update([['ephemeral', this.kind, true]]);
      }
      if (this.options.perPlayer) {
        this.client.update([['perPlayer', this.kind, true]]);
      }
      if (this.options.sendOnConnect) {
        const entries: Array<Entry> = [];
        for (const [key, value] of this.map.entries()) {
          entries.push([this.kind, key, value]);
        }
        this.client.update(entries);
      }
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
