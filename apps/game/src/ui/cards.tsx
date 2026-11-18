import {
  Crosshair,
  Drama,
  Eye,
  FlaskConical,
  House,
  type LucideIcon,
  PawPrint,
  Shield,
  Sparkles,
} from "lucide-react";
import {
  type Camp,
  campNames,
  cardFor,
  type Role,
  type Settings,
} from "../../shared/rules";

const emblems: Record<string, LucideIcon> = {
  villager: House,
  wolf: PawPrint,
  seer: Eye,
  guard: Shield,
  hunter: Crosshair,
  witch: FlaskConical,
  jester: Drama,
};

export const emblemFor = (role: Role): LucideIcon => emblems[role] ?? Sparkles;

export function Emblem({ role, size = 22 }: { role: Role; size?: number }) {
  const Icon = emblemFor(role);
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;
}

export function RoleCard({
  role,
  settings,
  size = "full",
  onClick,
}: {
  role: Role;
  settings: Settings;
  size?: "full" | "mini";
  onClick?: () => void;
}) {
  const card = cardFor(role, settings);
  const camp: Camp = card.camp;
  const content = (
    <>
      <span className="card-camp">{campNames[camp]}</span>
      <span className="card-emblem">
        <Emblem role={role} size={size === "mini" ? 20 : 46} />
      </span>
      <strong className="card-name">{card.name}</strong>
      {size === "full" && (
        <>
          <span className="card-rule">{card.text}</span>
          {"flavor" in card && card.flavor && (
            <em className="card-flavor">{card.flavor}</em>
          )}
        </>
      )}
    </>
  );
  if (onClick)
    return (
      <button
        type="button"
        className={`role-card ${size} camp-${camp}`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  return <div className={`role-card ${size} camp-${camp}`}>{content}</div>;
}
