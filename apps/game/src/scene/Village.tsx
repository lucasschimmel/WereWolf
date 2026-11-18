import { useEffect, useRef, useState } from "react";
import * as T from "three";
import type { Phase } from "../../shared/rules";
import type { Member, Position } from "../rooms/model";
import { useControls } from "../store";
import {
  batchScenery,
  cabin,
  freePawn,
  pawn,
  seatLantern,
  village,
} from "./art";

type Pose = { x: number; z: number; yaw: number };
type Props = {
  members: Member[];
  me: string;
  positions: Position[];
  phase?: Phase;
  onMove: (position: Pose) => void;
  onSelect: (id: string) => void;
};
function spawn(index: number, count: number) {
  const angle = (index * 2 * Math.PI) / Math.max(count, 8);
  return { x: Math.sin(angle) * 7, z: Math.cos(angle) * 7, yaw: angle };
}
const wrap = (yaw: number) => Math.atan2(Math.sin(yaw), Math.cos(yaw));
const movementKeys = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "KeyZ",
  "KeyQ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export default function Village(props: Props) {
  const latest = useRef(props);
  latest.current = props;
  const ref = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const sensitivity = useControls((state) => state.sensitivity);
  const setSensitivity = useControls((state) => state.setSensitivity);
  const reducedMotion = useControls((state) => state.reducedMotion);
  const setReducedMotion = useControls((state) => state.setReducedMotion);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setUnavailable(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute(
      "aria-label",
      "Village. Utilise ZQSD ou les flèches pour te déplacer. Glisse pour regarder.",
    );
    element.prepend(canvas);
    const scene = new T.Scene();
    const daylight = new T.Color("#a6b2a9");
    const darkness = new T.Color("#151b2a");
    scene.background = daylight;
    scene.fog = new T.FogExp2(daylight, 0.028);
    const ambient = new T.HemisphereLight("#f5dbc8", "#555e75", 2.55);
    const sun = new T.DirectionalLight("#ffe4b8", 2.1);
    sun.position.set(-8, 14, 4);
    scene.add(ambient, sun);
    const camera = new T.PerspectiveCamera(65, 1, 0.07, 115);
    camera.rotation.order = "YXZ";
    village(scene);
    cabin(scene);
    batchScenery(scene);
    const lanterns = Array.from({ length: 15 }, () => seatLantern());
    for (const { stand } of lanterns) scene.add(stand);
    const pawns = new Map<string, { mesh: T.Group; variant: string }>();
    const pressed = new Set<string>();
    const drag = { id: -1, x: 0, y: 0, travel: 0 };
    const ray = new T.Raycaster();
    let pitch = 0;
    let view: Pose | undefined;
    let previousPhase: Phase | undefined;
    let previousFree = false;
    let last = performance.now(),
      sent = last;
    let lastMove: Pose | undefined;
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = element;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    function input(event: KeyboardEvent) {
      if (!movementKeys.has(event.code)) return;
      if (event.type === "keyup") {
        pressed.delete(event.code);
        return;
      }
      if (document.activeElement !== canvas) return;
      event.preventDefault();
      pressed.add(event.code);
    }
    function clear() {
      pressed.clear();
    }
    function down(event: PointerEvent) {
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      Object.assign(drag, {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        travel: 0,
      });
    }
    function pointer(event: PointerEvent) {
      if (event.pointerId !== drag.id || !view) return;
      const dx = event.clientX - drag.x,
        dy = event.clientY - drag.y;
      const factor = useControls.getState().sensitivity * 0.004;
      view.yaw = wrap(view.yaw - dx * factor);
      pitch = T.MathUtils.clamp(pitch - dy * factor, -0.9, 0.9);
      drag.x = event.clientX;
      drag.y = event.clientY;
      drag.travel += Math.hypot(dx, dy);
    }
    function up(event: PointerEvent) {
      if (event.pointerId !== drag.id) return;
      drag.id = -1;
      if (drag.travel > 6 || event.type === "pointercancel") return;
      const rect = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new T.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -(((event.clientY - rect.top) / rect.height) * 2 - 1),
        ),
        camera,
      );
      const hit = ray
        .intersectObjects(
          [...pawns.values()]
            .filter(({ mesh }) => mesh.visible)
            .map(({ mesh }) => mesh),
          true,
        )
        .find(({ object }) => object instanceof T.Mesh);
      for (let item = hit?.object; item; item = item.parent ?? undefined)
        if (item.userData.player) {
          latest.current.onSelect(item.userData.player);
          break;
        }
    }
    const events = {
      pointerdown: down,
      pointermove: pointer,
      pointerup: up,
      pointercancel: up,
      blur: clear,
    };
    canvas.addEventListener("pointerdown", events.pointerdown);
    canvas.addEventListener("pointermove", events.pointermove);
    canvas.addEventListener("pointerup", events.pointerup);
    canvas.addEventListener("pointercancel", events.pointercancel);
    canvas.addEventListener("blur", events.blur);
    window.addEventListener("keydown", input);
    window.addEventListener("keyup", input);
    renderer.setAnimationLoop((time) => {
      const { members, me, positions, phase, onMove } = latest.current;
      const own = members.find((member) => member.id === me);
      const index = members.findIndex((member) => member.id === me);
      const delta = T.MathUtils.clamp((time - last) / 1000, 0, 0.05);
      last = time;
      const night = phase === "night";
      const free =
        !!own?.alive && (!phase || phase === "intro" || phase === "debate");
      const ownPosition = positions.find((position) => position.player === me);
      if (!view || previousPhase !== phase || previousFree !== free) {
        view = night
          ? { x: 0, z: 103.1, yaw: 0 }
          : free && ownPosition
            ? { ...ownPosition }
            : spawn(index, members.length);
        pitch = 0;
        previousPhase = phase;
        previousFree = free;
        lastMove = undefined;
      }
      if (free) {
        const forward =
          Number(["KeyW", "KeyZ", "ArrowUp"].some((key) => pressed.has(key))) -
          Number(["KeyS", "ArrowDown"].some((key) => pressed.has(key)));
        const side =
          Number(["KeyD", "ArrowRight"].some((key) => pressed.has(key))) -
          Number(["KeyA", "KeyQ", "ArrowLeft"].some((key) => pressed.has(key)));
        const step = (delta * 3.5) / Math.max(1, Math.hypot(forward, side));
        const x =
          view.x +
          (-forward * Math.sin(view.yaw) + side * Math.cos(view.yaw)) * step;
        const z =
          view.z +
          (-forward * Math.cos(view.yaw) - side * Math.sin(view.yaw)) * step;
        if (Math.hypot(x, z) <= 10 && Math.hypot(x, z) >= 1.25) {
          view.x = x;
          view.z = z;
        }
        if (
          time - sent >= 220 &&
          (!lastMove ||
            Math.hypot(lastMove.x - view.x, lastMove.z - view.z) > 0.02 ||
            Math.abs(lastMove.yaw - view.yaw) > 0.03)
        ) {
          lastMove = { x: view.x, z: view.z, yaw: view.yaw };
          sent = time;
          onMove(lastMove);
        }
      }
      camera.position.set(view.x, night ? 1.83 : 1.65, view.z);
      camera.rotation.set(pitch, view.yaw, 0);
      const color = night ? darkness : daylight;
      scene.background = color;
      if (scene.fog instanceof T.FogExp2) {
        scene.fog.color.copy(color);
        scene.fog.density = night ? 0.008 : 0.028;
      }
      ambient.intensity = night ? 0.48 : 2.55;
      sun.intensity = night ? 0 : 2.1;
      for (const [seat, { stand, flame }] of lanterns.entries()) {
        const member = members[seat];
        const position = spawn(seat, members.length);
        stand.position.set(position.x * 0.82, 0, position.z * 0.82);
        stand.visible = !!member && !night;
        flame.visible = member?.alive ?? false;
      }
      for (const [id, value] of pawns)
        if (!members.some((member) => member.id === id)) {
          scene.remove(value.mesh);
          freePawn(value.mesh);
          pawns.delete(id);
        }
      for (const [seat, member] of members.entries()) {
        if (member.id === me) continue;
        const variant = `${member.character}:${member.alive}`;
        let existing = pawns.get(member.id);
        const location =
          positions.find(({ player }) => player === member.id) ||
          spawn(seat, members.length);
        if (!existing || existing.variant !== variant) {
          if (existing) {
            scene.remove(existing.mesh);
            freePawn(existing.mesh);
          }
          const mesh = pawn(member.name, member.character, member.alive);
          mesh.userData.player = member.id;
          mesh.position.set(location.x, 0, location.z);
          scene.add(mesh);
          existing = { mesh, variant };
          pawns.set(member.id, existing);
        }
        existing.mesh.visible = !night && member.alive;
        const alpha = useControls.getState().reducedMotion
          ? 1
          : 1 - Math.exp(-delta * 12);
        existing.mesh.position.x = T.MathUtils.lerp(
          existing.mesh.position.x,
          location.x,
          alpha,
        );
        existing.mesh.position.z = T.MathUtils.lerp(
          existing.mesh.position.z,
          location.z,
          alpha,
        );
        existing.mesh.rotation.y = location.yaw + Math.PI;
      }
      renderer.render(scene, camera);
    });
    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      window.removeEventListener("keydown", input);
      window.removeEventListener("keyup", input);
      scene.traverse((item) => {
        if (item instanceof T.InstancedMesh) item.dispose();
        if (item instanceof T.Mesh) item.geometry.dispose();
      });
      for (const { flame } of lanterns) flame.material.dispose();
      for (const value of pawns.values()) freePawn(value.mesh);
      renderer.dispose();
      canvas.remove();
    };
  }, []);
  return (
    <div className="canvas" ref={ref}>
      {unavailable ? (
        <div className="loading">
          La scène 3D est indisponible. La partie reste jouable depuis le
          panneau.
        </div>
      ) : (
        <details className="controls">
          <summary>Caméra</summary>
          <label>
            Sensibilité
            <input
              type="range"
              min="0.3"
              max="2"
              step="0.1"
              value={sensitivity}
              onChange={(event) => setSensitivity(Number(event.target.value))}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(event) => setReducedMotion(event.target.checked)}
            />
            Mouvement réduit
          </label>
        </details>
      )}
    </div>
  );
}
