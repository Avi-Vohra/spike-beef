# Backlog (in order; earlier matters more)
Tiers 1-3 are the definition of done for this session — do not let Tier 4
graphics polish eat time that Tiers 1-3 still need. Tiers 4-5 are best effort
with whatever time remains.

## Tier 1, core game
[ ] sim.js + physics.js + rules.js with tests (no rendering yet)
[ ] Render court, players, ball with the basic art style; keyboard input
[ ] Hit, bump, spike mechanics; serve; touches
[ ] Sets, match, screens, menu
[ ] CPU opponent, 3 difficulties; headless sim test
[ ] Touch controls, landscape lock screen, canvas scaling, mobile hardening

## Tier 2, online
[ ] Transport interface + LoopbackTransport + fake clock
[ ] netcode.js host/guest, snapshots, input redundancy; net test (a)
[ ] Guest prediction, interpolation, event dedupe; net tests (b) and (c)
[ ] PeerTransport, room codes, share link, join by link, error screens
[ ] Lobby, names, ready, countdown, mirrored guest view
[ ] Ping indicator, reconnect, forfeit, rematch

## Tier 3, trash talk
[ ] Emote taunts with bubbles and sounds, synced online
[ ] Quick lines menu
[ ] Announcer callouts and streaks
[ ] Character reactions and faces
[ ] End cards, stats, slow-motion final point replay
[ ] Head-to-head record

## Tier 4, graphics and feel
[ ] Full beach background with parallax, pre-rendered
[ ] Character animation: run, jump, hit, squash/stretch, eye tracking
[ ] Ball spin, shadow, trail, landing marker
[ ] Particles, screen shake, confetti, net sway
[ ] Sound set + mute button; vibration
[ ] UI polish: buttons, score pills, transitions between screens
[ ] Physics feel tuning from sim stats

## Tier 5, extras
[ ] Dive move, block, soft tip, charged serve (with tests, synced online)
[ ] Extra courts: night beach, gym, rooftop
[ ] Unlockable hats and ball skins from wins
[ ] Settings: points per set, sets, saved locally
[ ] Practice mode; tournament vs CPU
[ ] Installable (manifest + icons drawn to canvas), fullscreen button

If the backlog runs out: deep audit, then write 10 new items (bugs first,
then feel, then polish) and continue.
