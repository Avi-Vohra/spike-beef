# Current state
TIER 1 FULLY COMPLETE (all 6 items). Touch controls (on-screen buttons,
pointer:coarse only), landscape-lock rotate screen, canvas DPI scaling, and
mobile hardening (no pull-to-refresh/scroll/context-menu, wake lock, vibrate
on hit/point) are all in. Menu: Local 2P and vs CPU (3 difficulties) enabled,
Online 1v1 disabled ("coming soon").
Local server running at http://localhost:8787 for manual checking.
Tier 2: online play is ACTUALLY WORKING end-to-end in code (can't test two
real browsers myself, but connection logic, room codes, share link,
join-by-link, and a minimal playable match are all wired). Menu -> Online
1v1 -> Create Room (shows code + share) or Join Room (code entry) -> on
connect, match starts immediately (no lobby/ready-up/countdown yet — next
item). PeerJS pinned to 1.5.4 via jsdelivr, verified reachable.
Deep audit #2 done (stable-2 tag): walked every screen transition, found and
fixed one real stuck-state (no Cancel on the "Connecting..." screen).
Lobby, names, ready, countdown, mirrored guest view also done (online.js
handshake + ui.js lobby screens + swapLeftRight/mirrorState for the guest).

MID-SESSION REDESIGN (see DECISIONS.md "Mid-session redesign" section): a
live two-phone playtest found the original instant-tap hit model unfun —
rallies ended almost instantly, no way to tell when/how to hit, every hit
felt identical, art was a flat blob. Replaced with a charge-and-release hit
system (hold HIT to charge, release to swing: tip / charged hit / spike),
slower gravity for readability, shared landing-point prediction, a little
seeded luck on bounces. Rally length improved (~0 -> ~3.4 avg hits); CPU-vs-
CPU win-share balance is a known, investigated, documented rough edge
(DECISIONS.md) deprioritized in favor of the visual redesign — not yet
touched and explicitly requested.
VISUAL REDESIGN DONE (this session): limbed characters with run/charge/swing
animation, charge meter above head, landing-point marker, fx.js (screen
shake + capped particle bursts: impact/sand-puff/confetti), ball speed trail,
cloud parallax, trapezoidal sand for a cheap perspective read. Extracted
device.js (wake lock/vibrate/name) to keep main.js under 300 lines.
Not done, scope-cut and documented in DECISIONS.md: hit-stop/camera zoom,
WebAudio sound set, accessibility motion settings.
Next: either keep polishing feel (sound would be the highest-impact next
addition), or resume normal backlog items (Tier 2 reconnect/forfeit, Tier 3
trash talk) depending on what the user wants to see next.

# Log
- Done: sim.js + physics.js + rules.js with tests (headless match completes, deterministic, in-bounds).
- Done: canvas render (beach court, players, ball), keyboard input (WASD/arrows), fixed-timestep main loop.
- Done: tests for touch-fault counting and spike-vs-bump outcome differences.
- Done: screens/menu (ui.js DOM overlay) + match-end + pause; Local 2P is the only enabled mode so far.
- Done: CPU opponent (ai.js, 3 difficulties) + deep audit #1 — fixed touch-cooldown gating, serve/bump net-clearance tuning, switched AI to physics-projected landing prediction. Tagged stable-1.
- Done: touch controls (on-screen D-pad + jump/hit), landscape-lock rotate screen, mobile hardening (scroll/zoom/context-menu blocked), wake lock, vibrate on hit/point. Tier 1 complete.
- Done: src/transport.js — fake clock + LoopbackTransport (delay/jitter/loss), deterministic, tested (4 new tests).
- Done: src/netcode.js — host-authoritative sim over the transport interface, redundant guest input packets, host snapshots. Net test (a): full CPU-driven match over LoopbackTransport at 40ms/0% loss completes with matching final scores and no dropped/duplicated events.
- Done: guest-side prediction of own avatar + interpolation of ball/opponent from snapshot history; net tests (b) 150ms/jitter/5%loss and (c) 300ms/10%loss both pass. Split tests/run.mjs into 3 files to stay under the 300-line cap.
- Done: src/transport.js PeerTransport (createPeerHost/createPeerGuest), src/online.js orchestration, room codes, share link, join-by-link, error screens. Deep audit #2 found+fixed a stuck "Connecting..." screen with no Cancel. Tagged stable-2.
- Done: lobby/names/ready/countdown/mirrored-guest-view (online.js handshake protocol + ui.js screens + swapLeftRight/mirrorState).
- Done: MECHANICS REDESIGN — charge-and-release hit model (tip/charged-hit/spike) replacing instant-tap, slower gravity, shared predictLandingPoint, seeded bounce jitter, net-proximity arc-assist, wall-clamp bug fix, ai.js rewritten for charging. See DECISIONS.md for the full account including dead-ends tried and reverted.
