/* eslint no-console: 0 */

import WebSocket from 'ws';

import { Message, Entry } from './protocol';

class Game {
  gameId: string;
  private secrets: Map<number, string> = new Map();
  private clients: Map<number, Client> = new Map();

  numPlayers: number;
  unique: Map<string, string> = new Map();

  private collections: Map<string, Map<string | number, any>> = new Map();

  constructor(gameId: string, numPlayers: number) {
    this.gameId = gameId;
    this.numPlayers = numPlayers;
  }

  setting(): any | undefined {
    this.collections.get('settings');
  }

  validateNum(num: number): void {
    if (!(num !== null && Number.isInteger(num) && 0 <= num && num < this.numPlayers)) {
      throw 'wrong player number';
    }
  }

  join(client: Client, num: number | null): void {
    if (num === null) {
      for (let i = 0; i < this.numPlayers; i++) {
        if (!this.secrets.has(i)) {
          num = i;
          break;
        }
      }

      if (num === null) {
        throw 'no free seats';
      }
    } else {
      this.validateNum(num);
      if (this.secrets.has(num)) {
        throw 'already taken';
      }
    }

    let secret: string;
    const secrets = [...this.secrets.values()];
    do {
      secret = randomString();
    } while (secrets.indexOf(secret) !== -1);
    this.secrets.set(num, secret);
    this.start(client, num);
  }

  rejoin(client: Client, num: number, secret: string): void {
    this.validateNum(num);
    if (!this.secrets.has(num) || this.secrets.get(num) !== secret) {
      throw 'wrong secret';
    }

    // Kick old client
    const oldClient = this.clients.get(num);
    if (oldClient) {
      oldClient.game = null;
      oldClient.close();
    }

    this.start(client, num);
  }

  private start(client: Client, num: number): void {
    this.clients.set(num, client);
    client.game = this;
    client.num = num;

    this.send(num, {
      type: 'JOINED',
      gameId: this.gameId,
      secret: this.secrets.get(num)!,
      num,
    });

    this.send(num, {type: 'UPDATE', entries: this.allEntries(), full: true });

    this.update([['online', num, true]]);
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
      let collection = this.collections.get(kind);
      if (!collection) {
        collection = new Map();
        this.collections.set(kind, collection);
      }
      collection.set(key, value);

      if (kind === 'unique') {
        this.unique.set(key as string, value);
      }
      if (kind === 'settings' && key === 'numPlayers') {
        this.numPlayers = value;
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

      const filtered = entries.filter(e => e[0] === kind);
      const occupied = new Set<any>();
      for (const item of collection.values()) {
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

  leave(num: number): void {
    this.clients.delete(num);
    this.update([['online', num, false]]);
  }

  private send(num: number, message: Message): void {
    const client = this.clients.get(num);
    if (client) {
      const data = JSON.stringify(message);
      console.log(`send ${this.gameId}.${num} ${data}`);
      client.send(data);
    }
  }

  private sendAll(message: Message): void {
    for (let i = 0; i < this.numPlayers; i++) {
      this.send(i, message);
    }
  }

  onMessage(num: number, message: Message): void {
    switch (message.type) {
      case 'UPDATE':
        this.update(message.entries);
        break;
    }
  }
}

type Client = WebSocket & {
  game: Game | null;
  num: number | null;
}

class Server {
  port: number;
  games: Record<string, Game> = {};

  constructor(port: number) {
    this.port = port;
  }

  run(): void {
    const wss = new WebSocket.Server({
      port: this.port,
    });

    wss.on("connection", ws => {
      const client = ws as Client;
      client.game = null;
      client.num = null;

      client.on('message', data => {
        if (client.game !== null) {
          console.log(`recv ${client.game.gameId}.${client.num} ${data}`);
        } else {
          console.log(`recv * ${data}`);
        }

        const message = JSON.parse(data as string) as Message;

        try {
          this.onMessage(client, message);
        } catch(err) {
          console.error(err);
          client.close();
          this.onClose(client);
        }
      });

      client.on('close', (code, reason) => {
        console.log('> disconnect');
        this.onClose(client);
      });
    });
  }

  onMessage(client: Client, message: Message): void {
    if (client.game) {
      client.game.onMessage(client.num!, message);
      return;
    }

    switch(message.type) {
      case 'NEW': {
        let gameId: string;
        do {
          gameId = randomString();
        } while (this.games[gameId] !== undefined);

        const game = new Game(gameId, message.numPlayers);
        this.games[gameId] = game;
        game.join(client, message.num);
        break;
      }

      case 'JOIN': {
        const game = this.games[message.gameId];
        if (!game) {
          throw `game not found: ${message.gameId}`;
        }
        game.join(client, message.num);
        break;
      }

      case 'REJOIN': {
        const game = this.games[message.gameId];
        if (!game) {
          throw `game not found: ${message.gameId}`;
        }
        game.rejoin(client, message.num, message.secret);
        break;
      }
      default:
        throw `unknown message: ${message.type}`;
    }
  }

  onClose(client: Client): void {
    if (client.game !== null) {
      client.game.leave(client.num!);
    }
  }
}

function randomString(): string {
  const hex = '0123456789ABCDEFGJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += hex.charAt(Math.floor(Math.random() * hex.length));
  }
  return result;
}


function testPlayer(num: number, gameId: string | null): void {
  const ws = new WebSocket('ws://localhost:1235', {
    perMessageDeflate: false
  });

  const send = (message: Message): void => {
    ws.send(JSON.stringify(message));
  };

  ws.on('open', () => {
    ws.on('message', data => {
      const message = JSON.parse(data as string) as Message;
      if (message.type === 'JOINED' && num+1 < 4) {
        testPlayer(num+1, message.gameId);
      }
    });
    ws.on('close', data => console.log('test close'));

    if (gameId === null) {
      send({type: 'NEW', num, numPlayers: 4});
    } else {
      send({type: 'JOIN', gameId, num});
    }
    send({
      type: 'UPDATE',
      entries: [['player', num, `This is player ${num}`]],
      full: false,
    });
    setTimeout(() => ws.close(), 500);
  });
}

if (0) {
  testPlayer(0, null);
  setTimeout(() => process.exit(), 1000);
}

new Server(1235).run();
