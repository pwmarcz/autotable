/* eslint no-console: 0 */

import WebSocket from 'ws';

import { Message, Player, Thing } from './protocol';

const PLAYERS = 4;


class Game {
  gameId: string;
  secrets: Array<string | null>;
  clients: Array<Client | null>;

  players: Array<Player | null>;
  things: Array<Thing | null>;

  constructor(gameId: string) {
    this.gameId = gameId;
    this.secrets = [];
    this.clients = [];
    this.players = [];
    this.things = [];
    for (let i = 0; i < PLAYERS; i++) {
      this.secrets[i] = null;
      this.clients[i] = null;
      this.players[i] = null;
    }
  }

  join(client: Client, num: number | null): void {
    if (num === null) {
      for (let i = 0; i < PLAYERS; i++) {
        if (this.secrets[i] === null) {
          num = i;
          break;
        }
      }

      if (num === null) {
        throw 'no free seats';
      }
    }

    if (this.secrets[num] !== null) {
      throw 'already taken';
    }

    let secret: string;
    do {
      secret = randomString();
    } while (this.secrets.indexOf(secret) !== -1);
    this.secrets[num] = secret;

    this.start(client, num);
  }

  rejoin(client: Client, num: number, secret: string): void {
    if (this.secrets[num] !== secret) {
      throw 'wrong secret';
    }

    // Kick old client
    const oldClient = this.clients[num];
    if (oldClient) {
      oldClient.game = null;
      oldClient.close();
    }

    this.start(client, num);
  }

  start(client: Client, num: number): void {
    this.clients[num] = client;
    client.game = this;
    client.num = num;

    this.send(num, {
      type: 'JOINED',
      gameId: this.gameId,
      secret: this.secrets[num]!,
      num,
    });
    this.send(num, {
      type: 'REPLACE',
      allThings: this.things,
    });

    for (let i = 0; i < 4; i++) {
      this.send(num, {
        'type': 'PLAYER',
        num: i,
        player: this.players[i],
      });
    }
  }

  leave(num: number): void {
    this.clients[num] = null;
    this.players[num] = null;
    this.sendAll({ type: 'PLAYER', num, player: null});
  }

  send(num: number, message: Message): void {
    const client = this.clients[num];
    if (client !== null) {
      const data = JSON.stringify(message);
      console.log(`send ${this.gameId}.${num} ${data}`);
      client.send(data);
    }
  }

  sendAll(message: Message): void {
    for (let i = 0; i < PLAYERS; i++) {
      this.send(i, message);
    }
  }

  sendOthers(num: number, message: Message): void {
    for (let i = 0; i < PLAYERS; i++) {
      if (i !== num) {
        this.send(i, message);
      }
    }
  }

  onMessage(num: number, message: Message): void {
    switch (message.type) {
      case 'PLAYER':
        if (num !== message.num) {
          throw 'wrong player num';
        }
        this.players[num] = message.player;
        this.sendAll(message);
        break;
      case 'UPDATE':
        for (const thingIndex in message.things) {
          this.things[thingIndex] = message.things[thingIndex];
        }
        this.sendAll(message);
        break;
      case 'REPLACE':
        this.things = message.allThings;
        this.sendAll(message);
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

        const game = new Game(gameId);
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
      }
      default:
        throw 'unknown message';
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
      if (message.type === 'JOINED' && num+1 < PLAYERS) {
        testPlayer(num+1, message.gameId);
      }
    });
    ws.on('close', data => console.log('test close'));

    if (gameId === null) {
      send({type: 'NEW', num});
    } else {
      send({type: 'JOIN', gameId, num});
    }
    send({
      type: 'PLAYER',
      num,
      player: `This is player ${num}`
    });

    if (num === 3) {
      send({
        type: 'REPLACE',
        allThings: ['foo', 'bar', 'baz', 'quux'],
      });
    }
  });
}

if (0) testPlayer(0, null);

new Server(1235).run();
