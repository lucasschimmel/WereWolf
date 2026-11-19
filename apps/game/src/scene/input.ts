import { useControls } from "../store";

const forwardKeys = ["KeyW", "KeyZ", "ArrowUp"];
const backKeys = ["KeyS", "ArrowDown"];
const leftKeys = ["KeyA", "KeyQ"];
const rightKeys = ["KeyD"];
const handled = new Set([
  ...forwardKeys,
  ...backKeys,
  ...leftKeys,
  ...rightKeys,
  "ArrowLeft",
  "ArrowRight",
  "ShiftLeft",
  "ShiftRight",
]);

type Tracked = { x: number; y: number; travel: number; start: number };

function editable(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** Keyboard, mouse, touch-drag and pinch input for the 3D view. */
export class Input {
  private keys = new Set<string>();
  private pointers = new Map<number, Tracked>();
  private look = { x: 0, y: 0 };
  private pinch = 0;
  zoom = 1;
  hover?: { x: number; y: number };
  dragging = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private handlers: {
      tap: (x: number, y: number) => void;
      /** Right click or long press: abstain from the current pointing. */
      pass: () => void;
      /** Keyboard targeting; returns true when the key was consumed. */
      command: (key: "next" | "previous" | "confirm") => boolean;
    },
  ) {
    window.addEventListener("keydown", this.command);
    window.addEventListener("keydown", this.key);
    window.addEventListener("keyup", this.key);
    window.addEventListener("blur", this.reset);
    canvas.addEventListener("pointerdown", this.down);
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerup", this.up);
    canvas.addEventListener("pointercancel", this.up);
    canvas.addEventListener("pointerleave", this.leave);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    canvas.addEventListener("contextmenu", this.menu);
  }

  private key = (event: KeyboardEvent) => {
    if (!handled.has(event.code)) return;
    if (event.type === "keyup") {
      this.keys.delete(event.code);
      return;
    }
    if (
      editable(event.target) ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey
    )
      return;
    if (event.code.startsWith("Arrow")) event.preventDefault();
    this.keys.add(event.code);
  };

  private command = (event: KeyboardEvent) => {
    if (editable(event.target) || event.metaKey || event.ctrlKey) return;
    const key =
      event.code === "Tab"
        ? event.shiftKey
          ? "previous"
          : "next"
        : event.code === "Enter" || event.code === "NumpadEnter"
          ? "confirm"
          : undefined;
    if (!key) return;
    // Only steer targeting while focus rests on the scene, so Tab still
    // walks through the panels once the player moves focus into them.
    const focused = document.activeElement;
    if (focused !== this.canvas && focused !== document.body && focused) return;
    if (this.handlers.command(key)) event.preventDefault();
  };

  private reset = () => {
    this.keys.clear();
    this.pointers.clear();
    this.dragging = false;
  };

  private down = (event: PointerEvent) => {
    this.canvas.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      travel: 0,
      start: performance.now(),
    });
    if (this.pointers.size === 2) this.pinch = this.spread();
  };

  private spread() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private move = (event: PointerEvent) => {
    const tracked = this.pointers.get(event.pointerId);
    if (!tracked) {
      if (event.pointerType === "mouse")
        this.hover = { x: event.clientX, y: event.clientY };
      return;
    }
    const dx = event.clientX - tracked.x;
    const dy = event.clientY - tracked.y;
    tracked.x = event.clientX;
    tracked.y = event.clientY;
    tracked.travel += Math.hypot(dx, dy);
    if (this.pointers.size >= 2) {
      const spread = this.spread();
      if (this.pinch > 0 && spread > 0)
        this.zoom = Math.min(
          1.6,
          Math.max(0.65, this.zoom * (this.pinch / spread)),
        );
      this.pinch = spread;
      return;
    }
    if (tracked.travel > 6) this.dragging = true;
    this.look.x += dx;
    this.look.y += dy;
  };

  private up = (event: PointerEvent) => {
    const tracked = this.pointers.get(event.pointerId);
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 0) this.dragging = false;
    if (!tracked || event.type === "pointercancel" || tracked.travel >= 8)
      return;
    const held = performance.now() - tracked.start;
    if (event.button === 2 || (event.pointerType === "touch" && held > 650))
      this.handlers.pass();
    else if (held < 450) this.handlers.tap(event.clientX, event.clientY);
  };

  private leave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") this.hover = undefined;
  };

  private wheel = (event: WheelEvent) => {
    event.preventDefault();
    this.zoom = Math.min(
      1.6,
      Math.max(0.65, this.zoom * (1 + Math.sign(event.deltaY) * 0.08)),
    );
  };

  private menu = (event: Event) => event.preventDefault();

  /** Look delta in radians since the previous frame. */
  takeLook() {
    const factor = useControls.getState().sensitivity * 0.0042;
    const result = { yaw: -this.look.x * factor, pitch: this.look.y * factor };
    this.look.x = 0;
    this.look.y = 0;
    return result;
  }

  axes() {
    const has = (codes: string[]) => codes.some((code) => this.keys.has(code));
    const stick = useControls.getState().stick;
    const forward = Number(has(forwardKeys)) - Number(has(backKeys)) - stick.y;
    const side = Number(has(rightKeys)) - Number(has(leftKeys)) + stick.x;
    const turn =
      Number(this.keys.has("ArrowLeft")) - Number(this.keys.has("ArrowRight"));
    const length = Math.hypot(forward, side);
    const scale = length > 1 ? 1 / length : 1;
    return {
      forward: forward * scale,
      side: side * scale,
      turn,
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
    };
  }

  dispose() {
    window.removeEventListener("keydown", this.command);
    window.removeEventListener("keydown", this.key);
    window.removeEventListener("keyup", this.key);
    window.removeEventListener("blur", this.reset);
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.up);
    this.canvas.removeEventListener("pointerleave", this.leave);
    this.canvas.removeEventListener("wheel", this.wheel);
    this.canvas.removeEventListener("contextmenu", this.menu);
  }
}
