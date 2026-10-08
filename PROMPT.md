# MISSION
Build "Spike Beef", a polished 1v1 mini volleyball game for the browser where two
people play each other phone vs phone online, with trash talk built in. I am
away for 4 hours and cannot answer questions or approve anything. You work alone.

# KNOWN RISKS (design around these, do not burn time chasing them)
- PeerJS's free public signaling broker is STUN-only, no TURN relay. Two phones
  on the same Wi-Fi will connect fine. Two phones on different cellular carriers
  can fail to establish a direct path (symmetric NAT) — there is no free fix
  within the "no installs" constraint. Handle it with a clear error + Retry
  button (already in scope below) and note it as a known limitation in
  REPORT.md. Do not attempt to add a TURN server or coturn — out of scope.
- The public broker itself can be briefly rate-limited or down. Same handling:
  clear error, Retry, documented, not fixed.
- navigator.vibrate does not exist on iOS Safari. navigator.share and the
  Wake Lock API are inconsistently available across mobile browsers. All three
  are already optional-if-present in this spec — keep it that way, and list
  them as known platform gaps in REPORT.md rather than polyfilling.
- You cannot test real phone-to-phone play yourself. Say so plainly in
  REPORT.md rather than claiming it works from headless tests alone.

# RULES FOR WORKING ALONE
- Never ask a question, never wait for input. When unsure, pick the simplest
  reasonable option, log one line in DECISIONS.md, move on.
- Never stop because "it's done." There is always a next backlog item.
- First action: `date +%s > .start_time`. At the start of every loop compare
  `date +%s` to it. Stop only after 14400s. Then finish the current item, run
  the deep audit, write REPORT.md, stop.
- If your context was compacted or you feel unsure of the rules, re-read this
  file (PROMPT.md) and PROGRESS.md before continuing.
- If something fails 3 times: revert to the last good commit, log it as skipped
  in DECISIONS.md, take the next item.
- Stay in this folder. No installs, no build step, no frameworks. The only
  external resource allowed is the PeerJS script tag (see ONLINE).

# TOKEN BUDGET (limited plan, this matters)
- No subagents, no web search, no plan mode.
- Never re-read whole files. Grep, or read line ranges.
- Small targeted edits. Never rewrite a file to change a few lines.
- Files under ~300 lines. Split when they grow.
- One short line to me per loop. Notes go in the log files, not chat.
- Tests print one line: PASS, or the first failure only.
- PROGRESS.md is your memory: one line per finished item, plus a short
  "current state" block at the top that you keep updated.

# TECH
- index.html, style.css, ES modules in /src. Must work as static files on any
  HTTPS static host, and locally via `python3 -m http.server`.
- Canvas 2D. All art drawn in code. Sound via WebAudio, generated, no files.
- Fixed timestep 60 updates/sec, deterministic, seeded random only.
- Pure modules (no DOM, no window, importable in Node):
  src/physics.js   ball, players, collisions
  src/rules.js     scoring, serve, touches, sets, match
  src/sim.js       step(state, inputP1, inputP2) -> new state + events list
  src/ai.js        CPU opponent
  src/netcode.js   host/guest logic over an abstract transport
- Browser modules:
  src/transport.js PeerJS transport + loopback transport (loopback is pure)
  src/input.js     keyboard + touch, both produce the same input bitmask
  src/render.js, src/fx.js, src/art.js   drawing, particles, characters
  src/audio.js, src/ui.js, src/main.js
- Input is a bitmask: LEFT, RIGHT, JUMP, HIT. Everything (keyboard, touch, CPU,
  network) feeds the sim through this one format.
- sim.js returns events (hit, spike, bounce, point, setWon, matchWon) so
  render, audio and netcode all react to the same list.
- tests/run.mjs runs in Node, zero dependencies.

# GAME SPEC
- Side view court, net in the middle, one player per side.
- Ball: gravity, bounces off players, net, walls, ceiling. Hitting while moving
  or jumping adds direction and power. Jump + HIT near the peak = spike (fast,
  steep). HIT while standing = bump (high, soft). No ball tunneling: use
  swept collision or substeps. Ball can never come to rest on the net or a head.
- Max 3 touches per side; 4th loses the point. Ball lands on your side:
  opponent scores. Rally scoring. Scorer serves.
- Serve: ball floats above the server; HIT launches it. Auto-serve after 5s.
- First to 11, win by 2, cap at 15. Best of 3 sets. Sides stay fixed.
- Modes: Online 1v1 (main mode, top of the menu), vs CPU (easy/medium/hard),
  Local 2P on one keyboard (A/D/W/S and arrows) for desktop.
- Screens: menu, name entry, create/join room, lobby, countdown, match,
  between-point, set won, match won, rematch, pause (offline modes only),
  how to play.

# PHONE CONTROLS AND LAYOUT
- Landscape only. In portrait show a "rotate your phone" screen.
- Canvas has a fixed logical size (960x540), scaled to fit with letterboxing,
  sharp on high-DPI screens (devicePixelRatio, capped at 2).
- Touch: bottom-left has two big buttons, LEFT and RIGHT. Bottom-right has
  JUMP and HIT. Multi-touch, so move + jump + hit work together. Buttons are
  at least 72px, semi-transparent, light up when pressed, sit below the court
  so thumbs never cover play.
- Vibrate briefly on your own hits and on points (navigator.vibrate if present;
  silently no-op where absent, e.g. iOS Safari — do not try to work around this).
- Prevent scroll, zoom, text selection, long-press menu, pull-to-refresh.
- Unlock audio on first tap. Request wake lock during a match if available.
- Each player always sees themselves on the LEFT side. The guest's view is
  mirrored in render and input only; the sim is never mirrored.

# ONLINE (phone vs phone)
- PeerJS from a pinned CDN script tag in index.html, using its default public
  signaling server. Pin to a specific resolved version number (not "latest") —
  record the exact version string you pinned in DECISIONS.md. WebRTC data
  channel, unreliable/unordered for game traffic, reliable for chat/taunts/
  control messages if two channels are easy; otherwise one reliable channel.
- See KNOWN RISKS above re: no TURN server — some phone-to-phone pairs across
  different networks will fail to connect, and that's expected, not a bug to
  chase. Surface it as a plain "connection failed" with Retry, not a crash.
- Room flow: host taps Create, gets a 4-letter code (no confusing letters:
  skip O, I, L). Peer id is "spikebeef-" + code. Host screen shows the code
  big, plus a Share button (navigator.share, fallback copy link) for a link
  like ?room=ABCD. Opening that link jumps straight to joining.
  Guest can also type the code. Errors are shown in plain words: room not
  found, room full, connection failed, with a Retry button.
- Lobby: both names shown, both tap Ready, 3-2-1 countdown.
- Model: host is authoritative. Host runs sim.js at 60Hz. Guest sends its
  input bitmask with a sequence number every tick (include the last 3 inputs
  in each packet to survive loss). Host sends snapshots 30 times/sec: tick,
  ball x/y/vx/vy, both players, score, phase, events since last snapshot,
  last guest input seq processed.
- Guest: predicts its own player locally and reconciles to snapshots smoothly
  (no snapping unless error is large). Ball and opponent are rendered about
  100ms in the past, interpolated between snapshots. Events drive sound and
  effects exactly once (dedupe by tick).
- Packets are compact arrays of rounded numbers, not verbose objects.
- Show a small ping indicator (green/yellow/red). Ping via timestamp echo.
- No pause online. If a tab is hidden or packets stop for 3s: freeze the match
  with "Reconnecting..." for up to 15s, then the remaining player wins by
  forfeit. Leaving mid-match = forfeit, and the stayer is told so.
- Rematch: both tap "Run it back", same room, no re-entering codes.
- netcode.js must only talk to a transport interface: send(msg), onMessage,
  onClose. PeerTransport wraps PeerJS. LoopbackTransport links two endpoints in
  memory with configurable delay, jitter, and packet loss, driven by a fake
  clock so tests are deterministic.

# TRASH TALK (the personality of the game, treat as core)
- Name entry (max 10 chars) saved to localStorage, shown above each player.
- Taunt bar: 4 emote buttons at top-center, usable any time, 2s cooldown.
  Emote pops up as a speech bubble over your character on both screens with a
  sound. Emotes drawn in code: laughing, crying, sleeping (zzz), flexing.
- Quick lines: tap-and-hold the taunt bar for 8 preset lines, e.g. "Too easy",
  "You good?", "My grandma spikes harder", "Lucky.", "Run it back", "Respect",
  "Cooked.", "Wake up". Preset only, no free text.
- Auto-callouts from the announcer banner, triggered by events: ACE (serve not
  returned), DENIED (block at net), 3 points in a row = "ON FIRE", 5 = "COOKING",
  set won 11-0 = "SKUNKED", comeback from 5+ down, long rally (15+ hits).
- Characters react: winner of the point does a little dance, loser slumps.
  Faces change (smirk when ahead by 4+, sweat when behind by 4+).
- Match end: big title cards for both, picked from stats, e.g. winner "Certified
  Menace", loser "Got Cooked", plus stats (spikes, aces, longest rally, taunts
  sent). Final point replays once in slow motion.
- Head-to-head record vs that name stored in localStorage and shown in lobby
  ("You 3 - 1 Mike").
- Taunts travel over the reliable channel and never affect the sim.

# GRAPHICS (drawn in code, must look good, not like placeholder shapes)
- Style: bold cartoon, thick dark outlines, flat colors with one shade tone,
  soft shadows. Consistent palette defined once in art.js.
- Default court: beach at sunset. Gradient sky, sun, layered parallax clouds,
  sea with moving wave line, palm silhouettes, sand with texture specks, net
  with posts, rope and slight sway when hit.
- Characters: round-bodied with head, eyes that track the ball, arms that swing
  on hit, legs that cycle when running, squash on landing, stretch on jump.
  Player 1 and 2 have distinct colors and a headband or cap.
- Ball: panel lines that rotate with spin, shadow on the sand that shrinks
  with height, motion trail on fast shots, landing marker when it is falling.
- Effects: sand puff on landing and on ball impact, impact star on spikes,
  light screen shake on spikes, confetti on set win, slow motion on match point.
- UI: chunky rounded buttons, one display font stack from system fonts,
  score pills at the top, serve arrow, touch dots (3 pips per side).
- Hold 60fps on a mid-range phone: pre-render the static background to an
  offscreen canvas, cap particles at 150, no per-frame gradients or shadowBlur.

# SETUP (once)
git init. Create PROGRESS.md, DECISIONS.md, BACKLOG.md (copy the backlog
below as a checklist). Commit.

# THE LOOP (repeat until time is up)
1. Check time. Read the top of PROGRESS.md and the first unchecked backlog item.
2. Build that one item in the smallest change that works.
3. Quick audit. Fix failures.
4. Commit. Tick the item. One line in PROGRESS.md.
5. Every 5th item run the deep audit instead.
6. Back to 1. No pausing between loops.

# QUICK AUDIT
- `node --check` every changed JS file.
- `node tests/run.mjs` prints PASS.
- Touched physics, rules, sim, ai or netcode? Add or update a test.

# DEEP AUDIT
- Quick audit, plus:
- Sim test: 200 seeded CPU vs CPU matches headless. Assert every match ends,
  no NaN, ball stays in bounds, ball never rests anywhere for 2s, no rally
  over 60s, scores follow the rules, win share 35-65% at equal difficulty,
  average rally 4-10 hits (retune physics if outside).
- Determinism test: same seed and inputs twice = identical final state.
- Net test: host and guest over LoopbackTransport playing a full CPU-driven
  match at (a) 40ms, 0% loss (b) 150ms, 20ms jitter, 5% loss (c) 300ms, 10%
  loss. Assert: match completes, final scores identical on both ends, guest
  ball position error vs host (compared at the same tick) stays under a small
  tolerance on average, each event fires exactly once on the guest, a 4s
  blackout triggers reconnect and recovers, a 20s blackout ends in forfeit.
- Static checks: every import resolves to a real export, every getElementById
  id exists in index.html, no file over 300 lines, no console.log left in
  hot loops, index.html has the viewport meta and no-zoom settings.
- Walk main.js/ui.js state transitions: every screen reachable and escapable.
- `git tag stable-N`. Any bug found goes to the TOP of BACKLOG.md.

# BRANCHES
Work on main. Risky changes (physics retune, netcode rewrite, big refactor)
go on exp/<name>; merge only if the deep audit passes, else delete the branch
and log why. main is never left broken.

# BACKLOG (in order; earlier matters more)
Tiers 1-3 are the definition of done for this session — do not let Tier 4
graphics polish eat time that Tiers 1-3 still need. Tiers 4-5 are best effort
with whatever time remains.

Tier 1, core game
[ ] sim.js + physics.js + rules.js with tests (no rendering yet)
[ ] Render court, players, ball with the basic art style; keyboard input
[ ] Hit, bump, spike mechanics; serve; touches
[ ] Sets, match, screens, menu
[ ] CPU opponent, 3 difficulties; headless sim test
[ ] Touch controls, landscape lock screen, canvas scaling, mobile hardening
Tier 2, online
[ ] Transport interface + LoopbackTransport + fake clock
[ ] netcode.js host/guest, snapshots, input redundancy; net test (a)
[ ] Guest prediction, interpolation, event dedupe; net tests (b) and (c)
[ ] PeerTransport, room codes, share link, join by link, error screens
[ ] Lobby, names, ready, countdown, mirrored guest view
[ ] Ping indicator, reconnect, forfeit, rematch
Tier 3, trash talk
[ ] Emote taunts with bubbles and sounds, synced online
[ ] Quick lines menu
[ ] Announcer callouts and streaks
[ ] Character reactions and faces
[ ] End cards, stats, slow-motion final point replay
[ ] Head-to-head record
Tier 4, graphics and feel
[ ] Full beach background with parallax, pre-rendered
[ ] Character animation: run, jump, hit, squash/stretch, eye tracking
[ ] Ball spin, shadow, trail, landing marker
[ ] Particles, screen shake, confetti, net sway
[ ] Sound set + mute button; vibration
[ ] UI polish: buttons, score pills, transitions between screens
[ ] Physics feel tuning from sim stats
Tier 5, extras
[ ] Dive move, block, soft tip, charged serve (with tests, synced online)
[ ] Extra courts: night beach, gym, rooftop
[ ] Unlockable hats and ball skins from wins
[ ] Settings: points per set, sets, saved locally
[ ] Practice mode; tournament vs CPU
[ ] Installable (manifest + icons drawn to canvas), fullscreen button
If the backlog runs out: deep audit, then write 10 new items (bugs first,
then feel, then polish) and continue.

# FINAL REPORT (only when time is up)
REPORT.md: how to run locally, how to put it online (upload the folder to any
static HTTPS host), controls, what was built, what was skipped and why, known
issues (explicitly include the KNOWN RISKS items: no-TURN NAT failures, broker
availability, iOS vibration/share/wake-lock gaps), what could not be verified
without real phones, last stable tag.
