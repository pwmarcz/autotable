/* eslint no-console: 0 */

import WebSocket from 'ws';
import { Client, Game, randomString } from './game';
import { Message } from './protocol';

type WebSocketClient = WebSocket & Client;

export class Server {
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
      const client = ws as WebSocketClient;
      client.game = null;
      client.playerId = null;

      client.on('message', data => {
        if (client.game !== null) {
          console.log(`recv ${client.game.gameId}.${client.playerId} ${data}`);
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

      client.on('close', () => {
        console.log('> disconnect');
        this.onClose(client);
      });
    });

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
        } while (this.games[gameId] !== undefined);

        const game = new Game(gameId);
        this.games[gameId] = game;
        game.join(client);
        break;
      }

      case 'JOIN': {
        const game = this.games[message.gameId];
        if (!game) {
          throw `game not found: ${message.gameId}`;
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
}
