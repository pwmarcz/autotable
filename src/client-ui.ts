import qs from 'qs';

import { Client, Status } from "./client";


interface UrlState {
  gameId: string | null;
  num: number | null;
}


export class ClientUi {
  url: string;
  client: Client;
  nickElement: HTMLInputElement;
  statusElement: HTMLElement;

  success = false;

  constructor(client: Client) {
    this.url = this.getUrl();
    this.client = client;
    this.nickElement = document.getElementById('nick')! as HTMLInputElement;
    this.nickElement.value = localStorage.getItem('autotable.nick') ?? '';

    this.nickElement.onchange = this.onNickChange.bind(this);
    this.nickElement.oninput = this.onNickChange.bind(this);

    this.statusElement = document.getElementById('status')! as HTMLElement;
    this.client.on('status', this.onStatus.bind(this));
    this.onNickChange();

    const connectButton = document.getElementById('connect')!;
    connectButton.onclick = this.connect.bind(this);

    this.start();
  }

  getUrlState(): UrlState {
    const hash = window.location.search.substr(1);
    const q = qs.parse(hash) as any;
    return {
      gameId: q.gameId ?? null,
      num: q.num === undefined ? null : parseInt(q.num, 10),
    };
  }

  setUrlState(state: UrlState): void {
    const hash = window.location.search.substr(1);
    const q = qs.parse(hash) as any;
    q.gameId = state.gameId ?? undefined;
    q.num = state.num ?? undefined;
    history.replaceState(undefined, '', '?' + qs.stringify(q));
  }

  start(): void {
    const {gameId, num} = this.getUrlState();
    if (gameId !== null && num !== null) {
      const secret = localStorage.getItem(`autotable.secret.${gameId}.${num}`);
      if (secret) {
        this.success = false;
        this.client.rejoin(this.url, gameId, num, secret);
        return;
      }
    }
    if (gameId) {
      this.success = false;
      this.client.join(this.url, gameId, num ?? null);
    }
  }

  getUrl(): string {
    // @ts-ignore
    const env = process.env.NODE_ENV;

    if (env !== 'production') {
      return 'ws://localhost:1235';
    }

    let path = window.location.pathname;
    path = path.substring(1, path.lastIndexOf('/')+1);
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsPath = path + 'ws';
    return `${wsProtocol}//${wsHost}/${wsPath}`;
  }

  onNickChange(): void {
    this.client.updatePlayer({ nick: this.nickElement.value });
    localStorage.setItem('autotable.nick', this.nickElement.value);
  }

  onStatus(status: Status): void {
    this.statusElement.innerText = status.toLowerCase();

    switch (status) {
      case Status.NEW:
        this.statusElement.innerHTML = 'not connected';
        break;
      case Status.DISCONNECTED:
        this.statusElement.innerText = 'not connected';
        if (!this.success) {
          this.setUrlState({ gameId: null, num: null });
        }
        break;
      case Status.CONNECTING:
      case Status.JOINING:
        this.statusElement.innerText = 'connecting';
        break;
      case Status.JOINED: {
        this.success = true;
        const {num, gameId, secret} = this.client.game!;
        localStorage.setItem(`autotable.secret.${gameId}.${num}`, secret);
        this.setUrlState({gameId, num});
        break;
      }
    }
  }

  connect(): void {
    if (!(this.client.status() === Status.NEW ||
          this.client.status() === Status.DISCONNECTED)) {
      return;
    }

    this.success = false;
    this.client.new(this.url, null);
  }
}
