import { Eye } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  type Camp,
  campNames,
  cardFor,
  type Role,
  type Settings,
} from "../../shared/rules";
import guardArt from "../assets/cards/guard.webp";
import hunterArt from "../assets/cards/hunter.webp";
import jesterArt from "../assets/cards/jester.webp";
import littleGirlArt from "../assets/cards/little-girl.webp";
import seerArt from "../assets/cards/seer.webp";
import villagerArt from "../assets/cards/villager.webp";
import witchArt from "../assets/cards/witch.webp";
import wolfArt from "../assets/cards/wolf.webp";

/** Fully illustrated card faces, one per built-in role (custom cards are drawn live). */
const faces: Record<string, string> = {
  wolf: wolfArt,
  villager: villagerArt,
  seer: seerArt,
  littleGirl: littleGirlArt,
  guard: guardArt,
  hunter: hunterArt,
  witch: witchArt,
  jester: jesterArt,
};

/** Visual theme of each card: frame, panels and the accent used for text. */
const themes: Record<
  string,
  { frame: string; inner: string; bar: string; art: string; accent: string }
> = {
  wolf: {
    frame: "#5a1b1e",
    inner: "#2a0f14",
    bar: "#3e1418",
    art: "#1a1020",
    accent: "#f09a8e",
  },
  villager: {
    frame: "#6b5538",
    inner: "#33291d",
    bar: "#4a3b28",
    art: "#2e3b52",
    accent: "#e7c98f",
  },
  seer: {
    frame: "#2c3a78",
    inner: "#141a3a",
    bar: "#1e2858",
    art: "#141a3a",
    accent: "#afc4ff",
  },
  littleGirl: {
    frame: "#60465b",
    inner: "#261b2c",
    bar: "#493447",
    art: "#241a36",
    accent: "#f2c7da",
  },
  guard: {
    frame: "#7a5c1e",
    inner: "#2e2410",
    bar: "#4e3b14",
    art: "#22304a",
    accent: "#f0c75e",
  },
  witch: {
    frame: "#4a2a6e",
    inner: "#1d1430",
    bar: "#33204e",
    art: "#1d1430",
    accent: "#b9eb8e",
  },
  hunter: {
    frame: "#6a4a22",
    inner: "#22301f",
    bar: "#3e2e16",
    art: "#22301f",
    accent: "#f2a35c",
  },
  jester: {
    frame: "#5a2266",
    inner: "#2a1530",
    bar: "#3e1a48",
    art: "#2a1530",
    accent: "#f2c35d",
  },
  custom: {
    frame: "#2f5a5a",
    inner: "#12262a",
    bar: "#1b3a3e",
    art: "#132a30",
    accent: "#9fe0d6",
  },
};

const gems: Record<Camp, string> = {
  village: "#5fbf6a",
  pack: "#e5483b",
  solo: "#b78cf2",
};

const timing: Record<string, string> = {
  wolf: "Chaque nuit",
  villager: "Le jour",
  seer: "Chaque nuit",
  littleGirl: "Chaque nuit",
  guard: "Chaque nuit",
  witch: "Une fois chacune",
  hunter: "À sa mort",
  jester: "Le jour",
};

const flavors: Record<string, string> = {
  wolf: "Le jour, il vote avec vous. Et il sourit.",
  villager: "Le nombre est sa seule arme. C’est déjà beaucoup.",
  seer: "Les âmes n’ont pas de secret pour elle.",
  guard: "Sa lanterne ne s’éteint jamais avant l’aube.",
  witch: "Deux fioles. Aucun remords.",
  hunter: "Il ne rate jamais son dernier tir.",
  jester: "Pendez-le. C’est exactement ce qu’il veut.",
};

const numbers: Record<string, string> = {
  wolf: "01",
  villager: "02",
  seer: "03",
  guard: "04",
  witch: "05",
  hunter: "06",
  jester: "07",
  littleGirl: "08",
};

export const themeOf = (role: Role) =>
  role.startsWith("custom:") ? "custom" : role;
export const accentOf = (role: Role) => themes[themeOf(role)].accent;

/** Flat illustration of a role, drawn for the card's art window. */
export function RoleArt({ kind: role }: { kind: Role }) {
  if (role === "littleGirl")
    return <Eye size="42%" color={accentOf(role)} aria-hidden="true" />;
  const art = arts[themeOf(role)] ?? arts.custom;
  return (
    <svg
      viewBox="0 0 264 176"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      {art}
    </svg>
  );
}

const arts: Record<string, ReactNode> = {
  wolf: (
    <>
      <circle cx="182" cy="70" r="48" fill="#eadfc8" />
      <circle cx="166" cy="58" r="8" fill="#d6c9ae" />
      <path
        d="M0 150 Q70 118 140 140 T264 132 L264 176 L0 176 Z"
        fill="#0e0a14"
      />
      <path
        d="M58 176 L62 128 Q58 104 74 92 L82 72 L78 50 L92 60 L104 38 L110 56 Q126 60 130 74 L120 80 Q108 82 104 94 Q118 112 116 140 L124 176 Z"
        fill="#07050b"
      />
      <circle cx="104" cy="64" r="3" fill="#e5483b" />
    </>
  ),
  villager: (
    <>
      <circle cx="216" cy="44" r="18" fill="#f3e3b8" />
      <path
        d="M0 140 Q90 112 170 132 T264 124 L264 176 L0 176 Z"
        fill="#26402f"
      />
      <path d="M80 150 L80 92 L132 52 L184 92 L184 150 Z" fill="#8a6a50" />
      <path
        d="M70 96 L132 44 L194 96 L184 102 L132 60 L80 102 Z"
        fill="#8e3b30"
      />
      <rect x="100" y="104" width="26" height="28" fill="#ffc56b" />
      <rect x="144" y="112" width="22" height="38" fill="#3b2a1e" />
    </>
  ),
  seer: (
    <>
      <circle
        cx="132"
        cy="84"
        r="58"
        fill="#2c3a86"
        stroke="#9db6ff"
        strokeWidth="3"
      />
      <path d="M96 84 Q132 56 168 84 Q132 112 96 84 Z" fill="#cfe0ff" />
      <circle cx="132" cy="84" r="12" fill="#141a3a" />
      <circle cx="136" cy="80" r="3" fill="#fff" />
      <path d="M92 176 L104 140 L160 140 L172 176 Z" fill="#6b4e2e" />
    </>
  ),
  guard: (
    <>
      <path
        d="M132 22 L190 44 Q188 118 132 156 Q76 118 74 44 Z"
        fill="#b8862e"
      />
      <path
        d="M132 34 L178 52 Q176 112 132 142 Q88 112 86 52 Z"
        fill="#e0b84e"
      />
      <rect x="116" y="70" width="32" height="44" rx="4" fill="#3a2a14" />
      <path d="M132 76 Q144 92 132 106 Q120 92 132 76 Z" fill="#ffe29a" />
    </>
  ),
  witch: (
    <>
      <rect x="70" y="40" width="24" height="30" fill="#d9cdb4" />
      <circle cx="82" cy="110" r="46" fill="#4e9a3a" />
      <path
        d="M40 112 Q82 96 124 112 Q120 150 82 156 Q44 150 40 112 Z"
        fill="#9be070"
      />
      <rect x="166" y="30" width="20" height="40" fill="#d9cdb4" />
      <path d="M148 156 L156 70 L196 70 L204 156 Z" fill="#6a3da0" />
      <path d="M151 120 L201 120 L204 156 L148 156 Z" fill="#b07cf0" />
      <circle cx="96" cy="26" r="5" fill="#9be070" />
      <circle cx="200" cy="16" r="4" fill="#c9a6ff" />
    </>
  ),
  hunter: (
    <>
      <path d="M20 176 L50 70 L80 176 Z" fill="#17261a" />
      <path d="M190 176 L224 60 L258 176 Z" fill="#17261a" />
      <path
        d="M92 28 Q172 88 92 148"
        stroke="#a86a32"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M92 28 L92 148" stroke="#eadfc8" strokeWidth="2" />
      <path d="M70 88 L212 88" stroke="#eadfc8" strokeWidth="4" />
      <path d="M212 88 L196 78 L196 98 Z" fill="#e58b3a" />
    </>
  ),
  jester: (
    <>
      <path
        d="M70 124 Q60 60 24 46 Q76 46 108 96 Q122 30 132 18 Q142 30 156 96 Q188 46 240 46 Q204 60 194 124 Z"
        fill="#b07cf0"
      />
      <path d="M108 96 Q122 30 132 18 Q142 30 156 96 Z" fill="#f2b33d" />
      <rect x="62" y="122" width="140" height="26" rx="6" fill="#f2b33d" />
      <circle cx="24" cy="46" r="9" fill="#f5eedd" />
      <circle cx="132" cy="16" r="9" fill="#f5eedd" />
      <circle cx="240" cy="46" r="9" fill="#f5eedd" />
    </>
  ),
  custom: (
    <>
      <circle cx="132" cy="88" r="50" fill="#1f4a50" />
      <path
        d="M132 44 L146 80 L184 88 L146 96 L132 132 L118 96 L80 88 L118 80 Z"
        fill="#9fe0d6"
      />
    </>
  ),
};

export type CardSize = "full" | "hand" | "mini";

/** A role as a trading card: name, camp gem, art, power and flavour text. */
export function RoleCard({
  kind: role,
  settings,
  size = "full",
  onClick,
  label,
  className = "",
}: {
  /** The role shown on the card (named `kind` to stay clear of ARIA `role`). */
  kind: Role;
  settings: Settings;
  size?: CardSize;
  onClick?: () => void;
  label?: string;
  className?: string;
}) {
  const card = cardFor(role, settings);
  const theme = themes[themeOf(role)];
  const style = {
    "--frame": theme.frame,
    "--inner": theme.inner,
    "--bar": theme.bar,
    "--art": theme.art,
    "--accent": theme.accent,
  } as CSSProperties;
  const flavor =
    "flavor" in card && card.flavor ? card.flavor : flavors[themeOf(role)];
  const uses = role === "witch" ? 2 : role === "hunter" ? 1 : 0;
  const face = faces[themeOf(role)];
  const body = face ? (
    <img className="tcg-face" src={face} alt="" draggable={false} />
  ) : (
    <span className="tcg-inner">
      <span className="tcg-head">
        <span className="tcg-name">{card.name}</span>
        <svg
          className="tcg-gem"
          viewBox="0 0 28 28"
          role="img"
          aria-label={`Camp : ${campNames[card.camp]}`}
        >
          <path
            d="M14 2 L25 14 L14 26 L3 14 Z"
            fill={gems[card.camp]}
            stroke="#f5eedd"
            strokeWidth="2"
          />
        </svg>
      </span>
      <span className="tcg-art">
        <RoleArt kind={role} />
      </span>
      {size !== "mini" && (
        <>
          <span className="tcg-type">
            <span>{campNames[card.camp]}</span>
            <span>{timing[themeOf(role)] ?? "La nuit"}</span>
          </span>
          <span className="tcg-text">
            <span className="tcg-power">{card.text}</span>
            {flavor && <span className="tcg-flavor">{flavor}</span>}
          </span>
          <span className="tcg-foot">
            <span>WW · {numbers[themeOf(role)] ?? "∗"}</span>
            <span className="tcg-pips">
              {Array.from({ length: uses }, (_, index) => (
                <i key={String(index)} />
              ))}
            </span>
          </span>
        </>
      )}
    </span>
  );
  const classes =
    `tcg tcg-${size} ${face ? "tcg-photo" : ""} ${className}`.trim();
  if (onClick)
    return (
      <button
        type="button"
        className={classes}
        style={style}
        onClick={onClick}
        aria-label={label ?? `Ta carte : ${card.name}`}
      >
        {body}
      </button>
    );
  return (
    <div className={classes} style={style} role="img" aria-label={card.name}>
      {body}
    </div>
  );
}

/** The shared card back, shown before a card is revealed. */
export function CardBack({ className = "" }: { className?: string }) {
  return (
    <div className={`tcg tcg-back ${className}`.trim()} aria-hidden="true">
      <span className="tcg-inner">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="#14152a"
            stroke="#efe6d3"
            strokeWidth="3"
          />
          <circle cx="74" cy="46" r="26" fill="#efe6d3" />
          <circle cx="86" cy="38" r="24" fill="#14152a" />
          <path
            d="M30 96 L36 66 L30 50 L42 58 L50 44 L54 60 Q66 66 64 80 L70 96 Z"
            fill="#e5483b"
          />
        </svg>
      </span>
    </div>
  );
}
