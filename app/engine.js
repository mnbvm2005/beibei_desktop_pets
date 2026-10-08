(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Beibei = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAUNTS = ['我不告诉你～\n我不告诉你～', '你太low辣！', '杯杯我呀～', '急了？你急了？', '诶嘿，抓不到～', '略略略～', '杯杯路过，顺便嘲笑。'];
  const APOLOGIES = ['爸爸我错了！！', '我嘴欠！我嘴欠！！', '别别别别别！！', '轻点！杯杯要碎辣！！', '真的憋不住辣！！'];
  const RAINBOW = ['#ff6074', '#ffa93e', '#ffd955', '#77d974', '#45cbe5', '#748cff', '#d28bff'];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  class Engine {
    constructor({ areas = [{ x: 0, y: 0, width: 1280, height: 800 }], random = Math.random } = {}) {
      this.random = random; this.areas = areas; this.time = 0; this.state = 'idle';
      this.x = areas[0].x + areas[0].width * .72; this.y = areas[0].y+areas[0].height-90;
      this.restY=this.y+78;this.landingY=this.restY;
      this.direction = -1; this.vx = 0; this.vy = 0; this.wandering = true;
      this.muted = false; this.particles = []; this.orbiters = []; this.holdAge = 0;
      this.stateAge = 0; this.emitClock = 0; this.talkAt = 10; this.tauntIndex = 0;
      this.apologyIndex = 0; this.utteranceId = 0; this.bubble = null;
      this.treats = []; this.treatId = 0; this.heldTreat = null;
      this.lastPointer=null;this.moveTalkAt=5;this.moveTalkIndex=0;this.poopUntil=0;
      this.say('杯杯我呀～', 'smug', 4);
    }
    areaAt(x, y = this.y) {
      return this.areas.find(a => x >= a.x && x < a.x + a.width && y >= a.y && y <= a.y + a.height)
        || this.areas.reduce((best, a) => {
          const dist = Math.hypot(x - clamp(x, a.x, a.x+a.width), y-clamp(y,a.y,a.y+a.height));
          return !best || dist < best.dist ? { area:a, dist } : best;
        }, null).area;
    }
    floorAt(x, y) { const a = this.areaAt(x, y); return a.y + a.height - 12; }
    hitTest(x, y) {
      return this.state !== 'shattered' && this.state !== 'reforming' &&
        Math.abs(x-this.x) < 81 && y > this.y-61 && y < this.y+77;
    }
    say(text, kind = 'smug', duration = 3.5) {
      this.bubble = { text, kind, until:this.time+duration };
      this.utterance = { id: ++this.utteranceId, text:text.replace(/\n/g, ' '), kind };
    }
    taunt() { this.say(TAUNTS[this.tauntIndex++ % TAUNTS.length]); }
    pointerMoved(x,y) {
      if(!this.lastPointer){this.lastPointer={x,y};return;}
      const distance=Math.hypot(x-this.lastPointer.x,y-this.lastPointer.y);
      if(distance<55)return;
      this.lastPointer={x,y};
      if(this.state!=='idle'||this.heldTreat||this.time<this.moveTalkAt||this.time<this.poopUntil)return;
      const lines=['晃什么晃～\n杯杯看见你辣！','你太low辣！','我不告诉你～\n我不告诉你～','杯杯我呀～\n在盯着你呢～'];
      this.say(lines[this.moveTalkIndex++%lines.length],'smug',3.3);
      this.moveTalkAt=this.time+7;this.talkAt=this.time+12;
    }
    treatAt(x,y) { return [...this.treats].reverse().find(p=>Math.hypot(p.x-x,p.y-y)<24); }
    click() {
      this.transition('idle'); this.orbiters=[]; this.vx=0; this.vy=0;
      this.poopUntil=this.time+.85;
      const area=this.areaAt(this.x);
      this.y=this.restY-78;
      this.treats.push({id:++this.treatId,x:clamp(this.x+12,area.x+24,area.x+area.width-24),y:this.y+52,
        vx:190,vy:-115,age:0,size:29,rotation:0,floorY:this.restY});
      if(this.treats.length>10)this.treats.shift();
      this.say('热乎的，送你辣～', 'smug', 2.6); this.talkAt=this.time+12;
    }
    grabTreat(id) {
      const p=this.treats.find(t=>t.id===id);
      if(!p)return false;
      this.heldTreat=id; p.vx=0;p.vy=0;p.age=0;return true;
    }
    dragTreat(x,y) { const p=this.treats.find(t=>t.id===this.heldTreat);if(p){p.x=x;p.y=y;} }
    releaseTreat() {
      const p=this.treats.find(t=>t.id===this.heldTreat);this.heldTreat=null;
      if(!p)return false;
      if(!['held','falling','shattered','reforming'].includes(this.state) && Math.abs(p.x-this.x)<76 && Math.abs(p.y-this.y)<72){
        this.treats=this.treats.filter(t=>t!==p);this.transition('eating');this.y=this.restY-78;
        this.say('这……这是什么\n人间极品……！！', 'yum', 3);
        for(let i=0;i<12;i++)this.addParticle({kind:'heart',x:this.x,y:this.y-30,vx:(this.random()-.5)*110,vy:-130-this.random()*110,size:8+this.random()*5,life:1.4,color:RAINBOW[i%7]});
        return true;
      }
      p.vx=0;p.vy=0;p.floorY=Math.min(this.floorAt(p.x,p.y),p.y+35);return false;
    }
    transition(state) { this.state = state; this.stateAge = 0; }
    grab(cursorX = this.x, cursorY = this.y) {
      if (this.state === 'shattered' || this.state === 'reforming') return false;
      this.dragOffset = { x:cursorX-this.x, y:cursorY-this.y };
      this.transition('held'); this.holdAge = 0; this.emitClock = .19;
      this.vx = 0; this.vy = 0; this.apologyIndex = 1; this.nextApology = 2.4;
      this.say(APOLOGIES[0], 'panic', 20);
      return true;
    }
    dragTo(cursorX, cursorY, dt = 1/60) {
      if (this.state !== 'held') return;
      const area = this.areaAt(cursorX, cursorY);
      const nx = clamp(cursorX-this.dragOffset.x, area.x+65, area.x+area.width-65);
      const ny = clamp(cursorY-this.dragOffset.y, area.y+80, area.y+area.height-90);
      this.vx = clamp((nx-this.x) / Math.max(dt,.008), -1100, 1100);
      this.vy = clamp((ny-this.y) / Math.max(dt,.008), -700, 1200);
      this.x=nx; this.y=ny;
    }
    orbitPosition(o) {
      if (o.age < .52) {
        const t=o.age/.52;
        return {x:this.x+12+(o.radius-12)*t, y:this.y+52+Math.sin(t*Math.PI)*48-t*44};
      }
      const angle=o.angle+(o.age-.52)*3.5;
      return {x:this.x+Math.cos(angle)*o.radius, y:this.y+Math.sin(angle)*o.radius*.72+8};
    }
    ringItems() {
      if (this.state !== 'held' || this.holdAge < .65) return [];
      const growth=clamp((this.holdAge-.65)/1.5, 0, 1), out=[];
      for (let ring=0; ring<2; ring++) {
        const count=ring ? 30:24, radius=(ring?190:145)*(.6+.4*growth);
        for(let i=0;i<count;i++) {
          if(i/count>growth) continue;
          const angle=i/count*Math.PI*2+this.time*(ring?-1.05:1.55);
          out.push({x:this.x+Math.cos(angle)*radius,y:this.y+Math.sin(angle)*radius*.82,
            size:ring?17:16,rotation:angle+Math.PI/2,color:ring?RAINBOW[i%RAINBOW.length]:'#95623f',ring});
        }
      }
      return out;
    }
    release() {
      if(this.state !== 'held') return false;
      const debris = this.orbiters.map(o => ({...this.orbitPosition(o),size:20,rotation:o.age*5,color:'#925a39'})).concat(this.ringItems());
      for(const p of debris) {
        const a=Math.atan2(p.y-this.y,p.x-this.x), speed=160+this.random()*400;
        this.addParticle({...p,kind:'poop',vx:Math.cos(a)*speed+this.vx*.12,vy:Math.sin(a)*speed-160,
          vr:(this.random()-.5)*12,life:1.5+this.random()*.6,floorY:Math.min(this.floorAt(this.x),this.y+190)});
      }
      this.orbiters=[]; this.transition('falling'); this.vy=40;
      this.landingY=Math.min(this.floorAt(this.x),this.y+78+72);
      this.vx=clamp(this.vx*.1,-85,85); this.say('救——！！', 'panic', 3);
      return true;
    }
    addParticle(p) {
      this.particles.push({age:0,rotation:0,vr:0,color:'#fffdf5',...p});
      if(this.particles.length>180) this.particles.shift();
    }
    shatter() {
      this.transition('shattered'); this.restY=this.landingY;this.y=this.restY-78; this.vx=0; this.vy=0;
      this.impact={x:this.x,y:this.y+69,time:this.time};
      for(let i=0;i<12;i++) {
        this.addParticle({kind:'shard',index:i,x:this.x+(this.random()-.5)*72,y:this.y+(this.random()-.5)*80,
          vx:(this.random()-.5)*530,vy:-180-this.random()*480,size:22+this.random()*23,
          vr:(this.random()-.5)*15,life:3.15,floorY:this.restY});
      }
      for(let i=0;i<15;i++) this.addParticle({kind:'spark',x:this.x,y:this.y+68,vx:(this.random()-.5)*500,vy:-this.random()*230,size:3+this.random()*5,life:.55+this.random()*.6,floorY:this.restY});
      this.say('……碎了，真碎了。', 'broken', 2.2);
    }
    reset(area = this.areas[0]) {
      this.transition('idle'); this.x=area.x+area.width*.72; this.y=area.y+area.height-90;
      this.restY=this.y+78;this.landingY=this.restY;
      this.particles=[]; this.orbiters=[]; this.treats=[];this.heldTreat=null;this.poopUntil=0;this.vx=0; this.vy=0;
      this.talkAt=this.time+12; this.say('杯杯又回来辣～', 'smug', 3.5);
    }
    step(dt) {
      dt=clamp(dt,0,.05); this.time+=dt; this.stateAge+=dt;
      if(this.bubble && this.time>this.bubble.until) this.bubble=null;
      if(this.state==='idle') {
        const area=this.areaAt(this.x);
        if(this.wandering && this.time>=this.poopUntil && !this.heldTreat) {
          this.x+=this.direction*dt*(16+5*Math.sin(this.time*.5));
          if(this.x<area.x+105){this.x=area.x+105;this.direction=1;}
          if(this.x>area.x+area.width-105){this.x=area.x+area.width-105;this.direction=-1;}
        }
        this.y=this.restY-78;
        if(this.time>this.talkAt){this.taunt();this.talkAt=this.time+11+this.random()*9;}
      } else if(this.state==='held') {
        this.holdAge+=dt; this.emitClock+=dt;
        if(this.emitClock>.22){
          this.emitClock-=.22;
          this.orbiters.push({age:0,angle:0,radius:90+this.random()*18});
          if(this.orbiters.length>26)this.orbiters.shift();
        }
        for(const o of this.orbiters)o.age+=dt;
        if(this.holdAge>this.nextApology){this.say(APOLOGIES[this.apologyIndex++%APOLOGIES.length],'panic',3);this.nextApology+=2.7;}
      } else if(this.state==='falling') {
        this.vy+=650*dt; this.y+=this.vy*dt; this.x+=this.vx*dt;
        const area=this.areaAt(this.x), floor=this.landingY;
        this.x=clamp(this.x,area.x+90,area.x+area.width-90);
        if(this.y+78>=floor)this.shatter();
      } else if(this.state==='shattered' && this.stateAge>1.85) {
        this.transition('reforming'); this.say('捡一捡……还能用……', 'broken', 1.6);
        for(const p of this.particles)if(p.kind==='shard'){p.homeX=p.x;p.homeY=p.y;}
      } else if(this.state==='reforming' && this.stateAge>1.1) {
        this.particles=this.particles.filter(p=>p.kind!=='shard');
        this.transition('bruised'); this.say('杯杯再也不敢了……', 'broken', 2.3);
      } else if(this.state==='eating') {
        if(this.stateAge>2.3 && this.bubble?.kind!=='yum2')this.say('亚米亚米～\n再来一口嘛～', 'yum2', 2.5);
        if(this.stateAge>4.6){this.transition('idle');this.talkAt=this.time+10;}
      } else if(this.state==='bruised' && this.stateAge>2.6) {
        this.transition('idle'); this.say('……骗你的～', 'smug', 3); this.talkAt=this.time+11;
      }
      for(const p of this.particles) {
        p.age+=dt;
        if(p.kind==='shard' && this.state==='reforming'){
          const t=clamp(this.stateAge/1.1,0,1), ease=t*t*(3-2*t);
          p.x=p.homeX+(this.x+(p.index%3-1)*27-p.homeX)*ease;
          p.y=p.homeY+(this.y+(Math.floor(p.index/3)-1.5)*24-p.homeY)*ease;
          p.rotation*=.88;
        } else {
          p.vy+=(p.kind==='heart'?50:850)*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; p.rotation+=p.vr*dt;
          const floor=(p.floorY??this.floorAt(p.x,p.y))-p.size*.4;
          if(p.y>floor){p.y=floor;p.vy=-Math.abs(p.vy)*.3;p.vx*=.87;p.vr*=.78;}
        }
      }
      this.particles=this.particles.filter(p=>p.age<p.life || (p.kind==='shard' && this.state==='reforming'));
      for(const p of this.treats){
        if(p.id===this.heldTreat)continue;
        p.age+=dt;p.vy+=750*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
        const floor=p.floorY-13;
        if(p.y>floor){p.y=floor;p.vy=-Math.abs(p.vy)*.22;p.vx*=.83;}
      }
      this.treats=this.treats.filter(p=>p.age<90 || p.id===this.heldTreat);
    }
    snapshot() {
      return {time:this.time,state:this.state,stateAge:this.stateAge,x:this.x,y:this.y,direction:this.direction,
        muted:this.muted,wandering:this.wandering,holdAge:this.holdAge,bubble:this.bubble,pooping:this.state==='idle'&&this.time<this.poopUntil,
        utterance:this.utterance,particles:this.particles,impact:this.impact,treats:this.treats,heldTreat:this.heldTreat,
        orbiters:this.orbiters.map(o=>({...this.orbitPosition(o),size:19,rotation:o.age<.52?0:o.age*3,color:'#95623f'})),
        rings:this.ringItems()};
    }
  }
  return { Engine, TAUNTS, APOLOGIES, RAINBOW };
});
