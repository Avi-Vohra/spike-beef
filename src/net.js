// Net drawing: a post, a diamond-mesh panel (clipped, partial opacity so
// the court behind it stays visible — real netting is see-through), and a
// solid top cable. Split out of render.js to keep that file under the
// project's file-size guideline. Real volleyball netting is a see-through
// diamond mesh, not a solid panel — the original version filled a solid
// rectangle and overlaid horizontal lines, which read as a ladder/ruler
// rather than a net (confirmed via a real screenshot, not assumed).
import { GROUND_Y, NET_X, NET_TOP, NET_HALF_W } from './physics.js';
import { PALETTE } from './art.js';

const NET_MESH_SPACING = 11;

export function drawNet(ctx, sway) {
  const halfW = NET_HALF_W + 7;
  const top = NET_TOP + sway;
  const leftTop = NET_X - halfW;
  const rightTop = NET_X + halfW - sway * 0.3;
  const leftBot = NET_X - halfW + 2;
  const rightBot = NET_X + halfW - 2;

  // Post
  ctx.strokeStyle = PALETTE.netPost;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(NET_X, GROUND_Y);
  ctx.lineTo(NET_X, NET_TOP - 10);
  ctx.stroke();

  // Mesh: a diamond crosshatch clipped to the net's (slightly swaying)
  // quadrilateral, drawn at partial opacity so it reads as netting.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(leftTop, top);
  ctx.lineTo(rightTop, top - sway * 0.3);
  ctx.lineTo(rightBot, GROUND_Y);
  ctx.lineTo(leftBot, GROUND_Y);
  ctx.closePath();
  ctx.clip();

  ctx.strokeStyle = 'rgba(36,26,20,0.45)';
  ctx.lineWidth = 1;
  const spanTop = top - 6;
  const spanBottom = GROUND_Y + 6;
  const spanLeft = leftTop - 10;
  const spanRight = rightTop + 10;
  for (let x = spanLeft - (spanBottom - spanTop); x < spanRight + (spanBottom - spanTop); x += NET_MESH_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x, spanTop);
    ctx.lineTo(x + (spanBottom - spanTop), spanBottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, spanTop);
    ctx.lineTo(x - (spanBottom - spanTop), spanBottom);
    ctx.stroke();
  }
  ctx.restore();

  // Outline + top/bottom cables (the solid, reinforced edges of a real net).
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftTop, top);
  ctx.lineTo(rightTop, top - sway * 0.3);
  ctx.lineTo(rightBot, GROUND_Y);
  ctx.lineTo(leftBot, GROUND_Y);
  ctx.closePath();
  ctx.stroke();

  ctx.strokeStyle = PALETTE.net;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(leftTop, top);
  ctx.lineTo(rightTop, top - sway * 0.3);
  ctx.stroke();
}
