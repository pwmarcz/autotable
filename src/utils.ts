
export function shuffle<T>(arr: Array<T>): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[j];
    arr[j] = arr[i];
    arr[i] = temp;
  }
}

export class Animation {
  private startTime = 0;
  private endTime = 1;
  private startPos = 0;
  private endPos = 0;
  private period: number;
  pos = -1;

  constructor(period: number) {
    this.period = period;
  }

  start(endPos: number): void {
    this.startPos = this.pos;
    this.startTime = new Date().getTime();
    this.endPos = endPos;
    this.endTime = this.startTime + this.period * Math.abs(endPos - this.pos);
  }

  update(): boolean {
    if (this.pos === this.endPos) {
      return false;
    }

    const now = new Date().getTime();
    const delta = (now - this.startTime) / (this.endTime - this.startTime);
    this.pos = this.startPos + (this.endPos - this.startPos) * Math.min(1, delta);
    return true;
  }
}
