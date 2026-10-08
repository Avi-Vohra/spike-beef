# Current state
Tier 1: sim/physics/rules/render/input/ui/main all working, 6 tests passing.
Screen flow: menu -> Local 2P match -> matchEnd (rematch/menu), Escape pauses.
Online/CPU menu buttons present but disabled until those tiers are built.
Local server running at http://localhost:8787 for manual checking.
Next: CPU opponent (ai.js), 3 difficulties, headless sim test.

# Log
- Done: sim.js + physics.js + rules.js with tests (headless match completes, deterministic, in-bounds).
- Done: canvas render (beach court, players, ball), keyboard input (WASD/arrows), fixed-timestep main loop.
- Done: tests for touch-fault counting and spike-vs-bump outcome differences.
- Done: screens/menu (ui.js DOM overlay) + match-end + pause; Local 2P is the only enabled mode so far.
