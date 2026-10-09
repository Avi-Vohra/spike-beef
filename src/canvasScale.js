// Fits the logical 960x540 canvas to the window with letterboxing, sharp on
// high-DPI screens (devicePixelRatio capped at 2). Split out of main.js to
// keep that file under the project's file-size guideline.
export function setupCanvasScaling(canvas, ctx, logicalW, logicalH) {
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(window.innerWidth / logicalW, window.innerHeight / logicalH);
    canvas.style.width = `${logicalW * scale}px`;
    canvas.style.height = `${logicalH * scale}px`;
    canvas.width = logicalW * dpr;
    canvas.height = logicalH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();
}
