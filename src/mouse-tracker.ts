import { Vector3 } from "three";
import { Collection, Client } from "./client";
import { clamp } from "./utils";


interface Waypoint {
  pos: Vector3;
  time: number;
  remoteTime: number;
}

interface Player {
  held: Vector3 | null;
  waypoints: Array<Waypoint>;
}

interface MouseInfo {
  held: {x: number; y: number; z: number} | null;
  mouse: {x: number; y: number; z: number; time: number} | null;
}

const ANIMATION_TIME = 100;

export class MouseTracker {
  private players: Array<Player>;

  private clientMouse: Collection<number, MouseInfo>;
  private clientOnline: Collection<number, boolean>;

  constructor(client: Client) {
    this.players = [];
    for (let i = 0; i < 4; i++) {
      this.players.push({held: null, waypoints: []});
    }
    this.clientMouse = client.collection('mouse');
    this.clientMouse.on('update', this.onUpdate.bind(this));
    this.clientOnline = client.collection('online');
    this.clientOnline.on('update', this.onUpdate.bind(this));
  }

  update(playerNum: number, mouse: Vector3 | null, held: Vector3 | null): void {
    const now = new Date().getTime();
    this.clientMouse.set(playerNum, {
      mouse: mouse && {x: mouse.x, y: mouse.y, z: mouse.z, time: now},
      held: held && {x: held.x, y: held.y, z: held.z},
    });
  }

  getMouse(playerNum: number, now: number): Vector3 | null {
    const waypoints = this.players[playerNum].waypoints;
    if (waypoints.length === 0) {
      return null;
    }

    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i];
      const b = waypoints[i+1];
      if (a.time <= now && now <= b.time) {
        const pos = a.pos.clone();
        const alpha = (now - a.time) / (b.time - a.time);
        pos.lerp(b.pos, alpha);
        return pos;
      }
    }

    return waypoints[waypoints.length - 1].pos;
  }

  getHeld(playerNum: number): Vector3 | null {
    return this.players[playerNum].held;
  }

  private onUpdate(): void {
    const now = new Date().getTime();

    for (let i = 0; i < 4; i++) {
      const online = this.clientOnline.get(i);
      const mouseInfo = this.clientMouse.get(i);
      const player = this.players[i];

      if (!online || !mouseInfo) {
        player.held = null;
        player.waypoints.splice(0);
        continue;
      }

      if (mouseInfo.held === null) {
        player.held = null;
      } else {
        if (!player.held) {
          player.held = new Vector3();
        }
        player.held.set(mouseInfo.held.x, mouseInfo?.held.y, mouseInfo?.held.z);
      }

      if (mouseInfo.mouse === null) {
        player.waypoints.splice(0);
      } else {
        const nextPos = new Vector3(mouseInfo.mouse.x, mouseInfo.mouse.y, mouseInfo.mouse.z);
        const remoteTime = mouseInfo.mouse.time;
        const waypoints = player.waypoints.filter(w => w.time >= now - ANIMATION_TIME);
        if (waypoints.length === 0) {
          let lastPos;
          if (player.waypoints.length > 0) {
            lastPos = player.waypoints[player.waypoints.length-1].pos;
          } else {
            lastPos = nextPos;
          }
          waypoints.push({ time: now, pos: lastPos, remoteTime: remoteTime - ANIMATION_TIME });
        }
        const last = waypoints[waypoints.length-1];
        let time = last.time + remoteTime - last.remoteTime;
        time = clamp(time, now + ANIMATION_TIME * 0.5, now + ANIMATION_TIME);

        waypoints.push({ time, remoteTime, pos: nextPos});
        player.waypoints = waypoints;
      }
    }
  }
}
