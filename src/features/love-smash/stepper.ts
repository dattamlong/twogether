import { DT } from "./court";

const MAX_FRAME = 0.25;

export class FixedStepper {
  private acc = 0;

  advance(frameSeconds: number) {
    this.acc += Math.min(Math.max(frameSeconds, 0), MAX_FRAME);
    let ticks = 0;
    while (this.acc >= DT) {
      this.acc -= DT;
      ticks++;
    }
    return ticks;
  }

  get alpha() {
    return this.acc / DT;
  }

  reset() {
    this.acc = 0;
  }
}
