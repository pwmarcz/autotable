import { Client, Collection } from "./client";

interface Sound {
  type: 'discard';
  side: number;
}

export class SoundPlayer {
  private audioContext: AudioContext;

  private discard: HTMLAudioElement;
  private panner: StereoPannerNode;

  private clientSound: Collection<number, Sound>;

  constructor(client: Client) {
    this.audioContext = new AudioContext;

    this.discard = document.getElementById('sound-discard') as HTMLAudioElement;

    this.clientSound = client.collection('sound');
    this.clientSound.on('update', this.onUpdate.bind(this));

    this.panner = new StereoPannerNode(this.audioContext);
    const track = this.audioContext.createMediaElementSource(this.discard);

    track.connect(this.panner).connect(this.audioContext.destination);
  }

  play(sound: number): void {
    switch(side) {
      case 1:
        this.panner.pan.value = 0.3;
        break;
      case 3:
        this.panner.pan.value = -0.3;
        break;
      default:
        this.panner.pan.value = 0;
        break;
    }
    this.discard.play();
  }
}
