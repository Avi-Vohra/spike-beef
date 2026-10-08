# Current state
TIER 1 FULLY COMPLETE (all 6 items). Touch controls (on-screen buttons,
pointer:coarse only), landscape-lock rotate screen, canvas DPI scaling, and
mobile hardening (no pull-to-refresh/scroll/context-menu, wake lock, vibrate
on hit/point) are all in. Menu: Local 2P and vs CPU (3 difficulties) enabled,
Online 1v1 disabled ("coming soon").
Local server running at http://localhost:8787 for manual checking.
Tier 2 progressing well: transport.js + netcode.js now have guest-side
prediction (own avatar only, via stepPlayer) and interpolation (ball +
opponent, ~100ms buffer) on top of host-authoritative sim + snapshots.
Net tests (a)/(b)/(c) all pass — 40ms/0%, 150ms/20ms-jitter/5%, 300ms/10%.
Tests split into tests/sim.test.mjs + tests/net.test.mjs + tests/helpers.mjs
(run.mjs grew past the 300-line cap).
PeerTransport (real WebRTC) not written yet — later Tier 2 item.
Next: PeerTransport, room codes, share link, join by link, error screens.

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
