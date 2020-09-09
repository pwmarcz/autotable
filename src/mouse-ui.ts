import { Raycaster, Camera, Group, Mesh, BoxGeometry, PlaneGeometry, Vector3, Vector2 } from "three";
import { World } from "./world";
import { SelectionBox } from "./selection-box";

export class MouseUi {
  private world: World;
  private mainGroup: Group;
  private raycastGroup: Group;
  private raycaster: Raycaster;

  private selectionBox: SelectionBox | null;
  private camera: Camera | null;

  private main: HTMLElement;
  private selection: HTMLElement;
  private cursors: Array<HTMLElement>;

  private raycastObjects: Array<Mesh>;
  private raycastTable: Mesh;

  private currentObjects: Array<Mesh> = [];

  mouse2: Vector2 | null = null;
  private mouse3: Vector3 | null = null;
  private selectStart3: Vector3 | null = null;
  private dragStart3: Vector3 | null = null;

  sticky: boolean = false;

  constructor(world: World, mainGroup: Group) {
    this.world = world;
    this.mainGroup = mainGroup;
    this.raycaster = new Raycaster();

    this.camera = null;
    this.selectionBox = null;

    this.main = document.getElementById('main')!;
    this.selection = document.getElementById('selection')!;
    this.cursors = [
      document.querySelector('.cursor.rotate-0')! as HTMLElement,
      document.querySelector('.cursor.rotate-1')! as HTMLElement,
      document.querySelector('.cursor.rotate-2')! as HTMLElement,
      document.querySelector('.cursor.rotate-3')! as HTMLElement,
    ];

    this.raycastObjects = [];
    this.raycastGroup = new Group();
    this.mainGroup.add(this.raycastGroup);
    this.raycastGroup.visible = false;
    this.raycastGroup.matrixAutoUpdate = false;
    for (let i = 0; i < this.world.slots.size; i++) {
      const obj = new Mesh(new BoxGeometry(1, 1, 1));
      obj.name = 'raycastBox';
      obj.visible = false;
      obj.matrixAutoUpdate = false;
      this.raycastObjects.push(obj);
      this.raycastGroup.add(obj);
    }

    this.raycastTable = new Mesh(new PlaneGeometry(
      World.WIDTH * 3,
      World.WIDTH * 3,
    ));
    this.raycastTable.visible = false;
    this.raycastTable.position.set(World.WIDTH / 2, World.WIDTH / 2, 0);
    this.raycastGroup.add(this.raycastTable);

    this.setupEvents();
  }

  private setupEvents(): void {
    this.main.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.main.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    this.main.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.main.addEventListener('wheel', this.onWheel.bind(this));
    this.main.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
  }

  private onWheel(event: WheelEvent): void {
    this.world.onFlip(Math.sign(event.deltaY));
  }

  private onMouseMove(event: MouseEvent): void {
    const w = this.main.clientWidth;
    const h = this.main.clientHeight;
    if (this.mouse2 === null) {
      this.mouse2 = new Vector2(0, 0);
    }
    this.mouse2.x = event.offsetX / w * 2 - 1;
    this.mouse2.y = -event.offsetY / h * 2 + 1;

    this.update();
  }

  private onMouseLeave(): void {
    this.mouse2 = null;
    this.update();
  }

  private onMouseDown(event: MouseEvent): void {
    if (this.mouse2 === null || this.mouse3 === null) {
      return;
    }

    if (event.button === 0) {
      if (this.dragStart3 === null)  {
        if (this.world.onDragStart()) {
          this.dragStart3 = this.mouse3.clone();
        } else {
          this.selectStart3 = this.mouse3.clone();
        }
      } else if (this.sticky) {
        this.dragStart3 = null;
        this.world.onDragEnd();
      }

      this.update();
    } else if (event.button === 2) {
      this.world.onFlip(1);
    }
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 0) {
      this.selectStart3 = null;

      if (!this.sticky) {
        this.dragStart3 = null;
        this.world.onDragEnd();
      }
    }
  }

  setCamera(camera: Camera): void {
    if (this.camera !== camera) {
      this.camera = camera;
      this.selectionBox = new SelectionBox(camera);
    }
  }

  updateObjects(): void {
    this.currentObjects = this.prepareObjects();
  }

  update(): void {
    if (!this.camera || !this.selectionBox || this.mouse2 === null) {
      this.world.onHover(null);
      this.world.onMove(null);
      this.selection.style.visibility = 'hidden';
      return;
    }
    this.raycaster.setFromCamera(this.mouse2, this.camera);

    const intersects = this.raycaster.intersectObjects(this.currentObjects);
    let hovered = null;
    let hoverPos = null;
    if (intersects.length > 0) {
      hovered = intersects[0].object.userData.id;
      console.log(hovered);
      hoverPos = intersects[0].point.clone();
      this.raycastGroup.worldToLocal(hoverPos);
    }
    this.world.onHover(hovered);

    this.raycastTable.position.z = this.dragStart3 ? this.dragStart3.z : 0;
    this.raycastTable.updateMatrixWorld();
    const intersectsTable = this.raycaster.intersectObject(this.raycastTable);
    let levelPos = null;
    if (intersectsTable.length > 0) {
      levelPos = intersectsTable[0].point.clone();
      this.raycastGroup.worldToLocal(levelPos);
    }

    if (this.prepareSelection()) {
      const selected = [];
      for (const obj of this.selectionBox!.select(this.currentObjects)) {
        const id = obj.userData.id;
        selected.push(id);
      }
      this.world.onSelect(selected);
      if (levelPos) {
        this.mouse3 = levelPos;
      }
    } else {
      if (this.dragStart3) {
        this.mouse3 = levelPos ?? this.mouse3;
      } else {
        this.mouse3 = hoverPos ?? levelPos ?? this.mouse3;
      }
    }
    this.world.onMove(this.mouse3);
  }

  updateCursors(): void {
    if (!this.camera || !this.selectionBox) {
      return;
    }

    const w = this.main.clientWidth;
    const h = this.main.clientHeight;

    const now = new Date().getTime();

    const rotation = this.world.seat ?? 0;
    for (let i = 0; i < 4; i++) {
      const j = (4 + i - rotation) % 4;

      const cursorElement = this.cursors[j];
      const cursorPos = this.world.mouseTracker.getMouse(i, now);

      if (cursorPos && i !== this.world.seat) {
        const v = cursorPos.clone();
        this.raycastGroup.localToWorld(v);
        v.project(this.camera);

        const x = Math.floor((v.x + 1) / 2 * w);
        const y = Math.floor((-v.y + 1) / 2 * h);
        cursorElement.style.visibility = 'visible';
        cursorElement.style.left = `${x}px`;
        cursorElement.style.top = `${y}px`;
      } else {
        cursorElement.style.visibility = 'hidden';
      }
    }
  }

  private prepareSelection(): boolean {
    if (!this.selectionBox) {
      return false;
    }

    if (this.selectStart3 === null || this.mouse2 === null) {
      this.selection.style.visibility = 'hidden';
      return false;
    }

    const w = this.main.clientWidth;
    const h = this.main.clientHeight;

    const p = this.selectStart3.clone();
    this.raycastGroup.localToWorld(p);
    const selectStart2 = p.project(this.camera!);

    const x1 = Math.min(selectStart2.x, this.mouse2.x);
    const y1 = Math.min(selectStart2.y, this.mouse2.y);
    const x2 = Math.max(selectStart2.x, this.mouse2.x);
    const y2 = Math.max(selectStart2.y, this.mouse2.y);

    const sx1 = (x1 + 1) * w / 2;
    const sx2 = (x2 + 1) * w / 2;
    const sy1 = (-y2 + 1) * h / 2;
    const sy2 = (-y1 + 1) * h / 2;

    this.selection.style.left = `${sx1}px`;
    this.selection.style.top = `${sy1}px`;
    this.selection.style.width = `${sx2-sx1}px`;
    this.selection.style.height = `${sy2-sy1}px`;
    this.selection.style.visibility = 'visible';

    this.selectionBox.update(new Vector2(x1, y1), new Vector2(x2, y2));
    return true;
  }

  private prepareObjects(): Array<Mesh> {
    const toSelect = this.world.toSelect();
    const objs = [];

    const minSize = 3;

    for (let i = 0; i < toSelect.length; i++) {
      const select = toSelect[i];
      const obj = this.raycastObjects[i];
      obj.position.copy(select.position);
      obj.scale.copy(select.size);

      if (obj.scale.x < minSize) {
        obj.scale.x = minSize;
      }
      if (obj.scale.y < minSize) {
        obj.scale.y = minSize;
      }

      obj.updateMatrix();
      obj.updateMatrixWorld();
      obj.userData.id = select.id;
      objs.push(obj);
    }
    return objs;
  }
}
