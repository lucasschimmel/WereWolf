import { type Camera, type Scene, Vector2, type WebGLRenderer } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const bloomResolution = 0.6;
const daylightBloom = 0.1;
const nightBloom = 0.23;
const bloomRadius = 0.32;
const bloomThreshold = 1.25;

/** Allocates the post-processing chain only when it is enabled. */
export function createBloom(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
) {
  const composer = new EffectComposer(renderer);
  const pass = new UnrealBloomPass(
    new Vector2(1, 1),
    daylightBloom,
    bloomRadius,
    bloomThreshold,
  );
  const output = new OutputPass();
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(pass);
  composer.addPass(output);

  return {
    resize(width: number, height: number, dpr: number) {
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
      pass.setSize(
        width * dpr * bloomResolution,
        height * dpr * bloomResolution,
      );
    },
    render(delta: number, night: number) {
      pass.strength = daylightBloom + night * (nightBloom - daylightBloom);
      composer.render(delta);
    },
    dispose() {
      output.dispose();
      pass.dispose();
      composer.dispose();
    },
  };
}
