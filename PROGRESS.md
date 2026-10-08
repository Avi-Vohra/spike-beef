# Current state
TIER 1 FULLY COMPLETE (all 6 items). Touch controls (on-screen buttons,
pointer:coarse only), landscape-lock rotate screen, canvas DPI scaling, and
mobile hardening (no pull-to-refresh/scroll/context-menu, wake lock, vibrate
on hit/point) are all in. Menu: Local 2P and vs CPU (3 difficulties) enabled,
Online 1v1 disabled ("coming soon").
Local server running at http://localhost:8787 for manual checking.
Tier 2 started: src/transport.js has createFakeClock + createLoopbackPair
(delay/jitter/loss, deterministic by seed), tested. PeerTransport (real
WebRTC) not written yet — that's a later Tier 2 item.
Next: netcode.js host/guest logic over the transport interface, snapshots, input redundancy; net test (a).

# Log
- Done: sim.js + physics.js + rules.js with tests (headless match completes, deterministic, in-bounds).
- Done: canvas render (beach court, players, ball), keyboard input (WASD/arrows), fixed-timestep main loop.
- Done: tests for touch-fault counting and spike-vs-bump outcome differences.
- Done: screens/menu (ui.js DOM overlay) + match-end + pause; Local 2P is the only enabled mode so far.
- Done: CPU opponent (ai.js, 3 difficulties) + deep audit #1 — fixed touch-cooldown gating, serve/bump net-clearance tuning, switched AI to physics-projected landing prediction. Tagged stable-1.
- Done: touch controls (on-screen D-pad + jump/hit), landscape-lock rotate screen, mobile hardening (scroll/zoom/context-menu blocked), wake lock, vibrate on hit/point. Tier 1 complete.
- Done: src/transport.js — fake clock + LoopbackTransport (delay/jitter/loss), deterministic, tested (4 new tests).
