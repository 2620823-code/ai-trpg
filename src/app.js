(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DATA = window.AITRPG_DATA || {};
  const KEY = "ai-trpg-prototype-v06";
  const OLD = ["ai-trpg-prototype-v05", "ai-trpg-prototype-v04", "ai-trpg-prototype-v03", "ai-trpg-prototype-v02", "ai-trpg-prototype-v01"];
  const defaults = {
    name: "이름 없는 모험가", character: null, actions: [], day: 1,
    position: "바텀웨이마을 광장", region: "village", gold: 200,
    inventory: [], npcStats: {}, forestSteps: 0, nextForestAppleStep: null,
    librarySteps: 0, groundItems: [], activeEncounter: null,
    quests: { "book-mimic-hunt": { status: "available", defeated: 0, rewarded: false } },
    worldX: 800, worldY: 510
  };
  function readState() {
    try {
      for (const key of [KEY, KEY+"-backup", ...OLD]) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const saved = JSON.parse(raw);
        if (saved && typeof saved === "object") return {
          ...defaults, ...saved,
          inventory: Array.isArray(saved.inventory) ? saved.inventory : [],
          actions: Array.isArray(saved.actions) ? saved.actions : [],
          groundItems: Array.isArray(saved.groundItems) ? saved.groundItems : [],
          npcStats: saved.npcStats || {},
          quests: { ...defaults.quests, ...(saved.quests || {}) },
          worldX: Number.isFinite(saved.worldX) ? saved.worldX : 800,
          worldY: Number.isFinite(saved.worldY) ? saved.worldY : 510
        };
      }
    } catch (error) { console.warn("저장 기록을 읽지 못했습니다.", error); }
    return { ...defaults };
  }
  const state = readState();
  const scene = $("scene"), canvas = $("worldCanvas"), hero = $("heroStage");
  const modal = $("modal"), modalContent = $("modalContent");
  const dialogueScreen = $("dialogueScreen");
  let currentNpc = null, dialogueHistory = [], pendingCharacter = null, moveTimer = null;
  const npcWanderOffsets = {};
  let npcWanderTimer = null;
  const facilities = Array.isArray(DATA.facilities) ? DATA.facilities : [];
  const npcs = Array.isArray(DATA.npcs) ? DATA.npcs : [];
  const npcPositions = {
    denby:[1315,610], hamel:[190,730], billy:[1410,290], fonta:[1490,330],
    gale:[1000,300], bell:[490,260], yon:[550,330], cheorkol:[1370,580]
  };
  const facilityPositions = {
    shop:[1325,605], library:[200,730], sanctuary:[1450,300], training:[1010,280], guild:[480,250]
  };
  const facilityTitle = (id) => (facilities.find((f) => f.id === id) || {}).name || id;
  const roll = (max) => Math.floor(Math.random() * max) + 1;
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function save() {
    try {
      const snapshot=JSON.stringify(state);
      localStorage.setItem(KEY,snapshot);
      if(state.character)localStorage.setItem(KEY+"-backup",snapshot);
      $("saveState").textContent = "● 자동 저장됨";
    } catch { $("saveState").textContent = "저장 공간 부족"; }
  }
  function record(type, detail) {
    const entry = { at:new Date().toISOString(), day:state.day, type, detail, place:state.position, region:state.region };
    state.actions.push(entry); if (state.actions.length > 500) state.actions.shift();
    const row = document.createElement("article"); row.className = "log-entry";
    const time = document.createElement("time"); time.textContent = "1876년 · " + state.day + "일차 · " + type;
    const p = document.createElement("p"); p.textContent = detail; row.append(time,p);
    $("logList").prepend(row); save();
  }
  function notify(text) {
    const box = $("locationNotice"); box.textContent = text; box.classList.add("show");
    clearTimeout(box._timer); box._timer = setTimeout(() => box.classList.remove("show"), 1900);
  }
  function message(caption, gm = caption) { $("sceneCaption").textContent = caption; $("gmText").textContent = gm; }
  function openModal(title, html) { modalContent.innerHTML = "<h2>" + escape(title) + "</h2>" + html; modal.hidden = false; }
  function closeModal() { modal.hidden = true; }

  function baseStats() {
    const rules = DATA.statRules || {};
    const hpRoll = roll((rules.hp && rules.hp.dice) || 250);
    const stats = {
      hp:Math.max((rules.hp && rules.hp.floor) || 150, hpRoll),
      strength:roll((rules.strength && rules.strength.dice) || 50),
      intelligence:roll((rules.intelligence && rules.intelligence.dice) || 50),
      defense:roll((rules.defense && rules.defense.dice) || 50),
      luck:roll((rules.luck && rules.luck.dice) || 25),
      speed:roll((rules.speed && rules.speed.dice) || 30),
      precision:roll((rules.precision && rules.precision.dice) || 40),
      sp:(rules.sp && rules.sp.start) || 25,
      rolls:{hp:hpRoll}
    };
    stats.maxHp = stats.hp; stats.maxSp = stats.sp; return stats;
  }
  function applyRace(stats, raceId) {
    const race = (DATA.races || []).find((x) => x.id === raceId);
    const bonus = race && race.bonus || {};
    for (const key of ["hp","strength","intelligence","speed"]) if (bonus[key]) stats[key] += bonus[key];
    stats.maxHp = stats.hp; return stats;
  }
  function statsHtml(s) {
    return "<div class='table-wrap'><table><tbody>" + [
      ["HP",s.hp+" / "+s.maxHp],["근력",s.strength],["지능",s.intelligence],["방어력",s.defense],
      ["행운",s.luck],["속도",s.speed],["정교함",s.precision],["SP",s.sp+" / "+s.maxSp]
    ].map(([k,v])=>"<tr><th>"+k+"</th><td>"+v+"</td></tr>").join("") + "</tbody></table></div>";
  }
  function requiredLp(level){return Math.max(1,level)*50;}
  function grantLp(amount,reason){
    const c=state.character;if(!c||c.dead)return;
    c.lp=(c.lp||0)+amount;let gained=0;
    while(c.level<10000&&c.lp>=(c.nextLp||requiredLp(c.level))){c.lp-=c.nextLp||requiredLp(c.level);c.level++;c.statPoints=(c.statPoints||0)+1;gained++;c.nextLp=requiredLp(c.level);}
    c.exp=c.lp;c.nextExp=c.nextLp;
    record("LP 획득",reason+" · "+amount+" LP"+(gained?" · 레벨 "+c.level+" 상승":""));save();renderCharacter();
  }
  function renderCharacter() {
    const c = state.character;
    $("heroName").textContent = c ? c.name : state.name;
    document.querySelector(".character-name span").textContent = c ? c.raceName + " · " + c.jobName : "캐릭터 생성 필요";
    document.querySelector(".level-row").innerHTML = c ? "<span>LEVEL "+c.level+"</span><span>LP "+(c.lp||0)+" / "+(c.nextLp||requiredLp(c.level))+"</span>" : "<span>LEVEL —</span><span>EXP —</span>";
    document.querySelector(".stat-list").innerHTML = c ?
      "<div><span>HP</span><b>"+c.hp+" / "+c.maxHp+"</b></div><div class='meter hp'><i style='width:"+(100*c.hp/c.maxHp)+"%'></i></div>"+
      "<div><span>SP</span><b>"+c.sp+" / "+c.maxSp+"</b></div><div class='meter sp'><i style='width:"+(100*c.sp/c.maxSp)+"%'></i></div>"+
      "<div class='stat-grid'><span>근력 <b>"+c.strength+"</b></span><span>지능 <b>"+c.intelligence+"</b></span><span>방어력 <b>"+c.defense+"</b></span><span>속도 <b>"+c.speed+"</b></span><span>행운 <b>"+c.luck+"</b></span><span>정교함 <b>"+c.precision+"</b></span></div><p class='muted'>보유 골드 "+state.gold+"G</p>" : "<p class='muted'>캐릭터를 생성하면 능력치가 표시됩니다.</p>";
  }
  function characterForm() {
    const races = (DATA.races || []).map((r)=>"<option value='"+escape(r.id)+"'>"+escape(r.name)+"</option>").join("");
    const jobs = (DATA.jobs || []).map((j)=>"<option value='"+escape(j.id)+"'>"+escape(j.name)+"</option>").join("");
    openModal("새 캐릭터 생성", "<p>종족과 직업을 선택하면 확정된 주사위 규칙으로 능력치를 생성합니다. 시작 골드는 200G입니다.</p>"+
      "<label>이름</label><input id='charName' maxlength='20' value='이름 없는 모험가'><label>종족</label><select id='charRace'>"+races+"</select><label>직업</label><select id='charJob'>"+jobs+"</select>"+
      "<div id='rollPreview'><p class='muted'>능력치 주사위를 굴려 주세요.</p></div><button class='primary-modal' id='rollChar'>주사위 굴리기</button><button class='primary-modal' id='saveChar' disabled>캐릭터 생성</button>");
    pendingCharacter = null;
  }
  function rollCharacter() {
    const name = $("charName").value.trim() || "이름 없는 모험가";
    const raceId = $("charRace").value, jobId = $("charJob").value;
    const stats = applyRace(baseStats(), raceId);
    const race = DATA.races.find((r)=>r.id===raceId), job = DATA.jobs.find((j)=>j.id===jobId);
    pendingCharacter = {...stats,name,raceId,raceName:race.name,jobId,jobName:job.name,level:1,lp:0,nextLp:50,statPoints:0,exp:0,nextExp:50,skills:["이판사판"],equippedSkills:["이판사판"],inventory:[],equipment:{weapon:null,armor:null},guild:{joined:false,rank:0},training:{gauge:0,turns:0,braveDashCount:0},dead:false};
    $("rollPreview").innerHTML = statsHtml(pendingCharacter); $("saveChar").disabled = false;
  }
  function saveCharacter() {
    if (!pendingCharacter) return;
    pendingCharacter.name = $("charName").value.trim() || "이름 없는 모험가";
    state.character = pendingCharacter; state.name = pendingCharacter.name; state.gold = 200; state.guildJoined=false;
    state.position = "바텀웨이마을 광장"; state.region = "village"; state.worldX = 800; state.worldY = 510;
    state.day = 1; state.inventory = []; state.activeEncounter = null;
    closeModal(); renderCharacter(); renderWorld(); record("캐릭터 생성", state.name+" · "+pendingCharacter.raceName+" · "+pendingCharacter.jobName+" · 시작 골드 200G");
  }

  function renderMapCamera() {
    const rect = scene.getBoundingClientRect();
    const scale = Math.min(rect.width/1600, rect.height/900);
    const width = 1600*scale, height=900*scale;
    const x = Math.min(0, Math.max(rect.width-width, rect.width/2 - state.worldX*scale));
    const y = Math.min(0, Math.max(rect.height-height, rect.height/2 - state.worldY*scale));
    canvas.style.transform = "translate("+(x+(rect.width-width)/2)+"px,"+(y+(rect.height-height)/2)+"px) scale("+scale+")";
    hero.style.left = state.worldX+"px"; hero.style.top = state.worldY+"px";
    $("miniPlayerDot").setAttribute("cx", String(10 + state.worldX/1600*200));
    $("miniPlayerDot").setAttribute("cy", String(8 + state.worldY/900*116));
  }
  function actorPosition(npc, index, list) {
    if (state.region.startsWith("facility-")) return [800 + (index-(list.length-1)/2)*180, 565];
    return npcPositions[npc.id] || [800,480];
  }
  function renderActors() {
    const layer = $("npcLayer"), hot = $("facilityHotspots");
    const inside = state.region.startsWith("facility-");
    const fid = inside ? state.region.slice(9) : null;
    let shown = state.region === "forest" ? [] : npcs.filter((n)=>!inside || n.facility === facilityTitle(fid));
    if (inside && fid === "sanctuary") shown = npcs.filter((n)=>["billy","fonta"].includes(n.id));
    if (inside && fid === "guild") shown = npcs.filter((n)=>["bell","yon","cheorkol"].includes(n.id));
    layer.innerHTML = shown.map((npc,i)=>{
      const [x,y] = actorPosition(npc,i,shown);
      return "<button class='npc-actor' data-npc='"+escape(npc.id)+"' data-base-x='"+x+"' data-base-y='"+y+"' style='left:"+x+"px;top:"+y+"px' title='"+escape(npc.name)+"과 대화'>"+
        "<span class='npc-bubble'>…</span><svg class='npc-sprite npc-sprite-"+escape(npc.id)+"' viewBox='0 0 110 150' role='img' aria-label='"+escape(npc.name)+"'><use href='./assets/scene-kit.svg#npc-"+escape(npc.id)+"' xlink:href='./assets/scene-kit.svg#npc-"+escape(npc.id)+"'/></svg><span class='npc-nameplate'>"+escape(npc.name)+"</span></button>";
    }).join("");
    if (inside) {
      hot.innerHTML = "<div class='interior-actions'><b>"+escape(facilityTitle(fid))+" 내부</b><button id='useFacilityBtn'>시설 이용</button><button id='exitFacilityBtn'>마을로 나가기</button></div>";
    } else if (state.region === "village") {
      hot.innerHTML = facilities.map((f)=>{
        const [x,y] = facilityPositions[f.id] || [800,300];
        return "<button class='facility-hotspot' data-facility='"+escape(f.id)+"' style='left:"+x+"px;top:"+y+"px'>"+({shop:"✦",library:"▤",sanctuary:"☼",training:"⚔",guild:"⌂"}[f.id]||"⌂")+" "+escape(f.name)+"</button>";
      }).join("");
    } else hot.innerHTML = "";
  }
  function wanderNpcs() {
    if (state.region === "forest") return;
    document.querySelectorAll(".npc-actor").forEach((actor) => {
      const baseX = Number(actor.dataset.baseX || 800), baseY = Number(actor.dataset.baseY || 500);
      const dx = Math.round((Math.random() - 0.5) * 34);
      const dy = Math.round((Math.random() - 0.5) * 18);
      actor.classList.add("npc-walking");
      actor.style.left = (baseX + dx) + "px";
      actor.style.top = (baseY + dy) + "px";
      window.setTimeout(() => actor.classList.remove("npc-walking"), 850);
    });
  }
  function renderWorldItems() {
    const here = state.region;
    $("worldItems").innerHTML = state.groundItems.filter((i)=>i.location===here).map((item,i)=>{
      const x = Number.isFinite(item.worldX) ? item.worldX : 790+i*75;
      const y = Number.isFinite(item.worldY) ? item.worldY : 545;
      return "<button class='world-item' data-pickup='"+escape(item.instanceId)+"' style='left:"+x+"px;top:"+y+"px'><span class='apple-art'>🍎</span><span>큰사과 줍기</span></button>";
    }).join("");
  }
  function setRegion(region) {
    state.region = region;
    if (region === "village") {
      state.position = "바텀웨이마을 광장"; state.worldX=800; state.worldY=510;
      $("sceneArtUse").setAttribute("href", "./assets/scene-kit.svg#town-map");
      $("sceneArtUse").setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "./assets/scene-kit.svg#town-map");
      $("sceneBg").setAttribute("aria-label", "바텀웨이마을");
    } else if (region === "forest") {
      state.position = "바텀웨이 숲"; state.worldX=800; state.worldY=510;
      $("sceneArtUse").setAttribute("href", "./assets/scene-kit.svg#forest-map");
      $("sceneArtUse").setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "./assets/scene-kit.svg#forest-map");
      $("sceneBg").setAttribute("aria-label", "바텀웨이 숲");
    } else if (region.startsWith("facility-")) {
      const id = region.slice(9); state.position = facilityTitle(id)+" 내부";
      $("sceneArtUse").setAttribute("href", "./assets/scene-kit.svg#interior-"+id);
      $("sceneArtUse").setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "./assets/scene-kit.svg#interior-"+id);
      $("sceneBg").setAttribute("aria-label", facilityTitle(id)+" 내부");
    }
    const title = document.querySelector(".scene-title");
    title.style.display = region.startsWith("facility-") ? "none" : "block";
    document.querySelector(".scene-title h1").textContent = region === "forest" ? "바텀웨이 숲" : "바텀웨이마을";
    document.querySelector(".scene-title p").textContent = region === "forest" ? "마을 외곽 탐험 지역" : "모험가의 첫걸음이 시작되는 곳";
    $("worldName").textContent = region.startsWith("facility-") ? state.position : (region === "forest" ? "바텀웨이 숲" : "바텀웨이마을");
    $("miniLocation").textContent = $("worldName").textContent;
    $("forestBtn").innerHTML = region === "forest" ? "<span>⌂</span> 마을 복귀" : "<span>♧</span> 숲 탐험";
    renderWorld();
    message(region === "forest" ? "바텀웨이 숲에 들어왔습니다. 방향키나 WASD로 자유롭게 탐험하세요." : region.startsWith("facility-") ? state.position+"에 들어왔습니다." : "바텀웨이마을 광장입니다. NPC 또는 건물 표지를 선택하세요.",
      region === "forest" ? "50발자국마다 1d100 조우 판정. 40 이하이면 마물이 출현합니다." : "NPC에 가까이 가서 E 키를 누르거나 캐릭터를 직접 클릭해 대화할 수 있습니다.");
    save();
  }
  function renderWorld() {
    renderActors(); renderWorldItems(); renderMapCamera(); updateForestHud(); renderCharacter();
  }
  function updateForestHud() {
    const remaining = 50 - (state.forestSteps % 50);
    $("forestProgress").textContent = state.region === "forest" ? "조우 판정까지 "+remaining+"발자국 · 누적 "+state.forestSteps : "숲에서 50발자국마다 조우 판정";
    const q = state.quests["book-mimic-hunt"] || {defeated:0};
    const questText = document.querySelector(".quest-card small");
    if (questText) questText.textContent = "책의 미믹 3마리 처치 · "+(q.defeated||0)+" / 3";
  }

  function nearestNpc() {
    const inside = state.region.startsWith("facility-"), fid = inside ? state.region.slice(9) : null;
    let list = inside ? npcs.filter((n)=>n.facility===facilityTitle(fid)) : npcs.filter((n)=>npcPositions[n.id]);
    if (inside && fid === "sanctuary") list=npcs.filter(n=>["billy","fonta"].includes(n.id));
    if (inside && fid === "guild") list=npcs.filter(n=>["bell","yon","cheorkol"].includes(n.id));
    let best=null;
    list.forEach((npc,i)=>{ const [x,y]=actorPosition(npc,i,list); const d=Math.hypot(state.worldX-x,state.worldY-y); if(!best||d<best.distance) best={npc,distance:d}; });
    return best;
  }
  function nearestFacility() {
    if (state.region !== "village") return null;
    let best=null;
    facilities.forEach((f)=>{const [x,y]=facilityPositions[f.id]||[800,300];const d=Math.hypot(state.worldX-x,state.worldY-y);if(!best||d<best.distance)best={facility:f,distance:d};});
    return best;
  }

  const directions={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
  function move(direction) {
    if (!directions[direction] || state.activeEncounter || !dialogueScreen.hidden || !modal.hidden) return;
    const [dx,dy]=directions[direction], step=state.region==="forest"?42:38;
    state.worldX=Math.max(55,Math.min(1540,state.worldX+dx*step));
    state.worldY=Math.max(100,Math.min(860,state.worldY+dy*step));
    hero.classList.toggle("face-left",direction==="left");hero.classList.toggle("face-right",direction==="right");
    hero.classList.add("walking");clearTimeout(moveTimer);moveTimer=setTimeout(()=>hero.classList.remove("walking"),260);
    renderMapCamera();
    if(state.region==="forest") processForestStep();
    else if(state.region==="facility-library") processLibraryStep();
    else {
      const f=nearestFacility(),n=nearestNpc();
      if(state.region==="village"&&f&&f.distance<135) message(f.facility.name+" 입구에 가까이 왔습니다. E 키로 입장하세요.");
      else if(n&&n.distance<150) message(n.npc.name+"에게 가까이 왔습니다. E 키로 대화하세요.");
      else message("이동했습니다. 방향키로 주변을 더 둘러보세요.");
      record("이동",state.position+" 안에서 "+direction+" 방향으로 이동했다.");
    }
    renderActors();renderWorldItems();updateForestHud();save();
  }
  let heldDirection = null, heldMoveTimer = null;
  function startMoving(direction) {
    stopMoving(); heldDirection = direction; move(direction);
    heldMoveTimer = window.setInterval(() => { if (heldDirection) move(heldDirection); }, 145);
  }
  function stopMoving() { heldDirection = null; if (heldMoveTimer) window.clearInterval(heldMoveTimer); heldMoveTimer = null; }

  function scheduleApple() {
    if(state.nextForestAppleStep==null && !state.groundItems.some(x=>x.id==="big-apple"&&x.location==="forest")) {
      const cfg=(DATA.forestItems&&DATA.forestItems.bigApple)||{spawnStepMin:1,spawnStepMax:120};
      state.nextForestAppleStep=state.forestSteps+roll(Math.max(1,cfg.spawnStepMax-cfg.spawnStepMin+1))+cfg.spawnStepMin-1;
    }
  }
  function addGround(item,location) {
    state.groundItems.push({...item,instanceId:Date.now()+"-"+Math.random().toString(36).slice(2),location,worldX:state.worldX+72,worldY:state.worldY+20});
  }
  function processLibraryStep(){
    state.librarySteps=(state.librarySteps||0)+1;
    if(state.librarySteps%50!==0)return;
    const d=roll(100);record("도서관 미믹 조우 판정","1d100 = "+d+" · 출현 조건 40 이하");
    if(d<=40){const m=DATA.monsters.find(x=>x.id==="book-mimic"),base=DATA.monsters.find(x=>x.id==="weak-mimic");if(m&&base){const monster={...base,...m,stats:{...base.stats}};state.activeEncounter={monsterId:m.id,location:"library",hp:base.stats.hp,maxHp:base.stats.hp,turn:0};save();if(monster.stats.speed>(state.character.speed||0))monsterAttack(monster);else showEncounter(monster);}}
  }
  function processForestStep() {
    state.forestSteps++;
    scheduleApple();
    if(state.nextForestAppleStep!=null&&state.forestSteps>=state.nextForestAppleStep) {
      const cfg=(DATA.forestItems&&DATA.forestItems.bigApple)||{id:"big-apple",name:"큰사과",type:"consumable"};
      addGround({id:cfg.id||"big-apple",name:cfg.name||"큰사과",type:cfg.type||"consumable"},"forest");
      state.nextForestAppleStep=null;record("아이템 발견","숲에서 큰사과를 발견했다.");notify("숲에서 큰사과 발견!");
    }
    if(state.forestSteps%50===0) encounterRoll();
    else message("숲길을 따라 이동했습니다. 누적 "+state.forestSteps+"발자국.","마물 조우 판정은 50발자국마다 진행됩니다. 다음 판정까지 "+(50-state.forestSteps%50)+"발자국.");
    renderWorldItems();updateForestHud();save();
  }
  function chooseMonster() {
    const pool=(DATA.encounters&&DATA.encounters.forest&&DATA.encounters.forest.pool)||[];
    const entries=pool.map(id=>{
      const mon=(DATA.monsters||[]).find(x=>x.id===id); if(!mon)return null;
      if(mon.variantOf){const base=DATA.monsters.find(x=>x.id===mon.variantOf);return base?{...base,...mon,stats:{...base.stats}}:null;}
      return mon;
    }).filter(Boolean);
    const total=entries.reduce((sum,m)=>sum+(m.spawnWeight||1),0); if(!total)return null;
    let v=Math.random()*total;for(const m of entries){v-=m.spawnWeight||1;if(v<0)return m;}return entries[entries.length-1];
  }
  function encounterRoll() {
    const d=roll(100);record("숲 조우 판정","1d100 = "+d+" · 출현 조건 40 이하 · "+(d<=40?"출현":"미출현"));
    if(d<=40){const monster=chooseMonster();if(monster){state.activeEncounter={monsterId:monster.id,location:"forest",hp:monster.stats.hp,maxHp:monster.stats.hp,turn:0};save();if(monster.stats.speed>(state.character.speed||0))monsterAttack(monster);else showEncounter(monster);}}
    else {message("이번에는 마물이 나타나지 않았습니다.","조우 주사위 1d100 = "+d+" · 40 이하 출현");notify("마물이 나타나지 않았다");}
  }
  function showEncounter(monster) {
    const s=monster.stats||{},e=state.activeEncounter;
    if(!e)return;
    if(!Number.isFinite(e.hp))e.hp=s.hp;
    if(!e.maxHp)e.maxHp=s.hp;
    const c=state.character;
    openModal("전투 · "+escape(monster.name),"<div class='encounter-scene'><b>"+escape(monster.name)+"이(가) 나타났다!</b><p>마물의 남은 HP "+e.hp+" / "+e.maxHp+"</p></div>"+
      "<div class='monster-stats'><span>근력 "+s.strength+"</span><span>지능 "+s.intelligence+"</span><span>방어력 "+s.defense+"</span><span>속도 "+s.speed+"</span></div>"+
      "<p>플레이어 HP "+c.hp+"/"+c.maxHp+" · SP "+c.sp+"/"+c.maxSp+"</p>"+
      "<button class='primary-modal' id='battleAttack'>기본 공격</button><button class='primary-modal' id='battleSkill'>스킬</button><button class='primary-modal' id='battleEscape'>도주</button>");
  }
  function currentMonster(){
    const e=state.activeEncounter;if(!e)return null;
    const x=(DATA.monsters||[]).find(m=>m.id===e.monsterId);if(!x)return null;
    if(x.variantOf){const base=DATA.monsters.find(m=>m.id===x.variantOf);return base?{...base,...x,stats:{...base.stats}}:x;}return x;
  }
  function weaponBonus(){const w=state.character?.equipment?.weapon;return w?Number(w.bonus||0):0;}
  function monsterAttack(monster){
    const c=state.character,e=state.activeEncounter;if(!c||!e)return;
    const skills={
      "weak-goblin":{name:"돌진",damage:monster.stats.strength*1.2},
      "weak-spider":{name:"물기",damage:monster.stats.strength*1.5},
      "goblin":{name:"펀치",damage:monster.stats.strength*1.6},
      "treasure-mimic":{name:"염력",damage:(monster.stats.strength+monster.stats.intelligence)*1.9},
      "book-mimic":{name:"염력",damage:(monster.stats.strength+monster.stats.intelligence)*1.9}
    };
    const skill=skills[monster.id]||{name:"공격",damage:monster.stats.strength};
    const hit=roll(100),def=roll(100),hitOK=hit<=55,defLimit=50+(c.defense||0)/4,defOK=def<=defLimit;
    const damage=hitOK?Math.floor(skill.damage*(defOK?0.25:1)):0;
    c.hp=Math.max(0,c.hp-damage);e.turn=(e.turn||0)+1;
    record("마물 공격",skill.name+" · 명중 1d100="+hit+" (55 이하) · 방어 1d100="+def+" (기준 "+defLimit+") · 피해 "+damage);
    if(c.hp<=0){c.dead=true;c.hp=0;state.activeEncounter=null;save();renderCharacter();openModal("사망","<p>보유 아이템은 유지됩니다. 성소에서 200G를 지불해야 부활할 수 있습니다.</p>");message("캐릭터 사망","아이템과 레벨은 유지됩니다. 부활 비용은 200G입니다.");return;}
    save();renderCharacter();showEncounter(monster);
  }
  function finishMonster(monster){
    const c=state.character,e=state.activeEncounter;if(!e)return;
    const tables={
      "weak-goblin":["약골 고블린의 손톱","약골 고블린의 이빨","약골 고블린의 고기"],
      "weak-spider":["약골 거미의 다리","약골 거미의 눈","약골 거미의 심장"],
      "goblin":["고블린의 발톱","고블린의 낡은 옷","고블린의 고기"],
      "treasure-mimic":["미믹의 혀","미믹의 핵","미믹의 금화"],
      "book-mimic":["미믹의 혀","미믹의 핵","미믹의 금화"]
    };
    const luck=Math.floor((c.luck||0)/5),d=roll(100),hi=1+luck,mid=40+luck,low=90+luck;
    const tier=d<=hi?2:d<=mid?1:d<=low?0:-1,loot=tables[monster.id];
    let found="전리품 없음";
    if(tier>=0&&loot){found=loot[tier];addItem({id:"loot-"+monster.id+"-"+tier,name:found,type:"마물 유해",quality:["저급","중급","고급"][tier]});}
    if(monster.id==="book-mimic"){
      const q=state.quests["book-mimic-hunt"];q.defeated=(q.defeated||0)+1;
      if(q.defeated>=3&&!q.rewarded){q.rewarded=true;state.gold+=20;addItem({id:"skill-book",name:"스킬북",type:"서적"});grantLp(10,"도서관 의뢰 성공");record("의뢰 완료","책의 미믹 3마리 처치 · 20G, 스킬북, 10 LP 획득");}
    }
    state.activeEncounter=null;grantLp(5,"마물 "+monster.name+" 처치");
    record("전리품 판정","1d100="+d+" · "+found);save();closeModal();renderCharacter();
    message(monster.name+" 처치","5 LP 획득 · 전리품: "+found);
  }
  function battleAction(action){
    const monster=currentMonster(),c=state.character,e=state.activeEncounter;if(!monster||!c)return;
    if(action!=="skill"){const before=c.sp;c.sp=Math.min(c.maxSp||25,(c.sp||0)+1);if(c.sp!==before)record("SP 회복","턴 회복 +1 SP · "+before+" → "+c.sp);}
    if(action==="escape"){
      const ok=c.speed>monster.stats.speed?true:c.speed<monster.stats.speed?false:roll(100)<=50;
      record("도주 판정","플레이어 속도 "+c.speed+" · 마물 속도 "+monster.stats.speed+" · "+(ok?"성공":"실패"));
      if(ok){state.activeEncounter=null;save();closeModal();message("도주 성공","마물에게서 벗어났습니다.");return;}
      monsterAttack(monster);return;
    }
    if(action==="skill"){
      openModal("스킬 선택","<p>현재 보유 스킬: "+(c.skills||[]).join(" · ")+"</p><p>스킬별 피해 공식과 SP 비용은 확인된 기술 데이터에 연결할 예정입니다. 현재 기본 공격을 사용할 수 있습니다.</p><button class='primary-modal' id='battleBack'>전투로 돌아가기</button>");return;
    }
    const hit=roll(100),hitOK=hit<=55;
    if(hitOK){
      const def=roll(100),limit=50+(monster.stats.defense||0)/4,defOK=def<=limit;
      let damage=Math.floor(((c.strength||0)+weaponBonus())*(defOK?0.25:1));
      const crit=roll(100),critical=crit<=20;if(critical)damage=Math.floor(damage*1.25);
      e.hp=Math.max(0,e.hp-damage);
      const w=c.equipment&&c.equipment.weapon;
      if(w){w.pp=Math.max(0,(w.pp||0)-1);if(w.pp===0){c.equipment.weapon=null;record("무기 파괴",w.name+" PP가 0이 되어 파괴되었습니다.");}}
      record("플레이어 공격","명중 1d100="+hit+" (55 이하) · 마물 방어 1d100="+def+" (기준 "+limit+") · 크리티컬 1d100="+crit+" (20 이하) · "+(critical?"치명타 · ":"")+"피해 "+damage);
    }else record("플레이어 공격","명중 1d100="+hit+" (55 이하) · 빗나감 · 무기 PP 감소 없음");
    if(e.hp<=0){finishMonster(monster);return;}
    monsterAttack(monster);
  }
  function leaveEncounter(){battleAction("escape");}

  function addItem(item) {
    if(state.inventory.length>=30){notify("가방이 가득 찼습니다.");return false;}
    state.inventory.push({...item,instanceId:Date.now()+"-"+Math.random().toString(36).slice(2)});save();return true;
  }
  function pickup(instanceId) {
    const idx=state.groundItems.findIndex(i=>i.instanceId===instanceId);if(idx<0)return;
    const item=state.groundItems[idx];if(!addItem(item)){openModal("가방이 가득 참","<p>인벤토리 30칸이 모두 찼습니다.</p>");return;}
    state.groundItems.splice(idx,1);
    if(item.id==="big-apple"){scheduleApple();record("아이템 획득","큰사과를 획득했다.");}
    renderWorldItems();renderCharacter();notify(item.name+" 획득");
  }

  function enterFacility(id) {
    if(!state.character){characterForm();return;}
    if(!facilities.some(f=>f.id===id))return;
    if(id==="library"&&!(state.character.guild&&state.character.guild.joined)){if(state.gold<20){notify("도서관 입장료 20G가 부족합니다.");return;}state.gold-=20;record("도서관 입장료","20G 지불");renderCharacter();}
    setRegion("facility-"+id);record("시설 입장",facilityTitle(id)+"에 들어왔다.");notify(facilityTitle(id)+" 내부");
  }
  function exitFacility() { setRegion("village");record("시설 퇴장","바텀웨이마을로 돌아왔다."); }
  function interact() {
    if(!state.character){characterForm();return;}
    if(state.region==="forest"){
      const item=state.groundItems.find(i=>i.location==="forest");if(item){pickup(item.instanceId);return;}
      message("숲을 둘러보았습니다.","방향키로 탐험을 계속하세요. 큰사과나 마물이 나타날 수 있습니다.");return;
    }
    const f=nearestFacility();if(state.region==="village"&&f&&f.distance<145){enterFacility(f.facility.id);return;}
    const n=nearestNpc();if(n&&n.distance<170){talkToNpc(n.npc.id);return;}
    message("가까이 있는 NPC나 시설이 없습니다.","대상 가까이 이동한 뒤 E 키를 누르세요.");
  }

  const npcOpeners={
    denby:"어서 오게. 필요한 물건이 있으면 말해 보게나. 큰사과는 개당 5G에 매입하지.",
    hamel:"도서관에 온 것을 환영하네. 어떤 책을 찾고 있나?",
    billy:"성소에 온 것을 환영하네. 필요한 일이 있는가?",
    fonta:"어서 오세요. 성소에서 궁금한 점이 있으면 편하게 물어보세요.",
    gale:"훈련장에 온 것을 환영한다. 훈련에 관해 궁금한 점이 있나?",
    bell:"길드에 오신 걸 환영해요. 가입이나 의뢰 안내가 필요하신가요?",
    yon:"직업을 고르러 왔나? 무엇을 알고 싶은지 말해 봐.",
    cheorkol:"어서 오게. 거래할 물건이나 궁금한 것이 있는가?"
  };
  const npcOptions={
    denby:["상점 이용 방법을 알려주세요.","큰사과를 팔고 싶어요.","마을 소식이 궁금해요."],
    hamel:["도서관 이용 규칙을 알려주세요.","책의 미믹에 대해 알고 싶어요.","마물학 책이 있나요?"],
    billy:["부활은 어떻게 하나요?","네 신에 대해 알려주세요.","성자 전직이 궁금해요."],
    fonta:["성소를 안내해 주세요.","빌리는 어떤 사람인가요?","감사합니다."],
    gale:["훈련장 규칙을 알려주세요.","스킬 각성에 대해 알려주세요.","훈련을 시작하고 싶어요."],
    bell:["길드에 가입하고 싶어요.","의뢰를 받고 싶어요.","길드 등급을 알려주세요."],
    yon:["기본 직업을 알려주세요.","직업을 선택하고 싶어요.","전직에 대해 알려주세요."],
    cheorkol:["무기와 포션을 사고 싶어요.","마물 유해를 팔고 싶어요.","큰사과 매입가는 얼마인가요?"]
  };
  function npcResponse(id,text) {
    if(/큰사과|사과/.test(text)) return id==="denby"||id==="cheorkol"?"큰사과는 개당 5G에 매입하고 있네. 상점에서 판매할 수 있지.":"큰사과는 상점 주인 덴비에게 가져가 보세요.";
    if(/의뢰|퀘스트|임무/.test(text))return "길드 게시판에서 의뢰를 확인할 수 있어요. 중요한 의뢰와 기초 의뢰는 직접 정해진 내용으로 게시됩니다.";
    if(/직업|전직/.test(text))return id==="yon"?"기본 직업은 검사, 마법사, 기술자, 격투가, 도적이야. 어떤 전투 방식에 관심이 있지?":"직업 담당자 욘에게 물어보는 편이 정확합니다.";
    if(/훈련|스킬|각성/.test(text))return "훈련장에서는 20턴 동안 스킬을 사용해 단련할 수 있어. 입장료는 20G야.";
    if(/책|도서관|미믹|마물학/.test(text))return "길드 등록자는 도서관에 무료로 들어갈 수 있고, 미등록자는 20G를 내야 해. 책은 대여할 수 없네.";
    if(/부활|사망/.test(text))return "성소에서 부활할 수 있습니다. 비용은 200G이며 사망자를 성소까지 데려와야 합니다.";
    if(/신앙|신|성자/.test(text))return "성소에는 태양신, 풍요신, 혼돈신, 축복신을 모시고 있습니다.";
    if(/마을|소식|안녕|반가/.test(text))return "바텀웨이마을은 인간 제국 남부의 초급 모험가 마을입니다. 숲길을 따라가면 탐험 구역으로 이어집니다.";
    if(/안내|규칙|방법/.test(text))return id==="denby"?"진열된 물건을 살펴보고 필요한 것을 고르면 되네. 흥정은 받지 않으니 참고하게.":"궁금한 내용을 더 구체적으로 말해 주면 설명해 드리겠습니다.";
    return "그 질문은 아직 자세히 정리되지 않았네. 다른 것이 궁금한가?";
  }
  function renderDialogue() {
    $("dialogueLine").innerHTML=dialogueHistory.slice(-6).map((item)=>"<p class='dialogue-entry "+item.speaker+"'><b>"+(item.speaker==="player"?"나":""+escape(currentNpc.name))+"</b> "+escape(item.text)+"</p>").join("");
    $("dialogueLine").scrollTop=$("dialogueLine").scrollHeight;
  }
  function talkToNpc(id) {
    const npc=npcs.find(n=>n.id===id);if(!npc)return;
    currentNpc=npc;dialogueHistory=[{speaker:"npc",text:npcOpeners[id]||npc.temperament}];
    $("dialogueName").textContent=npc.name;
    $("dialoguePortrait").innerHTML="<svg class='npc-sprite npc-sprite-"+escape(id)+"' viewBox='0 0 110 150' role='img' aria-label='"+escape(npc.name)+"'><use href='./assets/scene-kit.svg#npc-"+escape(id)+"' xlink:href='./assets/scene-kit.svg#npc-"+escape(id)+"'/></svg>";
    $("dialogueChoices").innerHTML=(npcOptions[id]||["안녕하세요.","도움이 필요해요."]).map(t=>"<button type='button' data-choice='"+escape(t)+"'>"+escape(t)+"</button>").join("");
    $("dialogueInput").value="";dialogueScreen.hidden=false;
    renderDialogue();hero.classList.add("talking");
    record("NPC 대화 시작",npc.name+"에게 말을 걸었다.");
  }
  function sendDialogue(text) {
    if(!currentNpc||!text.trim())return;
    const clean=text.trim().slice(0,160);
    dialogueHistory.push({speaker:"player",text:clean});
    dialogueHistory.push({speaker:"npc",text:npcResponse(currentNpc.id,clean)});
    renderDialogue();$("dialogueInput").value="";
    const actor=document.querySelector(".npc-actor[data-npc='"+currentNpc.id+"']");if(actor){actor.classList.add("talking");setTimeout(()=>actor.classList.remove("talking"),800);}
    record("NPC 대화", "나: "+clean+" / "+currentNpc.name+": "+dialogueHistory[dialogueHistory.length-1].text);
  }
  function closeDialogue() { dialogueScreen.hidden=true;currentNpc=null;hero.classList.remove("talking"); }

  function trainingPanel(){
    const t=state.character.training;
    if(!t||!t.active){openModal("훈련장","<p>진행 중인 훈련이 없습니다.</p>");return;}
    const buttons=(state.character.skills||[]).map(x=>"<button class='primary-modal' data-train-skill='"+escape(x)+"'>"+escape(x)+" 사용 훈련</button>").join("");
    openModal("훈련 · 남은 턴 "+t.turns,"<p>보유 스킬을 선택해 한 턴씩 훈련합니다.</p>"+buttons);
  }
  function trainingTurn(skill){
    const c=state.character,t=c.training;if(!t||!t.active||t.turns<=0)return;
    t.turns--;if(skill!=="이판사판")t.sessionOnlyStruggle=false;
    if(t.turns===0){t.gauge=Math.min(8,(t.gauge||0)+1);t.sessions=(t.sessions||0)+1;if(t.sessionOnlyStruggle)t.braveDashCount=(t.braveDashCount||0)+1;else t.braveDashCount=0;
      if(t.gauge>=8){t.gauge=0;addItem({id:"training-result",name:"훈련의 성과",type:"훈련 아이템"});}
      if(t.braveDashCount>=5&&!(c.skills||[]).includes("브레이브 대쉬")){c.skills.push("브레이브 대쉬");if(c.equippedSkills.length<4)c.equippedSkills.push("브레이브 대쉬");record("스킬 습득","이판사판 훈련 5회 완료 · 브레이브 대쉬 습득");}
      t.active=false;record("훈련 완료","20턴 훈련 완료 · 훈련 게이지 "+t.gauge+"/8");save();renderCharacter();openModal("훈련 완료","<p>훈련 게이지가 1 증가했습니다. 현재 "+t.gauge+"/8</p>");
    }else{record("훈련 진행",skill+" 사용 · 남은 턴 "+t.turns);save();trainingPanel();}
  }
  function facilityContent(id) {
    const f=facilities.find(x=>x.id===id);if(!f)return;
    let html="<p>"+escape(f.summary)+"</p>";
    if(f.entryFee!==undefined) html+="<p>입장료: "+f.entryFee+"G</p>";
    if(f.id==="training")html+="<p>훈련 게이지: "+((state.character.training&&state.character.training.gauge)||0)+"/8</p><button class='primary-modal' id='startTraining'>훈련 20턴 시작 (20G)</button>";
    if(f.id==="guild")html+="<p>길드 등록: "+(state.character.guild&&state.character.guild.joined?"가입 완료":"미가입")+"</p><button class='primary-modal' id='joinGuild'>무료 길드 가입</button>";
    if(f.id==="sanctuary"&&state.character.dead)html+="<button class='primary-modal' id='revivePlayer'>부활 (200G)</button>";
    if(f.items) html+="<h3>판매 목록</h3><div class='shop-list'>"+f.items.map((item,i)=>"<div><span><b>"+escape(item.name)+"</b><small>"+escape(item.effect)+"</small></span><b>"+item.price+"G</b><button class='primary-modal' data-buy='"+i+"'>구매</button></div>").join("")+"</div><p>큰사과는 개당 5G에 판매할 수 있습니다.</p><button class='primary-modal' id='sellApples'>큰사과 판매</button>";
    if(f.rules)html+="<h3>이용 규칙</h3><ul>"+f.rules.map(x=>"<li>"+escape(x)+"</li>").join("")+"</ul>";
    if(f.books)html+="<h3>소장 도서</h3><ul>"+f.books.map(x=>"<li>"+escape(x)+"</li>").join("")+"</ul>";
    if(f.deities)html+="<h3>신앙 대상</h3><p>"+f.deities.map(escape).join(" · ")+"</p>";
    if(f.id==="library")html+="<h3>도서관 의뢰</h3><p>책의 미믹 3마리 처치 · 보상 20G + 스킬북 1개</p><button class='primary-modal' id='libraryQuest'>의뢰 확인</button>";
    if(f.id==="guild"){
      const shop=facilities.find(x=>x.id==="shop");
      html+="<h3>길드 상점</h3><p>마을 상점과 동일한 판매 가격을 적용합니다.</p><div class='shop-list'>"+(shop.items||[]).map((item,i)=>"<div><span><b>"+escape(item.name)+"</b><small>"+escape(item.effect)+"</small></span><b>"+item.price+"G</b><button class='primary-modal' data-guild-buy='"+i+"'>구매</button></div>").join("")+"</div>";
      html+="<h3>물품 매입</h3><p>큰사과와 마물 유해를 매입합니다.</p><button class='primary-modal' id='sellGuildLoot'>매입 가능한 물품 판매</button><h3>길드 게시판</h3><p>중요 의뢰와 기초 의뢰는 사용자 설정을 따릅니다.</p>";
    }
    openModal(f.name+" · 시설 이용",html);
  }
  function showInventory() {
    const c=state.character,weapon=c&&c.equipment&&c.equipment.weapon;
    const slots=state.inventory.map((item,i)=>"<div class='inventory-item'><b>"+(i+1)+". "+escape(item.name)+"</b><small>"+escape(item.type||"아이템")+(item.type==="무기"?" · PP "+item.pp+"/"+item.maxPp:"")+"</small><button class='primary-modal' data-use-item='"+escape(item.instanceId)+"'>"+(item.type==="무기"?"장착":item.type==="소모품"||item.id==="big-apple"?"사용":"정보")+"</button></div>").join("");
    openModal("가방","<p>아이템 "+state.inventory.length+" / 30칸 · 보유 골드 "+state.gold+"G</p><h3>장착 칸</h3><div class='inventory-item'><b>무기</b><small>"+(weapon?escape(weapon.name)+" · PP "+weapon.pp+"/"+weapon.maxPp:"비어 있음")+"</small></div>"+(slots||"<p>보유한 아이템이 없습니다.</p>"));
  }
  function useInventoryItem(instanceId){
    const index=state.inventory.findIndex(x=>x.instanceId===instanceId);if(index<0)return;
    const item=state.inventory[index],c=state.character;if(!c)return;
    if(item.type==="무기"){
      if(item.id==="shop-0"&&c.jobId!=="swordsman"||item.id==="shop-1"&&c.jobId!=="rogue"||item.id==="shop-3"&&!["mage","dark-mage"].includes(c.jobId)||item.id==="shop-4"&&!["technician","swordsman","rogue"].includes(c.jobId)){notify("직업 제한으로 장착할 수 없습니다.");return;}
      const old=c.equipment.weapon;if(old)state.inventory.push(old);
      c.equipment.weapon=item;state.inventory.splice(index,1);
      record("무기 장착",item.name+" 장착");
    }else if(item.type==="소모품"||item.id==="big-apple"){
      const match=String(item.effect||"").match(/HP\s*\+\s*(\d+)/);
      const heal=match?Number(match[1]):item.id==="big-apple"?Math.floor(c.maxHp/4):0;
      if(!heal){notify("사용할 수 없는 아이템입니다.");return;}
      if(c.hp>=c.maxHp){notify("HP가 이미 최대치입니다.");return;}
      c.hp=Math.min(c.maxHp,c.hp+heal);state.inventory.splice(index,1);record("아이템 사용",item.name+" · HP "+heal+" 회복");
    }else if(item.id==="training-result"){
      const skills=(c.skills||[]).map(x=>"<button class='primary-modal' data-awaken-skill='"+escape(x)+"'>"+escape(x)+" 각성</button>").join("");
      openModal("훈련의 성과 사용","<p>각성할 스킬을 선택하세요. 스킬당 최대 3회입니다.</p>"+skills);return;
    }else{openModal(item.name,"<p>"+escape(item.effect||"서적 또는 재료 아이템")+"</p>");return;}
    save();renderCharacter();showInventory();
  }
  function awakenSkill(skill,mode){
    const c=state.character,itemIndex=state.inventory.findIndex(x=>x.id==="training-result");if(itemIndex<0)return;
    c.skillAwakenings=c.skillAwakenings||{};const data=c.skillAwakenings[skill]||{count:0,spReduction:0,multiplierBonus:0};
    if(data.count>=3){notify("해당 스킬은 최대 3회 각성했습니다.");return;}
    if(mode==="sp")data.spReduction=Math.min(0.5*(data.count+1),data.spReduction+0.5);
    else data.multiplierBonus+=0.1;
    data.count++;c.skillAwakenings[skill]=data;state.inventory.splice(itemIndex,1);
    record("스킬 각성",skill+" · "+(mode==="sp"?"SP 소모량 0.5 감소":"위력 배율 +0.1")+" · "+data.count+"/3");save();renderCharacter();openModal("각성 완료","<p>"+escape(skill)+" · "+data.count+"/3회</p><p>"+(mode==="sp"?"SP 소모량 감소를 선택했습니다.":"위력 배율 강화를 선택했습니다.")+"</p>");
  }
  function spendStatPoint(key){
    const c=state.character;if(!c||!(c.statPoints>0))return;
    const caps={strength:150,intelligence:150,defense:100,luck:100,speed:200,precision:195,sp:150};
    if(!(key in caps)||c[key]>=caps[key]){notify("해당 능력치는 상한에 도달했습니다.");return;}
    c[key]++;if(key==="sp")c.maxSp=c.sp=Math.min(caps.sp,(c.maxSp||25)+1);
    c.statPoints--;record("능력치 성장",key+" +1 · 남은 포인트 "+c.statPoints);save();renderCharacter();openCharacterPanel();
  }
  function openCharacterPanel(){
    const c=state.character;if(!c)return;
    const labels={strength:"근력",intelligence:"지능",defense:"방어력",luck:"행운",speed:"속도",precision:"정교함",sp:"SP"};
    const caps={strength:150,intelligence:150,defense:100,luck:100,speed:200,precision:195,sp:150};
    const rows=Object.keys(labels).map(k=>"<div class='inventory-item'><b>"+labels[k]+" "+c[k]+"/"+caps[k]+"</b><button class='primary-modal' data-stat-point='"+k+"' "+(c.statPoints>0&&c[k]<caps[k]?"":"disabled")+">+1</button></div>").join("");
    openModal("캐릭터 정보","<p>"+escape(c.name)+" · "+escape(c.raceName)+" · "+escape(c.jobName)+" · Lv."+c.level+"</p>"+statsHtml(c)+"<p>LP "+(c.lp||0)+" / "+(c.nextLp||requiredLp(c.level))+" · 능력치 포인트 "+(c.statPoints||0)+"</p><h3>능력치 분배</h3>"+rows);
  }
  function sellGuildLoot(){
    const prices={"weak-goblin":[5,10,20],"weak-spider":[5,10,20],"goblin":[10,20,40],"treasure-mimic":[20,40,100],"book-mimic":[20,40,100]};
    let total=0,sold=[];
    state.inventory=state.inventory.filter(item=>{
      if(item.id==="big-apple"){total+=5;sold.push(item.name+" 5G");return false;}
      if(item.id&&item.id.startsWith("loot-")){const parts=item.id.split("-"),tier=Number(parts.pop()),monster=parts.slice(1).join("-"),p=prices[monster];if(p&&Number.isInteger(tier)&&p[tier]!==undefined){total+=p[tier];sold.push(item.name+" "+p[tier]+"G");return false;}}
      return true;
    });
    if(!sold.length){openModal("길드 매입","<p>매입 가능한 물품이 없습니다.</p>");return;}
    state.gold+=total;save();renderCharacter();record("길드 매각",sold.join(", ")+" · 총 "+total+"G");openModal("길드 매입 완료","<p>"+sold.map(escape).join("<br>")+"</p><p>합계 "+total+"G를 받았습니다.</p>");
  }
  function sellApples() {
    const count=state.inventory.filter(i=>i.id==="big-apple").length;
    if(!count){openModal("큰사과 판매","<p>판매할 큰사과가 없습니다.</p>");return;}
    state.inventory=state.inventory.filter(i=>i.id!=="big-apple");state.gold+=count*5;save();renderCharacter();
    record("아이템 판매","큰사과 "+count+"개를 "+(count*5)+"G에 판매했다.");openModal("판매 완료","<p>큰사과 "+count+"개를 판매해 "+(count*5)+"G를 받았습니다.</p>");
  }
  function showMap() {
    openModal("지역 지도", "<div class='map-illustration'><svg class='map-scene' viewBox='0 0 1600 900' aria-label='바텀웨이마을 지도'><use href='./assets/scene-kit.svg#town-map' xlink:href='./assets/scene-kit.svg#town-map'/></svg><div class='map-actions'><button class='primary-modal' id='mapVillage'>마을</button><button class='primary-modal' id='mapForest'>숲 탐험</button></div></div><p>현재 위치: "+escape(state.position)+"</p>");
  }
  function showNpcs() {
    const html=npcs.map(n=>"<div class='npc-list-card'><svg class='npc-sprite npc-sprite-"+escape(n.id)+"' viewBox='0 0 110 150'><use href='./assets/scene-kit.svg#npc-"+escape(n.id)+"' xlink:href='./assets/scene-kit.svg#npc-"+escape(n.id)+"'/></svg><div><b>"+escape(n.name)+"</b><small>"+escape(n.facility)+" · "+escape(n.role)+"</small><button class='primary-modal' data-talk="+escape(n.id)+">대화</button></div></div>").join("");
    openModal("바텀웨이마을 NPC",html);
  }

  // UI event handlers
  $("newGameBtn").addEventListener("click",characterForm);
  $("fullscreenBtn").addEventListener("click",async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{notify("전체 화면을 사용할 수 없습니다.");}});
  $("forestBtn").addEventListener("click",()=>{if(state.region==="forest")setRegion("village");else if(state.region.startsWith("facility-"))setRegion("village");else {scheduleApple();setRegion("forest");record("지역 이동","바텀웨이 숲에 진입했다.");notify("바텀웨이 숲에 도착했습니다.");}});
  $("moveBtn").addEventListener("click",()=>move("up"));
  $("talkBtn").addEventListener("click",interact);
  $("attackBtn").addEventListener("click",()=>{if(!state.character){characterForm();return;}if(state.activeEncounter){battleAction("attack");return;}message("전투 대상이 없습니다.","숲에서 마물을 조우하면 공격할 수 있습니다.");});
  $("facilityBtn").addEventListener("click", () => {
    if (state.region.startsWith("facility-")) {
      facilityContent(state.region.slice(9));
      return;
    }
    const cards = facilities.map((f) => {
      const icon = ({shop:"✦",library:"▤",sanctuary:"☼",training:"⚔",guild:"⌂"}[f.id] || "⌂");
      return "<button class='facility-card' data-enter='" + escape(f.id) + "'><span class='facility-icon'>" + icon + "</span><span><b>" + escape(f.name) + "</b><small>" + escape(f.summary) + "</small></span><i>들어가기 →</i></button>";
    }).join("");
    openModal("바텀웨이마을 시설", "<div class='facility-grid'>" + cards + "</div>");
  });
  document.querySelectorAll("[data-direction]").forEach(b=>{
    b.addEventListener("pointerdown",(e)=>{e.preventDefault();startMoving(b.dataset.direction);});
    ["pointerup","pointerleave","pointercancel"].forEach(type=>b.addEventListener(type,stopMoving));
  });
  window.addEventListener("blur",stopMoving);
  window.addEventListener("keydown",(e)=>{
    if(e.altKey||e.ctrlKey||e.metaKey||!modal.hidden||!dialogueScreen.hidden||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
    const keys={ArrowUp:"up",w:"up",W:"up",ArrowDown:"down",s:"down",S:"down",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"};
    if(keys[e.key]){e.preventDefault();if(heldDirection!==keys[e.key])startMoving(keys[e.key]);} else if(e.key==="e"||e.key==="E"){e.preventDefault();interact();}
  });
  window.addEventListener("keyup",(e)=>{const keys={ArrowUp:"up",w:"up",W:"up",ArrowDown:"down",s:"down",S:"down",ArrowLeft:"left",a:"left",A:"left",ArrowRight:"right",d:"right",D:"right"};if(keys[e.key]===heldDirection)stopMoving();});;
  $("npcLayer").addEventListener("click",(e)=>{const b=e.target.closest("[data-npc]");if(b)talkToNpc(b.dataset.npc);});
  $("facilityHotspots").addEventListener("click",(e)=>{const f=e.target.closest("[data-facility]");if(f)enterFacility(f.dataset.facility);if(e.target.id==="exitFacilityBtn")exitFacility();if(e.target.id==="useFacilityBtn")facilityContent(state.region.slice(9));});
  $("worldItems").addEventListener("click",(e)=>{const b=e.target.closest("[data-pickup]");if(b)pickup(b.dataset.pickup);});
  $("dialogueChoices").addEventListener("click",(e)=>{const b=e.target.closest("[data-choice]");if(b)sendDialogue(b.dataset.choice);});
  $("dialogueForm").addEventListener("submit",(e)=>{e.preventDefault();sendDialogue($("dialogueInput").value);});
  $("dialogueClose").addEventListener("click",closeDialogue);
  $("scene").addEventListener("click",(e)=>{
    if(e.target.closest("button,.dialogue-screen,.scene-hud,.direction-pad") || !modal.hidden || !dialogueScreen.hidden) return;
    if(e.detail>1 || state.activeEncounter) return;
    const r=scene.getBoundingClientRect(), scale=Math.min(r.width/1600,r.height/900);
    const targetX=(e.clientX-r.left-(r.width-1600*scale)/2)/scale;
    const targetY=(e.clientY-r.top-(r.height-900*scale)/2)/scale;
    const dx=targetX-state.worldX,dy=targetY-state.worldY;
    const dir=Math.abs(dx)>Math.abs(dy)?(dx<0?"left":"right"):(dy<0?"up":"down");
    startMoving(dir);
    const stopAtTarget=()=>{const d=Math.hypot(targetX-state.worldX,targetY-state.worldY);if(d<42||state.activeEncounter){stopMoving();scene.removeEventListener("pointermove",stopAtTarget);}};
    const watcher=window.setInterval(()=>{if(Math.hypot(targetX-state.worldX,targetY-state.worldY)<48||state.activeEncounter){stopMoving();clearInterval(watcher);}},80);
  });
  $("closeModal").addEventListener("click",closeModal);modal.addEventListener("click",(e)=>{if(e.target===modal)closeModal();});
  modalContent.addEventListener("click",(e)=>{
    const t=e.target;
    if(t.id==="rollChar")rollCharacter();
    if(t.id==="saveChar")saveCharacter();
    if(t.id==="leaveEncounter")leaveEncounter();
    if(t.id==="battleAttack")battleAction("attack");if(t.id==="battleSkill")battleAction("skill");if(t.id==="battleEscape")battleAction("escape");
    if(t.id==="battleBack"){const m=currentMonster();if(m)showEncounter(m);}
    if(t.dataset.awakenSkill){openModal("스킬 각성 방식","<p>"+escape(t.dataset.awakenSkill)+"의 각성 효과를 선택하세요.</p><button class='primary-modal' data-awaken-mode='sp' data-awaken-target='"+escape(t.dataset.awakenSkill)+"'>SP 소모량 -0.5</button><button class='primary-modal' data-awaken-mode='power' data-awaken-target='"+escape(t.dataset.awakenSkill)+"'>위력 배율 +0.1</button>");}
    if(t.dataset.awakenMode)awakenSkill(t.dataset.awakenTarget,t.dataset.awakenMode);
    if(t.dataset.statPoint)spendStatPoint(t.dataset.statPoint);
    if(t.id==="sellApples")sellApples();
    if(t.id==="sellGuildLoot")sellGuildLoot();
    if(t.id==="mapVillage"){closeModal();setRegion("village");}
    if(t.id==="mapForest"){closeModal();if(state.character){scheduleApple();setRegion("forest");}else characterForm();}
    if(t.id==="libraryQuest")openModal("도서관 의뢰","<p>책의 미믹 3마리 처치. 보상은 20G와 스킬북 1개입니다.</p>");
    if(t.id==="joinGuild"){state.character.guild=state.character.guild||{};state.character.guild.joined=true;state.guildJoined=true;save();record("길드 가입","무료로 길드에 가입했다.");facilityContent("guild");}
    if(t.id==="revivePlayer"){if(state.gold<200){notify("부활 비용 200G가 부족합니다.");return;}state.gold-=200;state.character.dead=false;state.character.hp=Math.max(1,Math.floor(state.character.maxHp/2));save();renderCharacter();record("부활","성소에서 200G를 지불하고 부활했다.");facilityContent("sanctuary");}
    if(t.id==="startTraining"){if(state.gold<20){notify("훈련장 입장료 20G가 부족합니다.");return;}state.gold-=20;state.character.training=state.character.training||{gauge:0,turns:0,braveDashCount:0};state.character.training.turns=20;state.character.training.active=true;state.character.training.sessionOnlyStruggle=true;save();record("훈련 시작","20G 지불 · 20턴 훈련 시작");trainingPanel();}
    if(t.dataset.trainSkill)trainingTurn(t.dataset.trainSkill);
    if(t.id==="battleAttack")battleAction("attack");if(t.id==="battleDefend")battleAction("defend");if(t.id==="battleSkill")battleAction("skill");if(t.id==="battleEscape")battleAction("escape");
    if(t.id==="battleBack"){const m=currentMonster();if(m)showEncounter(m);}
    if(t.dataset.enter){closeModal();enterFacility(t.dataset.enter);}
    if(t.dataset.talk){closeModal();talkToNpc(t.dataset.talk);}
    if(t.dataset.buy!==undefined){
      const f=facilities.find(x=>x.id==="shop"),item=f&&f.items[Number(t.dataset.buy)];
      if(item){
        if(state.gold<item.price){notify("골드가 부족합니다.");return;}
        const restriction=item.restriction||"";
        if(/검사 계열/.test(restriction)&&state.character.jobId!=="swordsman"||/도적 계열/.test(restriction)&&state.character.jobId!=="rogue"||/격투가 전용/.test(restriction)&&state.character.jobId!=="fighter"){notify("현재 직업은 구매할 수 없습니다.");return;}
        if(state.inventory.length>=30){notify("인벤토리가 가득 찼습니다.");return;}
        const bonusMatch=item.effect.match(/(?:보정치|보정)\s*\+\s*(\d+)/),ppMatch=item.effect.match(/PP\s*(\d+)/);
        const weapon=item.type==="무기";
        const obj={id:"shop-"+Number(t.dataset.buy),name:item.name,type:weapon?"무기":item.type==="회복"?"소모품":item.type,effect:item.effect,bonus:bonusMatch?Number(bonusMatch[1]):0,pp:ppMatch?Number(ppMatch[1]):weapon?10:0,maxPp:ppMatch?Number(ppMatch[1]):weapon?10:0,restriction};
        state.gold-=item.price;obj.instanceId=Date.now()+"-"+Math.random().toString(36).slice(2);state.inventory.push(obj);
        save();renderCharacter();record("상점 구매",item.name+" · "+item.price+"G");facilityContent("shop");
      }
    }
    if(t.dataset.guildBuy!==undefined){const shop=facilities.find(x=>x.id==="shop"),item=shop&&shop.items[Number(t.dataset.guildBuy)];if(item){t.dataset.buy=String(t.dataset.guildBuy);const f=facilities.find(x=>x.id==="shop");if(state.gold<item.price)notify("골드가 부족합니다.");else if(state.inventory.length>=30)notify("인벤토리가 가득 찼습니다.");else{const bonusMatch=item.effect.match(/(?:보정치|보정)\s*\+\s*(\d+)/),ppMatch=item.effect.match(/PP\s*(\d+)/),weapon=item.type==="무기";const obj={id:"shop-"+Number(t.dataset.guildBuy),name:item.name,type:weapon?"무기":item.type==="회복"?"소모품":item.type,effect:item.effect,bonus:bonusMatch?Number(bonusMatch[1]):0,pp:ppMatch?Number(ppMatch[1]):weapon?10:0,maxPp:ppMatch?Number(ppMatch[1]):weapon?10:0,restriction:item.restriction};obj.instanceId=Date.now()+"-"+Math.random().toString(36).slice(2);state.gold-=item.price;state.inventory.push(obj);save();renderCharacter();record("길드 상점 구매",item.name+" · "+item.price+"G");facilityContent("guild");}}}
    if(t.dataset.useItem)useInventoryItem(t.dataset.useItem);
  });
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{
    const v=b.dataset.view;
    if(v==="character"){if(state.character)openCharacterPanel();else characterForm();}
    if(v==="inventory")showInventory();if(v==="map")showMap();if(v==="npcs")showNpcs();
    if(v==="story")openModal("스토리 기록","<p>1876년, 인간 제국 남부의 바텀웨이마을에서 모험을 시작합니다.</p><p>기록된 행동: "+state.actions.length+"건</p>");
  }));
  $("menuBtn").addEventListener("click",()=>openModal("게임 메뉴","<button class='primary-modal' id='menuChar'>캐릭터 생성</button><button class='primary-modal' id='menuMap'>지도</button><button class='primary-modal' id='menuNpcs'>NPC 목록</button>"));
  modalContent.addEventListener("click",(e)=>{if(e.target.id==="menuChar")characterForm();if(e.target.id==="menuMap")showMap();if(e.target.id==="menuNpcs")showNpcs();});
  window.addEventListener("resize",renderMapCamera);window.addEventListener("beforeunload",save);
  npcWanderTimer = window.setInterval(wanderNpcs, 2300);

  // Restore a saved scene. Forest entry never opens a blocking modal.
  if(!["village","forest"].includes(state.region)&&!state.region.startsWith("facility-"))state.region="village";
  if(state.region.startsWith("facility-")){
    const id=state.region.slice(9);if(!facilities.some(f=>f.id===id))state.region="village";
  }
  setRegion(state.region);renderCharacter();updateForestHud();
  $("clock").textContent="DAY "+String(state.day).padStart(2,"0")+" · 1876";
  if(state.activeEncounter){const m=(()=>{const x=(DATA.monsters||[]).find(a=>a.id===state.activeEncounter.monsterId);if(x&&x.variantOf){const b=DATA.monsters.find(a=>a.id===x.variantOf);return b?{...b,...x,stats:{...b.stats}}:x;}return x;})();if(m)showEncounter(m);else state.activeEncounter=null;}
  save();
})();