/* eslint no-console: 0 */

import { Message, Entry } from './protocol';

export type Client = {
  game: Game | null;
  playerId: string | null;
  send(data: string): void;
}

const MAX_PLAYERS = 8;

export class Game {
  gameId: string;
  private starting: boolean = true;
  private clients: Map<string, Client> = new Map();

  unique: Map<string, string> = new Map();
  ephemeral: Map<string, boolean> = new Map();
  perPlayer: Map<string, boolean> = new Map();

  private collections: Map<string, Map<string | number, any>> = new Map();

  constructor(gameId: string) {
    this.gameId = gameId;
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

    this.send(client, {
      type: 'JOINED',
      gameId: this.gameId,
      playerId,
      isFirst: this.starting,
    });
    this.starting = false;

    this.send(client, {type: 'UPDATE', entries: this.allEntries(), full: true });
  }

  private allEntries(): Array<Entry> {
    const entries: Array<Entry> = [];
    for (const [kind, collection] of this.collections.entries()) {
      for (const [key, value] of collection.entries()) {
        entries.push([kind, key, value]);
      }
    }
    return entries;
  }

  private update(entries: Array<Entry>): void {
    if (!this.checkUnique(entries)) {
      this.sendAll({type: 'UPDATE', entries: this.allEntries(), full: true});
      return;
    }

    for (const [kind, key, value] of entries) {
      if (!this.ephemeral.get(kind)) {
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

      if (kind === 'unique') {
        this.unique.set(key as string, value);
      }
      if (kind === 'ephemeral') {
        this.ephemeral.set(key as string, value);
      }
      if (kind === 'perPlayer') {
        this.perPlayer.set(key as string, value);
      }
    }
    this.sendAll({type: 'UPDATE', entries, full: false});
  }

  private checkUnique(entries: Array<Entry>): boolean {
    for (const [kind, field] of this.unique.entries()) {
      const collection = this.collections.get(kind);
      if (!collection) {
        continue;
      }

      const filtered = entries.filter(e => e[0] === kind && e[2] !== null);
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
      this.update(toUpdate);
    }
  }

  private send(client: Client, message: Message): void {
    const data = JSON.stringify(message);
    console.log(`send ${this.gameId}.${client.playerId} ${data}`);
    client.send(data);
  }

  private sendAll(message: Message): void {
    for (const client of this.clients.values()) {
      this.send(client, message);
    }
  }

  onMessage(client: Client, message: Message): void {
    switch (message.type) {
      case 'UPDATE':
        this.update(message.entries);
        break;
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
