# Current state
Tier 1 COMPLETE: sim/physics/rules/render/input/ui/ai/main all working.
Menu has Local 2P and vs CPU (easy/medium/hard) enabled; Online 1v1 still disabled ("coming soon").
Deep audit #1 done (stable-1 tag): found and fixed 3 real physics bugs via the
200-match CPU-vs-CPU stress test (see DECISIONS.md) — win share and rally
length are now within spec range.
Local server running at http://localhost:8787 for manual checking.
Next: Touch controls, landscape lock screen, canvas scaling, mobile hardening (last Tier 1 item).

# Log
- Done: sim.js + physics.js + rules.js with tests (headless match completes, deterministic, in-bounds).
- Done: canvas render (beach court, players, ball), keyboard input (WASD/arrows), fixed-timestep main loop.
- Done: tests for touch-fault counting and spike-vs-bump outcome differences.
- Done: screens/menu (ui.js DOM overlay) + match-end + pause; Local 2P is the only enabled mode so far.
- Done: CPU opponent (ai.js, 3 difficulties) + deep audit #1 — fixed touch-cooldown gating, serve/bump net-clearance tuning, switched AI to physics-projected landing prediction. Tagged stable-1.
