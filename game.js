const $=s=>document.querySelector(s);
const canvas=$('#course'),ctx=canvas.getContext('2d');
const golferImg=new Image(); golferImg.src='assets/golfers.webp';
const topDownImg=new Image(); topDownImg.src='assets/golfers-topdown.webp';
const portraitFiles=['portrait-barry.webp','portrait-chip.webp','portrait-sandy.webp','portrait-norm.webp'];
const golfers=[
 {name:'Barry Bigstick',role:'BIG HITTER',color:'#e74738',stats:{power:5,accuracy:2,short:2},desc:'Bombs away. Directions optional.'},
 {name:'Chip McGee',role:'APPROACH ACE',color:'#e7ae22',stats:{power:3,accuracy:5,short:3},desc:'Finds flags like a homing pigeon.'},
 {name:'Sandy Putterson',role:'SHORT-GAME WIZ',color:'#20a9a4',stats:{power:2,accuracy:3,short:5},desc:'Dangerous anywhere near a green.'},
 {name:'Norm Alround',role:'BALANCED',color:'#2574d2',stats:{power:4,accuracy:4,short:4},desc:'Good at golf. Terrible at nicknames.'}
];
const difficulties={easy:{label:'EASY',sub:'Relaxed',width:1.25,length:.88,green:1.28,hazards:.55,slope:.45,wind:.55},medium:{label:'MEDIUM',sub:'Club golfer',width:1,length:1,green:1,hazards:1,slope:.75,wind:.85},hard:{label:'HARD',sub:'Tour trouble',width:.72,length:1.12,green:.76,hazards:1.45,slope:1.2,wind:1.25}};
const clubs=[['Driver',225],['3 Wood',195],['4 Iron',165],['6 Iron',140],['8 Iron',115],['Pitching Wedge',90],['Sand Wedge',65],['Putter',12]];
const puttModes=[['Short Putt',5],['Medium Putt',11],['Long Putt',24]];
let selectedGolfer=3,selectedDifficulty='medium',course=[],holeIndex=0,strokes=0,scores=[],ball={x:480,y:585},aim=0,club=0,puttMode=1,phase='ready',power=0,accuracy=0,meterDir=1,animFrame,lastTime=0,hole,lie='TEE',shotAnimating=false,viewScale=1,pendingCupMessage='',golferSwingPose=0,ballInCup=false,audioCtx=null;

function renderSetup(){
 $('#golferGrid').innerHTML=golfers.map((g,i)=>`<button class="golfer-card ${i===selectedGolfer?'selected':''}" role="radio" aria-checked="${i===selectedGolfer}" data-golfer="${i}"><div class="portrait" style="background-image:url('assets/${portraitFiles[i]}')"></div><div class="golfer-info"><small>${g.role}</small><h3>${g.name}</h3>${statRow('POWER',g.stats.power)}${statRow('CONTROL',g.stats.accuracy)}${statRow('SHORT',g.stats.short)}</div></button>`).join('');
 $('#difficultyGrid').innerHTML=Object.entries(difficulties).map(([k,d])=>`<button class="difficulty ${k===selectedDifficulty?'selected':''}" role="radio" aria-checked="${k===selectedDifficulty}" data-difficulty="${k}">${d.label}<small>${d.sub}</small></button>`).join('');
}
function statRow(label,n){return `<div class="stat"><span>${label}</span><span class="pips">${[1,2,3,4,5].map(v=>`<i class="${v<=n?'on':''}"></i>`).join('')}</span></div>`}
$('#golferGrid').onclick=e=>{const b=e.target.closest('[data-golfer]');if(b){selectedGolfer=+b.dataset.golfer;renderSetup()}};
$('#difficultyGrid').onclick=e=>{const b=e.target.closest('[data-difficulty]');if(b){selectedDifficulty=b.dataset.difficulty;renderSetup()}};

function rand(a,b){return a+Math.random()*(b-a)}
function shuffled(a){return [...a].sort(()=>Math.random()-.5)}
function generateCourse(){
 const mixes=[[3,11,4],[4,10,4],[4,9,5],[5,9,4]],mix=mixes[Math.floor(Math.random()*mixes.length)];
 const pars=shuffled([...Array(mix[0]).fill(3),...Array(mix[1]).fill(4),...Array(mix[2]).fill(5)]);
 const d=difficulties[selectedDifficulty];
 return pars.map((par,i)=>{
  const base=par===3?rand(110,190):par===4?rand(285,410):rand(430,530);
  const length=Math.round(base*d.length/5)*5;
  const green={x:rand(325,635),y:75,r:rand(42,61)*d.green};
  green.points=Array.from({length:14},(_,k)=>{const a=k/14*Math.PI*2,rad=green.r*rand(.76,1.15);return {x:green.x+Math.cos(a)*rad,y:green.y+Math.sin(a)*rad*rand(.72,1.02)}});
  const tee={x:rand(405,555),y:585};
  const bends=par===3?0:Math.random()<.72?1:2;
  const centers=[tee]; for(let j=1;j<=bends;j++){const t=j/(bends+1);centers.push({x:tee.x+(green.x-tee.x)*t+rand(-115,115),y:tee.y+(green.y-tee.y)*t});} centers.push(green);
  const fairWidth=rand(62,88)*d.width;
  const bunkers=Array.from({length:Math.max(0,Math.round(rand(1,4)*d.hazards))},(_,j)=>({x:green.x+rand(-95,95),y:green.y+rand(-65,90),rx:rand(16,30),ry:rand(9,18),rot:rand(0,Math.PI)}));
  const waters=Array.from({length:Math.random()<.32*d.hazards?1:0},()=>({x:rand(235,725),y:rand(210,455),rx:rand(45,90),ry:rand(20,48),rot:rand(-.8,.8)}));
  const trees=Array.from({length:Math.round(rand(18,30)*d.hazards)},()=>({x:rand(35,925),y:rand(45,585),r:rand(8,15)}));
  return {number:i+1,par,length,green,tee,centers,fairWidth,bunkers,waters,trees,wind:{speed:Math.round(rand(2,13)*d.wind),angle:rand(0,Math.PI*2)},slope:{strength:rand(.2,1)*d.slope,angle:rand(0,Math.PI*2)}};
 });
}
function startRound(){course=generateCourse();scores=[];holeIndex=0;$('#setup').classList.add('hidden');$('#game').classList.remove('hidden');const g=golfers[selectedGolfer];$('#golferName').textContent=g.name;$('#golferRole').textContent=g.role;$('#miniPortrait').style.backgroundImage=`url('assets/${portraitFiles[selectedGolfer]}')`;loadHole()}
function aimAtHole(){aim=Math.atan2(hole.green.x-ball.x,ball.y-hole.green.y)}
function loadHole(){hole=course[holeIndex];ball={...hole.tee};strokes=0;lie='TEE';ballInCup=false;aimAtHole();club=hole.par===3?3:0;puttMode=1;phase='ready';power=0;accuracy=0;updateHUD();draw()}
function updateHUD(){
 $('#holeLabel').textContent=`HOLE ${holeIndex+1}`;$('#parLabel').textContent=`PAR ${hole.par}`;$('#yardLabel').textContent=`${hole.length} M`;$('#shotCount').textContent=strokes+1;$('#lieBadge').textContent=lie;
 const total=scores.reduce((a,s,i)=>a+s-course[i].par,0);$('#roundScore').textContent=formatScore(total);
 $('#windLabel').textContent=`${hole.wind.speed} mph`;$('#windArrow').style.transform=`rotate(${hole.wind.angle}rad)`;
 $('#clubLabel').textContent=(lie==='GREEN'?puttModes[puttMode][0]:clubs[club][0]).toUpperCase();$('#distanceLabel').textContent=lie==='GREEN'?`${clubDistance().toFixed(1)} m max`:`${Math.round(clubDistance())} m max`;$('#aimDegrees').textContent=`${Math.round(aim*180/Math.PI)}°`;
}
function clubDistance(){const g=golfers[selectedGolfer];if(lie==='GREEN')return puttModes[puttMode][1];let n=clubs[club][1];if(club<2)n*=.9+g.stats.power*.035;if(lie==='ROUGH')n*=.82;if(lie==='BUNKER')n*=.62;return n}
function formatScore(n){return n===0?'E':n>0?`+${n}`:`${n}`}
function pixelsPerMetre(){return (hole.tee.y-hole.green.y)/hole.length}
function greenRadiusPixels(){return Math.max(...hole.green.points.map(p=>dist(p,hole.green)))}
function puttPixelsPerMetre(){return greenRadiusPixels()/16}
function shotPixelsPerMetre(){return lie==='GREEN'?puttPixelsPerMetre():pixelsPerMetre()}
function remainingMetres(){return dist(ball,hole.green)/(lie==='GREEN'?puttPixelsPerMetre():pixelsPerMetre())}
function pointInGreen(x,y){
 const pts=hole.green.points;let inside=false;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const a=pts[i],b=pts[j],cross=(a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x;
  if(cross)inside=!inside;
 }
 return inside;
}
function getAudio(){
 const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;
 if(!audioCtx)audioCtx=new Audio();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;
}
function tone(freq,start,duration,type='sine',gain=.08,endFreq=freq){
 const a=getAudio();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,start);o.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),start+duration);g.gain.setValueAtTime(gain,start);g.gain.exponentialRampToValueAtTime(.001,start+duration);o.connect(g).connect(a.destination);o.start(start);o.stop(start+duration);
}
function noise(start,duration,gain=.08,cutoff=1200){
 const a=getAudio();if(!a)return;const buffer=a.createBuffer(1,Math.ceil(a.sampleRate*duration),a.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;const src=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();src.buffer=buffer;filter.type='lowpass';filter.frequency.value=cutoff;g.gain.setValueAtTime(.001,start);g.gain.exponentialRampToValueAtTime(gain,start+Math.min(.035,duration/3));g.gain.exponentialRampToValueAtTime(.001,start+duration);src.connect(filter).connect(g).connect(a.destination);src.start(start);src.stop(start+duration);
}
function playShotSound(kind){
 const a=getAudio();if(!a)return;const now=a.currentTime+.01;
 if(kind==='drive'){noise(now,.13,.24,1100);tone(125,now,.16,'square',.11,48)}
 else if(kind==='approach'){noise(now,.1,.14,1450);tone(180,now,.12,'triangle',.08,75)}
 else{tone(620,now,.055,'triangle',.07,260);noise(now,.045,.035,2400)}
}
function playResultSound(relative){
 const a=getAudio();if(!a)return;const now=a.currentTime+.03;
 if(relative<=-2){noise(now,1.15,.15,2200);[392,523,659,784,1047].forEach((f,i)=>tone(f,now+i*.11,.48,'sine',.075,f*1.08))}
 else if(relative===-1){noise(now,.72,.1,1800);[440,554,659,880].forEach((f,i)=>tone(f,now+i*.1,.32,'sine',.06,f*1.04))}
 else if(relative===0){for(let i=0;i<5;i++)noise(now+i*.15,.07,.12,1300)}
 else{noise(now,.55,.045,600);tone(330,now,.65,'sine',.07,185);tone(247,now+.08,.58,'sine',.045,165)}
}
function getCamera(){
 if(lie==='GREEN'){const scale=Math.min(9,Math.max(5,340/hole.green.r));return {scale,x:480-hole.green.x*scale,y:320-hole.green.y*scale}}
 if(hole&&remainingMetres()<=20){const mid={x:(ball.x+hole.green.x)/2,y:(ball.y+hole.green.y)/2},spanX=Math.abs(ball.x-hole.green.x)+hole.green.r*2.4,spanY=Math.abs(ball.y-hole.green.y)+hole.green.r*2.4,scale=Math.max(1.45,Math.min(2.8,820/spanX,520/spanY));return {scale,x:480-mid.x*scale,y:320-mid.y*scale}}
 return {scale:1,x:0,y:0};
}
function worldToScreen(p){const c=getCamera();return {x:p.x*c.scale+c.x,y:p.y*c.scale+c.y}}
function screenToWorld(x,y){const c=getCamera();return {x:(x-c.x)/c.scale,y:(y-c.y)/c.scale}}
function draw(){
 ctx.clearRect(0,0,960,640);ctx.fillStyle='#266c43';ctx.fillRect(0,0,960,640);
 const camera=getCamera();viewScale=camera.scale;ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);drawMow();
 hole.waters.forEach(w=>ellipse(w,'#2c9dcc','#63c4e4'));drawFairway();
 hole.bunkers.forEach(b=>ellipse(b,'#ead18e','#f7e5b5'));
 hole.trees.forEach(t=>{if(!onFairway(t.x,t.y)&&dist(t,hole.green)>hole.green.r+12){ctx.fillStyle='#163f2b';ctx.beginPath();ctx.arc(t.x+3,t.y+4,t.r,0,7);ctx.fill();ctx.fillStyle='#2f8b4c';ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,7);ctx.fill()}});
 drawGreen();drawAim();drawBall();
 ctx.restore();
}
function drawMow(){ctx.save();ctx.globalAlpha=.08;for(let y=0;y<640;y+=28){ctx.fillStyle=y%56?'#fff':'#000';ctx.fillRect(0,y,960,28)}ctx.restore()}
function ellipse(o,fill,shine){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot||0);ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(0,0,o.rx,o.ry,0,0,7);ctx.fill();ctx.strokeStyle=shine;ctx.lineWidth=3;ctx.stroke();ctx.restore()}
function drawFairway(){ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#65b95f';ctx.lineWidth=hole.fairWidth+18;ctx.beginPath();hole.centers.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.strokeStyle='#83ce72';ctx.lineWidth=hole.fairWidth;ctx.stroke();ctx.setLineDash([12,16]);ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=hole.fairWidth*.75;ctx.stroke();ctx.setLineDash([])}
function drawGreen(){const g=hole.green,s=1/viewScale,flagH=lie==='GREEN'?46*s:37,pts=g.points;ctx.fillStyle='#9bdd73';ctx.beginPath();const firstMid={x:(pts[0].x+pts[pts.length-1].x)/2,y:(pts[0].y+pts[pts.length-1].y)/2};ctx.moveTo(firstMid.x,firstMid.y);pts.forEach((p,i)=>{const n=pts[(i+1)%pts.length];ctx.quadraticCurveTo(p.x,p.y,(p.x+n.x)/2,(p.y+n.y)/2)});ctx.closePath();ctx.fill();ctx.strokeStyle='#b9ef91';ctx.lineWidth=4*s;ctx.stroke();ctx.fillStyle='#143c29';ctx.beginPath();ctx.ellipse(g.x,g.y+2*s,5*s,2.2*s,0,0,7);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.lineTo(g.x,g.y-flagH);ctx.stroke();ctx.fillStyle='#ef4a3d';ctx.beginPath();ctx.moveTo(g.x,g.y-flagH);ctx.lineTo(g.x+18*s,g.y-flagH+7*s);ctx.lineTo(g.x,g.y-flagH+14*s);ctx.fill();if(lie==='GREEN'){for(let y=g.y-g.r*.72;y<g.y+g.r*.72;y+=17)for(let x=g.x-g.r*.78;x<g.x+g.r*.78;x+=22){if(pointInGreen(x,y))drawSlopeArrow(x,y)}}}
function drawSlopeArrow(x,y){const pulse=.55+.45*Math.sin(performance.now()/220*hole.slope.strength+x),s=1/viewScale;ctx.save();ctx.translate(x,y);ctx.rotate(hole.slope.angle);ctx.scale(s,s);ctx.globalAlpha=.25+pulse*.55;ctx.fillStyle=hole.slope.strength>.75?'#e34c3f':'#226dba';ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-3,-5);ctx.lineTo(-3,-2);ctx.lineTo(-9,-2);ctx.lineTo(-9,2);ctx.lineTo(-3,2);ctx.lineTo(-3,5);ctx.closePath();ctx.fill();ctx.restore()}
function drawAim(){if(shotAnimating||ballInCup)return;const len=clubDistance()*shotPixelsPerMetre(),s=1/viewScale;ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(aim);ctx.setLineDash([9*s,8*s]);ctx.strokeStyle='#fff';ctx.lineWidth=3*s;ctx.beginPath();ctx.moveTo(0,-9*s);ctx.lineTo(0,-len);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,-len-10*s);ctx.lineTo(-7*s,-len+3*s);ctx.lineTo(7*s,-len+3*s);ctx.fill();ctx.restore()}
function drawBall(){if(ballInCup)return;const s=1/viewScale,r=5*s;ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(ball.x+2*s,ball.y+4*s,7*s,3*s,0,0,7);ctx.fill();if(!shotAnimating&&topDownImg.complete&&topDownImg.naturalWidth){const cellW=topDownImg.naturalWidth/4,w=34*s,h=45*s,side=22*s;ctx.save();ctx.translate(ball.x-Math.cos(aim)*side,ball.y-Math.sin(aim)*side);ctx.rotate(aim-Math.PI/2+golferSwingPose);ctx.drawImage(topDownImg,selectedGolfer*cellW,0,cellW,topDownImg.naturalHeight,-w/2,-h/2,w,h);ctx.restore()}ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x,ball.y,r,0,7);ctx.fill();ctx.strokeStyle='#203629';ctx.lineWidth=1*s;ctx.stroke()}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function onFairway(x,y){return hole.centers.some((p,i)=>i&&segmentDistance({x,y},hole.centers[i-1],p)<hole.fairWidth/2)}
function segmentDistance(p,a,b){const l2=(b.x-a.x)**2+(b.y-a.y)**2;if(!l2)return dist(p,a);let t=((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2;t=Math.max(0,Math.min(1,t));return dist(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)})}
function pathNearPoint(p,a,b){const l2=(b.x-a.x)**2+(b.y-a.y)**2;if(!l2)return {distance:dist(p,a),t:0};let t=((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2;t=Math.max(0,Math.min(1,t));return {distance:dist(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)}),t}}

function swing(){if(shotAnimating||phase==='swinging')return;getAudio();if(phase==='ready'){phase='power';$('#swingMain').textContent='LOCK POWER';$('#swingHint').textContent='Tap near the top';meterDir=1;animateMeters()}else if(phase==='power'){phase='accuracy';$('#swingMain').textContent='HIT IT!';$('#swingHint').textContent='Stop in the centre'}else if(phase==='accuracy'){cancelAnimationFrame(animFrame);phase='swinging';$('#swingMain').textContent='SWINGING';$('#swingHint').textContent='';animateGolferSwing()}}
function animateGolferSwing(){const started=performance.now(),duration=620;function frame(now){const t=Math.min(1,(now-started)/duration);if(t<.34)golferSwingPose=-(t/.34)*.55;else if(t<.7)golferSwingPose=-.55+((t-.34)/.36)*1.35;else golferSwingPose=.8-((t-.7)/.3)*.5;draw();if(t<1)requestAnimationFrame(frame);else{golferSwingPose=0;phase='flight';hitBall()}}requestAnimationFrame(frame)}
function animateMeters(t=0){if(phase==='ready'||phase==='flight')return;const dt=Math.min(30,t-lastTime||16);lastTime=t;if(phase==='power'){power+=meterDir*dt*.085;if(power>=100||power<=0){meterDir*=-1;power=Math.max(0,Math.min(100,power))}$('#powerFill').style.width=`${power}%`;$('#powerValue').textContent=`${Math.round(power)}%`}else{accuracy+=meterDir*dt*.13;if(accuracy>=100||accuracy<=-100){meterDir*=-1;accuracy=Math.max(-100,Math.min(100,accuracy))}$('#accuracyNeedle').style.left=`${50+accuracy*.5}%`;$('#accuracyValue').textContent=Math.abs(accuracy)<12?'PERFECT':Math.abs(accuracy)<38?'GOOD':'MISS'}animFrame=requestAnimationFrame(animateMeters)}
function hitBall(){
 cancelAnimationFrame(animFrame);shotAnimating=true;ballInCup=false;strokes++;pendingCupMessage='';
 const g=golfers[selectedGolfer],isPutt=lie==='GREEN',start={...ball};
 playShotSound(isPutt||remainingMetres()<=20||club>=5?'chip':club<=1?'drive':'approach');
 const strength=isPutt?.05+.95*power/100:.42+.58*power/100;
 const shotMetres=clubDistance()*strength,d=shotMetres*shotPixelsPerMetre();
 const control=isPutt?g.stats.short:g.stats.accuracy,miss=accuracy*(1.15-control*.13),angle=aim+miss*Math.PI/450;
 const baseTx=ball.x+Math.sin(angle)*d,baseTy=ball.y-Math.cos(angle)*d;
 const windFactor=isPutt?0:hole.wind.speed*(.75+d/140)*(1-control*.045);
 const windX=Math.cos(hole.wind.angle)*windFactor,windY=Math.sin(hole.wind.angle)*windFactor;
 const slopeFactor=isPutt?d*Math.min(.3,hole.slope.strength*.38):0;
 const slopeX=Math.cos(hole.slope.angle)*slopeFactor,slopeY=Math.sin(hole.slope.angle)*slopeFactor;
 let tx=baseTx+windX+slopeX,ty=baseTy+windY+slopeY;
 if(isPutt){
  const target={x:tx,y:ty},pass=pathNearPoint(hole.green,start,target),overshoot=dist(target,hole.green),cupRadius=4;
  if(pass.t>.03&&pass.t<.99&&pass.distance<cupRadius){
   const lineQuality=1-pass.distance/cupRadius,tooHard=overshoot>hole.green.r*.75,paceQuality=Math.max(0,1-overshoot/(hole.green.r*.9));
   const sinkChance=tooHard?.06:.48+.48*lineQuality*paceQuality;
   if(overshoot<6||Math.random()<sinkChance){tx=hole.green.x;ty=hole.green.y;pendingCupMessage='DROPPED!'}
   else{const side=Math.sin(angle)*2.5;tx+=Math.cos(angle)*side;ty+=Math.sin(angle)*side;pendingCupMessage=overshoot>hole.green.r*.55?'BOUNCED OVER!':'LIPPED OUT!'}
  }
 }
 tx=Math.max(12,Math.min(948,tx));ty=Math.max(12,Math.min(628,ty));
 const curveX=tx-baseTx,curveY=ty-baseTy;
 const startTime=performance.now(),dur=Math.max(450,Math.min(1200,d*4));
 function pathPoint(t){const ease=1-(1-t)*(1-t),bend=ease*ease;return {x:start.x+(baseTx-start.x)*ease+curveX*bend,y:start.y+(baseTy-start.y)*ease+curveY*bend}}
 function flight(now){const q=Math.min(1,(now-startTime)/dur),p=pathPoint(q);ball.x=p.x;ball.y=p.y;draw();if(!isPutt){const lift=t=>Math.sin(Math.PI*t)*Math.min(38,d*.18)*getCamera().scale,from=Math.max(0,q-.22);ctx.save();ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.beginPath();for(let i=0;i<=10;i++){const t=from+(q-from)*i/10,wp=worldToScreen(pathPoint(t)),x=wp.x,y=wp.y-lift(t);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.restore();const sp=worldToScreen(p);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sp.x,sp.y-lift(q),5,0,7);ctx.fill()}if(q<1)requestAnimationFrame(flight);else landBall(start)}
 requestAnimationFrame(flight)
}
function landBall(previous){shotAnimating=false;const g=hole.green;if(dist(ball,g)<3.4){ball={x:g.x,y:g.y};ballInCup=true;draw();if(pendingCupMessage)toast(pendingCupMessage);setTimeout(finishHole,650);return}if(pointInGreen(ball.x,ball.y)){lie='GREEN';club=7;const remaining=remainingMetres();puttMode=remaining<4.5?0:remaining<10.5?1:2;toast(pendingCupMessage||'ON THE GREEN')}else if(hole.bunkers.some(b=>pointInEllipse(ball,b))){lie='BUNKER';toast('BEACH DAY')}else if(onFairway(ball.x,ball.y)){lie='FAIRWAY';toast('FAIRWAY FOUND')}else if(hole.waters.some(w=>pointInEllipse(ball,w))){ball=previous;strokes++;toast('SPLASH! +1 PENALTY')}else{lie='ROUGH';toast('IN THE ROUGH')}pendingCupMessage='';phase='ready';power=0;accuracy=0;resetMeter();autoClub();aimAtHole();updateHUD();draw()}
function pointInEllipse(p,e){const c=Math.cos(-(e.rot||0)),s=Math.sin(-(e.rot||0)),dx=p.x-e.x,dy=p.y-e.y,x=dx*c-dy*s,y=dx*s+dy*c;return x*x/e.rx**2+y*y/e.ry**2<=1}
function autoClub(){if(lie==='GREEN')return;const remaining=remainingMetres();club=clubs.findIndex(c=>c[1]<remaining+20);if(club<0)club=0}
function resetMeter(){$('#powerFill').style.width='0';$('#powerValue').textContent='0%';$('#accuracyNeedle').style.left='50%';$('#accuracyValue').textContent='READY';$('#swingMain').textContent='SWING';$('#swingHint').textContent='Tap to start power'}
let toastTimer;function toast(s){const el=$('#toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1200)}
function finishHole(){scores[holeIndex]=strokes;playResultSound(strokes-hole.par);showScorecard()}
function showScorecard(){const rel=strokes-hole.par;$('#scoreKicker').textContent=holeIndex===17?'FINAL SCORE':`AFTER HOLE ${holeIndex+1}`;$('#scoreTitle').textContent=rel<=-2?'An eagle!':rel===-1?'Beautiful birdie!':rel===0?'Nice par!':rel===1?'Just a bogey.':rel===2?'Double trouble.':'The ball survived.';const total=scores.reduce((a,s,i)=>a+s-course[i].par,0);$('#scoreTotal').textContent=formatScore(total);$('#scoreHoles').innerHTML='<th>HOLE</th>'+course.map(h=>`<th>${h.number}</th>`).join('')+'<th>OUT</th><th>IN</th><th>TOT</th>';$('#scorePars').innerHTML='<td>PAR</td>'+course.map(h=>`<td>${h.par}</td>`).join('')+`<td>${course.slice(0,9).reduce((a,h)=>a+h.par,0)}</td><td>${course.slice(9).reduce((a,h)=>a+h.par,0)}</td><td>${course.reduce((a,h)=>a+h.par,0)}</td>`;const cells=course.map((h,i)=>{const s=scores[i];if(!s)return '<td>–</td>';const r=s-h.par,cl=r<=-2?'eagle':r===-1?'birdie':r===0?'par':'bogey';return `<td class="${i===holeIndex?'current':''}"><span class="score-cell ${cl}">${s}</span></td>`}).join('');const sum=a=>a.reduce((x,s,i)=>x+(s||0),0)||'–';$('#scoreScores').innerHTML=`<td>SCORE</td>${cells}<td>${sum(scores.slice(0,9))}</td><td>${sum(scores.slice(9))}</td><td>${sum(scores)}</td>`;$('#nextHoleBtn').innerHTML=holeIndex===17?'NEW ROUND <span>↻</span>':'NEXT HOLE <span>→</span>';$('#scoreDialog').showModal()}

function changeAim(n){if(phase==='ready'){aim+=n;updateHUD();draw()}}
function changeClub(n){if(phase!=='ready')return;if(lie==='GREEN')puttMode=Math.max(0,Math.min(2,puttMode+n));else club=Math.max(0,Math.min(6,club+n));updateHUD();draw()}
$('#startBtn').onclick=startRound;$('#swingBtn').onclick=swing;$('#aimLeft').onclick=()=>changeAim(-.06);$('#aimRight').onclick=()=>changeAim(.06);$('#clubDown').onclick=()=>changeClub(-1);$('#clubUp').onclick=()=>changeClub(1);$('#menuBtn').onclick=()=>{if(confirm('Leave this round and return to golfer select?')){$('#game').classList.add('hidden');$('#setup').classList.remove('hidden')}};$('#nextHoleBtn').onclick=()=>{$('#scoreDialog').close();if(holeIndex===17){$('#game').classList.add('hidden');$('#setup').classList.remove('hidden')}else{holeIndex++;loadHole()}};
document.addEventListener('keydown',e=>{if($('#game').classList.contains('hidden'))return;if(e.code==='Space'){e.preventDefault();swing()}if(['ArrowLeft','KeyA'].includes(e.code))changeAim(-.045);if(['ArrowRight','KeyD'].includes(e.code))changeAim(.045);if(e.code==='ArrowUp')changeClub(-1);if(e.code==='ArrowDown')changeClub(1)});
let pointerAiming=false;
function aimAtPointer(e){if(phase!=='ready')return;const rect=canvas.getBoundingClientRect(),sx=(e.clientX-rect.left)*960/rect.width,sy=(e.clientY-rect.top)*640/rect.height,p=screenToWorld(sx,sy);aim=Math.atan2(p.x-ball.x,ball.y-p.y);updateHUD();draw()}
canvas.addEventListener('pointerdown',e=>{if(phase!=='ready')return;pointerAiming=true;canvas.setPointerCapture(e.pointerId);aimAtPointer(e)});
canvas.addEventListener('pointermove',e=>{if(pointerAiming)aimAtPointer(e)});
canvas.addEventListener('pointerup',e=>{pointerAiming=false;canvas.releasePointerCapture(e.pointerId)});
function loop(){if(hole&&lie==='GREEN'&&!shotAnimating)draw();requestAnimationFrame(loop)}
renderSetup();loop();
