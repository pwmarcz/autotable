import { Raycaster, Camera, Group, Mesh, BoxGeometry, PlaneGeometry, Vector3, Vector2 } from "three";
import { World } from "./world";
import { SelectionBox } from "./selection-box";

export class MouseUi {
  private world: World;
  private mainGroup: Group;
  private raycaster: Raycaster;

  private selectionBox: SelectionBox | null;
  private camera: Camera | null;

  private main: HTMLElement;
  private selection: HTMLElement;
  private cursors: Array<HTMLElement>;

  private raycastObjects: Array<Mesh>;
  private raycastTable: Mesh;

  mouse2: Vector2 | null;
  private mouse3: Vector3 | null;
  private selectStart2: Vector2 | null;
  private dragStart3: Vector3 | null;

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
    for (let i = 0; i < Object.keys(this.world.slots).length; i++) {
      const obj = new Mesh(new BoxGeometry(1, 1, 1));
      obj.visible = false;
      this.raycastObjects.push(obj);
      this.mainGroup.add(obj);
    }

    this.raycastTable = new Mesh(new PlaneGeometry(
      World.WIDTH * 3,
      World.WIDTH * 3,
    ));
    this.raycastTable.visible = false;
    this.raycastTable.position.set(World.WIDTH / 2, World.WIDTH / 2, 0);
    this.mainGroup.add(this.raycastTable);

    this.mouse2 = null;
    this.mouse3 = null;
    this.selectStart2 = null;
    this.dragStart3 = null;

    this.setupEvents();
  }

  private setupEvents(): void {
    this.main.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.main.addEventListener('mouseleave', this.onMouseLeave.bind(this));
    this.main.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
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

  private onMouseDown(): void {
    if (this.mouse2 === null || this.mouse3 === null) {
      return;
    }

    if (this.world.onDragStart()) {
      this.dragStart3 = this.mouse3.clone();
    } else {
      this.selectStart2 = this.mouse2.clone();
    }
    this.update();
  }

  private onMouseUp(): void {
    this.dragStart3 = null;
    this.selectStart2 = null;
    this.world.onDragEnd();
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
    this.selectionBox = new SelectionBox(camera);
  }

  update(): void {
    if (!this.camera || !this.selectionBox || this.mouse2 === null) {
      this.world.onHover(null);
      this.world.onMove(null);
      this.world.onSelect([]);
      this.selection.style.visibility = 'hidden';
      return;
    }

    this.raycaster.setFromCamera(this.mouse2, this.camera);
    const objs = this.prepareObjects();

    const intersects = this.raycaster.intersectObjects(objs);
    let hovered = null;
    let hoverPos = null;
    if (intersects.length > 0) {
      hovered = intersects[0].object.userData.id;
      hoverPos = intersects[0].point.clone();
      this.mainGroup.worldToLocal(hoverPos);
    }
    this.world.onHover(hovered);

    this.raycastTable.position.z = this.dragStart3 ? this.dragStart3.z : 0;
    this.raycastTable.updateMatrixWorld();
    const intersectsTable = this.raycaster.intersectObject(this.raycastTable);
    let levelPos = null;
    if (intersectsTable.length > 0) {
      levelPos = intersectsTable[0].point.clone();
      this.mainGroup.worldToLocal(levelPos);
    }

    if (this.prepareSelection()) {
      const selected = [];
      for (const obj of this.selectionBox.select(objs)) {
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

    for (let i = 0; i < 4; i++) {
      const j = (4 + i - this.world.playerNum) % 4;

      const cursorElement = this.cursors[j];
      const cursorPos = this.world.playerMouses[i];

      if (cursorPos && i !== this.world.playerNum) {
        const v = cursorPos.clone();
        this.mainGroup.localToWorld(v);
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

    if (this.selectStart2 === null || this.mouse2 === null) {
      this.selection.style.visibility = 'hidden';
      return false;
    }

    const w = this.main.clientWidth;
    const h = this.main.clientHeight;

    const x1 = Math.min(this.selectStart2.x, this.mouse2.x);
    const y1 = Math.min(this.selectStart2.y, this.mouse2.y);
    const x2 = Math.max(this.selectStart2.x, this.mouse2.x);
    const y2 = Math.max(this.selectStart2.y, this.mouse2.y);

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
    for (let i = 0; i < toSelect.length; i++) {
      const select = toSelect[i];
      const obj = this.raycastObjects[i];
      obj.position.copy(select.position);
      obj.scale.copy(select.size);
      obj.updateMatrixWorld();
      obj.userData.id = select.id;
      objs.push(obj);
    }
    return objs;
  }
}
