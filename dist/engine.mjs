export function isPointing(hand) {
  if (!hand || hand.length < 21) return false;
  if (!hand.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z ?? 0))) return false;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  function finger(base, joint, tip) {
    const a = hand[base], b = hand[joint], c = hand[tip];
    const ux = a.x - b.x, uy = a.y - b.y, uz = (a.z || 0) - (b.z || 0);
    const vx = c.x - b.x, vy = c.y - b.y, vz = (c.z || 0) - (b.z || 0);
    const lengths = Math.hypot(ux, uy, uz) * Math.hypot(vx, vy, vz);
    const reach = distance(b, hand[0]);
    if (lengths < 1e-10 || reach < 1e-5) return null;
    return { cosine: (ux * vx + uy * vy + uz * vz) / lengths, reach: distance(c, hand[0]) / reach };
  }
  // Require a straight index AND positively curled middle, ring, and little fingers.
  // Joint angles and wrist distances work with either hand and rotated poses.
  const index = finger(5, 6, 8);
  if (!index || index.cosine >= -0.65 || index.reach <= 1.08) return false;
  return [[9, 10, 12], [13, 14, 16], [17, 18, 20]].every(indices => {
    const other = finger(...indices);
    return other && other.cosine > -0.3 && other.reach <= 1.05;
  });
}
export function headPose(landmarks, width, height) {
  if (!landmarks?.[33] || !landmarks?.[263]) return null;
  let a={x:(1-landmarks[33].x)*width,y:landmarks[33].y*height};
  let b={x:(1-landmarks[263].x)*width,y:landmarks[263].y*height};
  if (a.x>b.x) [a,b]=[b,a];
  const scale=Math.hypot(b.x-a.x,b.y-a.y);
  if (!Number.isFinite(scale) || scale<5) return null;
  return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,scale,angle:Math.atan2(b.y-a.y,b.x-a.x)};
}
// Map points between two head poses, preserving position relative to the eyes.
export function followHead(point, from, to) {
  if (!from || !to) return {...point};
  const x=point.x-from.x, y=point.y-from.y;
  const angle=to.angle-from.angle, scale=to.scale/from.scale;
  return {x:to.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale,
    y:to.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale};
}
export function flowerCluster(size, color, palette, random = Math.random) {
  const companions = palette.filter(value => value !== color);
  const start = Math.floor(random() * companions.length);
  const rotation = random() * Math.PI * 2;
  const cluster = [{x:0, y:0, size, color, rotation}];
  for (const [i, scale] of [0.45, 0.6, 0.85, 0.5].entries()) {
    const angle = rotation + i * Math.PI / 2 + (random() - 0.5) * 0.4;
    const radius = size * (0.65 + random() * 0.2);
    cluster.push({x:Math.cos(angle)*radius, y:Math.sin(angle)*radius, size:size*scale,
      color:companions[(start+i)%companions.length] || color, rotation:random()*Math.PI});
  }
  return cluster;
}
export function flower(ctx, x, y, size, color, rotation = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
  ctx.fillStyle = color;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3); ctx.beginPath();
    ctx.ellipse(0, -size * .28, size * .17, size * .29, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.fillStyle = '#ffd46a'; ctx.arc(0, 0, size * .15, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
