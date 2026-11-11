// render.js: FamilyFi reel "Paisa gaya kahan?" drawn 100% in code. Run: node render.js
// Same pattern as the reference: seeded canvas frames piped raw into ffmpeg.
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { spawn } = require('child_process');
const path = require('path');

// ---- fonts ----
const FD = path.join(__dirname, 'node_modules/@fontsource/poppins/files');
for (const w of ['400', '700', '800']) {
  GlobalFonts.registerFromPath(path.join(FD, `poppins-latin-${w}-normal.woff2`), 'Poppins');
  GlobalFonts.registerFromPath(path.join(FD, `poppins-devanagari-${w}-normal.woff2`), 'Poppins');
}
GlobalFonts.registerFromPath('/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', 'Noto Color Emoji');
const F = (w, s) => `${w} ${s}px Poppins, "DejaVu Sans", "Noto Color Emoji"`;

// ---- settings: change one line, only that thing changes ----
const W = 1080, H = 1920;
const FPS = 30;
const DURATION = Number(process.env.DURATION || 22);
const SEED = 42;
const OUT = process.env.OUT || 'familyfi_reel.mp4';
const STILLS = process.env.STILLS;                // e.g. "1,6,12,19" -> PNGs only
// FamilyFi brand palette (from the app's CSS variables)
const ACCENT = '#0d6b61', ACCENT_L = '#4cbcae', INC = '#5bc58d', EXP = '#f08b64', SAV = '#82a8f3';
const GOLD = '#e2b04a', INK = '#132321', NIGHT_TOP = '#081615', NIGHT_BOT = '#123d39';

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
const rand = rng(SEED);
const clamp = (x) => Math.min(Math.max(x, 0), 1);
const ease = (x) => 0.5 - Math.cos(Math.PI * clamp(x)) / 2;
const pop = (x) => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const seg = (t, a, b) => clamp((t - a) / (b - a));   // 0..1 progress inside [a,b]
const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// falling rupee coins (parallax, like the reference snow)
const coins = Array.from({ length: 70 }, () => ({
  x: rand() * W, y: rand() * H, z: 0.3 + rand() * 0.7, spin: rand() * 6.28,
}));
// sparkles for the happy ending
const sparks = Array.from({ length: 160 }, () => ({
  x: rand() * W, y: rand() * H, z: 0.3 + rand() * 0.7, p: rand() * 6.28,
}));
// expense bills that fly out of the wallet
const bills = [
  ['Rent', 18000], ['Groceries', 9400], ['EMI', 12500], ['School fees', 6200],
  ['Online shopping', 4800], ['Petrol', 3900], ['Swiggy / Zomato', 3100], ['Mobile + OTT', 1499],
].map(([n, v], i) => ({ n, v, a: -2.4 + i * 0.62 + rand() * 0.2, sp: 0.8 + rand() * 0.5, d: i * 0.28 }));

// ---------- drawing helpers ----------
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function text(ctx, s, x, y, font, color, align = 'center', alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align;
  ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); ctx.restore();
}
// caption pill (Hinglish), kept inside the Instagram safe area
function caption(ctx, s, t, a, b, y = 1560, color = '#fff', bg = 'rgba(0,0,0,0.55)') {
  const k = Math.min(seg(t, a, a + 0.25), 1 - seg(t, b - 0.25, b));
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = k; let fs = 62; ctx.font = F(800, fs);
  while (ctx.measureText(s).width > W - 180 && fs > 36) { fs -= 2; ctx.font = F(800, fs); }
  const w = ctx.measureText(s).width + 80;
  const s2 = 0.85 + 0.15 * pop(seg(t, a, a + 0.35));
  ctx.translate(W / 2, y); ctx.scale(s2, s2);
  ctx.fillStyle = bg; rr(ctx, -w / 2, -58, w, 116, 58); ctx.fill();
  text(ctx, s, 0, 4, F(800, fs), color);
  ctx.restore();
}
function coin(ctx, x, y, r, spin) {
  const sx = Math.abs(Math.cos(spin)) * 0.8 + 0.2;
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
  ctx.fillStyle = '#b8862a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.28); ctx.fill();
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(0, 0, r * 0.84, 0, 6.28); ctx.fill();
  if (sx > 0.45) text(ctx, '₹', 0, r * 0.05, F(800, r * 1.1), '#8a5e12');
  ctx.restore();
}
function logo(ctx, x, y, s = 1, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(s, s);
  // house + rupee mark
  ctx.fillStyle = ACCENT; rr(ctx, -60, -60, 120, 120, 30); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-34, 2); ctx.lineTo(0, -30); ctx.lineTo(34, 2);
  ctx.lineTo(24, 2); ctx.lineTo(24, 34); ctx.lineTo(-24, 34); ctx.lineTo(-24, 2); ctx.closePath(); ctx.fill();
  text(ctx, '₹', 0, 14, F(800, 34), ACCENT);
  ctx.font = F(800, 92); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('family', 90, 4); const w = ctx.measureText('family').width;
  ctx.fillStyle = ACCENT_L; ctx.fillText('fi', 90 + w, 4);
  ctx.restore();
}

// ---------- background layers ----------
function night(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, NIGHT_TOP); g.addColorStop(1, NIGHT_BOT);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // moon
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const m = ctx.createRadialGradient(900, 210, 10, 900, 210, 200);
  m.addColorStop(0, '#fff4c2aa'); m.addColorStop(1, '#fff4c200');
  ctx.fillStyle = m; ctx.fillRect(600, 0, 480, 480); ctx.restore();
  ctx.fillStyle = '#fff4c2'; ctx.beginPath(); ctx.arc(900, 210, 50, 0, 6.28); ctx.fill();
}
function skyline(ctx, t) {
  const r = rng(7);
  ctx.fillStyle = '#06100f';
  for (let x = -20; x < W; x += 90) {
    const h = 260 + r() * 380, w = 70 + r() * 30;
    ctx.fillRect(x, 1300 - h, w, h + 20);
    for (let wy = 1300 - h + 30; wy < 1280; wy += 50)
      for (let wx = x + 14; wx < x + w - 14; wx += 26)
        if (r() > 0.55) {
          const on = Math.sin(t * 2 + wx * 0.3 + wy) > -0.7;
          ctx.fillStyle = on ? '#ffd98a' : '#1a2a28'; ctx.fillRect(wx, wy, 12, 18); ctx.fillStyle = '#06100f';
        }
  }
  ctx.fillStyle = '#0a1c1a'; ctx.fillRect(0, 1300, W, H - 1300);
}
// family of four walking home (same path-drawn style as the reference runners)
function person(ctx, x, y, s, t, phase, color, walk = 1, armsUp = 0) {
  const k = Math.sin(t * 7 + phase) * walk;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, -165, 30, 0, 6.28); ctx.fill();                       // head
  rr(ctx, -38, -128, 76, 120, 26); ctx.fill();                                        // body
  ctx.lineWidth = 22;
  ctx.beginPath(); ctx.moveTo(-14, -16); ctx.lineTo(-14 + 30 * k, 80); ctx.stroke();  // legs
  ctx.beginPath(); ctx.moveTo(14, -16); ctx.lineTo(14 - 30 * k, 80); ctx.stroke();
  const up = armsUp * 120;
  ctx.beginPath(); ctx.moveTo(-34, -110); ctx.lineTo(-34 - 30 * k - up * 0.3, -40 - up); ctx.stroke(); // arms
  ctx.beginPath(); ctx.moveTo(34, -110); ctx.lineTo(34 + 30 * k + up * 0.3, -40 - up); ctx.stroke();
  ctx.restore();
}
function family(ctx, x, y, t, color, walk, armsUp = 0) {
  person(ctx, x, y, 1.25, t, 0, color, walk, armsUp);            // papa
  person(ctx, x + 150, y + 6, 1.12, t, 1.6, color, walk, armsUp); // mummy
  person(ctx, x + 270, y + 40, 0.78, t, 0.8, color, walk, armsUp);// kid
  person(ctx, x - 120, y + 50, 0.66, t, 2.4, color, walk, armsUp);// little one
}
function fallingCoins(ctx, t, speed = 1, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha;
  for (const c of coins) {
    const y = (c.y + t * 260 * c.z * speed) % (H + 100) - 50;
    const x = (c.x + Math.sin(t + c.spin) * 40 * c.z + W) % W;
    coin(ctx, x, y, 14 + 26 * c.z, c.spin + t * 4 * c.z);
  }
  ctx.restore();
}
function grain(ctx, t) {
  const r = rng(SEED + Math.floor(t * FPS));
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 2200; i++) ctx.fillRect(r() * W, r() * H, 2, 2);
}
function vignette(ctx) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ---------- the phone with a FamilyFi dashboard (sample data only) ----------
function phone(ctx, cx, cy, t0, t) {
  const p = seg(t, t0, t0 + 0.8);
  const y = cy + (1 - pop(p)) * 1400;
  const PW = 640, PH = 1180, x = cx - PW / 2, top = y - PH / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  ctx.fillStyle = '#0b0f0f'; rr(ctx, x, top, PW, PH, 70); ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, x + 18, top + 18, PW - 36, PH - 36, 54); ctx.clip();
  ctx.fillStyle = '#f3f6f5'; ctx.fillRect(x, top, PW, PH);
  // app bar
  ctx.fillStyle = ACCENT; ctx.fillRect(x, top, PW, 190);
  text(ctx, 'familyfi', x + 60, top + 105, F(800, 44), '#fff', 'left');
  text(ctx, 'Nov 2026', x + PW - 60, top + 105, F(700, 28), '#dcefeb', 'right');
  ctx.fillStyle = '#0b0f0f'; rr(ctx, cx - 70, top + 26, 140, 34, 17); ctx.fill(); // notch
  // three KPI cards counting up
  const k = ease(seg(t, t0 + 0.7, t0 + 2.2));
  const cards = [['Income', 85000, '#1d7a4c'], ['Expense', 59199, '#c0532f'], ['Savings', 25801, '#2c5db0']];
  cards.forEach(([lab, v, col], i) => {
    const cw = 180, gx = x + 40 + i * (cw + 20), gy = top + 225;
    ctx.fillStyle = '#fff'; rr(ctx, gx, gy, cw, 140, 22); ctx.fill();
    ctx.fillStyle = col; ctx.fillRect(gx, gy + 20, 6, 100);
    text(ctx, lab, gx + cw / 2, gy + 44, F(700, 24), '#5b6c69');
    text(ctx, inr(v * k), gx + cw / 2, gy + 95, F(800, 32), col);
  });
  // donut: where the money went
  const dcx = x + 190, dcy = top + 590, R = 130;
  const parts = [[18000, ACCENT], [12500, SAV], [9400, INC], [6200, GOLD], [4800, EXP], [8299, '#ae95ea']];
  const tot = parts.reduce((s, q) => s + q[0], 0);
  let a = -Math.PI / 2; const sweep = ease(seg(t, t0 + 1.0, t0 + 2.6)) * 6.283;
  ctx.lineWidth = 56;
  for (const [v, col] of parts) {
    const d = (v / tot) * 6.283; const e = Math.min(a + d, -Math.PI / 2 + sweep);
    if (e > a) { ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(dcx, dcy, R, a, e); ctx.stroke(); }
    a += d;
  }
  text(ctx, 'Spent', dcx, dcy - 18, F(700, 26), '#5b6c69');
  text(ctx, inr(59199 * k), dcx, dcy + 22, F(800, 34), INK);
  const legend = [['Rent', ACCENT], ['EMI', SAV], ['Groceries', INC], ['School', GOLD], ['Shopping', EXP], ['Others', '#ae95ea']];
  legend.forEach(([n, c], i) => {
    const ly = top + 470 + i * 46, al = seg(t, t0 + 1.2 + i * 0.12, t0 + 1.5 + i * 0.12);
    ctx.globalAlpha = al; ctx.fillStyle = c; rr(ctx, x + 370, ly - 12, 24, 24, 6); ctx.fill();
    text(ctx, n, x + 410, ly + 2, F(700, 26), INK, 'left'); ctx.globalAlpha = 1;
  });
  // budget bars
  text(ctx, 'Budget vs Actual', x + 60, top + 790, F(800, 30), INK, 'left');
  const bars = [['Groceries', 0.78, INC], ['Shopping', 1.2, EXP], ['Eating out', 0.62, GOLD]];
  bars.forEach(([n, f, c], i) => {
    const by = top + 850 + i * 80, bw = PW - 120, pr = ease(seg(t, t0 + 1.8 + i * 0.15, t0 + 2.8 + i * 0.15));
    text(ctx, n, x + 60, by, F(700, 24), '#5b6c69', 'left');
    text(ctx, Math.round(f * 100 * pr) + '%', x + PW - 60, by, F(800, 24), f > 1 ? '#b42318' : INK, 'right');
    ctx.fillStyle = '#eaf0ee'; rr(ctx, x + 60, by + 22, bw, 18, 9); ctx.fill();
    ctx.fillStyle = f > 1 ? '#b42318' : c; rr(ctx, x + 60, by + 22, Math.max(18, bw * Math.min(f, 1) * pr), 18, 9); ctx.fill();
  });
  // overspend alert toast
  const al = pop(seg(t, t0 + 3.0, t0 + 3.4)) * (1 - seg(t, t0 + 5.2, t0 + 5.5));
  if (al > 0) {
    ctx.save(); ctx.globalAlpha = clamp(al); ctx.translate(cx, top + 1080); ctx.scale(al, al);
    ctx.fillStyle = '#fff4e5'; rr(ctx, -280, -48, 560, 96, 24); ctx.fill();
    ctx.strokeStyle = '#a86a12'; ctx.lineWidth = 3; ctx.stroke();
    text(ctx, '⚠ Shopping budget 120% — slow down!', 0, 2, F(700, 26), '#a86a12');
    ctx.restore();
  }
  ctx.restore();
  return { top, PH };
}

// savings goal jar that fills up
function jar(ctx, cx, cy, fill, t) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.save(); rr(ctx, -150, -200, 300, 400, 60); ctx.clip();
  const lvl = 200 - 400 * fill;
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(-160, 220);
  for (let x = -160; x <= 160; x += 10) ctx.lineTo(x, lvl + 10 * Math.sin(x / 30 + t * 5));
  ctx.lineTo(160, 220); ctx.fill();
  const r = rng(3);
  for (let i = 0; i < 30; i++) { const yy = lvl + 30 + r() * 380; if (yy < 200) coin(ctx, -120 + r() * 240, yy, 22, r() * 6 + t); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 10; rr(ctx, -150, -200, 300, 400, 60); ctx.stroke();
  ctx.fillStyle = ACCENT_L; rr(ctx, -110, -240, 220, 50, 16); ctx.fill();
  text(ctx, Math.round(fill * 100) + '%', 0, 0, F(800, 90), '#fff');
  ctx.restore();
}

// ---------- the shot list ----------
function shot(ctx, t) {
  const zoom = 1 + 0.05 * Math.sin(t * 0.4);
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);

  if (t < 9.5) {
    // SCENE 1+2: payday night, salary comes in, bills fly out
    night(ctx, t); skyline(ctx, t);
    const walkX = 1150 - 170 * Math.min(t, 4.5);
    family(ctx, walkX, 1540, t, '#020807', t < 4.5 ? 1 : 0, 0);
    // wallet with salary
    const wx = W / 2, wy = 820, wp = pop(seg(t, 0.2, 0.8));
    ctx.save(); ctx.translate(wx, wy); ctx.scale(wp, wp);
    ctx.fillStyle = '#6b3f1f'; rr(ctx, -170, -110, 340, 220, 30); ctx.fill();
    ctx.fillStyle = '#8a5530'; rr(ctx, 40, -50, 150, 100, 24); ctx.fill();
    ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(110, 0, 18, 0, 6.28); ctx.fill();
    const bal = 85000 - bills.reduce((s, b) => s + b.v * clamp((t - 3.4 - b.d) / 0.4), 0);
    text(ctx, inr(Math.max(bal, 0)), -40, 0, F(800, 48), bal < 15000 ? '#ffb4a8' : '#fff');
    ctx.restore();
    if (t < 3.4) caption(ctx, 'Salary aayi: ₹85,000 💰', t, 0.4, 3.2, 1160, '#fff', 'rgba(13,107,97,0.85)');
    // bills fly out
    for (const b of bills) {
      const p = seg(t, 3.4 + b.d, 3.4 + b.d + 1.6); if (p <= 0) continue;
      const d = 120 + ease(p) * 560 * b.sp;
      const bx = wx + Math.cos(b.a) * d * 0.85, by = wy + Math.sin(b.a) * d * 0.6 - 60 + p * p * 300;
      ctx.save(); ctx.globalAlpha = 1 - seg(p, 0.75, 1); ctx.translate(bx, by); ctx.rotate(Math.sin(b.a * 3 + t) * 0.2);
      ctx.font = F(700, 30); const bw = ctx.measureText(b.n).width + 60;
      ctx.fillStyle = '#fff'; rr(ctx, -bw / 2, -50, bw, 100, 18); ctx.fill();
      text(ctx, b.n, 0, -14, F(700, 28), INK); text(ctx, '-' + inr(b.v), 0, 22, F(800, 28), '#c0532f');
      ctx.restore();
    }
    fallingCoins(ctx, t, 1, 0.9 * seg(t, 3.2, 4));
    caption(ctx, 'Mahine ke end tak… 😰', t, 3.6, 6.4, 1160, '#fff', 'rgba(180,35,24,0.85)');
    caption(ctx, 'PAISA GAYA KAHAN? 🤔', t, 6.4, 9.4, 1160, INK, '#ffd98a');
    // hook title, first 2 seconds
    const hk = 1 - seg(t, 2.6, 3.0);
    if (hk > 0) {
      ctx.save(); ctx.globalAlpha = hk;
      text(ctx, 'Har mahine', W / 2, 400, F(800, 84), '#fff');
      text(ctx, 'yahi kahani? 👀', W / 2, 510, F(800, 84), GOLD);
      ctx.restore();
    }
  } else if (t < 16.5) {
    // SCENE 3: FamilyFi shows exactly where it went
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0d6b61'); g.addColorStop(1, '#06201d'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.07;
    for (let i = 0; i < 12; i++) text(ctx, '₹', (i * 173 + t * 40) % (W + 200) - 100, 200 + (i * 331) % 1500, F(800, 160), '#fff');
    ctx.restore();
    logo(ctx, W / 2 - 230, 190, 1, seg(t, 9.6, 10.2));
    phone(ctx, W / 2, 940, 9.6, t);
    caption(ctx, 'Har ₹ kahan gaya — FamilyFi batata hai 📊', t, 10.4, 13.2, 1650, '#fff', 'rgba(0,0,0,0.6)');
    caption(ctx, 'Budget alert — overspend se pehle! 🔔', t, 13.2, 16.4, 1650, INK, '#ffd98a');
  } else {
    // SCENE 4: happy ending, goal jar fills, CTA end card
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0f4a44'); g.addColorStop(1, '#041513'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const s of sparks) {
      const a = 0.3 + 0.7 * Math.abs(Math.sin(t * 3 * s.z + s.p));
      ctx.fillStyle = `rgba(255,220,140,${(a * s.z * 0.6).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, (s.y - t * 40 * s.z + H) % H, 2 + 4 * s.z, 0, 6.28); ctx.fill();
    }
    ctx.restore();
    const tEnd = 19.2;
    if (t < tEnd) {
      jar(ctx, W / 2, 760, 0.15 + 0.85 * ease(seg(t, 16.6, 18.6)), t);
      text(ctx, 'Goal: Family Goa Trip 🏖️', W / 2, 460, F(800, 56), '#fff', 'center', seg(t, 16.6, 17));
      family(ctx, W / 2 - 110, 1330, t, '#e9f5f2', 0.3, pop(seg(t, 18, 18.5)) * 0.9);
      caption(ctx, 'Har mahine ₹25,801 ki bachat! 🎉', t, 16.8, 19.2, 1560, '#fff', 'rgba(13,107,97,0.9)');
    } else {
      const p = seg(t, tEnd, tEnd + 0.6);
      logo(ctx, W / 2 - 230, 420, 1.0, p);
      ctx.save(); const s = pop(seg(t, tEnd + 0.2, tEnd + 0.7)); ctx.translate(W / 2, 700); ctx.scale(s, s);
      text(ctx, 'Aapka paisa,', 0, -60, F(800, 88), '#fff');
      text(ctx, 'aapke CONTROL mein!', 0, 50, F(800, 76), GOLD);
      ctx.restore();
      const c = seg(t, tEnd + 0.7, tEnd + 1.1);
      ctx.save(); ctx.globalAlpha = c;
      ctx.fillStyle = '#fff'; rr(ctx, 140, 900, W - 280, 330, 40); ctx.fill();
      text(ctx, '15-DAY FREE TRIAL', W / 2, 975, F(800, 58), ACCENT);
      text(ctx, 'Yearly ₹1,499 → ₹999 launch offer', W / 2, 1060, F(700, 36), INK);
      text(ctx, 'Offer till 31 Dec 2026', W / 2, 1110, F(400, 30), '#5b6c69');
      text(ctx, 'Data stays in YOUR Google Drive 🔒', W / 2, 1170, F(700, 30), '#1d7a4c');
      const b = 1 + 0.04 * Math.sin(t * 8);
      ctx.translate(W / 2, 1360); ctx.scale(b, b);
      ctx.fillStyle = GOLD; rr(ctx, -380, -62, 760, 124, 62); ctx.fill();
      text(ctx, 'nisnil.co.in/familyfi 👉', 0, 4, F(800, 46), INK);
      ctx.restore();
      text(ctx, 'Link in bio  ·  @familyfi.app', W / 2, 1500, F(700, 34), '#dcefeb', 'center', c);
    }
  }
  ctx.restore();
  // scene-cut white flashes
  for (const cut of [9.5, 16.5]) {
    const f = 1 - Math.abs(t - cut) / 0.15;
    if (f > 0) { ctx.fillStyle = `rgba(255,255,255,${(f * 0.8).toFixed(3)})`; ctx.fillRect(0, 0, W, H); }
  }
  vignette(ctx); grain(ctx, t);
}

// ---- render ----
const canvas = createCanvas(W, H), ctx = canvas.getContext('2d');
if (STILLS) {
  const fs = require('fs');
  for (const s of STILLS.split(',')) { shot(ctx, Number(s)); fs.writeFileSync(`still_${s}.png`, canvas.toBuffer('image/png')); }
  console.log('stills written'); return;
}
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba',
  '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
  '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart', OUT],
  { stdio: ['pipe', 'inherit', 'inherit'] });
(async () => {
  const total = DURATION * FPS;
  for (let f = 0; f < total; f++) {
    shot(ctx, f / FPS);
    const ok = ff.stdin.write(Buffer.from(ctx.getImageData(0, 0, W, H).data.buffer));
    if (!ok) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % FPS === 0) process.stdout.write(`frame ${f} / ${total}\r`);
  }
  ff.stdin.end();
  ff.on('close', (code) => console.log(code === 0 ? `\ndone: ${OUT} (${total} frames)` : `ffmpeg exited ${code}`));
})();
