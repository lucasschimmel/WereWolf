import { GraduationCap } from "lucide-react";
import { useState } from "react";
import {
  campNames,
  cards,
  defaultSettings,
  maxPlayers,
  minPlayers,
  type Role,
} from "../../shared/rules";
import { RoleCard } from "./cards";
import { Drawer } from "./controls";
import {
  basics,
  camps,
  controls,
  modeGuide,
  roleTips,
  timeline,
} from "./guideData";

const tabs = [
  ["goal", "But"],
  ["flow", "Une partie"],
  ["cards", "Cartes"],
  ["modes", "Modes"],
  ["controls", "Commandes"],
  ["solo", "Solo"],
] as const;
type Tab = (typeof tabs)[number][0];

const roles = Object.keys(cards) as (keyof typeof cards)[];

/**
 * The "How to play" reference: goal, the course of a match, every card with
 * advice, the modes, the controls and the solo practice table.
 */
export function Guide({
  open,
  onClose,
  onSolo,
}: {
  open: boolean;
  onClose: () => void;
  /** Starts a solo table; offered at the top when provided. */
  onSolo?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("goal");
  const [preview, setPreview] = useState<Role>();
  return (
    <>
      <Drawer open={open} title="Comment jouer" onClose={onClose} wide>
        <div className="guide">
          <p className="guide-lead">
            Un village, des loups cachés. Chaque nuit la Meute dévore quelqu’un
            ; chaque jour le village vote pour en éliminer un. Personne ne
            connaît les autres cartes, à part les loups entre eux.
          </p>
          {onSolo && (
            <button type="button" className="primary" onClick={onSolo}>
              <GraduationCap size={16} /> Essayer en solo, avec des bots
            </button>
          )}
          <div className="guide-tabs" role="tablist" aria-label="Rubriques">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "goal" && (
            <section className="guide-section" aria-label="But du jeu">
              {camps.map((camp) => (
                <article key={camp.name} className={`guide-camp ${camp.tone}`}>
                  <h3>{camp.name}</h3>
                  <b>{camp.goal}</b>
                  <p>{camp.detail}</p>
                </article>
              ))}
              <ul className="guide-list">
                {basics.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          {tab === "flow" && (
            <ol className="guide-steps" aria-label="Déroulé d’une partie">
              {timeline.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          )}

          {tab === "cards" && (
            <section className="guide-section" aria-label="Les cartes">
              <p className="hint">Touche une carte pour la voir en grand.</p>
              <ul className="guide-cards">
                {roles.map((role) => (
                  <li key={role}>
                    <button type="button" onClick={() => setPreview(role)}>
                      <span className={`tag ${cards[role].camp}`}>
                        {campNames[cards[role].camp]}
                      </span>
                      <b>{cards[role].name}</b>
                      <span>{cards[role].text}</span>
                      <small>{roleTips[role]}</small>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="hint">
                Les cartes optionnelles dépendent de l’effectif : Chasseur dès 9
                joueurs, Sorcière et Cupidon dès 10, Petite Fille à 10–11,
                Nécromancien et Enfant Sauvage dès 12. L’hôte peut les activer
                dans le salon.
              </p>
            </section>
          )}

          {tab === "modes" && (
            <dl className="guide-section guide-modes">
              {modeGuide.map((mode) => (
                <div key={mode.name}>
                  <dt>{mode.name}</dt>
                  <dd>{mode.text}</dd>
                </div>
              ))}
            </dl>
          )}

          {tab === "controls" && (
            <section className="guide-section" aria-label="Commandes">
              <h3>Ordinateur</h3>
              <dl className="guide-keys">
                {controls.desktop.map(([key, text]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
              <h3>Téléphone</h3>
              <dl className="guide-keys">
                {controls.touch.map(([key, text]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
              <p className="hint">
                La nuit, seul le joueur dont c’est le tour peut agir : les
                autres dorment. Les votes de jour sont publics.
              </p>
            </section>
          )}

          {tab === "solo" && (
            <section className="guide-section" aria-label="Mode solo">
              <p>
                Le mode solo ouvre un salon privé où tous les autres sièges sont
                tenus par des bots. Rien à organiser : tu apprends à ton rythme.
              </p>
              <ul className="guide-list">
                <li>
                  {minPlayers} à {maxPlayers} joueurs, tous les modes et toutes
                  les cartes optionnelles.
                </li>
                <li>
                  Choisis ta carte pour t’entraîner : Voyante, Sorcière, Loup
                  Noir…
                </li>
                <li>
                  Un conseiller t’explique chaque étape et chaque pouvoir au
                  moment où tu en as besoin.
                </li>
                <li>
                  Passe les étapes d’attente (distribution, aube, débat) d’un
                  bouton.
                </li>
                <li>
                  Les bots jouent des coups légaux mais simples : ils votent
                  vite et parlent peu. C’est un terrain d’entraînement, pas un
                  adversaire.
                </li>
              </ul>
              {onSolo && (
                <button type="button" className="primary" onClick={onSolo}>
                  <GraduationCap size={16} /> Lancer une partie solo
                </button>
              )}
            </section>
          )}
        </div>
      </Drawer>
      {open && preview && (
        <div
          className="reveal guide-preview"
          role="dialog"
          aria-label="Aperçu de carte"
        >
          <button
            type="button"
            className="reveal-backdrop"
            aria-label="Fermer l’aperçu"
            onClick={() => setPreview(undefined)}
          />
          <RoleCard
            kind={preview}
            settings={defaultSettings}
            className="reveal-card"
          />
        </div>
      )}
    </>
  );
}
