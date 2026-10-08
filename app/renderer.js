'use strict';
const canvas=document.getElementById('pet'),ctx=canvas.getContext('2d');
let config={bounds:{x:0,y:0,width:innerWidth,height:innerHeight},audio:false},state,lastVoice=0,audioContext;
let lastState='',lastImpact=-1,pointerDown=false,voiceTimer;
function resize(){const dpr=window.devicePixelRatio||1;canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
addEventListener('resize',resize);resize();
function squeak(panic=false){
  try{
    audioContext ||= new AudioContext();audioContext.resume();
    for(let i=0;i<(panic?3:2);i++){
      const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime+i*.12;
      o.type='triangle';o.frequency.setValueAtTime(panic?900:540,t);o.frequency.exponentialRampToValueAtTime(panic?1450:740,t+.09);
      g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.035,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.1);
      o.connect(g);g.connect(audioContext.destination);o.start(t);o.stop(t+.12);
    }
  }catch(_){}
}
function crack(){
  try{
    audioContext ||= new AudioContext();audioContext.resume();
    const len=Math.round(audioContext.sampleRate*.22),buffer=audioContext.createBuffer(1,len,audioContext.sampleRate),channel=buffer.getChannelData(0);
    for(let i=0;i<len;i++)channel[i]=(Math.random()*2-1)*Math.pow(1-i/len,4)*.22;
    const source=audioContext.createBufferSource(),filter=audioContext.createBiquadFilter();
    source.buffer=buffer;filter.type='highpass';filter.frequency.value=1300;source.connect(filter);filter.connect(audioContext.destination);source.start();
  }catch(_){}
}
function speak(utterance){
  if(!config.audio || !state || state.muted || !utterance)return;
  const voices=window.speechSynthesis?.getVoices()||[];
  const voice=voices.find(v=>/^zh[-_]/i.test(v.lang)&&v.localService);
  if(!voice){squeak(utterance.kind==='panic');return;}
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(utterance.text);u.lang=voice.lang;u.voice=voice;
  u.pitch=utterance.kind==='panic'?1.9:1.55;u.rate=utterance.kind==='panic'?1.4:1.18;u.volume=.65;
  speechSynthesis.speak(u);
}
window.petBridge.onInit(value=>{config=value;resize();});
window.petBridge.onState(value=>{
  state=value;
  if(state.muted){clearTimeout(voiceTimer);window.speechSynthesis?.cancel();}
  if(state.utterance && state.utterance.id!==lastVoice){
    lastVoice=state.utterance.id;clearTimeout(voiceTimer);
    // A quick single click should drop a treat, without starting a full panic scream.
    const utterance=state.utterance;voiceTimer=setTimeout(()=>speak(utterance),state.state==='held'?310:10);
  }
  if(state.impact && state.impact.time!==lastImpact){lastImpact=state.impact.time;if(config.audio&&!state.muted)crack();}
  lastState=state.state;
  ctx.clearRect(0,0,innerWidth,innerHeight);PetScene.draw(ctx,state,config.bounds);
});
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;pointerDown=true;canvas.classList.add('holding');
  event.preventDefault();window.petBridge.down({x:event.clientX,y:event.clientY});
  try{canvas.setPointerCapture(event.pointerId);}catch(_){}
});
canvas.addEventListener('pointerup',event=>{
  if(event.button!==0 || !pointerDown)return;pointerDown=false;canvas.classList.remove('holding');
  window.petBridge.up({x:event.clientX,y:event.clientY});
  if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointercancel',()=>{pointerDown=false;canvas.classList.remove('holding');window.petBridge.cancel();});
canvas.addEventListener('contextmenu',event=>{event.preventDefault();window.petBridge.menu();});
