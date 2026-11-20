# WereWolf — Métiers et veillées

**Version 0.1 · Proposition à valider** · complète le [GDD](GDD.md)

Aujourd’hui, un joueur qui n’est pas appelé la nuit regarde un écran fixe pendant plusieurs minutes. Cette proposition remplace les 8 silhouettes par **15 métiers**. Chacun a sa couleur, sa maison sur la place, son intérieur, un compagnon et une **veillée**, c’est-à-dire une petite activité de nuit qui n’influence jamais la partie.

## 1. Règles de conception

1. **Le métier n’a aucun lien avec la carte.** On le choisit dans le salon, avant la distribution. Dire sur Discord « je pétris mon pain » ne révèle rien.
2. **Un métier par joueur.** Les 15 métiers couvrent la plus grande table, et deux joueurs ne partagent jamais la même couleur. Sur Discord, on peut se désigner par son métier (« le Boulanger a voté contre moi »), et l’avatar du chat reprend la couleur du métier.
3. **Ce que les autres voient ne dépend pas du temps de jeu.** Les loups et les rôles appelés passent une partie de la nuit sur la place et ont moins de temps libre. Si les ouvrages se voyaient selon l’effort fourni, « Bob n’a fait que deux pains » désignerait un loup. Donc :
   - **un ouvrage par nuit et par joueur.** S’il est inachevé à l’aube, la nuit le termine toute seule ;
   - l’extérieur de la maison est fixe pour un métier donné. La cheminée fume, la forge rougeoie et les lanternes brillent **toute la nuit, chez tout le monde**, comme le demande déjà la section « Nuit » du GDD ;
   - l’habileté du joueur ne change que des détails visibles **à l’intérieur, par lui seul**.
4. **Interruption immédiate.** Quand le tour du joueur commence, la veillée se fige, puis elle reprend au même geste. Il n’y a ni échec, ni chrono, ni score.
5. **Boucles courtes.** Un ouvrage se fait en 3 ou 4 gestes de 10 à 20 secondes, et la nuit peut s’arrêter à n’importe lequel.
6. **Aucun compte et aucune sauvegarde.** Tout repart à zéro à chaque partie. L’ouvrage du soir dépend seulement du numéro de la nuit, donc **la veillée ne nécessite aucun état serveur**.
7. **Jouable partout :** au pointeur, au toucher et au clavier (Espace, flèches, Entrée), avec un son discret qui ne couvre jamais le Héraut.
8. **Aucun nom de métier ne reprend un nom de rôle.** Le personnage « Le Veilleur » actuel devient **le Sonneur**. On évite aussi Chasseur, Sorcière, Corbeau, etc.

## 2. Les cinq gestes

Les 15 veillées reposent sur 5 mécaniques, avec 3 habillages chacune. On construit et règle 5 mini-jeux, pas 15.

| Geste          | Principe                                                                             | Clavier          |
| -------------- | ------------------------------------------------------------------------------------ | ---------------- |
| **Cadence**    | Taper en rythme sur un repère qui pulse. Rater ne fait que ralentir.                 | Espace           |
| **Dosage**     | Maintenir pour verser, relâcher près du trait. Un débordement est simplement essuyé. | Maintenir Espace |
| **Tracé**      | Suivre un motif au pointeur. Le tracé se recentre tout seul.                         | Flèches          |
| **Assemblage** | Glisser des pièces dans leur emplacement, qui s’aimantent.                           | Tab puis Entrée  |
| **Rotation**   | Tourner en cercle (souris, doigt ou flèches) pour faire avancer une jauge.           | ← →              |

## 3. Les quinze métiers

Les couleurs sont à valider à l’écran. Elles doivent se distinguer par la teinte ou par la luminosité, en pastille de chat comme sur la marionnette.

| Métier        | Couleur · liseré                         | Maison sur la place                            | Veillée                                                  | Ouvrage du soir                      | Compagnon         |
| ------------- | ---------------------------------------- | ---------------------------------------------- | -------------------------------------------------------- | ------------------------------------ | ----------------- |
| Le Boulanger  | croûte `#c97b35` · `#f0dcb0`             | four à pain en dôme, enseigne bretzel          | **Cadence** : pétrir la pâte puis enfourner              | miche, brioche, bretzel              | chat roux         |
| La Forgeronne | charbon `#4d4440` · braise `#d9783a`     | enclume, forge rougeoyante                     | **Cadence** : battre le fer rouge                        | fer à cheval, clou, serpe            | vieux chien       |
| Le Sonneur    | ardoise `#5a6fa8` · `#d2a458`            | clocheton sur le toit                          | **Cadence** : jouer une ritournelle au carillon de table | une clochette de plus                | chouette          |
| L’Herboriste  | sauge `#7fa36a` · `#3d2f4a`              | herbes qui sèchent sous l’avant-toit, jardinet | **Dosage** : verser les décoctions jusqu’au trait        | fiole colorée                        | hérisson          |
| L’Apicultrice | miel `#e3a52b` · `#3a2a1c`               | ruches de paille                               | **Dosage** : enfumer, puis faire couler le miel          | pot de miel                          | essaim d’abeilles |
| Le Fromager   | bleu lait `#9fb8c8` · `#5a4632`          | meules sur une étagère extérieure              | **Dosage** : remplir les moules de caillé, saler         | fromage                              | souris            |
| La Couturière | prune `#8e4f86` · `#e6c3a0`              | linge coloré sur un fil, enseigne aiguille     | **Tracé** : broder un motif                              | canevas brodé                        | chat blanc        |
| Le Menuisier  | chêne `#7a5232` · `#d9b98a`              | établi sous un auvent, tas de planches         | **Tracé** : sculpter une figurine                        | figurine d’un villageois de la table | écureuil          |
| Le Copiste    | encre `#3d3f7a` · `#e8dcc0`              | enseigne plume, fenêtre à vitrail              | **Tracé** : enluminer une lettrine                       | page enluminée                       | pigeon            |
| Le Lanternier | laiton `#9c7a3c` · `#4a3344`             | guirlande de lanternes multicolores            | **Assemblage** : sertir les vitraux d’une lanterne       | lanterne                             | papillons de nuit |
| Le Pêcheur    | sarcelle `#3f8a8f` · `#cbc09d`           | filets, nasses, barque retournée               | **Assemblage** : ravauder le filet                       | maquette de barque                   | héron             |
| La Forestière | sapin `#3f6b45` · `#c4a86d`              | bûches, hache plantée dans un billot           | **Assemblage** : trier la cueillette en bocaux           | bocal de baies ou de champignons     | renard            |
| Le Meunier    | blé pâle `#d8cfa0` · `#6b5536`           | petites ailes de moulin sur le pignon          | **Rotation** : tourner la meule                          | sac de farine                        | oie               |
| La Potière    | argile `#8f8a80` · terre cuite `#b8705a` | four à poterie, jarres                         | **Rotation** : monter un pot au tour                     | pot ou cruche                        | tortue            |
| La Bergère    | brique `#b0524a` · `#e2d4b8`             | enclos à moutons                               | **Rotation** : filer la laine au rouet                   | pelote colorée                       | agneau            |

Sept métiers sur quinze reprennent un personnage existant. La Guérisseuse devient l’Herboriste et garde sa couleur prune pour la Couturière. Le Veilleur devient le Sonneur. Les couleurs actuelles seront réajustées pour que les 15 se distinguent.

## 4. La maison

- **Extérieur.** C’est la maison du siège, sur la place, à laquelle on ajoute **une enseigne et un accessoire** du métier. Le reste de la maison reste celui de la carte (hameau, île, clairière, col). L’extérieur ne change pas pendant la partie : il sert à reconnaître le joueur le jour.
- **Intérieur.** On garde la pièce commune actuelle et on remplace les accessoires selon le métier, comme on le fait déjà par rôle : établi, chaudron, métier à broder, tour, etc. L’accessoire de rôle (boule de la Voyante, griffes du loup) reste réservé au moment où le joueur voit sa carte.
- **L’étagère** reçoit l’ouvrage de chaque nuit et se remplit au fil de la partie. Au **tableau de fin**, chaque joueur montre ses ouvrages, ce qui fait un petit moment de partage sans enjeu.
- **Le compagnon** vit dans la maison. Il réagit quand on le caresse ou quand on le nourrit, mais **jamais aux événements de la nuit**.
- **Gestes communs à tous les métiers :** ranimer le feu, regarder par la fenêtre (brume, lanternes, chat qui passe, sans aucun vrai indice), caresser le compagnon.

## 5. Les éliminés

- Le **fantôme** se promène librement dans le village, jour et nuit. Les vivants ne le voient pas.
- Sa maison reste visible mais **éteinte**, et son étagère est figée, comme un petit mémorial.
- **Le pari des morts :** parier sur le camp gagnant et sur le prochain éliminé. Le résultat apparaît au tableau de fin.
- Le salon Éliminés et le salon Esprits du chat existent déjà.

## 6. Le salon

- Le sélecteur d’apparence devient un **choix de métier** : 15 pastilles, et celles déjà prises sont grisées avec le nom de leur joueur. Le premier qui choisit l’obtient.
- Un joueur qui arrive reçoit le premier métier libre, et il le garde quand on relance une partie avec la même table.
- La fiche du métier montre la maison, la veillée et le compagnon. Le choix devient ainsi un petit plaisir avant même la partie.

## 7. Découpage proposé

| Lot | Contenu                                                                                                                                          | Pour valider                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 1   | 15 métiers dans les règles, choix unique au salon, couleurs, renommage du Sonneur, enseigne et accessoire de façade                              | Chacun se reconnaît sur la place et dans le chat.                                       |
| 2   | Moteur de veillée (pause et reprise, un ouvrage par nuit) et 3 gestes : **Boulanger** (Cadence), **Herboriste** (Dosage), **Couturière** (Tracé) | Une soirée test : les joueurs inactifs s’occupent-ils sans rater l’appel de leur tour ? |
| 3   | Gestes Assemblage et Rotation, puis les 12 autres habillages, l’étagère et les compagnons                                                        | Les 15 métiers sont jouables.                                                           |
| 4   | Fantômes, pari des morts, ouvrages au tableau de fin                                                                                             | Les éliminés restent jusqu’à la fin.                                                    |

## 8. Questions ouvertes

- Faut-il imposer 15 métiers uniques, ou accepter des doublons au-delà d’un certain nombre ? La proposition : uniques.
- La figurine du Menuisier représente un villageois de la table : choisi au hasard, ou choisi par le joueur ? Une figurine choisie pourrait se lire comme une accusation.
- Au tableau de fin, montre-t-on les ouvrages de tout le monde, ou seulement ceux du joueur ?
