export type Tier = "low" | "medium" | "high";
export type QualityPreference = "auto" | Tier;

export type Budget = {
  dpr: number;
  shadows: boolean;
  bloom: boolean;
  antialias: boolean;
  trees: number;
  grass: number;
  stones: number;
  terrain: number;
  motes: number;
};

export const budgets: Record<Tier, Budget> = {
  low: {
    dpr: 1,
    shadows: false,
    bloom: false,
    antialias: false,
    trees: 190,
    grass: 0,
    stones: 260,
    terrain: 48,
    motes: 40,
  },
  medium: {
    dpr: 1.5,
    shadows: false,
    bloom: false,
    antialias: true,
    trees: 320,
    grass: 450,
    stones: 480,
    terrain: 72,
    motes: 80,
  },
  high: {
    dpr: 2,
    shadows: true,
    bloom: true,
    antialias: true,
    trees: 480,
    grass: 1100,
    stones: 760,
    terrain: 100,
    motes: 140,
  },
};

export function detectTier(): Tier {
  if (typeof window === "undefined") return "medium";
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  if (coarse && (cores <= 4 || (memory !== undefined && memory <= 4)))
    return "low";
  if (coarse || small || cores <= 4) return "medium";
  return "high";
}

export function resolveTier(preference: QualityPreference): Tier {
  return preference === "auto" ? detectTier() : preference;
}

/** Lowers resolution, then post-processing, when frames run long. */
export class FrameGovernor {
  private samples = 0;
  private total = 0;
  private cooldown = 3;
  constructor(
    public dpr: number,
    private readonly maxDpr: number,
    public bloom: boolean,
  ) {}
  tick(delta: number) {
    this.cooldown -= delta;
    this.samples++;
    this.total += delta;
    if (this.total < 1.5) return false;
    const average = this.total / this.samples;
    this.samples = 0;
    this.total = 0;
    if (this.cooldown > 0) return false;
    if (average > 1 / 42) {
      this.cooldown = 2;
      if (this.bloom) {
        this.bloom = false;
        return true;
      }
      if (this.dpr > 0.7) {
        this.dpr = Math.max(0.7, this.dpr - 0.2);
        return true;
      }
    } else if (average < 1 / 58 && this.dpr < this.maxDpr) {
      this.cooldown = 6;
      this.dpr = Math.min(this.maxDpr, this.dpr + 0.1);
      return true;
    }
    return false;
  }
}
