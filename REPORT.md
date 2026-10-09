# Spike Beef — Final Report

Last stable tag: **stable-3** (also stable-1 after Tier 1 + CPU opponent, stable-2 after
Tier 2 online connectivity — see `git log`/`git tag` for the full history, 16 commits).

## How to run locally

```
cd spike-beef
python3 -m http.server 8787
```

Open `http://localhost:8787` in a browser. No build step, no install — static
HTML/CSS/JS, ES modules, one external script tag (pinned PeerJS 1.5.4 from jsdelivr).

For phone-vs-phone testing on one machine without deploying anywhere, tunnel the local
server to a public HTTPS URL (required for WebRTC on mobile browsers off localhost):
`npx localtunnel --port 8787` (or ngrok/cloudflared if you have them). This session used
a localturrel tunnel for live two-phone testing during development.

## How to put it online for real

Upload the folder as-is to any static HTTPS host (GitHub Pages, Netlify, Vercel,
Cloudflare Pages, S3+CloudFront, etc.) — no build command needed, just serve the files.
HTTPS is required for the online mode (WebRTC) to work on mobile browsers.

## Controls

- **Keyboard**: P1 = A/D move, W jump, **hold S to charge a hit, release to swing**.
  P2 (Local 2P only) = Arrow keys move, Up jump, **hold Down to charge, release to swing**.
- **Touch** (phones): on-screen D-pad bottom-left (move), JUMP/HIT buttons bottom-right
  (hold HIT, release to swing — same charge mechanic as keyboard).
- **Jump + charge + release near your jump's peak** = spike (fastest, steepest).
- **Quick tap-and-release** = a weak tip. **Hold longer** = a stronger charged hit,
  scaling smoothly with how long you held it.
- Escape = pause (offline modes only; no pause online, by design).

## What was built

**Tier 1 (core game) — complete.** Deterministic 60Hz fixed-timestep sim
(`physics.js`/`rules.js`/`sim.js`), canvas rendering, keyboard + touch input, full
screen flow (menu → match → set/match end), CPU opponent at 3 difficulties using
physics-projected landing prediction, landscape lock + mobile hardening (no
scroll/zoom/pull-to-refresh/context-menu), wake lock, vibration.

**Tier 2 (online) — complete except reconnect/forfeit.** Transport abstraction with a
`LoopbackTransport` + fake clock for deterministic network-condition testing in Node,
host-authoritative `netcode.js` with guest-side prediction/interpolation, real WebRTC via
PeerJS (pinned 1.5.4), 4-letter room codes, share-link and join-by-link, a full
lobby (name entry → both-ready → 3-2-1 countdown), and a mirrored guest view so each
player always sees themselves on the left. **Not built**: ping indicator, reconnect on
dropped connection, forfeit-on-timeout, same-room rematch (online "rematch" currently
just returns to the menu).

**Mid-session mechanics + visual redesign.** A live two-phone playtest (the actual
point of building the online layer) found the original instant-tap hit model unfun:
rallies ended almost instantly, no way to tell when/how to hit, every hit felt
identical, and the character art was a flat blob. Rebuilt, with the user's explicit
approval on a plan first:
- **Hit model**: hold-to-charge, release-to-swing (tip / charged hit / spike), inspired
  by Beach Spikers and Windjammers (researched live). Lower gravity for longer, more
  readable ball flight. A little seeded "luck" jitter on net/wall bounces only (never
  direct hits). A shared `predictLandingPoint` function used by both the AI's targeting
  and the on-screen landing marker, so they can't disagree.
- **Visuals**: characters rebuilt with actual limbs (torso/arms/legs/head), animated
  run-cycle, charge windup, and swing-through poses, plus a charge meter above the head.
  Added `fx.js` (screen shake + capped particle bursts: impacts/sand puffs/confetti), a
  ball speed trail, cloud parallax, and a slightly trapezoidal sand shape for a cheap
  forced-perspective read. Explicitly **not** a 3D engine — still a 2D sim, by design,
  communicated to the user before starting.
- **Audio**: a full WebAudio sound set (every sound synthesized, no files) and a mute
  toggle persisted to localStorage.
- **Hit-stop**: a brief freeze-frame on hard hits/spikes — scoped to offline modes only,
  since pausing an authoritative online host's tick loop would desync the guest.

**Tier 3 (trash talk)** and most of **Tier 5 (extras)** — not started. The user's
original "let people dawg on each other" request is still open; the session's attention
went to making the core 1v1 loop actually fun first, per direct live feedback, which
took priority over adding the personality layer on top of mechanics that didn't work yet.

## Known issues / limitations

- **No TURN server** (documented risk from the start): PeerJS's free public broker is
  STUN-only. Two phones on the same Wi-Fi connect fine; phones on different
  networks/carriers can fail to establish a direct WebRTC path. Surfaced as a plain
  "Connection failed" with Retry, not a crash.
- **CPU-vs-CPU win-share balance is unresolved.** Investigated directly (not guessed):
  "winner serves next" plus a real per-point server edge makes this a positive-feedback
  system, and the AI's jitter is a deterministic hash rather than true per-trial
  randomness, so small constant changes tend to flip most seeds' outcomes at once rather
  than shifting a distribution smoothly. The implementation itself is side-symmetric
  (verified). This does not necessarily reflect how two humans playing each other feel —
  it's an internal CPU-vs-CPU stat — but it's an honest open item. See `DECISIONS.md`
  for the full investigation, including two tuning attempts that were tried and reverted
  because they made things worse on net.
- **Rally length** improved substantially (near-zero real exchanges before the redesign
  to ~3.4 average hits per CPU-vs-CPU rally after) but is short of this session's own
  6-12 hit aspiration. Likely needs another tuning pass with fresh eyes/time.
- **iOS Safari gaps** (documented from the start, not fixable within this project's
  "no installs" scope): no Vibration API, Web Share/Wake Lock availability varies. All
  guarded with `if present`/`if available` checks — silent no-ops, not crashes.
- **No camera zoom**, no accessibility motion-reduction settings, no settings screen —
  real items from the redesign brief that didn't fit in the time available.
- Online "rematch" returns to the menu rather than restarting in the same room (that's
  bundled with the unbuilt reconnect/forfeit item).

## What could not be verified without real phones/multiple devices

- True phone-to-phone play across different networks (cellular vs Wi-Fi, different
  carriers) — only tested via a tunnel from one development machine plus the user's own
  live two-phone test mid-session, which is what surfaced the mechanics/visual feedback
  this report's redesign section responds to.
- Actual feel/fun on a touchscreen specifically (charge-and-release via the on-screen
  HIT button) — reasoned about but not directly observed by me; worth a fresh playtest.
- Battery/performance behavior over a long real play session (wake lock, particle cap,
  sustained 60fps on a mid-range phone).

## Tests

`node tests/run.mjs` → `PASS` (prints one `NOTE:` line for the documented win-share
issue above, not a failure). Covers: physics/rules/sim invariants, determinism, a
200-seed CPU-vs-CPU stress test, touch-fault and charge-model unit tests, transport/fake-
clock behavior, and three netcode conditions (40ms/0% loss, 150ms+jitter/5% loss,
300ms/10% loss) — all passing, including after the mechanics redesign.
