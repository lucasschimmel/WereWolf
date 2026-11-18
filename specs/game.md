# Game implementation

The game uses a single Convex deployment for room membership, server-authoritative rules and realtime projections. Each seat has a browser-generated private credential. Invite codes identify rooms and cannot authorize existing seats. The host seat is assigned at creation and stays fixed across disconnects and rematches.

The frontend keeps lobby and match projections separate from scene animation. Avatar movement is bounded and interpolated, and hidden during nighttime play. Shared rules define official cards, legal decks and phase deadlines. The server applies one scheduled transition per phase revision, and evaluates victory after all death effects.

The first-person scene and a keyboard-friendly roster both provide targeting. Players communicate on Discord. Workshop presets are saved in the host's browser.
