import { Client } from "./client";
import { SoundInfo, SoundType } from "./types";

class Channel {
  private element: HTMLAudioElement;
  // TODO intensity
  private panner: StereoPannerNode;
  private gainer: GainNode;
  playing: boolean = false;

  constructor(audioContext: AudioContext) {
    this.element = document.createElement('audio');
    this.element.onended = () => {
      this.element.currentTime = 0;
      this.playing = false;
    };
    this.gainer = audioContext.createGain();
    this.panner = audioContext.createStereoPanner();
    const track = audioContext.createMediaElementSource(this.element);
    track.connect(this.gainer).connect(this.panner).connect(audioContext.destination);
  }

  gain(gain: number): void {
    this.gainer.gain.value = gain;
  }

  pan(pan: number): void {
    this.panner.pan.value = pan;
  }

  play(url: string): void {
    this.element.src = url;
    this.element.play();
    this.playing = true;
  }
}

export class SoundPlayer {
  private audioContext: AudioContext;
  private channels: Array<Channel>;
  private client: Client;
  private urls: Record<SoundType, string>;
  muted: boolean = false;

  constructor(client: Client) {
    this.audioContext = new AudioContext();
    this.channels = [];
    for (let i = 0; i < 8; i++) {
      this.channels.push(new Channel(this.audioContext));
    }
    this.client = client;
    this.client.sound.on('update', this.onUpdate.bind(this));
    this.urls = {
      [SoundType.DISCARD]: this.getSource('sound-discard'),
      [SoundType.STICK]: this.getSource('sound-stick'),
    };
  }

  play(type: SoundType, side: number | null): void {
    this.doPlay(type, side);
    this.client.sound.set(0, {type, side, seat: this.client.seat!});
  }

  private onUpdate(entries: Array<[number, SoundInfo | null]>): void {
    for (const [, sound] of entries) {
      if (sound !== null && sound.seat !== this.client.seat) {
        this.doPlay(sound.type, sound.side);
      }
    }
  }

  private getSource(id: string): string {
    return (document.getElementById(id) as HTMLAudioElement).src;
  }

  private doPlay(type: SoundType, side: number | null): void {
    if (this.muted) {
      return;
    }

    this.audioContext.resume();
    for (const channel of this.channels) {
      const rotation = this.client.seat ?? 0;
      if (!channel.playing) {
        if (side !== null) {
          side = (side + 4 - rotation) % 4;
        }
        let pan = 0;
        switch(side) {
          case 1: pan = 0.5; break;
          case 3: pan = -0.5; break;
        }
        channel.pan(pan);
        channel.gain(0.5);
        channel.play(this.urls[type]);
        break;
      }
    }
  }
}
