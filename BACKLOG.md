# Backlog (in order; earlier matters more)
Tiers 1-3 are the definition of done for this session — do not let Tier 4
graphics polish eat time that Tiers 1-3 still need. Tiers 4-5 are best effort
with whatever time remains.

## Tier 1, core game
[x] sim.js + physics.js + rules.js with tests (no rendering yet)
[x] Render court, players, ball with the basic art style; keyboard input
[x] Hit, bump, spike mechanics; serve; touches
[x] Sets, match, screens, menu
[x] CPU opponent, 3 difficulties; headless sim test
[x] Touch controls, landscape lock screen, canvas scaling, mobile hardening

## Tier 2, online
[x] Transport interface + LoopbackTransport + fake clock
[x] netcode.js host/guest, snapshots, input redundancy; net test (a)
[x] Guest prediction, interpolation, event dedupe; net tests (b) and (c)
[x] PeerTransport, room codes, share link, join by link, error screens
[x] Lobby, names, ready, countdown, mirrored guest view
[x] Ping indicator, reconnect, forfeit, rematch

## Tier 3, trash talk
[x] Emote taunts with bubbles and sounds, synced online
[x] Quick lines menu
[x] Announcer callouts and streaks
[x] Character reactions and faces
[x] End cards, stats, slow-motion final point replay
[x] Head-to-head record

## Tier 4, graphics and feel
[x] Full beach background with parallax, pre-rendered — clouds parallax + animated sea wave line on top of the static bgCanvas
[x] Character animation: run, jump, hit, squash/stretch, eye tracking — done via the mid-session redesign (limbed run/charge/swing animation)
[x] Ball spin, shadow, trail, landing marker — done via the mid-session redesign
[x] Particles, screen shake, confetti, net sway — net now sways via a damped spring, nudged on every netBounce event
[x] Sound set + mute button; vibration — done (audio.js, generated tones, no files)
[x] UI polish: buttons, score pills, transitions between screens — screens now fade/scale in via a CSS animation on .sb-panel
[~] Physics feel tuning from sim stats — iterated extensively via the 200-match harness; CPU-vs-CPU win-share balance remains an open, documented issue (see DECISIONS.md)

## Tier 5, extras
[ ] Dive move, block, soft tip, charged serve (with tests, synced online)
[ ] Extra courts: night beach, gym, rooftop
[ ] Unlockable hats and ball skins from wins
[ ] Settings: points per set, sets, saved locally
[ ] Practice mode; tournament vs CPU
[ ] Installable (manifest + icons drawn to canvas), fullscreen button

If the backlog runs out: deep audit, then write 10 new items (bugs first,
then feel, then polish) and continue.
