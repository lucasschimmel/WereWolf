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
        <div className="stage-fallback">
          <p>
            La scène 3D est indisponible sur cet appareil. Tu peux quand même
            désigner quelqu’un ici.
          </p>
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
