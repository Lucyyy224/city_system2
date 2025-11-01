/* ===== 人数配置 & 素材 ===== */
const ZONES = [{id:1,count:10},{id:2,count:25},{id:3,count:50}];
const PEOPLE_SOURCES = [
  "assets/i1.png","assets/i2.png","assets/i3.png",
  "assets/i4.png","assets/i5.png","assets/i6.png",
  "assets/i7.png","assets/i8.png","assets/i9.png"
];

const rand=(a,b)=>Math.random()*(b-a)+a;
const pick=arr=>arr[Math.floor(Math.random()*arr.length)];

/* ===== 生成面板人物（大幅度尺寸/错落） ===== */
function populatePanel(panelEl, count){
  panelEl.innerHTML="";
  const w = panelEl.clientWidth || innerWidth;
  for(let i=0;i<count;i++){
    const el=document.createElement("div");
    el.className="person bob";
    el.style.transform=`scale(${rand(0.6,1.6)})`;
    el.style.left=`${rand(40,w-80)}px`;
    el.style.bottom=`${rand(0,60)}px`;
    el.style.setProperty("--delay",`${rand(0,4).toFixed(2)}s`);
    const img=document.createElement("img");
    img.src=pick(PEOPLE_SOURCES); img.alt="person";
    img.decoding="async"; img.loading="lazy";
    el.appendChild(img); panelEl.appendChild(el);
  }
}

function initPeople(){
  document.querySelectorAll(".people-strip .panel")
    .forEach((p,idx)=>populatePanel(p, ZONES[idx].count));
}

/* ===== 居中 HUD 显隐 & 文案联动 + 人群横移 ===== */
function initScrollSync(){
  const strip=document.getElementById("peopleStrip");
  const titleEl=document.getElementById("hudTitle");
  const textEl=document.getElementById("hudText");
  const zoneScreens=document.querySelectorAll("section.screen[data-zone]");
  const introSection=document.querySelector("section.intro");

  const introHUD=document.querySelector(".introHUD"); // Intro 固定层
  const zoneHUD=document.querySelector(".zoneHUD");   // Zone 固定层

  // 当 Intro 显著可见（≥60%）时：显示 Intro，隐藏 ZoneHUD，并把人群归位
  const ioIntro = new IntersectionObserver((entries)=>{
    const e = entries[0];
    if(e.isIntersecting){
      introHUD.classList.remove("is-hidden");
      zoneHUD.classList.add("is-hidden");
      strip.style.transform = `translateX(0)`;
    }
  },{threshold:[0.6]});
  ioIntro.observe(introSection);

  // 当任一 Zone 进入视野（≥25%）时：隐藏 Intro，显示 ZoneHUD，并同步内容与人群横移
  const ioZones = new IntersectionObserver((entries)=>{
    const vis = entries
      .filter(e=>e.isIntersecting)
      .sort((a,b)=>b.intersectionRatio - a.intersectionRatio)[0];

    if(!vis) return;

    const zone = parseInt(vis.target.dataset.zone,10);

    introHUD.classList.add("is-hidden");
    zoneHUD.classList.remove("is-hidden");

    titleEl.textContent = vis.target.dataset.title || `ZONE${zone}`;
    textEl.textContent  = vis.target.dataset.text  || "";

    strip.style.transform = `translateX(${(zone-1)*-100}vw)`;
  },{threshold:[0.25,0.5,0.75]});

  zoneScreens.forEach(s=>ioZones.observe(s));
}

/* ===== 启动 ===== */
addEventListener("load", ()=>{
  initPeople();
  initScrollSync();
  let t=null;
  addEventListener("resize", ()=>{ clearTimeout(t); t=setTimeout(initPeople,150); });
});
