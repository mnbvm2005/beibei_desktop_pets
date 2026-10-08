'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { Engine } = require('../app/engine.js');

const appDirectory = path.resolve(__dirname, '../app');
const source = name => fs.readFileSync(path.join(appDirectory, name), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));

// Exercise the real main-process handlers without starting Electron or touching
// the user's profile. The OS content origin deliberately differs from display y=0.
function makeApp({ contentBounds } = {}) {
  const display = {
    bounds: { x: 0, y: 0, width: 1440, height: 900 },
    workArea: { x: 0, y: 33, width: 1440, height: 827 },
  };
  const ipcMain = new EventEmitter();
  const screen = new EventEmitter();
  const windows = [];
  let cursor = { x: 0, y: 0 }, engine, frame, now = 0;
  screen.getAllDisplays = () => [display];
  screen.getCursorScreenPoint = () => ({ ...cursor });

  class TestEngine extends Engine {
    constructor(options) { super(options); engine = this; }
  }
  class BrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.bounds = { ...(contentBounds || display.workArea) };
      this.messages = [];
      this.webContents = new EventEmitter();
      this.webContents.id = windows.length + 1;
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.send = (channel, payload) => this.messages.push({ channel, payload: copy(payload) });
      windows.push(this);
    }
    getBounds() { return { ...this.bounds }; }
    getContentBounds() { return { ...this.bounds }; }
    setIgnoreMouseEvents(ignore) { this.ignore = ignore; }
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    showInactive() {}
    loadFile() {}
    isDestroyed() { return false; }
  }
  const app = new EventEmitter();
  Object.assign(app, {
    setName() {},
    commandLine: { appendSwitch() {} },
    requestSingleInstanceLock: () => true,
    whenReady: () => ({ then: callback => callback() }),
    getPath: () => '/mock-beibei-profile',
    dock: { hide() {} },
  });
  const trayImage = { isEmpty: () => false, resize() { return this; }, setTemplateImage() {} };
  const electron = {
    app, BrowserWindow, ipcMain, screen,
    Menu: { setApplicationMenu() {} },
    Tray: class { setToolTip() {} on() {} },
    nativeImage: { createFromPath: () => trayImage },
    globalShortcut: { register() {} },
  };
  const context = {
    require(name) {
      if (name === 'electron') return electron;
      if (name === './engine') return { Engine: TestEngine };
      if (name === 'node:fs') return { readFileSync() { throw new Error('No saved preferences'); } };
      if (name === 'node:path') return path;
      throw new Error(`Unexpected dependency: ${name}`);
    },
    process: { argv: [], platform: 'darwin' },
    __dirname: appDirectory,
    performance: { now: () => now },
    setInterval(callback) { frame = callback; return 1; },
    console,
  };
  vm.runInNewContext(source('main.js'), context, { filename: 'main.js' });
  const win = windows[0];
  win.emit('ready-to-show');
  engine.wandering = false;
  const api = {
    engine, win, display,
    setCursor(point) { cursor = { ...point }; },
    tick() { now += 1000 / 60; frame(); },
    lastInit() { return win.messages.filter(m => m.channel === 'pet:init').at(-1).payload; },
    local(point) { return { x: point.x - win.bounds.x, y: point.y - win.bounds.y }; },
    send(channel, point) { ipcMain.emit(channel, { sender: win.webContents }, point); },
  };
  return api;
}

function addSettledTreat(app) {
  const { engine } = app;
  engine.x = 600;
  engine.y = 480;
  engine.restY = engine.y + 78;
  engine.click();
  for (let i = 0; i < 180; i++) engine.step(1 / 60);
  return engine.treats[0];
}

test('a 33px native window offset keeps the drawn treat aligned with mouse hit testing', () => {
  // A second native adjustment in x ensures init uses the observed content bounds,
  // rather than merely substituting the requested work area for display bounds.
  const app = makeApp({ contentBounds: { x: 8, y: 33, width: 1432, height: 827 } });
  const { win, display } = app;
  const requested = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, win.options[key]]));
  assert.deepEqual(requested, display.workArea);
  assert.deepEqual(app.lastInit().bounds, win.getContentBounds());
  const treat = addSettledTreat(app);
  const drawBounds = app.lastInit().bounds;
  const visibleCenter = {
    x: win.bounds.x + treat.x - drawBounds.x,
    y: win.bounds.y + treat.y - drawBounds.y,
  };
  assert.deepEqual(visibleCenter, { x: treat.x, y: treat.y });
  app.setCursor(visibleCenter);
  app.tick();
  assert.equal(win.ignore, false, 'the visible treat must receive mouse input');
  app.send('pet:down', app.local(visibleCenter));
  assert.equal(app.engine.heldTreat, treat.id);
});

test('a delayed pointerdown uses the original event position after the cursor has moved away', () => {
  const app = makeApp();
  const treat = addSettledTreat(app);
  const downPoint = app.local(treat);
  app.setCursor({ x: treat.x + 250, y: treat.y - 120 });
  app.send('pet:down', downPoint);
  assert.equal(app.engine.heldTreat, treat.id);
  assert.equal(app.engine.state, 'idle', 'selecting a treat must not grab the cup');
});

test('a delayed pointerup feeds at the release event position instead of the later cursor position', () => {
  const app = makeApp();
  const treat = addSettledTreat(app);
  app.setCursor(treat);
  app.send('pet:down', app.local(treat));
  assert.equal(app.engine.heldTreat, treat.id);
  const releasePoint = app.local(app.engine);
  app.setCursor({ x: 1200, y: 200 });
  app.send('pet:up', releasePoint);
  assert.equal(app.engine.heldTreat, null);
  assert.equal(app.engine.state, 'eating');
  assert.equal(app.engine.treats.length, 0);
});

test('native move and resize refresh renderer coordinates and the click-through boundary', () => {
  const app = makeApp();
  const treat = addSettledTreat(app);
  const { win } = app;
  win.bounds = { x: 400, y: 80, width: 900, height: 760 };
  win.emit('move');
  assert.deepEqual(app.lastInit().bounds, win.getContentBounds());
  app.setCursor({ x: 1300, y: 200 });
  app.send('pet:down', app.local(treat));
  assert.equal(app.engine.heldTreat, treat.id, 'event coordinates must use the moved content origin');
  app.send('pet:cancel');

  win.bounds = { ...win.bounds, width: 250, height: 500 };
  win.emit('resize');
  assert.deepEqual(app.lastInit().bounds, win.getContentBounds());
  app.setCursor(treat);
  app.tick();
  assert.ok(app.engine.treatAt(treat.x, treat.y));
  assert.equal(win.ignore, true, 'an object outside the actual viewport must not enable input');

  win.bounds = { ...win.bounds, width: 900, height: 760 };
  win.emit('resize');
  app.tick();
  assert.equal(win.ignore, false, 'expanding the viewport must restore input at the visible treat');
});

test('renderer and preload preserve client coordinates even if pointer capture fails', () => {
  const app = makeApp();
  const treat = addSettledTreat(app);
  const listeners = new Map(), pendingIPC = [];
  let bridge;
  vm.runInNewContext(source('preload.js'), {
    require(name) {
      assert.equal(name, 'electron');
      return {
        contextBridge: { exposeInMainWorld(name, value) { assert.equal(name, 'petBridge'); bridge = value; } },
        ipcRenderer: { send: (...args) => pendingIPC.push(args), on() {} },
      };
    },
  }, { filename: 'preload.js' });
  const canvas = {
    getContext: () => ({ setTransform() {} }),
    classList: { add() {}, remove() {} },
    addEventListener: (name, callback) => listeners.set(name, callback),
    setPointerCapture() { throw new Error('Native pointer capture failed'); },
    hasPointerCapture: () => false,
  };
  vm.runInNewContext(source('renderer.js'), {
    document: { getElementById: () => canvas },
    window: { devicePixelRatio: 2, petBridge: bridge },
    innerWidth: 1440, innerHeight: 827,
    addEventListener() {},
  }, { filename: 'renderer.js' });
  const dispatch = (type, point) => listeners.get(type)({
    button: 0, pointerId: 1, clientX: point.x, clientY: point.y,
    screenX: 9999, screenY: 9999, preventDefault() {},
  });
  const downPoint = app.local(treat);
  assert.doesNotThrow(() => dispatch('pointerdown', downPoint));
  assert.deepEqual(copy(pendingIPC[0]), ['pet:down', downPoint]);
  app.setCursor({ x: 1200, y: 200 });
  app.send(...pendingIPC.shift());
  assert.equal(app.engine.heldTreat, treat.id);

  const upPoint = app.local(app.engine);
  dispatch('pointerup', upPoint);
  assert.deepEqual(copy(pendingIPC[0]), ['pet:up', upPoint]);
  app.send(...pendingIPC.shift());
  assert.equal(app.engine.state, 'eating');
  assert.equal(app.engine.treats.length, 0);
});
