import { useEffect, useRef, useState } from "react";
import { useControls } from "../store";
import { loadMap } from "./maps";
import { resolveTier } from "./quality";
import type { SceneState, Stage } from "./stage";

export type { SceneState };

export default function Village(props: SceneState) {
  const host = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage>(null);
  const latest = useRef(props);
  latest.current = props;
  const quality = useControls((state) => state.quality);
  const { id: mapId, seed } = props.map;
  const [status, setStatus] = useState<
    "loading" | "ready" | "lost" | "unavailable"
  >("loading");

  // biome-ignore lint/correctness/useExhaustiveDependencies: the stage reads the seed from the latest props, and a new one must rebuild the scenery.
  useEffect(() => {
    const container = host.current;
    const overlay = veil.current;
    if (!container || !overlay) return;
    let cancelled = false;
    setStatus("loading");
    const load = async () => {
      try {
        const [{ Stage }, map] = await Promise.all([
          import("./stage"),
          loadMap(mapId),
        ]);
        if (cancelled) return;
        stage.current = new Stage(
          container,
          resolveTier(quality),
          latest.current,
          overlay,
          (lost) => setStatus(lost ? "lost" : "ready"),
          map,
        );
        setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        console.warn("WebGL village unavailable", cause);
        setStatus("unavailable");
      }
    };
    // Let the HTML controls paint before the decorative home scene starts.
    let start = requestAnimationFrame(() => {
      start = requestAnimationFrame(() => void load());
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(start);
      stage.current?.dispose();
      stage.current = null;
    };
  }, [quality, mapId, seed]);

  useEffect(() => {
    stage.current?.setState(props);
  });

  return (
    <div className="stage" ref={host}>
      <div className="stage-veil" ref={veil} aria-hidden="true" />
      {status === "loading" && (
        <div className="stage-loading">
          {props.showcase ? "La place s’éveille…" : "Le village s’éveille…"}
        </div>
      )}
      {(status === "lost" ||
        status === "unavailable" ||
        (status === "loading" && props.targets.length > 0)) && (
        <div className="stage-fallback">
          {status === "lost" && <p>Le rendu 3D est interrompu.</p>}
          {status === "unavailable" && (
            <p>La scène 3D est indisponible sur cet appareil.</p>
          )}
          {props.targets.length > 0 && (
            <div className="fallback-targets">
              {props.members
                .filter((member) => props.targets.includes(member.id))
                .map((member) => (
                  <button
                    type="button"
                    key={member.id}
                    aria-pressed={props.selected === member.id}
                    onClick={() => props.onSelect(member.id)}
                  >
                    {member.name}
                  </button>
                ))}
              {props.onPass && (
                <button type="button" onClick={props.onPass}>
                  Passer
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
