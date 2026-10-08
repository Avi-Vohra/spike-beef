# Current state
TIER 1 FULLY COMPLETE (all 6 items). Touch controls (on-screen buttons,
pointer:coarse only), landscape-lock rotate screen, canvas DPI scaling, and
mobile hardening (no pull-to-refresh/scroll/context-menu, wake lock, vibrate
on hit/point) are all in. Menu: Local 2P and vs CPU (3 difficulties) enabled,
Online 1v1 disabled ("coming soon").
Local server running at http://localhost:8787 for manual checking.
Next: Tier 2 (online) — Transport interface + LoopbackTransport + fake clock.

# Log
- Done: sim.js + physics.js + rules.js with tests (headless match completes, deterministic, in-bounds).
- Done: canvas render (beach court, players, ball), keyboard input (WASD/arrows), fixed-timestep main loop.
- Done: tests for touch-fault counting and spike-vs-bump outcome differences.
- Done: screens/menu (ui.js DOM overlay) + match-end + pause; Local 2P is the only enabled mode so far.
- Done: CPU opponent (ai.js, 3 difficulties) + deep audit #1 — fixed touch-cooldown gating, serve/bump net-clearance tuning, switched AI to physics-projected landing prediction. Tagged stable-1.
- Done: touch controls (on-screen D-pad + jump/hit), landscape-lock rotate screen, mobile hardening (scroll/zoom/context-menu blocked), wake lock, vibrate on hit/point. Tier 1 complete.
