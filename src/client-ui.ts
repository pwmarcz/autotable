import { Client, Status } from "./client";


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

    if (window.location.hash.length > 1) {
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
        if (!this.success && window.location.hash.length > 1) {
          window.location.hash = '#';
        }
        break;
      case Status.CONNECTING:
      case Status.JOINING:
        this.statusElement.innerText = 'connecting';
        break;
      case Status.JOINED: {
        this.success = true;
        const {gameId, secret} = this.client.game!;
        localStorage.setItem(`autotable.secret.${gameId}`, secret);
        break;
      }
    }
  }

  connect(): void {
    if (!(this.client.status() === Status.NEW ||
          this.client.status() === Status.DISCONNECTED)) {
      return;
    }

    const gameId = window.location.hash.substr(1) || null;
    let secret = null;
    if (gameId) {
      secret = localStorage.getItem(`autotable.secret.${gameId}`);
    }
    this.success = false;
    this.client.connect(this.url, gameId, secret);
  }
}
