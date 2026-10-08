# Current state
Tier 1: sim/physics/rules/render/input/main all working, 6 tests passing.
Local server running at http://localhost:8787 for manual checking.
Next: sets/match/screens/menu (currently match loops forever with no menu or screen flow).

# Log
- Done: sim.js + physics.js + rules.js with tests (headless match completes, deterministic, in-bounds).
- Done: canvas render (beach court, players, ball), keyboard input (WASD/arrows), fixed-timestep main loop.
- Done: tests for touch-fault counting and spike-vs-bump outcome differences.
