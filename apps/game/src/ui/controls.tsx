import { X } from "lucide-react";
import {
  Fragment,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { QualityPreference } from "../scene/quality";
import { useControls } from "../store";

export function Drawer({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="drawer-layer">
      <button
        type="button"
        className="drawer-scrim"
        aria-label="Fermer"
        onClick={onClose}
      />
      <aside className="drawer" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Joystick({ enabled }: { enabled: boolean }) {
  const setStick = useControls((state) => state.setStick);
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!enabled) {
      setStick(0, 0);
      setKnob({ x: 0, y: 0 });
    }
  }, [enabled, setStick]);
  useEffect(() => () => setStick(0, 0), [setStick]);
  if (!enabled) return null;
  const update = (event: PointerEvent) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    const radius = rect.width * 0.38;
    let dx = event.clientX - (rect.left + rect.width / 2);
    let dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    if (length > radius) {
      dx = (dx / length) * radius;
      dy = (dy / length) * radius;
    }
    setKnob({ x: dx, y: dy });
    setStick(dx / radius, dy / radius);
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    setStick(0, 0);
  };
  return (
    <div
      className="joystick"
      ref={base}
      aria-hidden="true"
      onPointerDown={(event) => {
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event);
      }}
      onPointerMove={(event) =>
        event.pointerId === pointer.current && update(event)
      }
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

const qualities: { value: QualityPreference; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "low", label: "Basse" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
];

const mouseKeys = [
  ["ZQSD · WASD", "Marcher (Maj pour courir)"],
  ["Glisser · ← →", "Tourner la caméra"],
  ["Molette · pincer", "Zoomer"],
  ["Viser · clic", "Cibler pendant une action"],
  ["Clic droit", "S’abstenir ou passer"],
] as const;
const touchKeys = [
  ["Joystick", "Marcher, pendant le débat"],
  ["Glisser", "Tourner la caméra"],
  ["Pincer", "Zoomer"],
  ["Toucher · liste", "Cibler un villageois pendant une action"],
  ["Appui long", "S’abstenir ou passer"],
] as const;

export function SettingsPanel({ touch = false }: { touch?: boolean }) {
  const {
    sensitivity,
    setSensitivity,
    reducedMotion,
    setReducedMotion,
    quality,
    setQuality,
  } = useControls();
  return (
    <div className="settings">
      <label className="field">
        <span>Sensibilité de la caméra</span>
        <input
          type="range"
          min="0.3"
          max="2"
          step="0.1"
          value={sensitivity}
          onChange={(event) => setSensitivity(Number(event.target.value))}
        />
      </label>
      <fieldset className="field">
        <legend>Qualité graphique</legend>
        <div className="segmented">
          {qualities.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-pressed={quality === option.value}
              onClick={() => setQuality(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="toggle">
        <input
          type="checkbox"
          checked={reducedMotion}
          onChange={(event) => setReducedMotion(event.target.checked)}
        />
        <span>Mouvement réduit · coupe les travellings de caméra</span>
      </label>
      <dl className="keys">
        {(touch ? touchKeys : mouseKeys).map(([key, effect]) => (
          <Fragment key={key}>
            <dt>{key}</dt>
            <dd>{effect}</dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
