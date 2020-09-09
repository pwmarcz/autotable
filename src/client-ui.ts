import qs from 'qs';

import { Client } from "./client";
import { Game } from './base-client';


const TITLE_DISCONNECTED = 'Autotable';
const TITLE_CONNECTED = 'Autotable (online)';
const RECONNECT_DELAY = 2000;
const RECONNECT_ATTEMPTS = 15;

export class ClientUi {
  url: string;
  client: Client;
  nickElement: HTMLInputElement;
  statusElement: HTMLElement;
  statusTextElement: HTMLElement;

  disconnecting = false;
  reconnectAttempts: number = 0;
  reconnectSeat: number | null = null;

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
    connectButton.onclick = () => this.connect();
    const disconnectButton = document.getElementById('disconnect')!;
    disconnectButton.onclick = this.disconnect.bind(this);
    const newGameButton = document.getElementById('new-game')!;
    newGameButton.onclick = this.newGame.bind(this);

    this.statusElement = document.getElementById('status') as HTMLElement;
    this.statusTextElement = document.getElementById('status-text') as HTMLElement;
  }

  getUrlState(): string | null {
    const query = window.location.search.substr(1);
    const q = qs.parse(query) as any;
    return q.gameId ?? null;
  }

  setUrlState(gameId: string | null): void {
    const query = window.location.search.substr(1);
    const q = qs.parse(query) as any;
    q.gameId = gameId ?? undefined;
    const newQuery = qs.stringify(q);
    if (newQuery !== query) {
      history.pushState(undefined, '', '?' + qs.stringify(q));
    }
  }

  start(): void {
    if (this.getUrlState() !== null) {
      // If connecting right on page load, start from empty seat
      // (to prevent sudden change)
      this.client.seats.set(this.client.playerId(), { seat: null });

      this.connect();
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
    this.client.nicks.set(this.client.playerId(), this.nickElement.value);
  }

  onConnect(game: Game): void {
    this.setStatus(null);
    document.getElementById('server')!.classList.add('connected');
    this.onNickChange();
    this.setUrlState(game.gameId);
    document.getElementsByTagName('title')[0].innerText = TITLE_CONNECTED;

    if (this.reconnectSeat !== null) {
      this.client.seats.set(this.client.playerId(), { seat: this.reconnectSeat });
    }
  }

  onDisconnect(game: Game | null): void {
    document.getElementById('server')!.classList.remove('connected');
    document.getElementsByTagName('title')[0].innerText = TITLE_DISCONNECTED;

    if (game && !this.disconnecting) {
      this.reconnectSeat = this.client.seat;
      setTimeout(
        () => this.connect(RECONNECT_ATTEMPTS, this.client.seat ?? undefined),
        RECONNECT_DELAY
      );
      this.setStatus('Trying to reconnect...');
    } else if (!game && this.reconnectAttempts > 0) {
      setTimeout(
        () => this.connect(this.reconnectAttempts - 1, this.reconnectSeat ?? undefined),
        RECONNECT_DELAY);
    } else {
      (document.getElementById('connect')! as HTMLButtonElement).disabled = false;
      if (!this.disconnecting) {
        this.setStatus('Failed to connect.');
      }
    }
  }

  setStatus(status: string | null): void {
    if (status !== null) {
      this.statusElement.style.display = 'block';
      this.statusTextElement.innerText = status;
    } else {
      this.statusElement.style.display = 'none';
    }
  }

  connect(reconnectAttempts?: number, reconnectSeat?: number): void {
    if (this.client.connected()) {
      return;
    }
    (document.getElementById('connect')! as HTMLButtonElement).disabled = true;
    this.reconnectSeat = null;
    const gameId = this.getUrlState();
    if (gameId !== null) {
      this.client.join(this.url, gameId);
    } else {
      this.client.new(this.url);
    }
    this.reconnectAttempts = reconnectAttempts ?? 0;
    this.reconnectSeat = reconnectSeat ?? null;
  }

  disconnect(): void {
    this.disconnecting = true;
    this.client.disconnect();
    // this.setUrlState(null);
  }

  newGame(): void {
    window.location.search = '';
  }
}
