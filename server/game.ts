/* eslint no-console: 0 */

import { Message, Entry } from './protocol';

export type Client = {
  game: Game | null;
  isAuthed: boolean;
  playerId: string | null;
  send(data: string): void;
}

const MAX_PLAYERS = 8;

const EXPIRY_HOURS = 2;
const EXPIRY_TIME = EXPIRY_HOURS * 60 * 60 * 1000;

export class Game {
  password: string;
  expiryTime: number | null;
  private starting: boolean = true;
  private clients: Map<string, Client> = new Map();

  private unique: Map<string, string> = new Map();
  private ephemeral: Map<string, boolean> = new Map();
  private writeProtected: Map<string, boolean> = new Map();
  private perPlayer: Map<string, boolean> = new Map();

  private collections: Map<string, Map<string | number, any>> = new Map();

  constructor(public readonly gameId: string) {
    this.password = randomString();
    console.log(`new game: ${this.gameId}, password: ${this.password}`);
    this.expiryTime = new Date().getTime() + EXPIRY_TIME;
  }

  join(client: Client): void {
    if (this.clients.size >= MAX_PLAYERS) {
      throw 'too many players';
    }

    let playerId: string;
    do {
      playerId = randomString();
    } while (this.clients.has(playerId));
    this.clients.set(playerId, client);
    client.playerId = playerId;
    client.game = this;
    client.isAuthed = this.starting;

    console.log(`${this.gameId}: join: ${playerId}`);

    this.send(client, {
      type: 'JOINED',
      gameId: this.gameId,
      playerId,
      isFirst: this.starting,
      password: this.starting ? this.password : undefined,
    });
    this.starting = false;
    this.expiryTime = null;

    this.send(client, {type: 'UPDATE', entries: this.allEntries(), full: true });
  }

  private allEntries(): Array<Entry> {
    const entries: Array<Entry> = [];
    for (const [kind, collection] of this.collections.entries()) {
      for (const [key, value] of collection.entries()) {
        entries.push([kind, key, value]);
      }
    }

    for (const [kind, value] of this.writeProtected.entries()) {
      entries.push(["writeProtected", kind, value]);
    }

    return entries;
  }

  private isAuthed(playerId: string | null): boolean {
    return playerId !== null && this.clients.get(playerId)?.isAuthed === true;
  }

  private update(entries: Array<Entry>, senderId: string | null): void {
    if (!this.checkUnique(entries)) {
      this.sendAll({type: 'UPDATE', entries: this.allEntries(), full: true});
      return;
    }

    const sendToAll: Array<Entry> = [];
    const sendToOthers: Array<Entry> = [];

    for (const [kind, key, value] of entries) {
      if (this.writeProtected.get(kind)){
        if (!this.isAuthed(senderId)) {
          continue;
        }
        sendToAll.push([kind, key, value]);
      } else {
        sendToOthers.push([kind, key, value]);
      }

      if (this.ephemeral.get(kind)) {
        continue;
      }

      if (kind === 'unique') {
        this.unique.set(key as string, value);
        continue;
      }

      if (kind === 'ephemeral') {
        this.ephemeral.set(key as string, value);
        continue;
      }

      if (kind === 'perPlayer') {
        this.perPlayer.set(key as string, value);
        continue;
      }

      if (kind === 'writeProtected' && this.isAuthed(senderId)) {
        this.writeProtected.set(key as string, value);
        continue;
      }

      let collection = this.collections.get(kind);
      if (!collection) {
        collection = new Map();
        this.collections.set(kind, collection);
      }
      if (value !== null) {
        collection.set(key, value);
      } else {
        collection.delete(key);
      }
    }

    if (sendToOthers.length > 0) {
      const message: Message = {type: 'UPDATE', entries: sendToOthers, full: false};
      this.sendAll(message, [senderId]);
    }

    if (sendToAll.length > 0) {
      const message: Message = {type: 'UPDATE', entries: sendToAll, full: false};
      this.sendAll(message);
    }
  }

  private checkUnique(entries: Array<Entry>): boolean {
    for (const [kind, field] of this.unique.entries()) {
      const collection = this.collections.get(kind);
      if (!collection) {
        continue;
      }

      const filtered = entries.filter(e => e[0] === kind);
      const occupied = new Set<any>();
      for (const item of collection.values()) {
        if (item === null) {
          continue;
        }
        const value = item[field];
        if (value !== null && value !== undefined) {
          occupied.add(value);
        }
      }

      for (const [, key, ] of filtered) {
        const item = collection.get(key);
        if (!item) {
          continue;
        }
        const value = item[field];
        if (value !== null && value !== undefined) {
          occupied.delete(value);
        }
      }

      for (const [, , item] of filtered) {
        if (item === null) {
          continue;
        }
        const value = item[field];
        if (value !== null && value !== undefined) {
          if (occupied.has(value)) {
            console.log(`conflict on ${kind}, ${field} = ${value}`);
            return false;
          }
          occupied.add(value);
        }
      }
    }
    return true;
  }

  leave(client: Client): void {
    console.log(`${this.gameId}: leave: ${client.playerId}`);

    this.clients.delete(client.playerId!);
    const toUpdate: Array<Entry> = [];
    for (const [kind, isPerPlayer] of this.perPlayer.entries()) {
      const collection = this.collections.get(kind);
      if (isPerPlayer && collection) {
        for (const key of collection.keys()) {
          if (key === client.playerId) {
            toUpdate.push([kind, key, null]);
          }
        }
      }
    }
    if (toUpdate.length > 0) {
      this.update(toUpdate, client.playerId);
    }
    if (this.clients.size === 0) {
      this.expiryTime = new Date().getTime() + EXPIRY_TIME;
    }
  }

  private send(client: Client, message: Message): void {
    const data = JSON.stringify(message);
    console.debug(`send ${this.gameId}.${client.playerId} ${data}`);
    client.send(data);
  }

  private sendAll(message: Message, blacklist: Array<string|null> = []): void {
    for (const client of this.clients.values()) {
      if (client.playerId !== null && blacklist.indexOf(client.playerId) >= 0) {
        continue;
      }
      this.send(client, message);
    }
  }

  onMessage(client: Client, message: Message): void {
    switch (message.type) {
      case 'UPDATE':
        this.update(message.entries, client.playerId);
        break;

      case 'AUTH': {
        client.isAuthed = message.password === client.game?.password;
        this.send(client, {
          type: 'AUTHED',
          isAuthed: client.isAuthed,
        });
        break;
      }
    }
  }
}

export function randomString(): string {
  const hex = '0123456789ABCDEFGJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += hex.charAt(Math.floor(Math.random() * hex.length));
  }
  return result;
}
