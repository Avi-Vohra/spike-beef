# Decisions log (one line each, newest last)
- Screens use DOM overlay (ui.js) over the canvas rather than drawing menu text/buttons on canvas — simpler hit-testing and accessible buttons, cheap given no build step.
- Online 1v1 and vs CPU menu buttons are present but disabled ("coming soon") until Tier 2/1 build them out, so the menu shape is final early and doesn't need rework later.
- Pause (Escape key) only wired for the match/paused screens, matches spec's "pause (offline modes only)" — online pause is explicitly out per ONLINE section and will be skipped when that mode exists.
