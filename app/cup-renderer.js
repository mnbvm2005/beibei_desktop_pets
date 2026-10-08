/* 杯杯 · A small, deliberately insufferable hand-drawn porcelain creature.
 * All artwork is procedural Canvas 2D, in a 180 × 156 reference coordinate system.
 * It never clears the canvas and restores every context property it changes.
 */
(function (global) {
  'use strict';

  const INK = '#252723';
  const PORCELAIN = '#fffdf6';
  const SHADE = '#e8e6dd';

  function path(ctx, points, fill, width = 3.7, stroke = INK) {
    ctx.beginPath();
    points.forEach(p => {
      if (p[0] === 'M') ctx.moveTo(p[1], p[2]);
      else if (p[0] === 'L') ctx.lineTo(p[1], p[2]);
      else if (p[0] === 'C') ctx.bezierCurveTo(...p.slice(1));
      else if (p[0] === 'Q') ctx.quadraticCurveTo(...p.slice(1));
      else if (p[0] === 'Z') ctx.closePath();
    });
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke && width > 0) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function ellipse(ctx, x, y, rx, ry, fill, width = 0, stroke = INK, angle = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (width > 0) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function music(ctx, x, y, scale, rotation, double) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(scale, scale);
    if (double) {
      path(ctx, [['M', 0, 12], ['L', 0, -8], ['L', 16, -11], ['L', 16, 8]], null, 4.4);
      path(ctx, [['M', 1, -3], ['L', 15, -6]], null, 4.4);
      ellipse(ctx, -4, 12, 6.7, 5, INK, 0, INK, -0.35);
      ellipse(ctx, 12, 8, 6.7, 5, INK, 0, INK, -0.35);
    } else {
      path(ctx, [['M', 1, 8], ['L', 1, -9], ['Q', 3, -2, 10, -4]], null, 4.3);
      ellipse(ctx, -3, 9, 6.3, 5.1, INK, 0, INK, -0.45);
    }
    ctx.restore();
  }

  function drop(ctx, x, y, size, rotation, pale = false) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size, size);
    path(ctx, [['M', 0, -8], ['C', -2, -3, -6, 1, -5, 4], ['C', -4, 10, 5, 10, 5, 4], ['C', 5, 1, 2, -4, 0, -8], ['Z']], pale ? '#f5fbff' : '#a9def2', 1.75);
    path(ctx, [['M', -2, 3], ['Q', -3, 5, -1, 6]], null, 1.2, '#ffffff');
    ctx.restore();
  }

  function legs(ctx, mood, time) {
    const beat = Math.sin(time * (mood === 'smug' ? 5 : 27));
    ctx.save();
    if (mood === 'smug' || mood === 'yum') {
      // Flat white, mitten-like feet; the left foot struts out before the other.
      path(ctx, [['M', 64, 101], ['C', 61, 108, 58, 114 + beat * 3, 53, 118 + beat * 3], ['C', 48, 115, 42, 108, 39, 112], ['C', 34, 118, 48, 136, 54, 133], ['C', 61, 128, 66, 119, 71, 110], ['Z']], PORCELAIN);
      path(ctx, [['M', 104, 105], ['C', 106, 112, 117, 113 - beat * 3, 118, 116 - beat * 3], ['C', 114, 119, 108, 128, 112, 131], ['C', 120, 136, 130, 118, 127, 114], ['C', 124, 109, 118, 106, 114, 102], ['Z']], PORCELAIN);
    } else if (mood === 'panic') {
      path(ctx, [['M', 63, 101], ['C', 58, 109, 51, 108 + beat * 7, 43, 112 + beat * 7], ['C', 34, 109 + beat * 7, 29, 113 + beat * 7, 36, 120 + beat * 5], ['C', 43, 126 + beat * 5, 54, 116, 70, 110], ['Z']], PORCELAIN);
      path(ctx, [['M', 109, 103], ['C', 118, 106, 123, 121 - beat * 7, 130, 122 - beat * 7], ['C', 140, 124 - beat * 7, 147, 117 - beat * 5, 140, 113 - beat * 5], ['C', 130, 113 - beat * 5, 129, 109, 116, 100], ['Z']], PORCELAIN);
      const jitter = Math.sin(time * 34) * 2;
      path(ctx, [['M', 26, 106 + jitter], ['L', 20, 111 + jitter], ['M', 28, 124 + jitter], ['L', 22, 125 + jitter], ['M', 147, 104 - jitter], ['L', 153, 108 - jitter], ['M', 147, 124 - jitter], ['L', 155, 123 - jitter]], null, 2.2);
    } else if (mood === 'falling') {
      path(ctx, [['M', 66, 104], ['C', 60, 113, 54, 118, 50, 116], ['C', 47, 112, 43, 115, 44, 120], ['C', 46, 131, 59, 130, 73, 110], ['Z']], PORCELAIN);
      path(ctx, [['M', 103, 104], ['C', 112, 112, 117, 112, 121, 120], ['C', 117, 125, 120, 130, 126, 127], ['C', 138, 120, 125, 107, 115, 101], ['Z']], PORCELAIN);
    } else {
      path(ctx, [['M', 61, 105], ['C', 54, 116, 41, 115, 39, 119], ['C', 35, 126, 49, 130, 66, 119], ['L', 74, 110], ['Z']], PORCELAIN);
      path(ctx, [['M', 103, 108], ['C', 110, 120, 129, 130, 136, 123], ['C', 141, 117, 120, 117, 115, 105], ['Z']], PORCELAIN);
    }
    ctx.restore();
  }

  function handles(ctx, mood, time) {
    const panic = mood === 'panic' ? Math.sin(time * 28) * 2.2 : 0;
    // These are two ear-like handles, not human arms.
    path(ctx, [['M', 51, 59], ['C', 36, 58 + panic, 31, 66 + panic, 33, 82], ['C', 34, 90, 40, 94, 51, 90], ['L', 57, 77], ['Z']], PORCELAIN);
    path(ctx, [['M', 47, 69], ['Q', 39, 66 + panic, 40, 77], ['Q', 39, 84, 48, 81], ['Z']], SHADE, 2.6);
    path(ctx, [['M', 121, 65], ['C', 135, 59 - panic, 150, 67 - panic, 148, 82], ['C', 147, 96, 135, 101, 120, 94], ['L', 116, 76], ['Z']], PORCELAIN);
    path(ctx, [['M', 129, 74], ['Q', 139, 69 - panic, 139, 81], ['Q', 139, 88, 129, 86], ['Z']], SHADE, 2.7);
  }

  function cupBody(ctx, mood) {
    const squash = mood === 'bruised' ? 7 : 0;
    path(ctx, [['M', 54, 43 + squash], ['C', 68, 39 + squash, 100, 39 + squash, 118, 44 + squash], ['C', 124, 47 + squash, 122, 59, 123, 76], ['L', 121, 103], ['C', 119, 110, 107, 109, 95, 108], ['L', 63, 106], ['C', 51, 108, 46, 102, 48, 91], ['L', 49, 57], ['Q', 48, 47 + squash, 54, 43 + squash], ['Z']], PORCELAIN, 4.1);
    // A tiny warm porcelain edge keeps the silhouette readable against white.
    path(ctx, [['M', 118, 56], ['Q', 116, 88, 116, 100], ['Q', 105, 105, 88, 103]], null, 3, '#eeece4');
    if (mood === 'panic') {
      const shade = ctx.createLinearGradient(0, 44, 0, 77);
      shade.addColorStop(0, 'rgba(108,178,211,0.56)');
      shade.addColorStop(1, 'rgba(171,218,235,0)');
      path(ctx, [['M', 54, 46], ['Q', 85, 40, 119, 47], ['L', 120, 78], ['L', 50, 78], ['Z']], shade, 0);
      path(ctx, [['M', 57, 49], ['L', 58, 57], ['M', 63, 47], ['L', 64, 56], ['M', 70, 47], ['L', 70, 53]], null, 1.1, '#6c95a8');
    }
  }

  function smugFace(ctx, time) {
    // A tiny occasional flutter replaces the grin without losing the reference's closed eyes.
    const blink = Math.pow(Math.max(0, Math.sin(time * 0.65)), 40);
    path(ctx, [['M', 62, 68], ['C', 65, 53 + blink * 8, 75, 54 + blink * 8, 73, 66]], null, 4.2);
    path(ctx, [['M', 88, 66], ['C', 92, 52 + blink * 8, 102, 55 + blink * 8, 100, 67]], null, 4.2);
    // The left-facing epsilon mouth is the core of the annoying expression.
    path(ctx, [['M', 76, 79], ['C', 64, 73, 62, 80, 70, 84], ['C', 61, 85, 64, 93, 75, 90]], null, 3.5);
    path(ctx, [['M', 80, 84], ['L', 83, 83]], null, 1.5, '#aca79d');
    // Barely-there rosy cheeks, just enough to make the smugness worse.
    ellipse(ctx, 57.5, 79, 4.5, 2, '#f6d9cf');
    ellipse(ctx, 105, 79, 5, 2, '#f6d9cf');
  }

  function panicFace(ctx, time) {
    const twitch = Math.sin(time * 35);
    path(ctx, [['M', 58, 55], ['L', 70, 51], ['M', 92, 51], ['L', 106, 56]], null, 2.8);
    ellipse(ctx, 65, 68, 9.4, 12.7, '#ffffff', 2.9, INK, -0.15);
    ellipse(ctx, 98, 68, 9.8, 12.7, '#ffffff', 2.9, INK, 0.13);
    ellipse(ctx, 65 + twitch, 70, 1.7, 3.1, INK);
    ellipse(ctx, 98 - twitch, 70, 1.7, 3.1, INK);
    path(ctx, [['M', 77, 81], ['C', 81, 76, 88, 80, 90, 87], ['C', 97, 100, 86, 105, 76, 102], ['C', 65, 99, 68, 88, 77, 81], ['Z']], INK, 2.5);
    path(ctx, [['M', 76, 83], ['Q', 83, 79, 87, 86], ['L', 85, 88], ['L', 78, 87], ['Z']], '#ffffff', 0);
    path(ctx, [['M', 74, 97], ['Q', 82, 90, 90, 98], ['Q', 85, 103, 76, 100], ['Z']], '#e9a9a8', 0);
    drop(ctx, 55, 87, 0.54, 0.3);
    drop(ctx, 112, 84, 0.57, -0.42);
    drop(ctx, 132, 43 + Math.sin(time * 14) * 3, 0.8, 0.52);
    drop(ctx, 39, 45 + Math.cos(time * 13) * 3, 0.63, -0.6);
    path(ctx, [['M', 25, 54], ['L', 18, 50], ['M', 151, 56], ['L', 159, 51]], null, 2.2);
  }

  function fallingFace(ctx, time) {
    ellipse(ctx, 65, 65, 9.5, 12, '#fff', 3, INK, -0.15);
    ellipse(ctx, 99, 66, 9.5, 12, '#fff', 3, INK, 0.16);
    // Pupils rolled so high that only a little black crescent survives.
    ellipse(ctx, 65, 56, 3, 2, INK);
    ellipse(ctx, 99, 57, 3, 2, INK);
    path(ctx, [['M', 76, 83], ['Q', 82, 76, 88, 84], ['L', 91, 98], ['Q', 82, 105, 73, 98], ['Z']], INK, 2.8);
    path(ctx, [['M', 76, 97], ['Q', 83, 89, 88, 98]], '#dba2a2', 0);
    drop(ctx, 110, 84, 0.55, -0.5);
    const tail = Math.sin(time * 19) * 3;
    path(ctx, [['M', 32, 22 + tail], ['L', 32, 37 + tail], ['M', 46, 13 + tail], ['L', 46, 29 + tail], ['M', 139, 21 - tail], ['L', 139, 34 - tail]], null, 2.2, '#989f9e');
  }

  function bruisedFace(ctx, time) {
    ellipse(ctx, 100, 69, 12.8, 11, '#e0dce9');
    path(ctx, [['M', 59, 64], ['L', 71, 70], ['L', 60, 73], ['M', 94, 67], ['L', 104, 72], ['L', 94, 76]], null, 3.2);
    path(ctx, [['M', 69, 92], ['Q', 82, 81, 96, 92], ['M', 74, 95], ['Q', 82, 91, 90, 95]], null, 2.7);
    drop(ctx, 61, 82 + Math.sin(time * 3), 0.63, 0.2);
    drop(ctx, 107, 84 + Math.cos(time * 3), 0.61, -0.28);
    // Small ceramic cracks, kept away from the eyes for legibility.
    path(ctx, [['M', 113, 48], ['L', 107, 54], ['L', 113, 59], ['L', 109, 65], ['M', 52, 89], ['L', 59, 93], ['L', 54, 97], ['L', 64, 103]], null, 1.6, '#6f7069');
    path(ctx, [['M', 77, 51], ['L', 72, 56], ['M', 73, 51], ['L', 78, 56]], null, 1.5, '#b4aca3');
    // A melancholy puff above the head rather than extra UI text.
    const sway = Math.sin(time * 2) * 2;
    path(ctx, [['M', 83, 31], ['C', 77 + sway, 27, 85 + sway, 24, 80, 20], ['M', 93, 29], ['C', 88 + sway, 25, 96 + sway, 22, 92, 18]], null, 2, '#969995');
  }

  function sparkle(ctx, x, y, size) {
    path(ctx, [['M', x, y - size], ['Q', x + 1, y - 1, x + size, y], ['Q', x + 1, y + 1, x, y + size], ['Q', x - 1, y + 1, x - size, y], ['Q', x - 1, y - 1, x, y - size], ['Z']], '#ffe594', 1.8);
  }

  function yumFace(ctx, time) {
    const wave = Math.sin(time * 4);
    // Half-lidded eyes rolling up: an utterly unearned moment of bliss.
    ellipse(ctx, 66, 66, 8, 10, '#ffffff', 2.6, INK, -0.1);
    ellipse(ctx, 98, 66, 8, 10, '#ffffff', 2.6, INK, 0.1);
    ellipse(ctx, 67, 59.5, 2.5, 3, INK);
    ellipse(ctx, 98, 59.5, 2.5, 3, INK);
    path(ctx, [['M', 57, 69], ['Q', 66, 74, 74, 69], ['M', 90, 69], ['Q', 98, 74, 106, 68]], null, 2.3);
    ellipse(ctx, 59, 80, 8, 3.8, '#f0c3b5');
    ellipse(ctx, 107, 81, 8, 3.8, '#f0c3b5');
    path(ctx, [['M', 56, 78], ['L', 55, 82], ['M', 61, 79], ['L', 60, 83], ['M', 104, 79], ['L', 103, 83], ['M', 110, 79], ['L', 109, 83]], null, 1.2, '#d99383');
    path(ctx, [['M', 72, 82], ['Q', 81, 89, 92, 81], ['C', 94, 91, 88, 103, 80, 102], ['C', 72, 101, 71, 91, 72, 82], ['Z']], INK, 2.5);
    path(ctx, [['M', 77, 96], ['C', 78, 90, 88, 91, 87, 98], ['Q', 84, 107 + wave, 78, 102], ['Z']], '#efb1ae', 1.4);
    path(ctx, [['M', 82, 95], ['L', 82, 100]], null, 1.1, '#cf8886');
    drop(ctx, 93, 97, 0.4, -0.35, true);
    sparkle(ctx, 35, 46 + wave * 2, 6);
    sparkle(ctx, 135, 41 - wave * 3, 8);
    sparkle(ctx, 115, 22 + wave, 4.5);
    sparkle(ctx, 55, 23 - wave, 4);
  }

  function draw(ctx, rect, pose = {}) {
    if (!ctx || !rect || rect.width <= 0 || rect.height <= 0) return;
    const mood = ['smug', 'panic', 'falling', 'bruised', 'yum'].includes(pose.mood) ? pose.mood : 'smug';
    const time = Number.isFinite(pose.time) ? pose.time : 0;
    const intensity = Number.isFinite(pose.intensity) ? Math.max(0, Math.min(1.5, pose.intensity)) : 1;
    const facing = pose.direction < 0 ? -1 : 1;
    const scale = Math.min(rect.width / 180, rect.height / 156);
    ctx.save();
    ctx.translate((rect.x || 0) + rect.width / 2, (rect.y || 0) + rect.height / 2);
    ctx.scale(scale * facing, scale);
    ctx.translate(-90, -78);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (mood === 'smug') {
      const float = Math.sin(time * 3);
      music(ctx, 42, 39 + float * 3, 0.74, -0.32, false);
      music(ctx, 73, 15 - float * 2, 0.77, 0.12, true);
      music(ctx, 144, 31 + Math.cos(time * 3.4) * 4, 0.77, 0.5, false);
    }
    ctx.translate(87, 82);
    if (mood === 'smug' || mood === 'yum') {
      ctx.translate(0, Math.sin(time * 5) * 2 * intensity);
      ctx.rotate(Math.sin(time * 2.5) * 0.045 * intensity);
    } else if (mood === 'panic') {
      ctx.translate(Math.sin(time * 47) * 1.1 * intensity, Math.cos(time * 39) * 0.7 * intensity);
      ctx.rotate(Math.sin(time * 22) * 0.055 * intensity);
    } else if (mood === 'falling') {
      ctx.rotate(Math.sin(time * 9) * 0.08 * intensity);
    } else {
      ctx.translate(0, 4);
      ctx.rotate(-0.055);
    }
    ctx.translate(-87, -82);
    legs(ctx, mood, time);
    handles(ctx, mood, time);
    cupBody(ctx, mood);
    if (mood === 'smug') smugFace(ctx, time);
    else if (mood === 'panic') panicFace(ctx, time);
    else if (mood === 'falling') fallingFace(ctx, time);
    else if (mood === 'yum') yumFace(ctx, time);
    else bruisedFace(ctx, time);
    ctx.restore();
  }

  function drawPoop(ctx, x, y, size = 20, rotation = 0, color = '#ba9169') {
    if (!ctx || size <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size / 24, size / 24);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(ctx, [['M', -8, 10], ['C', -16, 10, -15, 2, -8, 1], ['C', -13, -4, -6, -9, -2, -8], ['C', -3, -12, 0, -12, 1, -17], ['C', 7, -14, 8, -9, 5, -6], ['C', 12, -6, 14, -1, 9, 2], ['C', 17, 4, 15, 10, 8, 10], ['Z']], color, 2.1);
    path(ctx, [['M', -8, 1], ['Q', -2, 4, 9, 2], ['M', -2, -8], ['Q', 2, -5, 5, -6]], null, 1.4, 'rgba(50,30,20,0.42)');
    path(ctx, [['M', -8, 6], ['Q', -3, 7, 3, 6]], null, 1.4, 'rgba(255,255,255,0.48)');
    ctx.restore();
  }

  function drawShard(ctx, x, y, size = 20, rotation = 0, index = 0) {
    if (!ctx || size <= 0) return;
    const variants = [
      [['M', -10, -7], ['L', 5, -10], ['L', 11, -1], ['L', 1, 8], ['L', -8, 5], ['Z']],
      [['M', -8, -11], ['L', 8, -5], ['L', 4, 11], ['L', -3, 6], ['Z']],
      [['M', -12, 0], ['L', 1, -10], ['L', 10, -3], ['L', 5, 8], ['L', -5, 9], ['Z']],
      [['M', -7, -10], ['Q', 10, -12, 10, 2], ['L', 4, 8], ['L', -1, 1], ['Q', 4, -5, -6, -3], ['Z']],
      [['M', -11, -5], ['L', 10, -8], ['L', 7, 6], ['L', -2, 9], ['L', -4, 2], ['Z']]
    ];
    const n = ((Math.trunc(index) % variants.length) + variants.length) % variants.length;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.scale(size / 24, size / 24);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    path(ctx, variants[n], PORCELAIN, 2.2);
    path(ctx, [['M', -5, 3], ['L', 0, 5], ['L', 5, 2]], null, 1.3, '#d0cfc6');
    if (n === 1) path(ctx, [['M', -3, -6], ['Q', 2, -2, 0, 2]], null, 2.7);
    if (n === 4) path(ctx, [['M', -3, -3], ['Q', 0, -7, 3, -2]], null, 2.4);
    ctx.restore();
  }

  global.CupRenderer = Object.freeze({ draw, drawPoop, drawShard });
})(typeof window !== 'undefined' ? window : globalThis);
