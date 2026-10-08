'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine, TAUNTS, RAINBOW } = require('../app/engine.js');

function makeEngine(options = {}) {
  const engine = new Engine({ random: () => 0.5, ...options });
  engine.wandering = false;
  return engine;
}

function advance(engine, seconds, dt = 1 / 60) {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i++) engine.step(seconds / steps);
}

function untilState(engine, expected, timeout = 8) {
  for (let i = 0; i < Math.ceil(timeout * 60); i++) {
    if (engine.state === expected) return;
    engine.step(1 / 60);
  }
  assert.equal(engine.state, expected, `Expected ${expected} within ${timeout}s`);
}

function assertNear(actual, expected, tolerance = 1e-7) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
}

test('idle bubbles expire and taunts recur on a bounded randomized schedule', () => {
  const engine = makeEngine();
  assert.equal(engine.state, 'idle');
  assert.equal(engine.bubble.text, '杯杯我呀～');
  advance(engine, 4.1);
  assert.equal(engine.bubble, null);
  advance(engine, 6.0);
  assert.ok(TAUNTS.includes(engine.bubble.text));
  assert.equal(engine.bubble.kind, 'smug');
  const firstId = engine.utterance.id;
  const nextTalk = engine.talkAt;
  assert.ok(nextTalk - engine.time >= 10.9 && nextTalk - engine.time <= 20);
  advance(engine, 5);
  assert.equal(engine.bubble, null);
  advance(engine, nextTalk - engine.time + 0.1);
  assert.ok(TAUNTS.includes(engine.bubble.text));
  assert.ok(engine.utterance.id > firstId);
});

test('grabbing immediately replaces smugness with panic and preserves cursor offset', () => {
  const engine = makeEngine();
  engine.taunt();
  const previousId = engine.utterance.id;
  engine.vx = 120;
  engine.vy = -60;
  assert.equal(engine.grab(engine.x + 12, engine.y - 8), true);
  assert.equal(engine.state, 'held');
  assert.equal(engine.holdAge, 0);
  assert.equal(engine.vx, 0);
  assert.equal(engine.vy, 0);
  assert.equal(engine.bubble.kind, 'panic');
  assert.equal(engine.bubble.text, '爸爸我错了！！');
  assert.ok(engine.utterance.id > previousId);
  engine.dragTo(500, 300);
  assert.equal(engine.x, 488);
  assert.equal(engine.y, 308);
});

test('holding continuously emits poop, puts it into motion, and caps the orbit population', () => {
  const engine = makeEngine();
  engine.grab();
  engine.dragTo(600, 300);
  advance(engine, 0.08);
  assert.ok(engine.orbiters.length > 0);
  const early = engine.snapshot().orbiters[0];
  advance(engine, 0.7);
  const moving = engine.snapshot().orbiters[0];
  assert.ok(engine.orbiters.length >= 3);
  assert.ok(Math.hypot(moving.x - early.x, moving.y - early.y) > 20);
  assert.equal(engine.snapshot().orbiters[0].color, '#95623f');
  advance(engine, 30);
  assert.equal(engine.orbiters.length, 26);
  assert.equal(engine.bubble.kind, 'panic');
  assert.ok(engine.utterance.id > 3, 'begging should continue while held');
});

test('a sustained hold creates distinct brown and rainbow poop rings', () => {
  const engine = makeEngine();
  engine.grab();
  advance(engine, 0.5);
  assert.equal(engine.snapshot().rings.length, 0);
  advance(engine, 2);
  const rings = engine.snapshot().rings;
  const inner = rings.filter(p => p.ring === 0);
  const outer = rings.filter(p => p.ring === 1);
  assert.equal(inner.length, 24);
  assert.equal(outer.length, 30);
  assert.equal(new Set(inner.map(p => p.color)).size, 1);
  assert.ok(inner.every(p => p.color === '#95623f'));
  assert.deepEqual(new Set(outer.map(p => p.color)), new Set(RAINBOW));
  const first = { x: inner[0].x, y: inner[0].y };
  advance(engine, 0.15);
  const rotated = engine.snapshot().rings.find(p => p.ring === 0);
  assert.ok(Math.hypot(rotated.x - first.x, rotated.y - first.y) > 10);
});

test('release explodes orbiting poop, stops emission, and starts the fall', () => {
  const engine = makeEngine();
  engine.grab();
  engine.dragTo(600, 200);
  advance(engine, 3);
  const before = engine.orbiters.length + engine.snapshot().rings.length;
  assert.equal(engine.release(), true);
  assert.equal(engine.state, 'falling');
  assert.equal(engine.bubble.kind, 'panic');
  assert.equal(engine.orbiters.length, 0);
  assert.equal(engine.snapshot().rings.length, 0);
  assert.equal(engine.particles.filter(p => p.kind === 'poop').length, before);
  assert.ok(engine.particles.some(p => p.vx < 0));
  assert.ok(engine.particles.some(p => p.vx > 0));
  advance(engine, 0.08);
  assert.equal(engine.state, 'falling');
  assert.equal(engine.orbiters.length, 0);
  assert.equal(engine.release(), false);
});

test('release falls at most 72 pixels, shatters there, reforms, and returns to smug idle', () => {
  const engine = makeEngine();
  engine.grab();
  engine.dragTo(600, 180);
  advance(engine, 1);
  const releasedY = engine.y;
  engine.release();
  const landingY = engine.landingY;
  assertNear(landingY, Math.min(engine.floorAt(engine.x), releasedY + 78 + 72));
  untilState(engine, 'shattered', 2);
  assertNear(engine.y + 78, landingY);
  assertNear(engine.y - releasedY, 72);
  assertNear(engine.restY, landingY);
  assert.equal(engine.particles.filter(p => p.kind === 'shard').length, 12);
  assert.equal(engine.bubble.kind, 'broken');
  assert.ok(engine.impact);
  assert.equal(engine.hitTest(engine.x, engine.y), false);
  assert.equal(engine.grab(), false);
  untilState(engine, 'reforming', 3);
  assert.equal(engine.grab(), false);
  assert.ok(engine.particles.filter(p => p.kind === 'shard').every(p => Number.isFinite(p.homeX) && Number.isFinite(p.homeY)));
  untilState(engine, 'bruised', 2);
  assert.equal(engine.particles.some(p => p.kind === 'shard'), false);
  untilState(engine, 'idle', 4);
  assert.equal(engine.bubble.text, '……骗你的～');
  assert.equal(engine.bubble.kind, 'smug');
  assert.ok(engine.talkAt > engine.time + 10);
  assertNear(engine.y + 78, landingY);
  advance(engine, 2);
  assertNear(engine.y + 78, landingY, 1e-6);
  assert.ok(engine.y + 78 < engine.floorAt(engine.x) - 300, 'recovery must not return the cup to the desktop bottom');
});

test('short grabs can still release and fully recover', () => {
  const engine = makeEngine();
  engine.grab();
  assert.equal(engine.release(), true);
  untilState(engine, 'shattered', 0.3);
  untilState(engine, 'idle', 7);
  assert.ok(Number.isFinite(engine.x) && Number.isFinite(engine.y));
});

test('particle storage is bounded and expired particles are reclaimed', () => {
  const engine = makeEngine();
  for (let i = 0; i < 500; i++) {
    engine.addParticle({ kind: 'poop', x: 200, y: 200, vx: i, vy: 0, size: 15, life: 0.2 });
  }
  assert.equal(engine.particles.length, 180);
  assert.equal(engine.particles[0].vx, 320, 'the oldest particles are evicted');
  advance(engine, 0.3);
  assert.equal(engine.particles.length, 0);
});

test('a long held session and repeated release cycles never exceed particle limits', () => {
  const engine = makeEngine();
  for (let cycle = 0; cycle < 8; cycle++) {
    engine.grab();
    engine.dragTo(600, 200);
    advance(engine, 9);
    assert.ok(engine.orbiters.length <= 26);
    engine.release();
    for (let i = 0; i < 420; i++) {
      engine.step(1 / 60);
      assert.ok(engine.particles.length <= 180);
    }
    assert.equal(engine.state, 'idle');
  }
});

test('negative-origin and unequal-height monitors calculate a short landing within their own work areas', () => {
  const areas = [
    { x: 0, y: 0, width: 1440, height: 900 },
    { x: -1600, y: -180, width: 1600, height: 1080 },
    { x: 1440, y: 140, width: 1280, height: 720 },
  ];
  for (const area of areas) {
    const engine = makeEngine({ areas });
    const targetX = area.x + area.width / 2;
    engine.grab();
    engine.dragTo(targetX, area.y + 140);
    engine.vx = 0;
    engine.vy = 0;
    assertNear(engine.floorAt(engine.x, engine.y), area.y + area.height - 12);
    const releaseY = engine.y;
    engine.release();
    const landingY = Math.min(area.y + area.height - 12, releaseY + 78 + 72);
    assertNear(engine.landingY, landingY);
    untilState(engine, 'shattered', 3);
    assertNear(engine.x, targetX);
    assertNear(engine.y + 78, landingY);
    assert.ok(engine.y - releaseY <= 72);
    assert.ok(engine.x >= area.x && engine.x < area.x + area.width);
  }
});

test('vertically stacked monitors are selected using both cursor coordinates', () => {
  const areas = [
    { x: 0, y: 0, width: 1440, height: 900 },
    { x: 0, y: -900, width: 1440, height: 900 },
  ];
  const engine = makeEngine({ areas });
  engine.grab();
  engine.dragTo(600, -700);
  engine.vx = 0;
  engine.vy = 0;
  const releaseY = engine.y;
  engine.release();
  untilState(engine, 'shattered', 3);
  assertNear(engine.y + 78, Math.min(-12, releaseY + 78 + 72));
  assert.ok(engine.y < 0);
});

test('reset clears transient debris and uses the requested monitor', () => {
  const engine = makeEngine();
  engine.grab();
  advance(engine, 4);
  engine.release();
  assert.ok(engine.particles.length > 0);
  const destination = { x: -1280, y: 0, width: 1280, height: 720 };
  engine.areas.push(destination);
  engine.reset(destination);
  assert.equal(engine.state, 'idle');
  assert.equal(engine.particles.length, 0);
  assert.equal(engine.orbiters.length, 0);
  assert.equal(engine.vx, 0);
  assert.equal(engine.vy, 0);
  assert.ok(engine.x < 0);
  assertNear(engine.y + 78, 708);
});

test('large frame gaps are clamped so the pet cannot teleport through the lifecycle', () => {
  const engine = makeEngine();
  engine.grab();
  engine.dragTo(600, 180);
  engine.release();
  const oldTime = engine.time;
  engine.step(1000);
  assertNear(engine.time - oldTime, 0.05);
  assert.equal(engine.state, 'falling');
});

test('a click cancels the initial grab and emits a draggable treat from the lower cup outlet', () => {
  const engine = makeEngine();
  engine.grab();
  advance(engine, 0.1);
  engine.click();
  assert.equal(engine.state, 'idle');
  assert.equal(engine.orbiters.length, 0);
  assert.equal(engine.snapshot().rings.length, 0);
  assert.equal(engine.treats.length, 1);
  const treat = engine.treats[0];
  assertNear(treat.x, engine.x + 12);
  assertNear(treat.y, engine.y + 52);
  assert.ok(treat.vx > 0, 'the new treat must travel from the outlet toward the cup’s side');
  assert.equal(engine.treatAt(treat.x, treat.y).id, treat.id);
  assert.equal(engine.treatAt(treat.x + 100, treat.y), undefined);
  assert.equal(engine.grabTreat(-1), false);
  assert.equal(engine.grabTreat(treat.id), true);
  engine.dragTreat(200, 250);
  assert.equal(treat.x, 200);
  assert.equal(treat.y, 250);
  assert.equal(engine.snapshot().heldTreat, treat.id);
});

test('click treats keep only the ten most recent and can be selected in overlap order', () => {
  const engine = makeEngine();
  for (let i = 0; i < 35; i++) engine.click();
  assert.equal(engine.treats.length, 10);
  assert.equal(new Set(engine.treats.map(p => p.id)).size, 10);
  assert.equal(engine.treats[0].id, 26);
  const newest = engine.treats.at(-1);
  assert.equal(engine.treatAt(newest.x, newest.y).id, newest.id);
});

test('unheld click treats expire after ninety seconds', () => {
  const engine = makeEngine();
  engine.click();
  advance(engine, 89.9);
  assert.equal(engine.treats.length, 1);
  advance(engine, 0.2);
  assert.equal(engine.treats.length, 0);
});

test('a treat held for longer than its normal lifetime stays fixed and can still be fed', () => {
  const engine = makeEngine();
  engine.click();
  const treat = engine.treats[0];
  advance(engine, 89);
  engine.grabTreat(treat.id);
  engine.dragTreat(engine.x, engine.y);
  const position = { x: treat.x, y: treat.y };
  advance(engine, 95);
  assert.equal(engine.treats.length, 1);
  assert.equal(engine.heldTreat, treat.id);
  assert.equal(treat.x, position.x);
  assert.equal(treat.y, position.y);
  assert.equal(engine.state, 'idle', 'hovering should not automatically feed the cup');
  assert.equal(engine.releaseTreat(), true);
  assert.equal(engine.state, 'eating');
  assert.equal(engine.treats.length, 0);
});

test('dropping a treat away from the cup preserves it and resumes floor physics', () => {
  const engine = makeEngine();
  engine.click();
  const treat = engine.treats[0];
  engine.grabTreat(treat.id);
  engine.dragTreat(200, 120);
  assert.equal(engine.releaseTreat(), false);
  assert.equal(engine.heldTreat, null);
  assert.equal(engine.treats[0].id, treat.id);
  assert.equal(engine.state, 'idle');
  advance(engine, 2);
  assert.ok(treat.y > 120);
  assert.ok(treat.y <= engine.floorAt(treat.x, treat.y));
  assert.equal(engine.releaseTreat(), false, 'release with no held treat is harmless');
});

test('feeding consumes exactly the offered treat, celebrates, and recovers automatically', () => {
  const engine = makeEngine();
  engine.click();
  engine.click();
  const [offered, retained] = engine.treats;
  engine.grabTreat(offered.id);
  engine.dragTreat(engine.x, engine.y);
  assert.equal(engine.releaseTreat(), true);
  assert.equal(engine.heldTreat, null);
  assert.deepEqual(engine.treats.map(p => p.id), [retained.id]);
  assert.equal(engine.state, 'eating');
  assert.equal(engine.bubble.kind, 'yum');
  assert.equal(engine.particles.filter(p => p.kind === 'heart').length, 12);
  advance(engine, 2.5);
  assert.equal(engine.state, 'eating');
  assert.equal(engine.bubble.kind, 'yum2');
  untilState(engine, 'idle', 3);
  assert.ok(engine.talkAt >= engine.time + 9.9);
});

test('held, falling, shattered, and reforming cups cannot eat a dropped treat', () => {
  for (const state of ['held', 'falling', 'shattered', 'reforming']) {
    const engine = makeEngine();
    engine.click();
    const treat = engine.treats[0];
    engine.transition(state);
    engine.grabTreat(treat.id);
    engine.dragTreat(engine.x, engine.y);
    assert.equal(engine.releaseTreat(), false, `${state} should reject feeding`);
    assert.equal(engine.state, state);
    assert.equal(engine.treats.length, 1);
  }
});

test('grabbing during a meal immediately interrupts delight with panic', () => {
  const engine = makeEngine();
  engine.click();
  engine.grabTreat(engine.treats[0].id);
  engine.dragTreat(engine.x, engine.y);
  engine.releaseTreat();
  advance(engine, 0.5);
  assert.equal(engine.state, 'eating');
  assert.equal(engine.grab(), true);
  assert.equal(engine.state, 'held');
  assert.equal(engine.bubble.kind, 'panic');
  assert.equal(engine.bubble.text, '爸爸我错了！！');
  engine.release();
  untilState(engine, 'shattered', 0.3);
  untilState(engine, 'idle', 7);
});

test('reset clears loose treats and the active treat drag', () => {
  const engine = makeEngine();
  engine.click();
  engine.click();
  engine.grabTreat(engine.treats[0].id);
  engine.reset();
  assert.equal(engine.state, 'idle');
  assert.equal(engine.treats.length, 0);
  assert.equal(engine.heldTreat, null);
  assert.equal(engine.releaseTreat(), false);
});

test('a release near the work-area bottom stops at the floor before falling 72 pixels', () => {
  const engine = makeEngine();
  engine.grab();
  engine.dragTo(600, 705);
  engine.vx = 0;
  const releasedY = engine.y;
  engine.release();
  assertNear(engine.landingY, 788);
  untilState(engine, 'shattered', 1);
  assertNear(engine.y + 78, 788);
  assert.ok(engine.y - releasedY < 72);
});

test('clicking and feeding at an elevated resting position never reset the cup to the desktop bottom', () => {
  const engine = makeEngine();
  engine.grab();
  engine.dragTo(600, 180);
  engine.release();
  untilState(engine, 'shattered', 2);
  untilState(engine, 'idle', 7);
  const restY = engine.restY;
  const cupY = engine.y;
  assert.ok(restY < 500);
  engine.grab();
  advance(engine, 0.1);
  engine.click();
  assertNear(engine.y, cupY);
  assertNear(engine.restY, restY);
  const treat = engine.treats[0];
  advance(engine, 3);
  assertNear(engine.y, cupY);
  assertNear(treat.floorY, restY);
  assertNear(treat.y, restY - 13, 0.2);
  assert.ok(treat.x - engine.x < 140, 'the loose treat should remain beside the elevated cup');
  engine.grabTreat(treat.id);
  engine.dragTreat(engine.x, engine.y);
  assert.equal(engine.releaseTreat(), true);
  assertNear(engine.y, cupY);
  untilState(engine, 'idle', 6);
  advance(engine, 1);
  assertNear(engine.y, cupY);
  assertNear(engine.restY, restY);
});

test('released orbit debris and cup fragments bounce near the release position', () => {
  const engine = makeEngine();
  engine.grab();
  engine.dragTo(600, 180);
  advance(engine, 3);
  const releasedY = engine.y;
  engine.release();
  const poop = engine.particles.filter(p => p.kind === 'poop');
  assert.ok(poop.length > 0);
  assert.ok(poop.every(p => p.floorY <= releasedY + 190));
  advance(engine, 0.15);
  assert.ok(engine.particles.filter(p => p.kind === 'poop').every(p => p.y <= releasedY + 190));
  untilState(engine, 'shattered', 1);
  const shards = engine.particles.filter(p => p.kind === 'shard');
  assert.ok(shards.every(p => p.floorY === engine.restY));
  advance(engine, 1);
  assert.ok(engine.particles.every(p => p.kind === 'heart' || p.y <= p.floorY));
});

test('an unconsumed treat dropped high on screen settles close to the drop point', () => {
  const engine = makeEngine();
  engine.click();
  const treat = engine.treats[0];
  engine.grabTreat(treat.id);
  engine.dragTreat(200, 120);
  assert.equal(engine.releaseTreat(), false);
  assertNear(treat.floorY, 155);
  advance(engine, 2);
  assert.ok(treat.y >= 120 && treat.y <= 155);
  assertNear(treat.y, 142, 0.2);
  assert.ok(treat.y < engine.floorAt(treat.x, treat.y) - 500);
});

test('mouse chatter waits through startup and ignores movements below the distance threshold', () => {
  const engine = makeEngine();
  const initialId = engine.utterance.id;
  engine.pointerMoved(0, 0);
  engine.pointerMoved(100, 0);
  assert.equal(engine.utterance.id, initialId, 'startup cooldown must suppress chatter');
  advance(engine, 5.1);
  engine.pointerMoved(154, 0);
  assert.equal(engine.utterance.id, initialId);
  engine.pointerMoved(156, 0);
  assert.equal(engine.utterance.id, initialId + 1);
  assert.equal(engine.bubble.kind, 'smug');
  assertNear(engine.moveTalkAt, engine.time + 7);
  assertNear(engine.talkAt, engine.time + 12);
});

test('mouse chatter has a seven-second cooldown and requires a fresh movement afterward', () => {
  const engine = makeEngine();
  advance(engine, 5.1);
  engine.pointerMoved(0, 0);
  engine.pointerMoved(80, 0);
  const firstId = engine.utterance.id;
  const firstText = engine.bubble.text;
  advance(engine, 6.9);
  engine.pointerMoved(160, 0);
  assert.equal(engine.utterance.id, firstId);
  advance(engine, 0.2);
  engine.pointerMoved(160, 0);
  assert.equal(engine.utterance.id, firstId, 'standing still after cooldown must not trigger chatter');
  engine.pointerMoved(220, 0);
  assert.equal(engine.utterance.id, firstId + 1);
  assert.notEqual(engine.bubble.text, firstText);
});

test('mouse movement never interrupts held, broken, falling, bruised, or eating states', () => {
  for (const state of ['held', 'falling', 'shattered', 'reforming', 'bruised', 'eating']) {
    const engine = makeEngine();
    advance(engine, 5.1);
    engine.transition(state);
    engine.say('当前动作的台词', 'panic', 10);
    const utteranceId = engine.utterance.id;
    engine.pointerMoved(0, 0);
    engine.pointerMoved(100, 0);
    assert.equal(engine.state, state);
    assert.equal(engine.utterance.id, utteranceId, `${state} must preserve its dialogue`);
    assert.equal(engine.bubble.text, '当前动作的台词');
    assert.equal(engine.moveTalkIndex, 0);
  }
});

test('mouse movement is quiet while a treat is being dragged and resumes after dropping it', () => {
  const engine = makeEngine();
  advance(engine, 5.1);
  engine.click();
  engine.grabTreat(engine.treats[0].id);
  engine.dragTreat(200, 120);
  const utteranceId = engine.utterance.id;
  engine.pointerMoved(0, 0);
  engine.pointerMoved(100, 0);
  assert.equal(engine.utterance.id, utteranceId);
  assert.equal(engine.moveTalkIndex, 0);
  assert.equal(engine.releaseTreat(), false);
  advance(engine, 0.9);
  engine.pointerMoved(160, 0);
  assert.equal(engine.utterance.id, utteranceId + 1);
  assert.equal(engine.bubble.kind, 'smug');
});

test('held poop begins at the lower cup outlet and joins its orbit without a position jump', () => {
  const engine = makeEngine();
  engine.grab();
  engine.dragTo(600, 220);
  for (const radius of [90, 99, 108]) {
    const start = engine.orbitPosition({ age: 0, angle: 0, radius });
    assertNear(start.x, engine.x + 12);
    assertNear(start.y, engine.y + 52);
    const beforeJoin = engine.orbitPosition({ age: 0.52 - 0.000001, angle: 0, radius });
    const atJoin = engine.orbitPosition({ age: 0.52, angle: 0, radius });
    const afterJoin = engine.orbitPosition({ age: 0.52 + 0.000001, angle: 0, radius });
    assertNear(atJoin.x, engine.x + radius);
    assertNear(atJoin.y, engine.y + 8);
    assert.ok(Math.hypot(beforeJoin.x - atJoin.x, beforeJoin.y - atJoin.y) < 0.001);
    assert.ok(Math.hypot(afterJoin.x - atJoin.x, afterJoin.y - atJoin.y) < 0.001);
  }
});

test('a click shows the pooping pose for 0.85 seconds while the treat travels outward', () => {
  const engine = makeEngine();
  assert.equal(engine.snapshot().pooping, false);
  engine.click();
  assert.equal(engine.state, 'idle');
  assert.equal(engine.snapshot().pooping, true);
  const treat = engine.treats[0];
  const startingX = treat.x;
  advance(engine, 0.84);
  assert.equal(engine.snapshot().pooping, true);
  assert.ok(treat.x > startingX + 60, 'the treat should visibly travel out to the side');
  advance(engine, 0.02);
  assert.equal(engine.snapshot().pooping, false);
  engine.click();
  advance(engine, 0.7);
  engine.click();
  advance(engine, 0.7);
  assert.equal(engine.snapshot().pooping, true, 'a new click restarts the pose timer');
  advance(engine, 0.2);
  assert.equal(engine.snapshot().pooping, false);
});

test('the pooping pose pauses wandering and mouse chatter, then permits both to resume', () => {
  const engine = makeEngine();
  engine.wandering = true;
  advance(engine, 5.1);
  engine.pointerMoved(0, 0);
  engine.click();
  const origin = { x: engine.x, y: engine.y };
  const utteranceId = engine.utterance.id;
  advance(engine, 0.4);
  engine.pointerMoved(100, 0);
  assert.equal(engine.utterance.id, utteranceId);
  assert.equal(engine.moveTalkIndex, 0);
  advance(engine, 0.44);
  assertNear(engine.x, origin.x);
  assertNear(engine.y, origin.y);
  assert.equal(engine.snapshot().pooping, true);
  advance(engine, 0.1);
  assert.equal(engine.snapshot().pooping, false);
  assert.notEqual(engine.x, origin.x);
  engine.pointerMoved(160, 0);
  assert.equal(engine.utterance.id, utteranceId + 1);
});

test('grabbing during the pooping pose immediately displays held panic instead', () => {
  const engine = makeEngine();
  engine.click();
  assert.equal(engine.snapshot().pooping, true);
  assert.equal(engine.grab(), true);
  assert.equal(engine.snapshot().pooping, false);
  assert.equal(engine.state, 'held');
  assert.equal(engine.bubble.text, '爸爸我错了！！');
});

test('dragging to the bottom edge no longer snaps the cup upward when released', () => {
  const engine = makeEngine();
  engine.grab();
  engine.dragTo(600, 900);
  const releasedY = engine.y;
  assertNear(releasedY + 78, engine.floorAt(engine.x, engine.y));
  engine.release();
  untilState(engine, 'shattered', 0.3);
  assertNear(engine.y, releasedY);
});
