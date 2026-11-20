# WereWolf — Game Design Document

**Version 0.1 · Proposition à valider**

WereWolf est un Loup-Garou privé pour **8 à 15 amis**, tous joueurs. Le groupe parle sur Discord. Dans le navigateur, chacun incarne un habitant d’un village en 3D sous Three.js. Le jeu distribue les rôles, orchestre les nuits et arbitre les votes. Une partie standard vise **20 à 30 minutes**, à confirmer en jeu.

## 1. Le village comme lieu de jeu

Les captures donnent deux repères de mise en scène : des joueurs physiquement présents autour d’une place et une bascule visible entre jour et nuit. Chaque salon se joue sur l’une de quatre cartes tirées au sort : un hameau palissadé, une île flottante, une clairière des brumes et un col enneigé. Toutes partagent la même place ronde, un foyer bas en son centre pour que chacun voie les joueurs d’en face, une cloche et un cercle de lanternes. Le décor s’adapte de 8 à 15 joueurs : une maison par joueur borde la place et des accessoires comblent les vides des petites tablées. Les silhouettes et les bâtiments s’inspirent du théâtre de marionnettes et des décors miniatures. Les rôles sont des **cartes à collectionner** (style TCG) : cadre aux couleurs du rôle, illustration, gemme de camp, texte de pouvoir et phrase d’ambiance. L’interface se limite à de petits panneaux, un bandeau d’état et ces cartes ; la scène 3D occupe tout l’écran.

- **Arrivée.** Le joueur apparaît directement sur une place, seul. Un petit panneau à gauche règle son prénom et sa silhouette, un autre à droite crée un salon ou en rejoint un avec un code. Aucun menu plein écran.
- **Salon.** Tous les joueurs se retrouvent sur la même place et se déclarent prêts. Le panneau de droite montre le code, le mode, le paquet exact en mini-cartes et le lancement. Le lancement verrouille les places et les règles. L’hôte reçoit une carte comme tout le monde.
- **Jour.** Déplacement libre autour de la place. Au début du vote, chacun rejoint son emplacement dans le cercle et un bandeau annonce le vote. On vote en **pointant** un villageois dans la scène, sans liste : survol pour viser, clic pour choisir, clic droit pour s’abstenir. Au clavier, Tab passe d’une cible à l’autre et Entrée valide.
- **Nuit.** Le village s’assombrit et chacun rentre chez lui. La nuit se joue **tour par tour** : quand vient son tour, le joueur voit sa carte, puis il est replacé seul sur la place pour pointer sa cible. Les autres joueurs y apparaissent en silhouettes endormies. Les loups jouent ensemble et voient la visée de leurs partenaires. Les présences, lumières et sons individuels ne trahissent aucune action.
- **Élimination.** La lanterne du joueur s’éteint. Il peut observer le village et consulter le journal public, avec les mêmes informations publiques que les vivants. Ses actions cessent après son éventuel pouvoir de mort. Sur Discord, les vivants parlent pendant le jour, tout le monde se tait la nuit et les éliminés peuvent rejoindre un salon séparé.
- **Fin.** Le tableau révèle les rôles, le camp gagnant et la chronologie des actions. Le groupe peut relancer avec le même paquet ou changer de configuration.

Le journal public affiche les changements de phase, les résultats de scrutin et les annonces de décès. L’interface affiche aussi la phase et son temps restant en texte. Une sensibilité réglable, une option de mouvement réduit et la visée au clavier (Tab, Entrée) permettent de jouer sans viser précisément ni dépendre d’un signal sonore.

## 2. Boucle et arbitrage

| Moment | Durée proposée | Décision |
|---|---:|---|
| Découverte et salutations | 45 s | Lecture privée de sa carte, courte prise de parole libre sur Discord |
| Nuit | Meute 30 s, puis 20 s par créneau d’action, Sorcière 20 s | Tour par tour, selon un horaire commun indépendant des choix privés |
| Aube | 10 s | Le village découvre les morts et, par défaut, leurs cartes |
| Résolution de l’aube | 15 s | Le Chasseur peut riposter après l’annonce. Dans les modes à cartes cachées, le créneau existe après tout décès si la configuration autorise le Chasseur |
| Débat | 150 s jusqu’à 10 joueurs, 180 s dès 11 | Discussion libre sur Discord |
| Vote | Au plus 30 s | Choix public en direct, modifiable jusqu’à clôture. Le vote s’achève peu après que tous les vivants ont voté ou se sont abstenus |
| Départage éventuel | Au plus 20 s | Second scrutin public entre les premiers ex æquo, même règle de clôture |
| Résolution éventuelle | 15 s | Fenêtre de riposte du Chasseur. Dans les modes à cartes cachées, elle suit toute élimination par verdict si la configuration autorise le Chasseur |

**Vote du village.** Chaque vivant peut voter pour un autre vivant ou s’abstenir. Les bulletins sont **publics en direct**, comme des mains levées : pendant le vote et le départage, chaque votant pointe sa cible du bras dans la scène, et tout le monde le voit. Les abstentions ne s’affichent pas. Chacun peut changer d’avis jusqu’à la clôture, qui tombe à la fin du temps ou 3 s après que tous les vivants ont voté ou se sont abstenus. À la clôture, le jeu publie les bulletins et les totaux dans le journal. Le premier au nombre de voix est éliminé. En cas d’égalité en tête, tous les vivants revotent entre les ex æquo avec la même règle d’auto-vote. Nouvelle égalité ou aucun suffrage valide : personne ne sort. L’absence de réponse vaut abstention. La partie commence par une nuit après les salutations.

**Vote de la meute.** Les loups connaissent leurs partenaires et voient leurs bulletins de nuit en direct. Chaque loup peut voter pour un vivant hors meute, modifier son choix ou s’abstenir. La cible avec le plus de voix est retenue. Une égalité en tête ou zéro voix annule l’attaque. Ce panneau constitue leur moyen de coordination nocturne.

**Ordre nocturne.** La nuit enchaîne un tour par carte d’action présente dans le paquet : la Meute (30 s), la Voyante, le Veilleur, puis les cartes de l’Atelier (20 s chacune). Pendant un tour, seuls ses détenteurs vivants agissent. La Voyante découvre le camp de sa cible aussitôt son choix fait, et ce choix est définitif. À la fin du dernier tour d’action, le jeu verrouille les cibles et applique la protection. Vient ensuite le tour de la Sorcière (20 s) : elle voit la victime provisoire, si l’attaque reste fatale, verse le remède en un clic, sort sur la place pour pointer la cible de son poison, puis **valide** son tour. Le jeu applique le soin, puis le poison, et regroupe les décès. La nuit s’arrête là : le Chasseur n’a pas de tour nocturne. L’aube annonce les morts ; si le Chasseur en fait partie, il riposte juste après l’annonce (15 s), puis le débat commence. Les paquets proposés contiennent au plus un Chasseur, donc la résolution comporte au plus une riposte.

**Durée des tours.** En multijoueur, un tour nocturne se termine à l’heure annoncée. L’entraînement solo peut avancer dès que les acteurs ont joué. Le traitement des cartes dont le détenteur est mort dépend du mode.

- **Cartes révélées à la mort** (Classique, Express, Chaos, Atelier avec révélation) : le tour est sauté. La mort du détenteur et sa carte sont déjà publiques, donc l’absence du tour ne révèle rien.
- **Cartes cachées** (Mystère, Atelier sans révélation) : chaque créneau conserve sa durée entière. Les rôles tirés au sort ont aussi un créneau lorsqu’ils sont autorisés par la configuration du salon.

**Décès.** Deux effets sur la même personne ne produisent qu’une élimination. Le Chasseur choisit parmi les vivants après le lot de décès qui l’a éliminé. Un délai expiré annule le tir. Le journal révèle les victimes et leurs cartes selon le mode. Les cibles sauvées, les rôles ayant agi et les causes privées restent secrets jusqu’à la fin.

**Victoire.** Après une résolution complète, le Village gagne si au moins un villageois survit et qu’il ne reste aucun loup. La Meute gagne si au moins un loup survit et si les loups sont aussi nombreux ou plus nombreux que les vivants hors meute. Ces conditions sont évaluées avant d’ouvrir la phase suivante. Si personne ne survit, la partie est nulle. En mode avec le Bouffon, sa victoire prioritaire s’applique si le verdict final d’un scrutin de jour l’élimine.

**Reconnexion et rythme.** Le lien de reprise rend au joueur sa place et son point de vue privé. Une déconnexion ne révèle aucune carte, n’empêche pas de cibler l’avatar et ne suspend pas la partie. Les choix déjà confirmés restent valides. L’hôte dispose de deux pauses de 60 secondes, utilisables pendant le débat. Une pause gèle le compte à rebours et reprend automatiquement à son terme. Une partie sans résolution après 7 cycles complets se termine sur un nul.

## 3. Catalogue des cartes officielles du projet

Le catalogue couvre les paquets proposés ci-dessous. Les pouvoirs « une fois par partie » sont consommés lors de la résolution d’un choix valide. Chaque carte spéciale apparaît au plus une fois par paquet.

| Carte | Camp | Pouvoir |
|---|---|---|
| Villageois | Village | Observe, débat et vote le jour. |
| Loup-garou | Meute | Connaît la meute et participe au choix collectif chaque nuit. Vote aussi de jour. |
| Voyante | Village | Chaque nuit, choisit un autre vivant et apprend son camp exact, y compris Solitaire en mode Chaos. |
| Veilleur | Village | Chaque nuit, protège un vivant contre l’attaque de la meute. Peut se protéger. Ne peut pas sélectionner la même personne deux nuits consécutives. Passer une nuit réinitialise cette restriction. La protection ne couvre que l’attaque de la meute. |
| Chasseur | Village | Lors de sa mort, peut éliminer un vivant. Le tir s’applique avant le contrôle de victoire. |
| Sorcière | Village | Dispose d’un remède et d’un poison, chacun à usage unique. Peut utiliser les deux la même nuit sur l’attaque provisoire et sur un autre vivant de son choix, respectivement. Peut se sauver elle-même si elle est la victime provisoire. Le remède annule uniquement l’attaque de la meute, y compris si le poison vise cette même cible par ailleurs. |
| Bouffon | Solitaire | Gagne seul s’il est éliminé par le verdict final du vote de jour. Une mort par un autre effet l’élimine sans victoire. Tant qu’il vit, il compte parmi les vivants hors meute. |

La Sorcière peut s’abstenir, choisir uniquement le poison même sans victime provisoire, ou soigner et empoisonner dans la même fenêtre. Le poison peut viser la victime provisoire si elle est un autre joueur. Dans ce cas, la cible soignée meurt du poison.

## 4. Compositions standard de 8 à 15

Les nombres indiquent le total de cartes distribuées, hôte compris. Veilleur et Sorcière alternent dans ces paquets pour garder une seule source de protection ou de soin. Les seuils ci-dessous sont des hypothèses de départ à éprouver sur les premières soirées.

| Joueurs | Loups | Villageois simples | Rôles spéciaux du Village |
|---:|---:|---:|---|
| 8 | 2 | 4 | Voyante, Veilleur |
| 9 | 2 | 4 | Voyante, Veilleur, Chasseur |
| 10 | 3 | 4 | Voyante, Sorcière, Chasseur |
| 11 | 3 | 5 | Voyante, Sorcière, Chasseur |
| 12 | 3 | 6 | Voyante, Sorcière, Chasseur |
| 13 | 3 | 7 | Voyante, Sorcière, Chasseur |
| 14 | 4 | 7 | Voyante, Sorcière, Chasseur |
| 15 | 4 | 8 | Voyante, Sorcière, Chasseur |

À **8**, une mauvaise journée laisse déjà peu de marge : après une attaque et un mauvais vote, deux loups font face à quatre villageois. La Voyante et le Veilleur donnent des options sans ajouter d’élimination. À **10**, la troisième voix de meute arrive avec la Sorcière et le Chasseur, qui rendent les résolutions plus explosives. Tester ce seuil en priorité. À **13**, la troisième voix de meute doit tenir face à dix villageois. À **14**, vérifier si la quatrième voix donne trop de contrôle sur le scrutin de jour.

## 5. Modes et disponibilité

Un seul mode est actif pour une partie. Les joueurs voient les modifications de règles avant de se déclarer prêts.

| Mode | 8–9 | 10–11 | 12–15 | Règles |
|---|---|---|---|---|
| Classique | Oui | Oui | Oui | Composition standard, cartes révélées à la mort, bulletins de jour publics en direct. |
| Express | Oui | Oui | Oui | Même composition. Débat de 75 s jusqu’à 10, 100 s dès 11, vote de 20 s, départage de 15 s. Nuit identique au Classique. |
| Mystère | Indisponible | Oui | Oui | Même composition. L’annonce publique indique les morts. Leurs cartes restent secrètes jusqu’au tableau final. |
| Chaos | Indisponible | Indisponible | Oui | Remplace un Villageois simple par le Bouffon. Révélation et rythme du Classique. |
| Atelier | Oui | Oui | Oui | Paquet personnalisé. Révélation des cartes à la mort activable par l’hôte. Rythme Classique. |

**Périmètre jouable proposé.** Commencer avec Classique, Express et les six cartes de camp Village ou Meute. Ajouter Mystère, Chaos et l’Atelier comme extensions une fois les règles de base éprouvées. Le mode Atelier et ses cartes font partie du design cible.

## 6. Atelier de création

Créer une carte consiste à remplir une fiche et choisir un effet dans une liste. L’hôte part d’un paquet standard pour la taille du groupe, remplace des cartes, puis enregistre un préréglage privé réutilisable. Les règles complètes sont consultables avant le lancement. Une carte a un **nom, un texte d’ambiance, un camp, un déclencheur, une cible, un effet, un nombre d’utilisations et une règle de visibilité**. L’éditeur génère aussi un texte de règles à partir des sélections.

| Champ de jeu | Choix proposés au premier Atelier |
|---|---|
| Camp | Village pour les cartes créées. Les loups du paquet conservent leur vote de meute. |
| Déclencheur | Première nuit ou chaque nuit, avec une action maximum par déclenchement. |
| Cible | Soi-même, autre vivant ou un vivant quelconque, selon l’effet. |
| Effet | Observer le camp, protéger de l’attaque de la meute, ou observer si la cible a soumis une action nocturne valide pendant les tours d’action de la nuit. Cette dernière lecture est rendue à la fin de ces tours et n’inclut ni les potions ni les ripostes. |
| Usages | Une fois par partie ou à chaque nuit admissible. Une restriction de cible précédente peut s’appliquer à une protection récurrente. |
| Visibilité | Choix et résultat privés. Les effets suivent l’ordre nocturne standard. |

**Exemples originaux.**

- **Le Guetteur du clocher · Village.** Une fois par partie, choisit un autre vivant. À la fin des tours d’action, il apprend si cette personne a confirmé une action valide cette nuit. Un vote valide de meute compte même si l’attaque échoue. Il ignore l’action et sa cible.
- **La Porteuse de braises · Village.** Première nuit uniquement, protège un autre vivant de l’attaque de la meute. Le village découvre les décès éventuels à l’aube selon ses règles habituelles.

**Règles de composition.** L’Atelier conserve le nombre de loups du standard et accueille au plus deux cartes créées différentes. Conserver au moins deux Villageois simples, un seul rôle d’observation récurrente et une seule carte de protection ou de soin, Sorcière comprise. L’éditeur indique précisément quelle carte retirer ou modifier quand une règle bloque le lancement. Aucun camp personnalisé en première version. Les choix sont figés pour toute la partie.

**Exemple à 10.** Remplacer la Voyante par le Guetteur et la Sorcière par la Porteuse conserve trois loups, quatre Villageois et le Chasseur. À l’aube, le Guetteur peut savoir qu’une cible a agi. Dans ce paquet, l’action peut venir aussi bien d’un loup que de la Porteuse, pendant la première nuit.

## 7. Validation en soirée

| Taille | Scénario à observer | Ce qui permet de juger |
|---|---|---|
| 8 | Première partie en Classique | Les joueurs comprennent leur première nuit et leur premier vote sans intervention de l’hôte. Le premier éliminé peut observer sans disposer d’informations supplémentaires. |
| 10 | Deux parties, Classique puis Express | Comparer temps de partie, nombre d’interventions au débat et fréquence des victoires rapides. Rejouer si possible en échangeant les camps. |
| 13–15 | Grande table, puis un essai Chaos à 12 ou plus | Les pseudonymes restent lisibles. Les joueurs suivent les votes. Le Bouffon crée un doute sans monopoliser les débats. |
| 8–15 | Essai Atelier et cas d’arbitrage | Vérifier qu’une carte se comprend à la lecture, qu’une égalité ou une déconnexion se résout et que soin, poison et riposte produisent un résultat explicable au tableau final. |

Après chaque partie, relever les durées par phase, le premier tour d’élimination, les égalités, les victoires et les moments où les joueurs ont dû demander une règle. Les choix à valider avant de passer à la suite sont le **village avec déplacements libres le jour**, la **révélation des cartes en Classique**, les **bulletins publics en direct** (effet de suivisme, avantage aux derniers votants), les **paliers de loups à 10 et 14**, et la **création de cartes par effets composables**.
