/* eslint no-console: 0 */

import { EventEmitter } from 'events';

import { Entry } from '../server/protocol';

import { BaseClient, Game } from './base-client';
import { ThingInfo, MatchInfo, MouseInfo, SoundInfo, SeatInfo } from './types';


export class Client extends BaseClient {
  match: Collection<number, MatchInfo>;
  seats: Collection<string, SeatInfo>;
  things: Collection<number, ThingInfo>;
  nicks: Collection<string, string>;
  mouse: Collection<string, MouseInfo>;
  sound: Collection<number, SoundInfo>;

  seat: number | null = 0;
  seatPlayers: Array<string | null> = new Array(4).fill(null);

  constructor() {
    super();

    // Make sure match is first, as it triggers reorganization of slots and things.
    this.match = new Collection('match', this, { sendOnConnect: true }),

    this.seats = new Collection('seats', this, { unique: 'seat', perPlayer: true });
    this.things = new Collection('things', this, { unique: 'slotName', sendOnConnect: true });
    this.nicks = new Collection('nicks', this, { perPlayer: true });
    this.mouse = new Collection('mouse', this, { rateLimit: 100, perPlayer: true });
    this.sound = new Collection('sound', this, { ephemeral: true });
    this.seats.on('update', this.onSeats.bind(this));
  }

  private onSeats(): void {
    this.seat = null;
    this.seatPlayers.fill(null);
    for (const [playerId, seatInfo] of this.seats.entries()) {
      if (playerId === this.playerId()) {
        this.seat = seatInfo.seat;
      }
      if (seatInfo.seat !== null) {
        this.seatPlayers[seatInfo.seat] = playerId;
      }
    }
  }
}

interface CollectionOptions {
  // Key that has to be kept unique. Enforced by the server.
  // For example, for 'things', the unique key is 'slotName', and if you
  // attempt to store two things with the same slots, server will reject the
  // update.
  unique?: string;

  // Updates will be sent to other players, but not stored on the server (new
  // will not receive them on connection).
  ephemeral?: boolean;

  // This is a collection indexed by player ID, and values will be deleted
  // when a player disconnect.
  perPlayer?: boolean;

  // The server will not send all updates, but limit to N per second.
  rateLimit?: number;

  // If we are initializing the server (i.e. we're the first player), send
  // our value.
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

  entries(): Iterable<[K, V]> {
    return this.map.entries();
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
  on(what: string, handler: (...args: any[]) => void): void {
    this.events.on(what, handler);
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

  private onDisconnect(game: Game | null): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (game && this.options.perPlayer) {
      const localEntries: Array<Entry> = [];
      for (const [key, value] of this.map.entries()) {
        localEntries.push([this.kind, key, null]);
        if (key === game.playerId) {
          localEntries.push([this.kind, 'offline', value]);
        }
      }
      this.onUpdate(localEntries, true);
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
