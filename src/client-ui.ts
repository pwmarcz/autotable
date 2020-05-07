import { Client, Status } from "./client";


export class ClientUi {
  url: string;
  client: Client;
  nickElement: HTMLInputElement;
  statusElement: HTMLElement;

  success = false;

  constructor(url: string, client: Client) {
    this.url = url;
    this.client = client;
    this.nickElement = document.getElementById('nick')! as HTMLInputElement;
    this.nickElement.onchange = this.onNickChange.bind(this);
    this.nickElement.oninput = this.onNickChange.bind(this);

    this.statusElement = document.getElementById('status')! as HTMLElement;
    this.client.on('status', this.onStatus.bind(this));
    this.onStatus(this.client.status());
    this.onNickChange();

    const connectButton = document.getElementById('connect')!;
    connectButton.onclick = this.connect.bind(this);

    if (window.location.hash.length > 1) {
      this.connect();
    }
  }

  onNickChange(): void {
    this.client.updatePlayer({ nick: this.nickElement.value });
  }

  onStatus(status: Status): void {
    this.statusElement.innerText = status.toLowerCase();

    switch (status) {
      case Status.NEW:
        this.statusElement.innerHTML = 'not connected';
        break;
      case Status.DISCONNECTED:
        this.statusElement.innerText = 'disconnected';
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
