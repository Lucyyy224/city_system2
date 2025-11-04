/* =============== 配置：分布 & 行为 =============== */
const BASE_COUNTS = { zone1: 6, zone2: 14, zone3: 28 };
const WEEKEND_MULTIPLIER = { 5: 1.5, 6: 2.0, 7: 1.8 };

const SPEED_MIN = 30, SPEED_MAX = 110;
const PAUSE_SEC = [0.8, 2.2];
const RETARGET_NEAR = 120;
const EXITS = ["top","bottom","left","right"];

const zonesSvg    = document.getElementById('zonesSvg');
const agentsLayer = document.getElementById('agentsLayer');
const dayRange    = document.getElementById('dayRange');

/* 工具函数 */
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

function getSafeRect(el, fallbackW=1366, fallbackH=768){
  if (!el) return { width: fallbackW, height: fallbackH, top:0, left:0 };
  const r = el.getBoundingClientRect();
  return { width: r.width || fallbackW, height: r.height || fallbackH, top:r.top, left:r.left };
}

function getZonePolygonsPx(){
  const rect = getSafeRect(agentsLayer);
  const W = rect.width, H = rect.height;
  const sx = W / 1366, sy = H / 768;
  return {
    zone1: [[0,0],[683*sx,0],[683*sx,384*sy],[0,384*sy]],
    zone2: [[683*sx,0],[1366*sx,0],[1366*sx,384*sy],[683*sx,384*sy]],
    zone3: [[0,384*sy],[1366*sx,384*sy],[1366*sx,768*sy],[0,768*sy]]
  };
}

function pointInPoly(p, vs){
  const x=p[0], y=p[1]; let inside=false;
  for (let i=0,j=vs.length-1;i<vs.length;j=i++){
    const xi=vs[i][0], yi=vs[i][1], xj=vs[j][0], yj=vs[j][1];
    const intersect=((yi>y)!==(yj>y))&&(x<((xj-xi)*(y-yi))/(yj-yi)+xi);
    if(intersect) inside=!inside;
  }
  return inside;
}

function randomPointInPolygon(poly){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const [x,y] of poly){ if(x<minX)minX=x; if(y<minY)minY=y; if(x>maxX)maxX=x; if(y>maxY)maxY=y; }
  for(let i=0;i<64;i++){
    const rx=minX+Math.random()*(maxX-minX);
    const ry=minY+Math.random()*(maxY-minY);
    if(pointInPoly([rx,ry],poly)) return [rx,ry];
  }
  let cx=0,cy=0; for(const [x,y] of poly){ cx+=x; cy+=y; } const n=poly.length||1;
  return [cx/n, cy/n];
}

function randomEntryPoint(){
  const polys=getZonePolygonsPx();
  return randomPointInPolygon(Math.random()<0.7 ? polys.zone3 : (Math.random()<0.5?polys.zone2:polys.zone1));
}

function exitTarget(){
  const rect = getSafeRect(agentsLayer);
  const side = EXITS[Math.floor(Math.random()*EXITS.length)];
  if(side==="top")    return [Math.random()*rect.width, -40];
  if(side==="bottom") return [Math.random()*rect.width, rect.height+40];
  if(side==="left")   return [-40, Math.random()*rect.height];
  return [rect.width+40, Math.random()*rect.height];
}

/* =============== 黑点 Agent =============== */
class Agent{
  constructor(parentEl){
    this.el = document.createElement('div');
    this.el.className = 'agent';
    (parentEl || document.body).appendChild(this.el);

    this.pos = randomEntryPoint();
    this.target = this.pickNextNear(this.pos);
    this.speed = 60;
    this.state = 'walking';
    this.resumeAt = 0;

    this.startPauseJitter();
    this.el.style.transform = `translate(${this.pos[0]}px, ${this.pos[1]}px)`;
  }

  startPauseJitter(minLead = 0.2, maxLead = 1.2){
    const dt = PAUSE_SEC[0] + Math.random()*(PAUSE_SEC[1]-PAUSE_SEC[0]);
    const lead = minLead + Math.random()*(maxLead - minLead);
    this.state = 'paused';
    this.resumeAt = performance.now()/1000 + Math.max(0.1, Math.min(dt, lead));
  }

  setSpeedByDensity(ratio){ this.speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * ratio; }

  pickNextNear(from){
    const a=Math.random()*Math.PI*2, d=Math.random()*RETARGET_NEAR;
    return [from[0]+Math.cos(a)*d, from[1]+Math.sin(a)*d];
  }

  pickNextAnywhere(){
    const polys=getZonePolygonsPx();
    const key=Math.random()<0.5?'zone3':(Math.random()<0.5?'zone2':'zone1');
    return randomPointInPolygon(polys[key]);
  }

  startPause(){
    const dt=PAUSE_SEC[0]+Math.random()*(PAUSE_SEC[1]-PAUSE_SEC[0]);
    this.state='paused';
    this.resumeAt=performance.now()/1000+dt;
  }

  decideNext(day){
    const weekend=(day>=5);
    const P = weekend ? {stay:.45, move:.45, leave:.10} : {stay:.55, move:.35, leave:.10};
    const r=Math.random();
    if(r<P.stay){ this.target=this.pickNextNear(this.pos); this.state='walking'; }
    else if(r<P.stay+P.move){ this.target=this.pickNextAnywhere(); this.state='walking'; }
    else { this.target=exitTarget(); this.state='leaving'; }
  }

  step(dt, day){
    if(this.state==='paused'){
      if((performance.now()/1000)>=this.resumeAt) this.decideNext(day);
      return;
    }
    const dx=this.target[0]-this.pos[0], dy=this.target[1]-this.pos[1];
    const dist=Math.hypot(dx,dy);
    if(dist<1){
      if(this.state==='leaving'){ this.dead=true; this.el.remove(); }
      else this.startPause();
      return;
    }
    const stepLen=Math.min(dist,this.speed*dt);
    this.pos[0]+=dx/dist*stepLen; this.pos[1]+=dy/dist*stepLen;
    this.el.style.transform=`translate(${this.pos[0]}px, ${this.pos[1]}px)`;
  }
}

/* =============== 主循环 =============== */
const agents=[];
function desiredCounts(day){
  const m=WEEKEND_MULTIPLIER[day]||1;
  return {
    zone1: Math.round(BASE_COUNTS.zone1*m),
    zone2: Math.round(BASE_COUNTS.zone2*m),
    zone3: Math.round(BASE_COUNTS.zone3*m)
  };
}
function desiredTotal(day){ const c=desiredCounts(day); return c.zone1+c.zone2+c.zone3; }
function spawnOne(){ const a=new Agent(agentsLayer); agents.push(a); }
function resetToDay(day){
  agents.forEach(a=>a.el.remove());
  agents.length=0;
  const target=desiredTotal(day);
  for(let i=0;i<target;i++) spawnOne();
}
function topUpToTarget(day, maxSpawn=6){
  const need=Math.max(0, desiredTotal(day)-agents.length);
  const n=Math.min(need, maxSpawn);
  for(let i=0;i<n;i++) spawnOne();
}
function liveZoneCounts(){
  const polys=getZonePolygonsPx();
  const cnt={zone1:0,zone2:0,zone3:0};
  for(const a of agents){
    const p=a.pos;
    if(pointInPoly(p,polys.zone1)) cnt.zone1++;
    else if(pointInPoly(p,polys.zone2)) cnt.zone2++;
    else if(pointInPoly(p,polys.zone3)) cnt.zone3++;
  }
  return cnt;
}
function updateSpeedByLiveDensity(){
  const c=liveZoneCounts();
  const total=c.zone1+c.zone2+c.zone3 || 1;
  const r1=c.zone1/total, r2=c.zone2/total, r3=c.zone3/total;
  const polys=getZonePolygonsPx();
  for(const a of agents){
    let r=0;
    if(pointInPoly(a.pos,polys.zone1)) r=r1;
    else if(pointInPoly(a.pos,polys.zone2)) r=r2;
    else if(pointInPoly(a.pos,polys.zone3)) r=r3;
    a.setSpeedByDensity(r);
  }
}

let lastTs=performance.now();
let day=(dayRange && dayRange.value) ? parseInt(dayRange.value,10) : 1;
resetToDay(day);

function tick(ts){
  const dt=(ts-lastTs)/1000; lastTs=ts;
  for(let i=agents.length-1;i>=0;i--){
    const a=agents[i]; a.step(dt, day);
    if(a.dead) agents.splice(i,1);
  }
  topUpToTarget(day);
  if(!tick._spdAt || ts - tick._spdAt > 300){
    updateSpeedByLiveDensity();
    tick._spdAt = ts;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* 滑条事件 */
if (dayRange){
  dayRange.addEventListener('input', e=>{
    day = parseInt(e.target.value,10) || 1;
    resetToDay(day);
  });
}
document.querySelectorAll('.ticks button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const d=parseInt(btn.dataset.day,10);
    if (dayRange) dayRange.value=d;
    day=d; resetToDay(day);
  });
});
