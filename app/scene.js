(function(global){
  'use strict';
  const C=()=>global.CupRenderer;
  function heart(ctx,x,y,size,color){
    ctx.save();ctx.translate(x,y);ctx.scale(size/12,size/12);ctx.fillStyle=color;
    ctx.beginPath();ctx.moveTo(0,8);ctx.bezierCurveTo(-20,-3,-8,-14,0,-5);ctx.bezierCurveTo(8,-14,20,-3,0,8);ctx.fill();ctx.restore();
  }
  function bubble(ctx,s,bounds){
    if(!s.bubble)return;
    ctx.save();ctx.font='700 17px "PingFang SC", "Microsoft YaHei", sans-serif';
    const lines=[];
    for(const raw of s.bubble.text.split('\n')){
      let line='';for(const char of raw){if(ctx.measureText(line+char).width>222){lines.push(line);line=char;}else line+=char;}
      if(line)lines.push(line);
    }
    const w=Math.max(100,...lines.map(line=>ctx.measureText(line).width))+30,h=lines.length*24+24;
    let x=s.x-w/2, y=s.y-(s.state==='held'?200:118)-h;
    if(y<bounds.y+12){x=s.x+111;y=Math.max(bounds.y+12,s.y-105);}
    x=Math.min(bounds.x+bounds.width-w-12,Math.max(bounds.x+12,x));
    const panic=s.bubble.kind==='panic',yum=s.bubble.kind.startsWith('yum');
    ctx.shadowColor='rgba(0,0,0,.13)';ctx.shadowBlur=12;ctx.shadowOffsetY=4;
    ctx.fillStyle=panic?'#fff5ec':yum?'#fffbe7':'#fffef8';
    ctx.strokeStyle=panic?'#b75138':'#35352e';ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect(x,y,w,h,15);ctx.fill();ctx.stroke();
    ctx.shadowColor='transparent';
    const tailX=Math.max(x+20,Math.min(x+w-20,s.x-10));
    ctx.beginPath();ctx.moveTo(tailX-7,y+h-1);ctx.lineTo(tailX+1,y+h+12);ctx.lineTo(tailX+13,y+h-1);ctx.fill();ctx.stroke();
    ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(tailX-5,y+h);ctx.lineTo(tailX+10,y+h);ctx.stroke();
    ctx.fillStyle=panic?'#ae3f27':'#302f29';ctx.textAlign='center';ctx.textBaseline='middle';
    lines.forEach((line,i)=>ctx.fillText(line,x+w/2,y+24+i*24));ctx.restore();
  }
  function draw(ctx,s,bounds){
    if(!s || !C())return;
    ctx.save();ctx.translate(-bounds.x,-bounds.y);
    // A modest grounding shadow; no opaque desktop surface.
    if(s.state!=='held' && s.state!=='falling'){
      ctx.fillStyle='rgba(34,28,17,.13)';ctx.beginPath();ctx.ellipse(s.x,s.y+77,62,7,0,0,Math.PI*2);ctx.fill();
    }
    if(s.state==='held' && s.rings.length){
      ctx.save();ctx.globalAlpha=.19;ctx.lineWidth=2;
      for(const [radius,color]of [[145,'#8e5734'],[190,'#bd8bf4']]){
        ctx.strokeStyle=color;ctx.beginPath();ctx.ellipse(s.x,s.y,radius,radius*.82,0,0,Math.PI*2);ctx.stroke();
      }ctx.restore();
    }
    for(const p of s.rings)C().drawPoop(ctx,p.x,p.y,p.size,p.rotation,p.color);
    for(const p of s.orbiters)if(p.y<s.y)C().drawPoop(ctx,p.x,p.y,p.size,p.rotation,p.color);
    if(s.state!=='shattered' && s.state!=='reforming'){
      const mood=s.pooping?'smug':({held:'panic',falling:'falling',bruised:'bruised',eating:'yum'}[s.state]||'smug');
      C().draw(ctx,{x:s.x-108,y:s.y-83,width:216,height:187.2},{mood,time:s.time,direction:s.state==='idle'&&!s.pooping?s.direction:1,intensity:s.state==='held'?1.4:1});
    }
    for(const p of s.orbiters)if(p.y>=s.y)C().drawPoop(ctx,p.x,p.y,p.size,p.rotation,p.color);
    for(const p of s.particles){
      ctx.save();ctx.globalAlpha=p.kind==='shard'?1:Math.max(0,Math.min(1,(p.life-p.age)/.45));
      if(p.kind==='poop')C().drawPoop(ctx,p.x,p.y,p.size,p.rotation,p.color);
      else if(p.kind==='shard')C().drawShard(ctx,p.x,p.y,p.size,p.rotation,p.index);
      else if(p.kind==='heart')heart(ctx,p.x,p.y,p.size,p.color);
      else{ctx.fillStyle='#c6b6a2';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }
    for(const p of s.treats||[]){
      const held=p.id===s.heldTreat;
      if(held){ctx.save();ctx.shadowColor='#ffde6f';ctx.shadowBlur=18;C().drawPoop(ctx,p.x,p.y,p.size+3,Math.sin(s.time*9)*.1);ctx.restore();}
      else C().drawPoop(ctx,p.x,p.y,p.size,0,'#95623f');
    }
    if(s.heldTreat && !['held','falling','shattered','reforming'].includes(s.state)){
      ctx.save();ctx.strokeStyle='rgba(232,179,38,.9)';ctx.lineWidth=2.5;ctx.setLineDash([5,5]);
      ctx.beginPath();ctx.ellipse(s.x,s.y,55,43,0,0,Math.PI*2);ctx.stroke();
      ctx.font='bold 13px "PingFang SC","Microsoft YaHei",sans-serif';ctx.textAlign='center';
      ctx.fillStyle='#49350c';ctx.fillText('喂这儿 ↓',s.x,s.y-55);ctx.restore();
    }
    if(s.impact && s.time-s.impact.time<.32){
      ctx.save();ctx.globalAlpha=1-(s.time-s.impact.time)/.32;ctx.strokeStyle='#e7b45b';ctx.lineWidth=4;
      const r=20+(s.time-s.impact.time)*280;ctx.beginPath();ctx.ellipse(s.impact.x,s.impact.y,r,r*.27,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    bubble(ctx,s,bounds);ctx.restore();
  }
  global.PetScene={draw};
})(typeof window!=='undefined'?window:globalThis);
