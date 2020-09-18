import { Scene, Camera, WebGLRenderer, Vector2, Vector3, Group, AmbientLight, DirectionalLight, PerspectiveCamera, OrthographicCamera, Mesh, Object3D, PlaneBufferGeometry } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass';
import Stats from 'three/examples/jsm/libs/stats.module.js';

import { World } from './world';
import { Client } from './client';
import { ThingInfo } from './types';
import { runInThisContext } from 'vm';

const RATIO = 1.5;

enum CameraPosition {
  TopDown,
  PlayerView,
  HandSpectator,
  CallSpectator,
  DoraSpectator,
}

interface AutoQueueItem {
  seat?: number;
  view: CameraPosition;
  delay?: number;
  squashable?: boolean;
}

export class MainView {
  private main: HTMLElement;
  private stats: Stats;
  private perspective = false;

  private scene: Scene;
  private viewGroup: Group;
  private renderer: WebGLRenderer;

  camera: Camera = null!;
  private composer: EffectComposer = null!;
  private outlinePass: OutlinePass = null!;
  private cameraPosition: CameraPosition = CameraPosition.TopDown;
  private autoCameraPosition: CameraPosition = CameraPosition.TopDown;
  private activeSeat: number = 0;
  private autoActiveSeat: number = 0;

  private width = 0;
  private height = 0;

  private dummyObject: Object3D;
  private autoSpectate: boolean = false;

  private readonly autoQueue: Array<AutoQueueItem> = [];
  private queueTaskId: NodeJS.Timeout | null = null;
  private doraIndicatorLocation: Vector3 | null = null;

  constructor(private readonly mainGroup: Group, private readonly client: Client, private readonly world: World) {
    this.main = document.getElementById('main')!;

    this.scene = new Scene();
    this.scene.autoUpdate = false;
    this.viewGroup = new Group();
    this.viewGroup.position.set(World.WIDTH/2, World.WIDTH/2, 0);
    this.scene.add(this.mainGroup);
    this.scene.add(this.viewGroup);

    this.dummyObject = new Mesh(new PlaneBufferGeometry(0, 0, 0));

    this.renderer = new WebGLRenderer({ antialias: false });
    this.main.appendChild(this.renderer.domElement);

    this.setupLights();
    this.setupRendering();

    this.client.match.on('update', () => {
      this.doraIndicatorLocation = null;
    });

    this.client.things.on('update', (update) => {
      if (this.queueAutoItem(update) && this.autoQueue.length > 0) {
        if (this.queueTaskId !== null) {
          return;
        }

        this.queueTaskId = setTimeout(() => {
          this.applyQueueItem();
        }, 0);
      }
    });

    this.stats = Stats();
    this.stats.dom.style.left = 'auto';
    this.stats.dom.style.right = '0';
    const full = document.getElementById('full')!;
    full.appendChild(this.stats.dom);
  }

  private applyQueueItem(previous?: AutoQueueItem): void {
    const change = this.autoQueue.shift();
    if (!change) {
      this.queueTaskId = null;
      return;
    }

    const duplicate = previous && change.view === previous.view && change.seat === previous.seat;

    if(this.autoQueue.length > 0 && change.squashable) {
      this.queueTaskId = setTimeout(() => this.applyQueueItem(previous), 0);
    }

    if (!duplicate) {
      if (change.seat !== undefined) {
        this.autoActiveSeat = change.seat;
      }
      this.autoCameraPosition = change.view;
    }

    this.queueTaskId = setTimeout(() => this.applyQueueItem(change), duplicate ? 0 : change.delay ?? 0);
  }

  private queueAutoItem(update: Array<[number, ThingInfo | null]>): boolean {
    for(const [id, info] of update) {
      const thing = this.world.things.get(id);
      if (!thing) {
        continue;
      }

      if (!info) {
        continue;
      }

      const seat = parseInt(info.slotName.substring(info.slotName.indexOf('@') + 1));

      if (info?.slotName.startsWith('wall')) {
        // Show hand of player who just drew tile from wall.
        if (info.claimedBy !== null && thing.rotationIndex !== 1) {
          this.autoQueue.push({
            seat: info.claimedBy,
            view: CameraPosition.HandSpectator,
          });
          return true;
        }

        // Show dora if tile in wall was just flipped, then swap back to last hand
        if (info.rotationIndex === 1 && thing.rotationIndex !== info.rotationIndex) {
          // set the first tile flipped in the round as the dora indicator location
          if (this.doraIndicatorLocation === null) {
            this.doraIndicatorLocation = thing.slot.places[0].position.clone();
            this.doraIndicatorLocation.setZ(0);
          }

          this.autoQueue.push({
            seat: 0,
            view: CameraPosition.DoraSpectator,
            delay: 4000,
          });

          // swap to the top view if the ura dora were flipped
          if (info.slotName.indexOf("0@") >= 0) {
            this.autoQueue.push({
              seat: 0,
              view: CameraPosition.TopDown,
              squashable: true,
            });
          }

          return true;
        }
      }

      // Show hand of player who just revealed their tiles
      if (info?.slotName.startsWith('hand') && info.rotationIndex !== thing.rotationIndex && info.rotationIndex === 1) {
        this.autoQueue.push({
          seat,
          view: CameraPosition.HandSpectator,
        });
        return true;
      }

      // Show call area of player who just moved their tiles there, then swap to their hand
      if (info?.slotName.startsWith('meld') && info.claimedBy === null) {
        if(thing.slot.name.startsWith('meld') && thing.slot.seat === seat) {
          continue;
        }

        this.autoQueue.push({
          seat,
          view: CameraPosition.CallSpectator,
          delay: 4000,
        });

        this.autoQueue.push({
          view: CameraPosition.HandSpectator,
        });
        return true;
      }
    }
    return false;
  }

  private setupLights(): void {
    this.viewGroup.add(new AmbientLight(0x888888));
    const topLight = new DirectionalLight(0x777777);
    topLight.position.set(0, 0, 10000);
    this.viewGroup.add(topLight);

    const frontLight = new DirectionalLight(0x222222);
    frontLight.position.set(0, -10000, 0);
    this.viewGroup.add(frontLight);

    const sideLight = new DirectionalLight(0x222222);
    sideLight.position.set(-10000, -10000, 0);
    this.viewGroup.add(sideLight);
  }

  private setupRendering(): void {
    const w = this.renderer.domElement.clientWidth;
    const h = this.renderer.domElement.clientHeight;

    if (this.camera !== null) {
      this.scene.remove(this.camera);
    }

    this.camera = this.makeCamera(this.perspective);
    this.viewGroup.add(this.camera);
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.outlinePass = new OutlinePass(new Vector2(w, h), this.scene, this.camera);
    this.outlinePass.visibleEdgeColor.setHex(0xffff99);
    this.outlinePass.hiddenEdgeColor.setHex(0x333333);
    this.composer.addPass(renderPass);
    this.composer.addPass(this.outlinePass);

    // Force OutlinePass to precompile shadows, otherwise there is a pause when
    // you first select something.
    this.outlinePass.selectedObjects.push(this.dummyObject);
    this.composer.render();
    this.outlinePass.selectedObjects.pop();
  }

  private makeCamera(perspective: boolean): Camera {
    if (perspective) {
      const camera = new PerspectiveCamera(30, RATIO, 0.1, 1000);
      camera.up = new Vector3(0, 0.001, 1).normalize();
      return camera;
    } else {
      const w = World.WIDTH * 1.2;
      const h = w / RATIO;
      const camera = new OrthographicCamera(
        -w / 2, w / 2,
        h / 2, -h / 2,
        0.1, 1000);
      return camera;
    }
  }
  readonly cameraUp = new Vector3(0, 0.001, 1).normalize();

  updateCamera(seat: number | null, lookDown: number, zoom: number, mouse2: Vector2 | null): void {
    const realSeat = seat ?? (this.autoSpectate ? this.autoActiveSeat : this.activeSeat);
    const angle = (realSeat) * Math.PI * 0.5;
    this.camera.up.copy(this.cameraUp).applyAxisAngle(new Vector3(0, 0, 1), angle);

    const cameraPosition = seat !== null
      ? CameraPosition.PlayerView
      : (this.autoSpectate
        ? this.autoCameraPosition
        : this.cameraPosition);

    if (this.perspective) {
      this.updatePespectiveCamera(cameraPosition, lookDown, zoom, mouse2);
    } else {
      this.updateOrthographicCamera(cameraPosition, lookDown, zoom, mouse2);
    }

    if(cameraPosition !== CameraPosition.TopDown) {
      this.viewGroup.setRotationFromAxisAngle(new Vector3(0, 0, 1), angle);
      this.viewGroup.updateMatrixWorld();
    }
  }

  private updatePespectiveCamera(
    cameraPosition: CameraPosition,
    lookDown: number,
    zoom: number,
    mouse2: Vector2 | null): void
  {
    switch (cameraPosition) {
      case CameraPosition.TopDown: {
        const center = this.camera.parent?.localToWorld(new Vector3());
        this.camera.position.set(0, 0, 400);
        this.camera.lookAt(center!);
        break;
      } case CameraPosition.PlayerView: {
        this.camera.position.set(0, -World.WIDTH*1.44, World.WIDTH * 1.05);
        this.camera.rotation.set(Math.PI * 0.3 - lookDown * 0.2, 0, 0);
        if (zoom !== 0) {
          const dist = new Vector3(0, 1.37, -1).multiplyScalar(zoom * 55);
          this.camera.position.add(dist);
        }
        if (zoom > 0 && mouse2) {
          this.camera.position.x += mouse2.x * zoom * World.WIDTH * 0.6;
          this.camera.position.y += mouse2.y * zoom * World.WIDTH * 0.6;
        }
        break;
      } case CameraPosition.HandSpectator: {
        this.camera.position.set(0, -World.WIDTH*1.44, World.WIDTH / 2).applyAxisAngle(new Vector3(0, 0, -1), Math.PI * 0.15);
        const offset = this.camera.parent?.localToWorld(new Vector3(World.WIDTH / 8, -World.WIDTH / 4, 0));
        this.camera.lookAt(offset!);
        break;
      } case CameraPosition.CallSpectator: {
        const callArea = new Vector3(World.WIDTH * 13 / 32, -World.WIDTH * 3 / 8, 0);
        this.camera.position.copy(callArea);
        this.camera.position.setZ(100);
        const center = this.camera.parent?.localToWorld(callArea);
        this.camera.lookAt(center!);
        break;
      } case CameraPosition.DoraSpectator: {
        this.camera.position.copy(new Vector3(0, 0, 100));
        this.camera.lookAt(this.doraIndicatorLocation);
      }
    }
  }

  private updateOrthographicCamera(
    cameraPosition: CameraPosition,
    lookDown: number,
    zoom: number,
    mouse2: Vector2 | null): void
  {
    switch (cameraPosition) {
      case CameraPosition.PlayerView: {
        this.camera.position.set(
          0,
          -53 * lookDown - World.WIDTH,
          174);
        this.camera.rotation.set(Math.PI * 0.25, 0, 0);
        this.camera.scale.setScalar(1 - 0.45 * zoom);

        if (zoom > 0 && mouse2) {
          this.camera.position.x += mouse2.x * zoom * World.WIDTH * 0.6;
          this.camera.position.y += mouse2.y * zoom * World.WIDTH * 0.6;
        }
        break;
      }
      default: {
        this.camera.position.set(0, 0, 100);
        this.camera.lookAt(new Vector3(World.WIDTH / 2, World.WIDTH / 2, 0));
        this.camera.scale.setScalar(1.55);
      }
    }
  }

  updateOutline(selectedObjects: Array<Mesh>): void {
    this.outlinePass.selectedObjects = selectedObjects;
  }

  setPerspective(perspective: boolean): void {
    this.perspective = perspective;
    this.setupRendering();
  }

  render(): void {
    this.composer.render();
    this.stats.update();
  }

  updateViewport(): void {
    if (this.main.parentElement!.clientWidth !== this.width ||
      this.main.parentElement!.clientHeight !== this.height) {

      this.width = this.main.parentElement!.clientWidth;
      this.height = this.main.parentElement!.clientHeight;

      let renderWidth: number, renderHeight: number;

      if (this.width / this.height > RATIO) {
        renderWidth = Math.floor(this.height * RATIO);
        renderHeight = Math.floor(this.height);
      } else {
        renderWidth = Math.floor(this.width);
        renderHeight = Math.floor(this.width / RATIO);
      }
      this.main.style.width = `${renderWidth}px`;
      this.main.style.height = `${renderHeight}px`;
      this.renderer.setSize(renderWidth, renderHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));

      this.setupRendering();
    }
  }

  spectateHand(i: number): void {
    this.autoSpectate = false;
    this.cameraPosition = CameraPosition.HandSpectator;
    this.activeSeat = i;
  }

  spectateCall(i: number): void {
    this.autoSpectate = false;
    this.cameraPosition = CameraPosition.CallSpectator;
    this.activeSeat = i;
  }

  spectateTop(): void {
    this.autoSpectate = false;
    this.cameraPosition = CameraPosition.TopDown;
    this.activeSeat = 0;
  }

  spectateAuto(): void {
    this.autoSpectate = true;
    this.autoCameraPosition = CameraPosition.TopDown;
    this.autoActiveSeat = 0;
  }
}
