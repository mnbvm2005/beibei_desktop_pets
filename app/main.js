'use strict';
const { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage, dialog, globalShortcut } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { Engine } = require('./engine');
const args = process.argv;
const option = key => { const i=args.indexOf(key); return i<0 ? null : args[i+1]; };
const testDir = option('--test-dir');
if (testDir) { fs.mkdirSync(testDir,{recursive:true});app.setPath('userData',testDir); }
app.setName('杯杯');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let engine, windows=[], tray, timer, gesture=null, quitting=false, rebuilding=false;
let preferences={muted:false,wandering:true};
const isTest = args.includes('--smoke-test');
const interactionTest = args.includes('--interaction-test') && !!testDir;
function traceInput(label, detail = {}) {
  if(!interactionTest)return;
  fs.appendFileSync(path.join(testDir,'input-trace.jsonl'),JSON.stringify({label,...detail,
    cup:engine?{x:engine.x,y:engine.y,state:engine.state}:null,
    treats:engine?.treats,heldTreat:engine?.heldTreat,
    windows:windows.map(r=>({display:r.display.bounds,window:r.win.getBounds(),content:r.win.getContentBounds()}))})+'\n');
}
function savePrefs() {
  if(isTest)return;
  try { fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(path.join(app.getPath('userData'),'preferences.json'),JSON.stringify(preferences)); } catch (_) {}
}
function broadcast() {
  const state=engine.snapshot();
  for(const record of windows)if(!record.win.isDestroyed())record.win.webContents.send('pet:state',state);
}
function menuTemplate() {
  return [
    {label:'杯杯 · 嘴硬，命也硬',enabled:false}, {type:'separator'},
    {label:'闭嘴（静音）',type:'checkbox',checked:engine.muted,click:()=>{engine.muted=!engine.muted;preferences.muted=engine.muted;savePrefs();broadcast();}},
    {label:'允许杯杯溜达',type:'checkbox',checked:engine.wandering,click:()=>{engine.wandering=!engine.wandering;preferences.wandering=engine.wandering;savePrefs();}},
    {label:'再嘴欠一句',click:()=>engine.taunt()},
    {label:'把杯杯叫回来',click:()=>{gesture=null;engine.reset();}},
    {label:'清理旁边的便便',click:()=>{engine.treats=[];engine.heldTreat=null;}},
    {label:'怎么玩',click:()=>dialog.showMessageBox({type:'info',title:'杯杯说明书',message:'一只没什么素质的杯子。',detail:'单击杯杯：在旁边掉一坨可拖动的便便。\n拖便便到杯身中央后松手：喂杯杯。\n拖动 / 长按杯杯：惊恐求饶，连续拉屎，便便公转。\n拎住两秒：棕色大便圈 + 彩虹大便圈全开。\n松手：便便炸开，杯杯只短落一截、摔碎，再原地拼回来。\n移动鼠标：杯杯会嘴欠搭话，有 7 秒冷却。\n\n右键杯杯或点击菜单栏 / 托盘图标：静音、暂停溜达、找回、退出。\n连续单击最多留下 10 坨，90 秒后自动清理。\n全局快捷键 Ctrl/⌘ + Shift + B：把杯杯叫回来。',buttons:['知道辣！']})},
    {type:'separator'}, {label:'退出杯杯',click:()=>app.quit()}
  ];
}
function showMenu() { Menu.buildFromTemplate(menuTemplate()).popup(); }
function createTray() {
  // Original local artwork. Template mode remains legible in either macOS menu-bar theme.
  let icon=nativeImage.createFromPath(path.join(__dirname,'tray.png'));
  if(icon.isEmpty())icon=nativeImage.createEmpty();
  icon=icon.resize({width:22,height:22});if(process.platform==='darwin')icon.setTemplateImage(true);
  tray=new Tray(icon);tray.setToolTip('杯杯 · 右键有菜单');
  tray.on('click',showMenu);tray.on('right-click',showMenu);
}
function buildWindows() {
  rebuilding=true;
  gesture=null;
  for(const record of windows)record.win.destroy();windows=[];
  const displays=screen.getAllDisplays();
  if(engine){engine.areas=displays.map(d=>d.workArea);engine.reset();}
  for(let i=0;i<displays.length;i++) {
    const display=displays[i], b=display.workArea;
    const win=new BrowserWindow({x:b.x,y:b.y,width:b.width,height:b.height,show:false,
      title:'杯杯',transparent:true,frame:false,hasShadow:false,resizable:false,movable:false,
      minimizable:false,maximizable:false,fullscreenable:false,alwaysOnTop:true,skipTaskbar:true,
      focusable:false,acceptFirstMouse:true,backgroundColor:'#00000000',
      webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
    win.setIgnoreMouseEvents(true,{forward:true});win.setAlwaysOnTop(true,'floating');
    if(process.platform==='darwin')win.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true});
    win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.webContents.on('will-navigate',e=>e.preventDefault());
    const record={win,display,ignore:true,bounds:win.getContentBounds()};windows.push(record);
    const syncViewport=()=>{
      if(win.isDestroyed())return;
      record.bounds=win.getContentBounds();
      win.webContents.send('pet:init',{bounds:record.bounds,audio:i===0});
      broadcast();
    };
    win.once('ready-to-show',()=>{win.showInactive();syncViewport();traceInput('ready');});
    win.on('move',syncViewport);win.on('resize',syncViewport);
    win.on('close',e=>{if(!quitting){e.preventDefault();app.quit();}});
    win.webContents.on('render-process-gone',()=>{if(!quitting)app.quit();});
    win.loadFile('index.html');
  }
  rebuilding=false;
}
function authorized(event) { return windows.some(r=>r.win.webContents===event.sender); }
function eventPoint(event,localPoint) {
  const record=windows.find(r=>r.win.webContents===event.sender);
  if(!record || !localPoint || !Number.isFinite(localPoint.x) || !Number.isFinite(localPoint.y))return null;
  return {x:record.bounds.x+localPoint.x,y:record.bounds.y+localPoint.y};
}
ipcMain.on('pet:down',(event,localPoint)=>{
  if(!engine || !authorized(event) || gesture)return;
  const p=eventPoint(event,localPoint);if(!p)return;
  const treat=engine.treatAt(p.x,p.y);
  traceInput('down',{point:p,treatId:treat?.id});
  const common={owner:event.sender.id,startX:p.x,startY:p.y,time:engine.time,maxDistance:0};
  if(treat && engine.grabTreat(treat.id)){gesture={...common,kind:'treat'};}
  else if(engine.hitTest(p.x,p.y) && engine.grab(p.x,p.y))gesture={...common,kind:'cup',originX:engine.x,originY:engine.y};
  broadcast();
});
ipcMain.on('pet:up',(event,localPoint)=>{
  if(!engine || !authorized(event) || !gesture || gesture.owner!==event.sender.id)return;
  const p=eventPoint(event,localPoint);if(!p)return;
  traceInput('up',{point:p});
  gesture.maxDistance=Math.max(gesture.maxDistance,Math.hypot(p.x-gesture.startX,p.y-gesture.startY));
  if(gesture.kind==='treat'){engine.dragTreat(p.x,p.y);engine.releaseTreat();}
  else if(engine.time-gesture.time<.3 && gesture.maxDistance<6){engine.x=gesture.originX;engine.y=gesture.originY;engine.click();}
  else {engine.dragTo(p.x,p.y);engine.release();}
  gesture=null;broadcast();
});
ipcMain.on('pet:cancel',event=>{
  if(!authorized(event)||!gesture||gesture.owner!==event.sender.id)return;
  if(gesture.kind==='treat')engine.releaseTreat();else engine.release();gesture=null;
});
ipcMain.on('pet:menu',event=>{if(authorized(event))showMenu();});

async function smokeTest() {
  const out=option('--capture-dir') || testDir;
  if(!out)return;
  fs.mkdirSync(out,{recursive:true});
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  await wait(1800);
  clearInterval(timer);engine.muted=true;engine.wandering=false;
  async function capture(name){broadcast();await wait(150);const img=await windows[0].win.webContents.capturePage();fs.writeFileSync(path.join(out,name+'.png'),img.toPNG());}
  await capture('01-idle');
  engine.grab(engine.x,engine.y);engine.dragTo(engine.x,engine.areas[0].y+engine.areas[0].height*.46);
  for(let i=0;i<170;i++)engine.step(1/60);
  await capture('02-held-orbits');
  engine.release();for(let i=0;i<10;i++)engine.step(1/60);await capture('03-poop-explosion');
  while(engine.state==='falling')engine.step(1/60);
  for(let i=0;i<18;i++)engine.step(1/60);await capture('04-shattered');
  for(let i=0;i<350;i++)engine.step(1/60);
  engine.click();for(let i=0;i<40;i++)engine.step(1/60);await capture('05-click-treat');
  engine.grabTreat(engine.treats[0].id);engine.dragTreat(engine.x,engine.y);engine.releaseTreat();
  for(let i=0;i<25;i++)engine.step(1/60);await capture('06-yummy');
  const rendererErrors=[];
  for(const record of windows){const check=await record.win.webContents.executeJavaScript('({canvas:!!document.querySelector("canvas"),width:innerWidth,height:innerHeight,renderer:typeof CupRenderer,scene:typeof PetScene})');rendererErrors.push(check);}
  fs.writeFileSync(path.join(out,'smoke-result.json'),JSON.stringify({ok:true,platform:process.platform,engineState:engine.state,windows:rendererErrors},null,2));
  app.quit();
}
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{if(engine&&!interactionTest){gesture=null;engine.reset();}});
  app.whenReady().then(()=>{
    try{preferences={...preferences,...JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'preferences.json'),'utf8'))};}catch(_){}
    engine=new Engine({areas:screen.getAllDisplays().map(d=>d.workArea)});
    engine.muted=isTest || !!preferences.muted;engine.wandering=!!preferences.wandering;
    Menu.setApplicationMenu(null);if(app.dock)app.dock.hide();
    buildWindows();createTray();
    if(interactionTest){engine.muted=true;engine.wandering=false;engine.x=engine.areas[0].x+engine.areas[0].width*.55;engine.y=engine.areas[0].y+engine.areas[0].height*.55;engine.restY=engine.y+78;engine.click();for(let i=0;i<80;i++)engine.step(1/60);}
    globalShortcut.register('CommandOrControl+Shift+B',()=>{gesture=null;engine.reset();});
    let last=performance.now();
    timer=setInterval(()=>{
      const now=performance.now(),dt=Math.min((now-last)/1000,.05);last=now;
      const p=screen.getCursorScreenPoint();engine.pointerMoved(p.x,p.y);
      if(gesture){
        gesture.maxDistance=Math.max(gesture.maxDistance,Math.hypot(p.x-gesture.startX,p.y-gesture.startY));
        if(gesture.kind==='treat')engine.dragTreat(p.x,p.y);
        else if(gesture.maxDistance>=6 || engine.time-gesture.time>=.3)engine.dragTo(p.x,p.y,dt);
      }
      engine.step(dt);
      const over=engine.hitTest(p.x,p.y)||!!engine.treatAt(p.x,p.y);
      for(const record of windows){
        const b=record.bounds;
        const inside=p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height;
        const ignore=gesture?record.win.webContents.id!==gesture.owner:!(over&&inside);
        if(ignore!==record.ignore){record.ignore=ignore;record.win.setIgnoreMouseEvents(ignore,{forward:true});}
      }
      broadcast();
    },1000/60);
    screen.on('display-added',buildWindows);screen.on('display-removed',buildWindows);
    screen.on('display-metrics-changed',buildWindows);
    if(isTest)smokeTest().catch(error=>{console.error(error);app.exit(1);});
  });
}
app.on('before-quit',()=>{quitting=true;clearInterval(timer);globalShortcut.unregisterAll();savePrefs();});
app.on('window-all-closed',()=>{if(!quitting&&!rebuilding)app.quit();});
