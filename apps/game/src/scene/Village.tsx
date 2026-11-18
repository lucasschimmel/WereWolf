import { useEffect, useRef, useState } from "react";
import { useControls } from "../store";
import { resolveTier } from "./quality";
import { type SceneState, Stage } from "./stage";

export type { SceneState };

export default function Village(props: SceneState) {
  const host = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage>(null);
  const latest = useRef(props);
  latest.current = props;
  const quality = useControls((state) => state.quality);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!host.current || !veil.current) return;
    let created: Stage;
    try {
      created = new Stage(
        host.current,
        resolveTier(quality),
        latest.current,
        veil.current,
      );
    } catch (cause) {
      console.error("WebGL scene unavailable", cause);
      setFailed(true);
      return;
    }
    created.setState(latest.current);
    stage.current = created;
    return () => {
      stage.current = null;
      created.dispose();
    };
  }, [quality]);

  useEffect(() => {
    stage.current?.setState(props);
  });

  return (
    <div className="stage" ref={host}>
      <div className="stage-veil" ref={veil} aria-hidden="true" />
      {failed && (
        <p className="stage-fallback">
          La scène 3D est indisponible sur cet appareil. La partie reste jouable
          depuis l’interface.
        </p>
      )}
    </div>
  );
}
