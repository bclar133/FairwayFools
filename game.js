const $=s=>document.querySelector(s);
const canvas=$('#course'),ctx=canvas.getContext('2d');
const golferImg=new Image(); golferImg.src='assets/golfers.png';
const golfers=[
 {name:'Barry Bigstick',role:'BIG HITTER',color:'#e74738',stats:{power:5,accuracy:2,short:2},desc:'Bombs away. Directions optional.'},
 {name:'Chip McGee',role:'APPROACH ACE',color:'#e7ae22',stats:{power:3,accuracy:5,short:3},desc:'Finds flags like a homing pigeon.'},
 {name:'Sandy Putterson',role:'SHORT-GAME WIZ',color:'#20a9a4',stats:{power:2,accuracy:3,short:5},desc:'Dangerous anywhere near a green.'},
 {name:'Norm Alround',role:'BALANCED',color:'#2574d2',stats:{power:4,accuracy:4,short:4},desc:'Good at golf. Terrible at nicknames.'}
];
const difficulties={easy:{label:'EASY',sub:'Relaxed',width:1.25,length:.88,green:1.28,hazards:.55,slope:.45,wind:.55},medium:{label:'MEDIUM',sub:'Club golfer',width:1,length:1,green:1,hazards:1,slope:.75,wind:.85},hard:{label:'HARD',sub:'Tour trouble',width:.72,length:1.12,green:.76,hazards:1.45,slope:1.2,wind:1.25}};
const clubs=[['Driver',245],['3 Wood',215],['4 Iron',180],['6 Iron',155],['8 Iron',130],['Pitching Wedge',100],['Sand Wedge',70],['Putter',32]];
let selectedGolfer=3,selectedDifficulty='medium',course=[],holeIndex=0,strokes=0,scores=[],ball={x:480,y:585},aim=0,club=0,phase='ready',power=0,accuracy=0,meterDir=1,animFrame,lastTime=0,hole,lie='TEE',shotAnimating=false;

function renderSetup(){
 $('#golferGrid').innerHTML=golfers.map((g,i)=>`<button class="golfer-card ${i===selectedGolfer?'selected':''}" role="radio" aria-checked="${i===selectedGolfer}" data-golfer="${i}"><div class="portrait" style="background-position-x:${i*33.333}%"></div><div class="golfer-info"><small>${g.role}</small><h3>${g.name}</h3>${statRow('POWER',g.stats.power)}${statRow('CONTROL',g.stats.accuracy)}${statRow('SHORT',g.stats.short)}</div></button>`).join('');
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
  const base=par===3?rand(125,205):par===4?rand(315,445):rand(465,560);
  const length=Math.round(base*d.length/5)*5;
  const green={x:rand(325,635),y:75,r:rand(42,61)*d.green};
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
function startRound(){course=generateCourse();scores=[];holeIndex=0;$('#setup').classList.add('hidden');$('#game').classList.remove('hidden');const g=golfers[selectedGolfer];$('#golferName').textContent=g.name;$('#golferRole').textContent=g.role;$('#miniPortrait').style.backgroundPositionX=`${selectedGolfer*33.333}%`;loadHole()}
function loadHole(){hole=course[holeIndex];ball={...hole.tee};strokes=0;lie='TEE';aim=Math.atan2(hole.green.x-ball.x,ball.y-hole.green.y);club=hole.par===3?3:0;phase='ready';power=0;accuracy=0;updateHUD();draw()}
function updateHUD(){
 $('#holeLabel').textContent=`HOLE ${holeIndex+1}`;$('#parLabel').textContent=`PAR ${hole.par}`;$('#yardLabel').textContent=`${hole.length} YDS`;$('#shotCount').textContent=strokes+1;$('#lieBadge').textContent=lie;
 const total=scores.reduce((a,s,i)=>a+s-course[i].par,0);$('#roundScore').textContent=formatScore(total);
 $('#windLabel').textContent=`${hole.wind.speed} mph`;$('#windArrow').style.transform=`rotate(${hole.wind.angle}rad)`;
 $('#clubLabel').textContent=clubs[club][0].toUpperCase();$('#distanceLabel').textContent=`${clubDistance()} yds`;$('#aimDegrees').textContent=`${Math.round(aim*180/Math.PI)}°`;
}
function clubDistance(){const g=golfers[selectedGolfer];let n=clubs[club][1];if(club<2)n*=.9+g.stats.power*.035;if(lie==='ROUGH')n*=.82;if(lie==='BUNKER')n*=.62;if(lie==='GREEN')n=Math.min(n,32);return Math.round(n)}
function formatScore(n){return n===0?'E':n>0?`+${n}`:`${n}`}
function draw(){
 ctx.clearRect(0,0,960,640);ctx.fillStyle='#266c43';ctx.fillRect(0,0,960,640);drawMow();
 hole.waters.forEach(w=>ellipse(w,'#2c9dcc','#63c4e4'));drawFairway();
 hole.bunkers.forEach(b=>ellipse(b,'#ead18e','#f7e5b5'));
 hole.trees.forEach(t=>{if(!onFairway(t.x,t.y)&&dist(t,hole.green)>hole.green.r+12){ctx.fillStyle='#163f2b';ctx.beginPath();ctx.arc(t.x+3,t.y+4,t.r,0,7);ctx.fill();ctx.fillStyle='#2f8b4c';ctx.beginPath();ctx.arc(t.x,t.y,t.r,0,7);ctx.fill()}});
 drawGreen();drawAim();drawBall();
}
function drawMow(){ctx.save();ctx.globalAlpha=.08;for(let y=0;y<640;y+=28){ctx.fillStyle=y%56?'#fff':'#000';ctx.fillRect(0,y,960,28)}ctx.restore()}
function ellipse(o,fill,shine){ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.rot||0);ctx.fillStyle=fill;ctx.beginPath();ctx.ellipse(0,0,o.rx,o.ry,0,0,7);ctx.fill();ctx.strokeStyle=shine;ctx.lineWidth=3;ctx.stroke();ctx.restore()}
function drawFairway(){ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#65b95f';ctx.lineWidth=hole.fairWidth+18;ctx.beginPath();hole.centers.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.strokeStyle='#83ce72';ctx.lineWidth=hole.fairWidth;ctx.stroke();ctx.setLineDash([12,16]);ctx.strokeStyle='rgba(255,255,255,.09)';ctx.lineWidth=hole.fairWidth*.75;ctx.stroke();ctx.setLineDash([])}
function drawGreen(){const g=hole.green;ctx.fillStyle='#9bdd73';ctx.beginPath();ctx.arc(g.x,g.y,g.r,0,7);ctx.fill();ctx.strokeStyle='#b9ef91';ctx.lineWidth=4;ctx.stroke();ctx.fillStyle='#143c29';ctx.beginPath();ctx.ellipse(g.x,g.y+3,7,3,0,0,7);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(g.x,g.y);ctx.lineTo(g.x,g.y-37);ctx.stroke();ctx.fillStyle='#ef4a3d';ctx.beginPath();ctx.moveTo(g.x,g.y-37);ctx.lineTo(g.x+23,g.y-29);ctx.lineTo(g.x,g.y-21);ctx.fill();if(lie==='GREEN'){for(let y=g.y-g.r*.55;y<g.y+g.r*.55;y+=17)for(let x=g.x-g.r*.6;x<g.x+g.r*.6;x+=22){if(dist({x,y},g)<g.r*.72)drawSlopeArrow(x,y)}}}
function drawSlopeArrow(x,y){const pulse=.55+.45*Math.sin(performance.now()/220*hole.slope.strength+x);ctx.save();ctx.translate(x,y);ctx.rotate(hole.slope.angle);ctx.globalAlpha=.25+pulse*.55;ctx.fillStyle=hole.slope.strength>.75?'#e34c3f':'#226dba';ctx.beginPath();ctx.moveTo(8,0);ctx.lineTo(-3,-5);ctx.lineTo(-3,-2);ctx.lineTo(-9,-2);ctx.lineTo(-9,2);ctx.lineTo(-3,2);ctx.lineTo(-3,5);ctx.closePath();ctx.fill();ctx.restore()}
function drawAim(){if(shotAnimating)return;const len=Math.min(180,clubDistance()*.65);ctx.save();ctx.translate(ball.x,ball.y);ctx.rotate(aim);ctx.setLineDash([9,8]);ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(0,-len);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(0,-len-10);ctx.lineTo(-7,-len+3);ctx.lineTo(7,-len+3);ctx.fill();ctx.restore()}
function drawBall(){ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.ellipse(ball.x+2,ball.y+4,7,3,0,0,7);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x,ball.y,5,0,7);ctx.fill();ctx.strokeStyle='#203629';ctx.lineWidth=1;ctx.stroke();if(!shotAnimating&&golferImg.complete){const sx=selectedGolfer*384;ctx.drawImage(golferImg,sx,333,384,691,ball.x-39,ball.y-103,58,104)}}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function onFairway(x,y){return hole.centers.some((p,i)=>i&&segmentDistance({x,y},hole.centers[i-1],p)<hole.fairWidth/2)}
function segmentDistance(p,a,b){const l2=(b.x-a.x)**2+(b.y-a.y)**2;if(!l2)return dist(p,a);let t=((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2;t=Math.max(0,Math.min(1,t));return dist(p,{x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)})}

function swing(){if(shotAnimating)return;if(phase==='ready'){phase='power';$('#swingMain').textContent='LOCK POWER';$('#swingHint').textContent='Tap near the top';meterDir=1;animateMeters()}else if(phase==='power'){phase='accuracy';$('#swingMain').textContent='HIT IT!';$('#swingHint').textContent='Stop in the centre'}else if(phase==='accuracy'){phase='flight';hitBall()}}
function animateMeters(t=0){if(phase==='ready'||phase==='flight')return;const dt=Math.min(30,t-lastTime||16);lastTime=t;if(phase==='power'){power+=meterDir*dt*.085;if(power>=100||power<=0){meterDir*=-1;power=Math.max(0,Math.min(100,power))}$('#powerFill').style.width=`${power}%`;$('#powerValue').textContent=`${Math.round(power)}%`}else{accuracy+=meterDir*dt*.13;if(accuracy>=100||accuracy<=-100){meterDir*=-1;accuracy=Math.max(-100,Math.min(100,accuracy))}$('#accuracyNeedle').style.left=`${50+accuracy*.5}%`;$('#accuracyValue').textContent=Math.abs(accuracy)<12?'PERFECT':Math.abs(accuracy)<38?'GOOD':'MISS'}animFrame=requestAnimationFrame(animateMeters)}
function hitBall(){cancelAnimationFrame(animFrame);shotAnimating=true;strokes++;const g=golfers[selectedGolfer],isPutt=lie==='GREEN';let shotYards=clubDistance()*(.42+.58*power/100);const pxPerYard=(hole.tee.y-hole.green.y)/hole.length;let d=shotYards*pxPerYard;const control=isPutt?g.stats.short:g.stats.accuracy;let miss=accuracy*(1.15-control*.13);let angle=aim+miss*Math.PI/450;const windFactor=isPutt?0:hole.wind.speed*(.26)*(1-control*.06);let tx=ball.x+Math.sin(angle)*d+Math.cos(hole.wind.angle)*windFactor;let ty=ball.y-Math.cos(angle)*d+Math.sin(hole.wind.angle)*windFactor;if(isPutt){tx+=Math.cos(hole.slope.angle)*hole.slope.strength*d*.14;ty+=Math.sin(hole.slope.angle)*hole.slope.strength*d*.14}tx=Math.max(12,Math.min(948,tx));ty=Math.max(12,Math.min(628,ty));const start={...ball},startTime=performance.now(),dur=Math.max(450,Math.min(1200,d*4));
 function flight(now){const q=Math.min(1,(now-startTime)/dur),ease=1-(1-q)*(1-q);ball.x=start.x+(tx-start.x)*ease;ball.y=start.y+(ty-start.y)*ease;draw();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ball.x,ball.y-Math.sin(Math.PI*q)*Math.min(38,d*.18),5,0,7);ctx.fill();if(q<1)requestAnimationFrame(flight);else landBall(start)}requestAnimationFrame(flight)
}
function landBall(previous){shotAnimating=false;const g=hole.green;if(dist(ball,g)<Math.max(7,g.r*.12)){ball={x:g.x,y:g.y};draw();setTimeout(finishHole,500);return}if(hole.waters.some(w=>pointInEllipse(ball,w))){ball=previous;strokes++;toast('SPLASH! +1 PENALTY')}else if(hole.bunkers.some(b=>pointInEllipse(ball,b))){lie='BUNKER';toast('BEACH DAY')}else if(dist(ball,g)<g.r){lie='GREEN';club=7;toast('ON THE GREEN')}else if(onFairway(ball.x,ball.y)){lie='FAIRWAY';toast('FAIRWAY FOUND')}else{lie='ROUGH';toast('IN THE ROUGH')}phase='ready';power=0;accuracy=0;resetMeter();autoClub();updateHUD();draw()}
function pointInEllipse(p,e){const c=Math.cos(-(e.rot||0)),s=Math.sin(-(e.rot||0)),dx=p.x-e.x,dy=p.y-e.y,x=dx*c-dy*s,y=dx*s+dy*c;return x*x/e.rx**2+y*y/e.ry**2<=1}
function autoClub(){if(lie==='GREEN')return;const remaining=dist(ball,hole.green)/((hole.tee.y-hole.green.y)/hole.length);club=clubs.findIndex(c=>c[1]<remaining+20);if(club<0)club=0}
function resetMeter(){$('#powerFill').style.width='0';$('#powerValue').textContent='0%';$('#accuracyNeedle').style.left='50%';$('#accuracyValue').textContent='READY';$('#swingMain').textContent='SWING';$('#swingHint').textContent='Tap to start power'}
let toastTimer;function toast(s){const el=$('#toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1200)}
function finishHole(){scores[holeIndex]=strokes;showScorecard()}
function showScorecard(){const rel=strokes-hole.par;$('#scoreKicker').textContent=holeIndex===17?'FINAL SCORE':`AFTER HOLE ${holeIndex+1}`;$('#scoreTitle').textContent=rel<=-2?'An eagle!':rel===-1?'Beautiful birdie!':rel===0?'Nice par!':rel===1?'Just a bogey.':rel===2?'Double trouble.':'The ball survived.';const total=scores.reduce((a,s,i)=>a+s-course[i].par,0);$('#scoreTotal').textContent=formatScore(total);$('#scoreHoles').innerHTML='<th>HOLE</th>'+course.map(h=>`<th>${h.number}</th>`).join('')+'<th>OUT</th><th>IN</th><th>TOT</th>';$('#scorePars').innerHTML='<td>PAR</td>'+course.map(h=>`<td>${h.par}</td>`).join('')+`<td>${course.slice(0,9).reduce((a,h)=>a+h.par,0)}</td><td>${course.slice(9).reduce((a,h)=>a+h.par,0)}</td><td>${course.reduce((a,h)=>a+h.par,0)}</td>`;const cells=course.map((h,i)=>{const s=scores[i];if(!s)return '<td>–</td>';const r=s-h.par,cl=r<=-2?'eagle':r===-1?'birdie':r===0?'par':'bogey';return `<td class="${i===holeIndex?'current':''}"><span class="score-cell ${cl}">${s}</span></td>`}).join('');const sum=a=>a.reduce((x,s,i)=>x+(s||0),0)||'–';$('#scoreScores').innerHTML=`<td>SCORE</td>${cells}<td>${sum(scores.slice(0,9))}</td><td>${sum(scores.slice(9))}</td><td>${sum(scores)}</td>`;$('#nextHoleBtn').innerHTML=holeIndex===17?'NEW ROUND <span>↻</span>':'NEXT HOLE <span>→</span>';$('#scoreDialog').showModal()}

function changeAim(n){if(phase==='ready'){aim+=n;updateHUD();draw()}}
function changeClub(n){if(phase!=='ready'||lie==='GREEN')return;club=Math.max(0,Math.min(6,club+n));updateHUD()}
$('#startBtn').onclick=startRound;$('#swingBtn').onclick=swing;$('#aimLeft').onclick=()=>changeAim(-.06);$('#aimRight').onclick=()=>changeAim(.06);$('#clubDown').onclick=()=>changeClub(-1);$('#clubUp').onclick=()=>changeClub(1);$('#menuBtn').onclick=()=>{if(confirm('Leave this round and return to golfer select?')){$('#game').classList.add('hidden');$('#setup').classList.remove('hidden')}};$('#nextHoleBtn').onclick=()=>{$('#scoreDialog').close();if(holeIndex===17){$('#game').classList.add('hidden');$('#setup').classList.remove('hidden')}else{holeIndex++;loadHole()}};
document.addEventListener('keydown',e=>{if($('#game').classList.contains('hidden'))return;if(e.code==='Space'){e.preventDefault();swing()}if(['ArrowLeft','KeyA'].includes(e.code))changeAim(-.045);if(['ArrowRight','KeyD'].includes(e.code))changeAim(.045);if(e.code==='ArrowUp')changeClub(-1);if(e.code==='ArrowDown')changeClub(1)});
let dragStart=null;canvas.addEventListener('pointerdown',e=>{if(phase!=='ready')return;dragStart={x:e.clientX,y:e.clientY,aim}});canvas.addEventListener('pointermove',e=>{if(!dragStart)return;aim=dragStart.aim+(e.clientX-dragStart.x)*.006;updateHUD();draw()});canvas.addEventListener('pointerup',()=>dragStart=null);
function loop(){if(hole&&lie==='GREEN'&&!shotAnimating)draw();requestAnimationFrame(loop)}
renderSetup();loop();
