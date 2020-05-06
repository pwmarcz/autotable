/* eslint no-console: 0 */

type NetPlayer = any & {
  nick: string;
}

interface Game {
  gameId: string;
  num: string;
  secret: string;
  players: Array<NetPlayer>;
}

export class Client {
  url: string;
  ws: WebSocket | null = null;

  nickElement: HTMLInputElement;
  statusElement: HTMLElement;

  game: Game | null = null;

  player: NetPlayer = { nick: '' };

  constructor(url: string) {
    this.url = url;

    this.nickElement = document.getElementById('nick')! as HTMLInputElement;
    this.statusElement = document.getElementById('status')!;

    this.nickElement.onchange = this.onNickChange.bind(this);
    this.nickElement.oninput = this.onNickChange.bind(this);

    this.onNickChange();

    const connectButton = document.getElementById('connect')!;
    connectButton.addEventListener('click', this.connect.bind(this));
  }

  onNickChange(): void {
    this.player.nick = this.nickElement.value;
    this.sendPlayer();
  }

  status(s: string): void {
    this.statusElement.innerText = s;
  }

  connect(): void {
    if (this.ws !== null) {
      return;
    }

    this.status('connecting...');

    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.status('connected');
      this.onOpen();
    };

    this.ws.onclose = () => {
      this.status('disconnected');

      if (this.game === null) {
        window.location.hash = '';
      }
      this.ws = null;
      this.game = null;
    };

    this.ws.onmessage = event => {
      const message: any = JSON.parse(event.data as string);
      console.log('recv', message);
      this.onMessage(message);
    };
  }

  send(message: any): void {
    if (!this.connected()) {
      return;
    }
    console.log('send', message);
    const data = JSON.stringify(message);
    this.ws!.send(data);
  }

  connected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getNicks(): Array<string> {
    if (this.game) {
      return this.game.players.map(player => {
        if (player === null) {
          return '';
        }
        if (player.nick === '') {
          return 'Player';
        }
        return player.nick;
      });
    } else {
      return ['', '', '', ''];
    }
  }

  sendPlayer(): void {
    if (this.connected() && this.game) {
      this.send({
        type: 'PLAYER',
        num: this.game.num,
        player: this.player,
      });
    }
  }

  onOpen(): void {
    const gameId = window.location.hash.substr(1) || null;

    this.send({
      type: 'JOIN',
      gameId,
      secret: null,
    });
  }

  onMessage(message: any): void {
    switch (message.type) {
      case 'JOINED':
        this.game = {
          gameId: message.gameId,
          num: message.num,
          secret: message.secret,
          players: new Array(4).fill(null),
        };
        window.location.hash = this.game.gameId;
        this.sendPlayer();
        break;

      case 'PLAYER':
        this.game!.players[message.num] = message.player;
    }
  }
}
