export type Tier = "low" | "medium" | "high";
export type QualityPreference = "auto" | Tier;

export type Budget = {
  dpr: number;
  pixels: number;
  shadows: boolean;
  bloom: boolean;
  antialias: boolean;
  trees: number;
  treeLod: number;
  houseLod: number;
  puppetLod: number;
  bushes: number;
  flowerPatches: number;
  grass: number;
  stones: number;
  terrain: number;
  motes: number;
  smoke: number;
};

export const budgets: Record<Tier, Budget> = {
  low: {
    dpr: 1,
    pixels: 750_000,
    shadows: false,
    bloom: false,
    antialias: false,
    trees: 150,
    treeLod: 0,
    houseLod: 0,
    puppetLod: 16,
    bushes: 24,
    flowerPatches: 0,
    grass: 0,
    stones: 190,
    terrain: 42,
    motes: 24,
    smoke: 0,
  },
  medium: {
    dpr: 1.5,
    pixels: 1_600_000,
    shadows: false,
    bloom: false,
    antialias: true,
    trees: 320,
    treeLod: 33,
    houseLod: 27,
    puppetLod: 24,
    bushes: 48,
    flowerPatches: 12,
    grass: 450,
    stones: 480,
    terrain: 72,
    motes: 80,
    smoke: 32,
  },
  high: {
    dpr: 2,
    pixels: 3_700_000,
    shadows: true,
    bloom: true,
    antialias: true,
    trees: 480,
    treeLod: 56,
    houseLod: 42,
    puppetLod: 36,
    bushes: 80,
    flowerPatches: 26,
    grass: 1100,
    stones: 760,
    terrain: 100,
    motes: 140,
    smoke: 90,
  },
};

export function detectTier(): Tier {
  if (typeof window === "undefined") return "medium";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (coarse || cores <= 4 || (memory !== undefined && memory <= 4))
    return "low";
  if (small || cores <= 8) return "medium";
  return "high";
}

export function resolveTier(preference: QualityPreference): Tier {
  return preference === "auto" ? detectTier() : preference;
}

export function pixelRatio(
  budget: Budget,
  width: number,
  height: number,
  dpr: number,
) {
  return Math.min(dpr, budget.dpr, Math.sqrt(budget.pixels / (width * height)));
}

const minimumScale = 0.6;
const samplingSeconds = 1.5;
const maximumDetailReduction = 2;

/** Adapts GPU work using actual frame intervals, independent of simulation time. */
export class FrameGovernor {
  scale = 1;
  detailReduction = 0;
  private samples = 0;
  private total = 0;
  private cooldown = 3;

  constructor(
    public bloom: boolean,
    private readonly targetFps: number,
  ) {}

  resetSamples() {
    this.samples = 0;
    this.total = 0;
    this.cooldown = 3;
  }

  tick(delta: number) {
    if (delta <= 0) return false;
    this.cooldown -= delta;
    this.samples++;
    this.total += delta;
    if (this.total < samplingSeconds) return false;
    const average = this.total / this.samples;
    this.samples = 0;
    this.total = 0;
    if (this.cooldown > 0) return false;
    if (average > 1 / (this.targetFps * 0.8)) {
      this.cooldown = 2;
      if (this.bloom) {
        this.bloom = false;
        return true;
      }
      if (this.scale < 1 && this.detailReduction < maximumDetailReduction) {
        this.detailReduction++;
        return true;
      }
      if (this.scale > minimumScale) {
        this.scale = Math.max(minimumScale, this.scale - 0.15);
        return true;
      }
    } else if (average < 1 / (this.targetFps * 0.96) && this.scale < 1) {
      this.cooldown = 6;
      this.scale = Math.min(1, this.scale + 0.08);
      return true;
    }
    return false;
  }
}
