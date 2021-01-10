/* eslint no-console: 0 */

import WebSocket from 'ws';
import { Client, Game, randomString } from './game';
import { Message } from './protocol';

type WebSocketClient = WebSocket & Client;

export class Server {
  port: number;
  games: Map<string, Game> = new Map();

  constructor(port: number) {
    this.port = port;
  }

  run(): void {
    const wss = new WebSocket.Server({
      port: this.port,
    });

    wss.on("connection", ws => {
      const client = ws as WebSocketClient;
      client.game = null;
      client.playerId = null;

      client.on('message', data => {
        if (client.game !== null) {
          console.debug(`recv ${client.game.gameId}.${client.playerId} ${data}`);
        } else {
          console.debug(`recv * ${data}`);
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

      client.on('error', (e) => {
        console.debug('> error', e);
        this.onClose(client);
      });

      client.on('close', () => {
        console.debug('> disconnect');
        this.onClose(client);
      });
    });

    setInterval(this.checkExpiry.bind(this), 5000);

    console.log(`listening at ${this.port}`);
  }

  onMessage(client: Client, message: Message): void {
    if (client.game) {
      client.game.onMessage(client, message);
      return;
    }

    switch(message.type) {
      case 'NEW': {
        let gameId: string;
        do {
          gameId = randomString();
        } while (this.games.has(gameId));

        const game = new Game(gameId);
        this.games.set(gameId, game);
        game.join(client);
        break;
      }

      case 'JOIN': {
        let game = this.games.get(message.gameId);
        if (!game) {
          console.warn(`game not found, creating: ${message.gameId}`);
          game = new Game(message.gameId);
          this.games.set(message.gameId, game);
        }
        game.join(client);
        break;
      }

      default:
        throw `unknown message: ${message.type}`;
    }
  }

  onClose(client: Client): void {
    if (client.game !== null) {
      client.game.leave(client);
    }
  }

  checkExpiry(): void {
    const now = new Date().getTime();
    for (const [gameId, game] of this.games.entries()) {
      if (game.expiryTime !== null && game.expiryTime < now) {
        console.log(`deleting expired: ${gameId}`);
        this.games.delete(gameId);
      }
    }
  }
}
