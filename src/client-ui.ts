import qs from 'qs';

import { Client } from "./client";
import { Game } from './base-client';

interface UrlState {
  gameId: string | null;
  num: number | null;
  secret: string | null;
}


const TITLE_DISCONNECTED = 'Autotable';
const TITLE_CONNECTED = 'Autotable (online)';


export class ClientUi {
  url: string;
  client: Client;
  nickElement: HTMLInputElement;

  success = false;

  constructor(client: Client) {
    this.url = this.getUrl();
    this.client = client;

    this.nickElement = document.getElementById('nick')! as HTMLInputElement;
    this.nickElement.value = localStorage.getItem('autotable.nick') ?? '';

    this.nickElement.onchange = this.onNickChange.bind(this);
    this.nickElement.oninput = this.onNickChange.bind(this);

    this.client.on('connect', this.onConnect.bind(this));
    this.client.on('disconnect', this.onDisconnect.bind(this));
    this.onNickChange();

    const connectButton = document.getElementById('connect')!;
    connectButton.onclick = this.connect.bind(this);
    const disconnectButton = document.getElementById('disconnect')!;
    disconnectButton.onclick = this.disconnect.bind(this);
  }

  getUrlState(): UrlState {
    const query = window.location.search.substr(1);
    const q = qs.parse(query) as any;
    return {
      gameId: q.gameId ?? null,
      num: q.num === undefined ? null : parseInt(q.num, 10),
      secret: q.secret ?? null,
    };
  }

  setUrlState(state: UrlState): void {
    const query = window.location.search.substr(1);
    const q = qs.parse(query) as any;
    q.gameId = state.gameId ?? undefined;
    q.num = state.num ?? undefined;
    q.secret = state.secret ?? undefined;
    const newQuery = qs.stringify(q);
    if (newQuery !== query) {
      history.pushState(undefined, '', '?' + qs.stringify(q));
    }
  }

  start(): void {
    const {gameId, num, secret: urlSecret} = this.getUrlState();
    if (gameId !== null && num !== null) {
      const secret = urlSecret ?? localStorage.getItem(`autotable.secret.${gameId}.${num}`);
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
    if (this.client.connected()) {
      this.client.nicks.set(this.client.num()!, this.nickElement.value);
    }
    localStorage.setItem('autotable.nick', this.nickElement.value);
  }

  onConnect(game: Game): void {
    this.success = true;
    document.getElementById('server')!.classList.add('connected');
    this.onNickChange();
    localStorage.setItem(`autotable.secret.${game.gameId}.${game.num}`, game.secret);
    this.setUrlState({gameId: game.gameId, num: game.num, secret: game.secret});
    document.getElementsByTagName('title')[0].innerText = TITLE_CONNECTED;

    const query = qs.stringify({gameId: game.gameId});
    const protocol = window.location.protocol;
    const host = window.location.host;
    const path = window.location.pathname;
    const link = `${protocol}//${host}${path}?${query}`;
    (document.getElementById('game-link')! as HTMLInputElement).value = link;
  }

  onDisconnect(): void {
    document.getElementById('server')!.classList.remove('connected');
    (document.getElementById('connect')! as HTMLButtonElement).disabled = false;
    document.getElementsByTagName('title')[0].innerText = TITLE_DISCONNECTED;
    if (!this.success) {
      this.setUrlState({ gameId: null, num: null, secret: null });
    }
  }

  connect(): void {
    if (this.client.connected()) {
      return;
    }
    (document.getElementById('connect')! as HTMLButtonElement).disabled = true;

    this.success = false;
    this.client.new(this.url, null, 4);
  }

  disconnect(): void {
    this.client.disconnect();
    this.setUrlState({ gameId: null, num: null, secret: null });
  }
}
