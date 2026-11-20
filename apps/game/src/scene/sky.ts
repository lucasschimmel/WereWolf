import * as T from "three";
import { Builder, type Materials, rng, softDot } from "./kit";
import type { Budget } from "./quality";

export type Look = "day" | "golden" | "dusk" | "night" | "dawn" | "eclipse";

export type Preset = {
  top: string;
  horizon: string;
  bottom: string;
  fog: string;
  near: number;
  far: number;
  sun: string;
  sunIntensity: number;
  sunDirection: [number, number, number];
  sky: string;
  ground: string;
  hemi: number;
  glow: number;
  night: number;
  exposure: number;
  plaza: number;
};

/** Per-map tweaks layered over the shared looks. */
export type Mood = Partial<Record<Look, Partial<Preset>>>;

const presets: Record<Look, Preset> = {
  day: {
    top: "#5d93d1",
    horizon: "#f2dcb4",
    bottom: "#76805c",
    fog: "#d9d8c4",
    near: 40,
    far: 260,
    sun: "#fff0d2",
    sunIntensity: 2.7,
    sunDirection: [0.45, 0.78, 0.35],
    sky: "#e3edff",
    ground: "#66724a",
    hemi: 1.25,
    glow: 0.35,
    night: 0,
    exposure: 1,
    plaza: 0,
  },
  golden: {
    top: "#5679b8",
    horizon: "#ffc98c",
    bottom: "#6d6450",
    fog: "#e9c39a",
    near: 34,
    far: 230,
    sun: "#ffc887",
    sunIntensity: 2.3,
    sunDirection: [-0.6, 0.38, -0.45],
    sky: "#ffe2c0",
    ground: "#5e5440",
    hemi: 1.05,
    glow: 0.8,
    night: 0,
    exposure: 1,
    plaza: 0.2,
  },
  dusk: {
    top: "#2d3a6b",
    horizon: "#f08a5d",
    bottom: "#33303d",
    fog: "#9d6d68",
    near: 26,
    far: 190,
    sun: "#ff9d64",
    sunIntensity: 1.5,
    sunDirection: [-0.75, 0.16, -0.5],
    sky: "#ffb28c",
    ground: "#3a3348",
    hemi: 0.85,
    glow: 1.7,
    night: 0.35,
    exposure: 1.05,
    plaza: 0.7,
  },
  night: {
    top: "#060a1a",
    horizon: "#1c2a4f",
    bottom: "#0a0d17",
    fog: "#141c33",
    near: 18,
    far: 150,
    sun: "#8ea8ff",
    sunIntensity: 1.1,
    sunDirection: [0.35, 0.62, -0.7],
    sky: "#3b508c",
    ground: "#11131d",
    hemi: 1.0,
    glow: 2.8,
    night: 1,
    exposure: 1.3,
    plaza: 1,
  },
  dawn: {
    top: "#4c6aa6",
    horizon: "#ffbf94",
    bottom: "#4b4850",
    fog: "#d9b4a6",
    near: 28,
    far: 210,
    sun: "#ffcf9e",
    sunIntensity: 1.9,
    sunDirection: [0.78, 0.22, 0.42],
    sky: "#ffd9c0",
    ground: "#4b5040",
    hemi: 1,
    glow: 0.9,
    night: 0.12,
    exposure: 1.02,
    plaza: 0.3,
  },
  eclipse: {
    top: "#10050a",
    horizon: "#6e1b1d",
    bottom: "#0d0709",
    fog: "#2a1012",
    near: 18,
    far: 150,
    sun: "#ff6a52",
    sunIntensity: 0.7,
    sunDirection: [0.35, 0.62, -0.7],
    sky: "#7d2a2a",
    ground: "#160a0c",
    hemi: 0.9,
    glow: 2.4,
    night: 1,
    exposure: 1.25,
    plaza: 0.9,
  },
};

const vertexShader = `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  vec4 world = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
  gl_Position.z = gl_Position.w;
}`;
const fragmentShader = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSun;
uniform vec3 uSunColor;
uniform float uDay;
varying vec3 vDirection;
void main() {
  vec3 direction = normalize(vDirection);
  float h = direction.y;
  vec3 color = h > 0.0
    ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5))
    : mix(uHorizon, uBottom, pow(clamp(-h, 0.0, 1.0), 0.35));
  float sun = max(dot(direction, normalize(uSun)), 0.0);
  color += uSunColor * (pow(sun, 900.0) * 6.0 + pow(sun, 14.0) * 0.32) * uDay;
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

type State = {
  top: T.Color;
  horizon: T.Color;
  bottom: T.Color;
  fog: T.Color;
  sun: T.Color;
  sky: T.Color;
  ground: T.Color;
  sunDirection: T.Vector3;
  near: number;
  far: number;
  sunIntensity: number;
  hemi: number;
  glow: number;
  night: number;
  exposure: number;
  plaza: number;
};

function stateFrom(preset: Preset): State {
  return {
    top: new T.Color(preset.top),
    horizon: new T.Color(preset.horizon),
    bottom: new T.Color(preset.bottom),
    fog: new T.Color(preset.fog),
    sun: new T.Color(preset.sun),
    sky: new T.Color(preset.sky),
    ground: new T.Color(preset.ground),
    sunDirection: new T.Vector3(...preset.sunDirection).normalize(),
    near: preset.near,
    far: preset.far,
    sunIntensity: preset.sunIntensity,
    hemi: preset.hemi,
    glow: preset.glow,
    night: preset.night,
    exposure: preset.exposure,
    plaza: preset.plaza,
  };
}

const moonDirection = new T.Vector3(0.35, 0.5, -0.8).normalize();

export class Atmosphere {
  readonly group = new T.Group();
  readonly sun: T.DirectionalLight;
  readonly hemi: T.HemisphereLight;
  readonly plazaLight: T.PointLight;
  readonly fog: T.Fog;
  private state: State;
  private target: State;
  private dome: T.Mesh<T.SphereGeometry, T.ShaderMaterial>;
  private stars: T.Points<T.BufferGeometry, T.PointsMaterial>;
  private moon: T.Mesh<T.CircleGeometry, T.MeshBasicMaterial>;
  private moonHalo: T.Sprite;
  private clouds: T.Mesh;
  private lightDirection = new T.Vector3();
  look: Look = "dusk";

  constructor(
    private scene: T.Scene,
    budget: Budget,
    materials: Materials,
    private mood: Mood = {},
  ) {
    this.state = this.preset("dusk");
    this.target = this.preset("dusk");
    this.fog = new T.Fog(this.state.fog, this.state.near, this.state.far);
    scene.fog = this.fog;
    this.dome = new T.Mesh(
      new T.SphereGeometry(500, 32, 16),
      new T.ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: T.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: this.state.top },
          uHorizon: { value: this.state.horizon },
          uBottom: { value: this.state.bottom },
          uSun: { value: this.state.sunDirection },
          uSunColor: { value: this.state.sun },
          uDay: { value: 1 },
        },
      }),
    );
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    const random = rng(7);
    const starPositions: number[] = [];
    const starColors: number[] = [];
    const color = new T.Color();
    for (let index = 0; index < 900; index++) {
      const theta = random() * Math.PI * 2;
      const y = 0.08 + random() * 0.92;
      const radius = Math.sqrt(1 - y * y);
      starPositions.push(
        Math.cos(theta) * radius * 450,
        y * 450,
        Math.sin(theta) * radius * 450,
      );
      color.setHSL(0.58 + random() * 0.12, 0.4, 0.75 + random() * 0.25);
      starColors.push(color.r, color.g, color.b);
    }
    const starGeometry = new T.BufferGeometry();
    starGeometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(starPositions, 3),
    );
    starGeometry.setAttribute(
      "color",
      new T.Float32BufferAttribute(starColors, 3),
    );
    this.stars = new T.Points(
      starGeometry,
      new T.PointsMaterial({
        size: 2.2,
        sizeAttenuation: false,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        fog: false,
        map: softDot(),
      }),
    );
    this.stars.frustumCulled = false;
    this.group.add(this.stars);

    this.moon = new T.Mesh(
      new T.CircleGeometry(16, 32),
      new T.MeshBasicMaterial({
        color: "#fff3dc",
        transparent: true,
        fog: false,
        depthWrite: false,
      }),
    );
    this.moon.position.copy(moonDirection).multiplyScalar(420);
    this.moon.lookAt(0, 0, 0);
    this.group.add(this.moon);
    this.moonHalo = new T.Sprite(
      new T.SpriteMaterial({
        map: softDot(),
        color: "#9fb6ff",
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    this.moonHalo.position.copy(this.moon.position);
    this.moonHalo.scale.setScalar(150);
    this.group.add(this.moonHalo);

    const cloud = new Builder(random, 0.03);
    for (let index = 0; index < 9; index++) {
      const angle = (index / 9) * Math.PI * 2 + random();
      const distance = 110 + random() * 80;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = 48 + random() * 22;
      for (let puff = 0; puff < 5; puff++)
        cloud.ball(
          "#f4efe9",
          [6 + random() * 5, 3.2 + random() * 2, 5 + random() * 4],
          [x + (puff - 2) * 6, y + random() * 2, z + (random() - 0.5) * 6],
        );
    }
    this.clouds = new T.Mesh(cloud.build(), materials.solid);
    this.group.add(this.clouds);

    this.hemi = new T.HemisphereLight(this.state.sky, this.state.ground, 1);
    this.sun = new T.DirectionalLight(this.state.sun, 2);
    if (budget.shadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      const camera = this.sun.shadow.camera;
      camera.left = camera.bottom = -30;
      camera.right = camera.top = 30;
      camera.near = 1;
      camera.far = 120;
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.03;
    }
    this.plazaLight = new T.PointLight("#ffb46b", 0, 16, 1.6);
    this.plazaLight.position.set(0, 3.4, 0);
    scene.add(this.hemi, this.sun, this.sun.target, this.plazaLight);
    scene.add(this.group);
    this.set("dusk", true);
  }

  private preset(look: Look) {
    return stateFrom({ ...presets[look], ...this.mood[look] });
  }

  get night() {
    return this.state.night;
  }
  get glow() {
    return this.state.glow;
  }

  setShadows(enabled: boolean) {
    this.sun.castShadow = enabled;
  }

  setOutdoors(outside: boolean) {
    this.plazaLight.visible = outside;
  }

  set(look: Look, immediate = false) {
    this.look = look;
    this.target = this.preset(look);
    if (immediate) this.state = this.preset(look);
    const uniforms = this.dome.material.uniforms;
    uniforms.uTop.value = this.state.top;
    uniforms.uHorizon.value = this.state.horizon;
    uniforms.uBottom.value = this.state.bottom;
    uniforms.uSun.value = this.state.sunDirection;
    uniforms.uSunColor.value = this.state.sun;
  }

  update(
    delta: number,
    camera: T.Camera,
    renderer: T.WebGLRenderer,
    focus: T.Vector3,
  ) {
    const k = 1 - Math.exp(-delta * 0.85);
    const s = this.state;
    const t = this.target;
    for (const key of [
      "top",
      "horizon",
      "bottom",
      "fog",
      "sun",
      "sky",
      "ground",
    ] as const)
      s[key].lerp(t[key], k);
    s.sunDirection.lerp(t.sunDirection, k).normalize();
    for (const key of [
      "near",
      "far",
      "sunIntensity",
      "hemi",
      "glow",
      "night",
      "exposure",
      "plaza",
    ] as const)
      s[key] += (t[key] - s[key]) * k;

    this.group.position.copy(camera.position);
    this.fog.color.copy(s.fog);
    this.fog.near = s.near;
    this.fog.far = s.far;
    this.dome.material.uniforms.uDay.value = 1 - s.night;
    this.hemi.color.copy(s.sky);
    this.hemi.groundColor.copy(s.ground);
    this.hemi.intensity = s.hemi;
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.sunIntensity;
    const lightDirection = this.lightDirection
      .copy(s.sunDirection)
      .lerp(moonDirection, s.night)
      .normalize();
    this.sun.target.position.copy(focus);
    this.sun.position.copy(focus).addScaledVector(lightDirection, 60);
    this.plazaLight.intensity = s.plaza * 14;
    this.stars.material.opacity = s.night;
    this.stars.visible = s.night > 0.02;
    this.moon.material.opacity = s.night;
    this.moon.material.color.set(
      this.look === "eclipse" ? "#ff8a73" : "#fff3dc",
    );
    this.moonHalo.material.opacity = s.night * 0.35;
    this.moon.visible = this.moonHalo.visible = s.night > 0.02;
    this.clouds.rotation.y += delta * 0.004;
    renderer.toneMappingExposure = s.exposure;
  }

  dispose() {
    this.scene.remove(
      this.group,
      this.hemi,
      this.sun,
      this.sun.target,
      this.plazaLight,
    );
    this.dome.geometry.dispose();
    this.dome.material.dispose();
    this.stars.geometry.dispose();
    this.stars.material.dispose();
    this.moon.geometry.dispose();
    this.moon.material.dispose();
    this.moonHalo.material.dispose();
    this.clouds.geometry.dispose();
    this.sun.dispose();
  }
}
