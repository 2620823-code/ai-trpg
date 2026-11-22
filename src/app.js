(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DATA = window.AITRPG_DATA;
  const STORAGE_KEY = "ai-trpg-prototype-v05";
  const oldKeys = ["ai-trpg-prototype-v04", "ai-trpg-prototype-v03", "ai-trpg-prototype-v02", "ai-trpg-prototype-v01"];
  const defaults = {
    name: "이름 없는 모험가",
    character: null,
    actions: [],
    day: 1,
    position: "바텀웨이마을 광장",
    region: "village",
    gold: 200,
    inventory: [],
    npcStats: {},
    forestSteps: 0,
    nextForestAppleStep: null,
    librarySteps: 0,
    groundItems: [],
    activeEncounter: null,
    quests: { "book-mimic-hunt": { status: "available", defeated: 0, rewarded: false } }
  };

  function loadState() {
    const cleanSavedState = (saved) => {
      if (!saved || typeof saved !== "object") return null;
      const { monsterStats: discardedMonsterStats, ...clean } = saved;
      return {
        ...defaults,
        ...clean,
        npcStats: clean.npcStats || {},
        groundItems: Array.isArray(clean.groundItems) ? clean.groundItems : [],
        quests: { ...defaults.quests, ...(clean.quests || {}) }
      };
    };
    try {
      const current = cleanSavedState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
      if (current) return current;
      for (const key of oldKeys) {
        const old = cleanSavedState(JSON.parse(localStorage.getItem(key)));
        if (old) return old;
      }
      return { ...defaults };
    } catch {
      return { ...defaults };
    }
  }

  const state = loadState();
  const stage = $("heroStage");
  const logList = $("logList");
  const caption = $("sceneCaption");
  const gmText = $("gmText");
  const saveState = $("saveState");
  const modal = $("modal");
  const modalContent = $("modalContent");
  let pendingCharacter = null;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveState.textContent = "● 로컬 기록 저장됨";
    } catch {
      saveState.textContent = "저장 공간을 사용할 수 없음";
    }
  }

  function record(type, detail) {
    const entry = {
      at: new Date().toISOString(),
      day: state.day,
      type,
      detail,
      place: state.position,
      region: state.region
    };
    state.actions.push(entry);
    if (state.actions.length > 500) state.actions.shift();
    save();

    const article = document.createElement("article");
    article.className = "log-entry";
    const time = document.createElement("time");
    time.textContent = "1876년 · " + state.day + "일차 · " + type;
    const p = document.createElement("p");
    p.textContent = detail;
    article.append(time, p);
    logList.prepend(article);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function openModal(title, html) {
    modalContent.innerHTML = "<h2>" + escapeHtml(title) + "</h2>" + html;
    modal.hidden = false;
  }
  function closeModal() { modal.hidden = true; }

  function roll(max) { return Math.floor(Math.random() * max) + 1; }

  function generateBaseStats(label) {
    const rules = DATA.statRules;
    const hpRoll = roll(rules.hp.dice);
    const strengthRoll = roll(rules.strength.dice);
    const intelligenceRoll = roll(rules.intelligence.dice);
    const defenseRoll = roll(rules.defense.dice);
    const luckRoll = roll(rules.luck.dice);
    const speedRoll = roll(rules.speed.dice);
    const precisionRoll = roll(rules.precision.dice);
    const hp = Math.max(rules.hp.floor, hpRoll);

    return {
      label,
      hp,
      maxHp: hp,
      strength: strengthRoll,
      intelligence: intelligenceRoll,
      defense: defenseRoll,
      luck: luckRoll,
      speed: speedRoll,
      precision: precisionRoll,
      sp: rules.sp.start,
      maxSp: rules.sp.start,
      rolls: {
        hp: hpRoll,
        strength: strengthRoll,
        intelligence: intelligenceRoll,
        defense: defenseRoll,
        luck: luckRoll,
        speed: speedRoll,
        precision: precisionRoll
      }
    };
  }

  function applyRaceBonus(stats, raceId) {
    const race = DATA.races.find((item) => item.id === raceId);
    if (!race) return stats;
    const bonus = race.bonus || {};
    if (bonus.hp) {
      stats.hp += bonus.hp;
      stats.maxHp += bonus.hp;
    }
    if (bonus.strength) stats.strength += bonus.strength;
    if (bonus.intelligence) stats.intelligence += bonus.intelligence;
    if (bonus.speed) stats.speed += bonus.speed;
    stats.raceBonus = { ...bonus };
    return stats;
  }

  function statHtml(stats, includeRolls = true) {
    const rows = [
      ["HP", stats.hp + " / " + stats.maxHp],
      ["근력", stats.strength],
      ["지능", stats.intelligence],
      ["방어력", stats.defense],
      ["행운", stats.luck],
      ["속도", stats.speed],
      ["정교함", stats.precision],
      ["SP", stats.sp == null ? null : stats.sp + " / " + stats.maxSp]
    ].filter((row) => row[1] != null);
    const html = rows.map(([name, value]) =>
      "<tr><th>" + name + "</th><td>" + value + "</td></tr>"
    ).join("");
    const rolls = includeRolls && stats.rolls
      ? "<h3>주사위 결과</h3><p class=\"muted\">" +
        "HP 1d250: " + stats.rolls.hp + " → " + stats.maxHp +
        " · 근력 1d50: " + stats.rolls.strength +
        " · 지능 1d50: " + stats.rolls.intelligence +
        " · 방어력 1d50: " + stats.rolls.defense +
        " · 행운 1d25: " + stats.rolls.luck +
        " · 속도 1d30: " + stats.rolls.speed +
        " · 정교함 1d40: " + stats.rolls.precision +
        "</p>" : "";
    return "<div class=\"table-wrap\"><table><tbody>" + html + "</tbody></table></div>" + rolls;
  }

  function renderCharacterPanel() {
    const character = state.character;
    $("heroName").textContent = character ? character.name : state.name;
    const nameSub = document.querySelector(".character-name span");
    if (nameSub) nameSub.textContent = character
      ? character.raceName + " · " + character.jobName
      : "캐릭터 생성 필요";
    const levelRow = document.querySelector(".level-row");
    if (levelRow) levelRow.innerHTML = character
      ? "<span>LEVEL " + character.level + "</span><span>EXP " + character.exp + " / " + character.nextExp + "</span>"
      : "<span>LEVEL —</span><span>EXP —</span>";
    const statList = document.querySelector(".stat-list");
    if (statList) {
      if (!character) {
        statList.innerHTML = "<p class=\"muted\">캐릭터를 생성하면 주사위 능력치가 표시됩니다.</p>";
      } else {
        statList.innerHTML =
          "<div><span>HP</span><b>" + character.hp + " / " + character.maxHp + "</b></div>" +
          "<div class=\"meter hp\"><i style=\"width:100%\"></i></div>" +
          "<div><span>SP</span><b>" + character.sp + " / " + character.maxSp + "</b></div>" +
          "<div class=\"meter sp\"><i style=\"width:100%\"></i></div>" +
          "<div class=\"stat-grid\">" +
          "<span>근력 <b>" + character.strength + "</b></span>" +
          "<span>지능 <b>" + character.intelligence + "</b></span>" +
          "<span>방어력 <b>" + character.defense + "</b></span>" +
          "<span>속도 <b>" + character.speed + "</b></span>" +
          "</div><p class=\"muted\">보유 골드 " + state.gold + "G</p>";
      }
    }
  }

  function createCharacterForm() {
    const raceOptions = DATA.races.map((race) =>
      "<option value=\"" + race.id + "\">" + race.name + "</option>"
    ).join("");
    const jobOptions = DATA.jobs.map((job) =>
      "<option value=\"" + job.id + "\">" + job.name + "</option>"
    ).join("");
    pendingCharacter = null;
    openModal("새 캐릭터 생성",
      "<p>종족과 직업을 선택한 뒤 주사위를 굴려 능력치를 생성합니다. 시작 골드는 200G입니다.</p>" +
      "<label for=\"characterNameInput\">캐릭터 이름</label><input id=\"characterNameInput\" maxlength=\"20\" value=\"이름 없는 모험가\">" +
      "<label for=\"raceSelect\">종족</label><select id=\"raceSelect\">" + raceOptions + "</select>" +
      "<label for=\"jobSelect\">직업</label><select id=\"jobSelect\">" + jobOptions + "</select>" +
      "<div id=\"characterRollPreview\"><p class=\"muted\">아직 능력치 주사위를 굴리지 않았습니다.</p></div>" +
      "<button class=\"primary-modal\" id=\"rollCharacterBtn\">능력치 주사위 굴리기</button> " +
      "<button class=\"primary-modal\" id=\"saveCharacterBtn\" disabled>캐릭터 생성</button>"
    );
  }

  function rollCharacterPreview() {
    const name = $("characterNameInput").value.trim() || "이름 없는 모험가";
    const raceId = $("raceSelect").value;
    const jobId = $("jobSelect").value;
    const base = generateBaseStats(name);
    const stats = applyRaceBonus(base, raceId);
    const race = DATA.races.find((item) => item.id === raceId);
    const job = DATA.jobs.find((item) => item.id === jobId);
    pendingCharacter = {
      ...stats,
      name,
      raceId,
      raceName: race.name,
      jobId,
      jobName: job.name,
      level: 1,
      exp: 0,
      nextExp: 100,
      skills: [],
      equippedSkills: [],
      inventory: []
    };
    $("characterRollPreview").innerHTML =
      "<h3>생성된 능력치 미리보기</h3>" + statHtml(pendingCharacter) +
      "<p class=\"muted\">종족 보정 적용 후 결과입니다. 직업 고유 스탯 직업의 스킬은 아직 미제작 상태이므로 추가하지 않았습니다.</p>";
    $("saveCharacterBtn").disabled = false;
  }

  function saveCharacter() {
    if (!pendingCharacter) return;
    const name = $("characterNameInput").value.trim();
    if (!name) {
      $("characterNameInput").focus();
      return;
    }
    pendingCharacter.name = name;
    state.character = pendingCharacter;
    state.name = name;
    state.gold = 200;
    state.inventory = [];
    state.position = "바텀웨이마을 광장";
    state.region = "village";
    state.day = 1;
    renderCharacterPanel();
    renderRegion();
    record("캐릭터 생성", name + " · " + pendingCharacter.raceName + " · " + pendingCharacter.jobName + " · 시작 골드 200G");
    closeModal();
  }

  function ensureNpcStats() {
    for (const npc of DATA.npcs) {
      state.npcStats[npc.id] = {
        label: npc.name, hp: 300, maxHp: 300, strength: 50,
        intelligence: 50, defense: 50, speed: 80,
        status: "사용자 확정 공통 능력치",
        source: "바텀웨이마을 NPC 공통 능력치"
      };
    }
    save();
  }
  function addInventoryItem(item) {
    const limit = DATA.forestItems.inventoryLimit;
    if (state.inventory.length >= limit) return false;
    state.inventory.push({ ...item, instanceId: Date.now() + "-" + Math.random().toString(36).slice(2) });
    save();
    return true;
  }

  function addGroundItem(item, location) {
    state.groundItems.push({
      ...item,
      instanceId: Date.now() + "-" + Math.random().toString(36).slice(2),
      location
    });
    save();
  }

  function renderGroundItems(location) {
    const items = state.groundItems.filter((item) => item.location === location);
    if (!items.length) return "<p class=\"muted\">주변에 떨어진 아이템이 없습니다.</p>";
    return items.map((item) =>
      "<div class=\"npc-note\"><b>" + escapeHtml(item.name) + "</b>" +
      "<button class=\"primary-modal\" data-pickup=\"" + escapeHtml(item.instanceId) + "\">줍기</button></div>"
    ).join("");
  }

  function pickupGroundItem(instanceId) {
    const index = state.groundItems.findIndex((item) => item.instanceId === instanceId);
    if (index < 0) return;
    const item = state.groundItems[index];
    if (!addInventoryItem(item)) {
      message("인벤토리가 가득 찼습니다.", "아이템을 줍기 전에 인벤토리에서 공간을 확보하세요.");
      openModal("인벤토리 가득 참", "<p>아이템은 현재 위치에 남아 있습니다. 인벤토리 최대 용량은 30칸입니다.</p>");
      return;
    }
    state.groundItems.splice(index, 1);
    save();
    record("아이템 획득", item.name + "을(를) 획득했다.");
    if (item.id === "big-apple" && state.region === "forest") {
      state.nextForestAppleStep = state.forestSteps + roll(
        DATA.forestItems.bigApple.spawnStepMax - DATA.forestItems.bigApple.spawnStepMin + 1
      );
      state.nextForestAppleStep += DATA.forestItems.bigApple.spawnStepMin - 1;
    }
    showInventory();
  }

  function showInventory() {
    const slots = Array.from({ length: DATA.forestItems.inventoryLimit }, (_, i) => {
      const item = state.inventory[i];
      return "<div class=\"inventory-slot\"><small>" + String(i + 1).padStart(2, "0") + "</small>" +
        (item
          ? "<b>" + escapeHtml(item.name) + "</b><span>" + escapeHtml(item.type || "아이템") + "</span>"
          : "<span class=\"empty-slot\">비어 있음</span>") +
        "</div>";
    }).join("");
    const details = state.inventory.map((item, i) => {
      let description = "";
      if (item.id === "big-apple") description = "1회용 · 스킬 사용 후 HP가 최대 HP의 절반 이하이면 자동 사용 · 최대 HP의 1/4 회복";
      else if (item.type === "monster-remains") description = "길드에서 매입할 수 있는 마물 유해 · 매입 가격은 아직 미정";
      else if (item.type === "skill-book") description = "의뢰 보상 스킬북 · 습득할 스킬은 책의 세부 규칙 확정 후 연결";
      return "<div class=\"inventory-item\"><b>" + (i + 1) + ". " + escapeHtml(item.name) +
        "</b><small>" + escapeHtml(description) + "</small></div>";
    }).join("");
    openModal("인벤토리",
      "<p>보유 아이템 " + state.inventory.length + " / " + DATA.forestItems.inventoryLimit +
      "칸 · 보유 골드 " + state.gold + "G</p><div class=\"inventory-grid\">" + slots + "</div>" +
      "<h3>아이템 정보</h3>" + (details || "<p class=\"muted\">아직 보유한 아이템이 없습니다.</p>") +
      "<h3>현재 위치의 드롭 아이템</h3>" + renderGroundItems(state.region));
  }

  function scheduleForestApple() {
    if (state.nextForestAppleStep == null &&
        !state.groundItems.some((item) => item.id === "big-apple" && item.location === "forest")) {
      const config = DATA.forestItems.bigApple;
      state.nextForestAppleStep = state.forestSteps + roll(config.spawnStepMax - config.spawnStepMin + 1) + config.spawnStepMin - 1;
    }
  }

  function spawnForestApple() {
    const config = DATA.forestItems.bigApple;
    addGroundItem({ id: config.id, name: config.name, type: config.type }, "forest");
    state.nextForestAppleStep = null;
    record("아이템 발견", "숲에서 큰사과가 무작위 위치에 나타났다.");
    message("숲 바닥에서 큰사과를 발견했다.", "주변에 나타난 큰사과를 줍거나 계속 이동할 수 있습니다.");
  }

  function monsterForEncounter(id) {
    const monster = DATA.monsters.find((item) => item.id === id);
    if (!monster) return null;
    if (monster.variantOf) {
      const base = DATA.monsters.find((item) => item.id === monster.variantOf);
      if (!base) return null;
      return { ...base, ...monster, stats: { ...base.stats } };
    }
    return monster;
  }

  function chooseMonster(pool) {
    const entries = pool.map((id) => monsterForEncounter(id)).filter(Boolean);
    const total = entries.reduce((sum, monster) => sum + (monster.spawnWeight || 0), 0);
    if (!total) return null;
    let point = Math.random() * total;
    for (const monster of entries) {
      point -= monster.spawnWeight || 0;
      if (point < 0) return monster;
    }
    return entries[entries.length - 1];
  }

  function monsterStatsHtml(monster) {
    const s = monster.stats || {};
    const rows = [
      ["HP", s.hp], ["근력", s.strength], ["지능", s.intelligence],
      ["방어력", s.defense == null ? "미기재" : s.defense], ["속도", s.speed]
    ];
    return "<div class=\"table-wrap\"><table><tbody>" +
      rows.map(([k, v]) => "<tr><th>" + k + "</th><td>" + v + "</td></tr>").join("") +
      "</tbody></table></div>";
  }

  function displayEncounter(monster) {
    const appearance = monster.appearance === "book" ? "책의 형태로 서가에 꽂혀 있다가 모습을 드러낸다." :
      monster.appearance === "treasure" ? "보물 상자의 모습을 한 채 숲속에서 발견된다." :
      "마물이 모습을 드러냈다.";
    openModal(monster.name + " 조우",
      "<p>" + escapeHtml(appearance) + "</p>" + monsterStatsHtml(monster) +
      "<p class=\"muted\">현재 실제 전투 판정은 아직 연결되지 않았습니다. 아래 처치 등록은 드롭·의뢰 진행을 확인하기 위한 테스트 기능입니다.</p>" +
      '<button class="primary-modal" id="registerDefeatBtn">테스트용 처치 결과 등록</button> ' +
      '<button class="primary-modal" id="leaveEncounterBtn">조우 종료</button>'
    );
  }

  function startEncounter(monster, location) {
    state.activeEncounter = { monsterId: monster.id, location };
    save();
    displayEncounter(monster);
    record("마물 조우", monster.name + "과(와) 조우했다.");
  }

  function rollForEncounter(location) {
    const config = DATA.encounters[location];
    const result = roll(config.rollSides);
    record("조우 판정", (location === "forest" ? "숲" : "도서관") + " 1d" + config.rollSides + " 결과 " + result +
      " · 기준 ≤" + config.encounterOnOrBelow + " · " +
      (result <= config.encounterOnOrBelow ? "조우" : "비조우"));
    if (result > config.encounterOnOrBelow) {
      message("주변을 살폈지만 마물은 나타나지 않았다.", "조우 판정 결과 비조우입니다. 계속 이동할 수 있습니다.");
      return;
    }
    const monster = chooseMonster(config.pool);
    if (monster) startEncounter(monster, location);
  }

  function processForestStep() {
    state.forestSteps += 1;
    if (state.nextForestAppleStep == null &&
        !state.groundItems.some((item) => item.id === "big-apple" && item.location === "forest")) {
      scheduleForestApple();
    }
    if (state.nextForestAppleStep != null && state.forestSteps >= state.nextForestAppleStep) spawnForestApple();
    if (state.forestSteps % DATA.encounters.forest.stepInterval === 0) {
      rollForEncounter("forest");
    } else if (!state.groundItems.some((item) => item.location === "forest")) {
      message("숲을 한 걸음 이동했다. (" + state.forestSteps + "발자국)", "마물 조우 판정은 50발자국마다 진행됩니다.");
    }
    save();
  }

  function showLibraryQuest() {
    const q = DATA.libraryQuest;
    const progress = state.quests[q.id] || { status: "available", defeated: 0, rewarded: false };
    const statusText = progress.status === "available" ? "수락 가능" :
      progress.status === "in_progress" ? "진행 중" :
      progress.status === "completed" ? "완료" : "상태 미정";
    const action = progress.status === "available"
      ? '<button class="primary-modal" id="acceptLibraryQuestBtn">의뢰 수락</button>'
      : progress.status === "in_progress"
        ? "<p>의뢰가 진행 중입니다. 아래 서가 탐색을 이용하세요.</p>"
        : "<p>의뢰 보상을 수령했습니다.</p>";
    return "<div class=\"npc-note\"><b>" + escapeHtml(q.name) + "</b>" +
      "<p>" + escapeHtml(q.description) + "</p><p>진행도: " + progress.defeated + " / " + q.targetCount +
      " · " + statusText + "</p>" + action + "</div>";
  }

  function acceptLibraryQuest() {
    const q = DATA.libraryQuest;
    state.quests[q.id] = { status: "in_progress", defeated: 0, rewarded: false };
    save();
    record("의뢰 수락", q.name);
    showFacility("library");
  }

  function exploreLibraryStep() {
    state.librarySteps += 1;
    if (state.librarySteps % DATA.encounters.library.stepInterval === 0) {
      rollForEncounter("library");
      if (state.activeEncounter) return;
    } else {
      message("도서관 서가 사이를 이동했다. (" + state.librarySteps + "발자국)", "책의 미믹 조우 판정은 50발자국마다 진행됩니다.");
      record("도서관 탐색", "서가를 1발자국 이동했다.");
    }
    showFacility("library");
  }

  function addMonsterRemains(monster, location) {
    const remains = {
      id: "monster-remains",
      name: "마물 유해",
      type: "monster-remains",
      sourceMonster: monster.name
    };
    if (!addInventoryItem(remains)) {
      addGroundItem(remains, location === "library" ? "library" : "forest");
      message("인벤토리가 가득 차 마물 유해가 바닥에 남았다.", "인벤토리 30칸을 비운 뒤 드롭 아이템을 주울 수 있습니다.");
    }
  }

  function registerMonsterDefeat() {
    if (!state.activeEncounter) return;
    const encounter = state.activeEncounter;
    const monster = monsterForEncounter(encounter.monsterId);
    if (!monster) return;
    addMonsterRemains(monster, encounter.location);
    if (monster.id === "book-mimic") {
      const q = DATA.libraryQuest;
      const progress = state.quests[q.id];
      if (progress && progress.status === "in_progress") {
        progress.defeated += 1;
        record("의뢰 진행", "책의 미믹 처치 " + progress.defeated + " / " + q.targetCount);
        if (progress.defeated >= q.targetCount && !progress.rewarded) {
          progress.status = "completed";
          progress.rewarded = true;
          state.gold += q.reward.gold;
          if (!addInventoryItem(q.reward.item)) addGroundItem(q.reward.item, "library");
          record("의뢰 완료", q.name + " · 보상 " + q.reward.gold + "G와 스킬북 1개");
        }
      }
    }
    state.activeEncounter = null;
    save();
    record("마물 처치", monster.name + " 처치 · 마물 유해 1개 획득");
    if (encounter.location === "library") showFacility("library");
    else showForest();
  }

  function leaveEncounter() {
    state.activeEncounter = null;
    save();
    closeModal();
    message("마물과의 조우를 종료했다.", "실제 전투 기능은 별도 전투 엔진 연결 후 사용할 수 있습니다.");
    record("조우 종료", "마물 조우 화면을 닫았다.");
  }

  function showGuildBuyback() {
    const remains = state.inventory.filter((item) => item.type === "monster-remains");
    const rows = remains.length ? remains.map((item) => {
      const price = DATA.guildBuybackPrices[item.name] ?? DATA.guildBuybackPrices["마물 유해"];
      return "<div class=\"npc-note\"><b>" + escapeHtml(item.name) + "</b><p>출처: " +
        escapeHtml(item.sourceMonster || "정보 없음") + " · 매입가: " +
        (price == null ? "미정" : price + "G") + "</p>" +
        (price == null ? '<button class="primary-modal" disabled>매입가 미정</button>' :
          '<button class="primary-modal" data-sell-remains="' + escapeHtml(item.instanceId) + '">판매</button>') +
        "</div>";
    }).join("") : "<p class=\"muted\">판매할 마물 유해가 없습니다.</p>";
    openModal("길드 · 마물 유해 매입", "<p>처콜이 마물 유해를 매입합니다. 현재 매입 가격은 아직 설정되지 않았습니다.</p>" + rows);
  }

  function sellRemains(instanceId) {
    const index = state.inventory.findIndex((item) => item.instanceId === instanceId && item.type === "monster-remains");
    if (index < 0) return;
    const item = state.inventory[index];
    const price = DATA.guildBuybackPrices[item.name] ?? DATA.guildBuybackPrices["마물 유해"];
    if (price == null) {
      message("아직 매입 가격이 정해지지 않았습니다.");
      return;
    }
    state.inventory.splice(index, 1);
    state.gold += price;
    save();
    record("길드 판매", item.name + " 판매 · " + price + "G");
    showGuildBuyback();
  }

  function useBigAppleAfterSkill() {
    const c = state.character;
    if (!c || c.hp > c.maxHp / 2) return false;
    const index = state.inventory.findIndex((item) => item.id === "big-apple");
    if (index < 0) return false;
    const amount = c.maxHp / 4;
    const actual = Math.min(amount, c.maxHp - c.hp);
    c.hp += actual;
    state.inventory.splice(index, 1);
    save();
    record("큰사과 자동 사용", "스킬 사용 후 HP가 최대치의 절반 이하이므로 " + actual + " 회복했다.");
    renderCharacterPanel();
    return true;
  }




  function renderRegion() {
    const forest = state.region === "forest";
    const region = DATA.regions.find((item) => item.id === state.region) || DATA.regions[0];
    const image = document.querySelector(".scene-bg");
    if (image) {
      image.src = forest ? "./assets/forest.svg" : "./assets/village.svg";
      image.alt = forest ? "바텀웨이 숲 풍경" : "바텀웨이마을 풍경";
    }
    const title = document.querySelector(".scene-title h1");
    const subtitle = document.querySelector(".scene-title p");
    if (title) title.textContent = region.name;
    if (subtitle) subtitle.textContent = forest
      ? "마을 바깥의 숲 탐험 구역 · 마물 관찰"
      : "모험가의 첫걸음이 시작되는 곳";
    const meta = document.querySelector(".world-meta b");
    if (meta) meta.textContent = region.name;
    if (forest) {
      message("숲의 나무 사이로 바람이 지나간다.", "이동 버튼을 누를 때마다 1발자국 전진합니다. 50발자국마다 조우 판정을 합니다.");
      $("moveBtn").innerHTML = "<span>↗</span> 한 걸음 이동";
      $("forestBtn").innerHTML = "<span>⌂</span> 마을 복귀";
    } else {
      message("광장에는 상인들의 목소리와 분수 소리가 잔잔하게 퍼진다.", "바텀웨이마을로 돌아왔습니다. 시설과 NPC를 살펴보세요.");
      $("moveBtn").innerHTML = "<span>↗</span> 이동";
      $("forestBtn").innerHTML = "<span>♧</span> 숲 탐험";
    }
    save();
  }

  function showForest() {
    if (state.activeEncounter) {
      const activeMonster = monsterForEncounter(state.activeEncounter.monsterId);
      if (activeMonster) { displayEncounter(activeMonster); return; }
    }
    if (!state.character) {
      createCharacterForm();
      return;
    }
    state.region = "forest";
    state.position = "바텀웨이 숲";
    scheduleForestApple();
    renderRegion();
    openModal("바텀웨이 숲",
      "<p>" + escapeHtml(DATA.regions[1].summary) + "</p>" +
      "<p>누적 이동: " + state.forestSteps + "발자국 · 다음 조우 판정까지 " +
      (DATA.encounters.forest.stepInterval - (state.forestSteps % DATA.encounters.forest.stepInterval)) +
      "발자국</p><p class=\"muted\">마물 조우: 50발자국마다 1d100, 20 이하이면 출현. " +
      escapeHtml(DATA.encounters.forest.note) + "</p>" +
      "<h3>숲 바닥의 아이템</h3>" + renderGroundItems("forest")
    );
    record("지역 이동", "바텀웨이 숲에 진입했다.");
  }

  function showNpcList() {
    ensureNpcStats();
    const cards = DATA.npcs.map((npc) => {
      const stats = state.npcStats[npc.id];
      return "<article class=\"npc-note\"><b>" + escapeHtml(npc.name) + " · " + escapeHtml(npc.facility) +
        "</b><p>" + escapeHtml(npc.temperament) + "</p><small>" +
        (npc.canBattle ? "전투 가능 상황 있음" : "전투 대상으로 설정되지 않음") +
        " · 임시 능력치 초안</small><details><summary>능력치 보기</summary>" +
        statHtml(stats) + "</details></article>";
    }).join("");
    openModal("바텀웨이마을 NPC 능력치", 
      "<p class=\"muted\">마을 NPC 공통 능력치: HP 300 · 근력 50 · 지능 50 · 방어력 50 · 속도 80</p>" + cards);
    record("NPC 조사", "바텀웨이마을 NPC의 임시 능력치 정보를 확인했다.");
  }

  function animate(name, duration) {
    stage.classList.remove("walking", "attacking", "talking");
    void stage.offsetWidth;
    stage.classList.add(name);
    window.setTimeout(() => stage.classList.remove(name), duration);
  }

  const directionOffsets = {
    up: [0, -28], down: [0, 20], left: [-34, 0], right: [34, 0]
  };
  let moveResetTimer = null;
  function moveDirection(direction) {
    if (!directionOffsets[direction]) return;
    if (!state.character) { createCharacterForm(); return; }
    if (state.activeEncounter) {
      const activeMonster = monsterForEncounter(state.activeEncounter.monsterId);
      if (activeMonster) displayEncounter(activeMonster);
      return;
    }
    const [dx, dy] = directionOffsets[direction];
    stage.style.setProperty("--move-x", dx + "px");
    stage.style.setProperty("--move-y", dy + "px");
    stage.classList.toggle("face-left", direction === "left");
    stage.classList.toggle("face-right", direction === "right");
    stage.classList.remove("step-up", "step-down", "step-left", "step-right");
    void stage.offsetWidth;
    stage.classList.add("step-" + direction, "walking");
    window.clearTimeout(moveResetTimer);
    moveResetTimer = window.setTimeout(() => {
      stage.classList.remove("walking", "step-up", "step-down", "step-left", "step-right");
      stage.style.setProperty("--move-x", "0px");
      stage.style.setProperty("--move-y", "0px");
    }, 420);
    if (state.region === "forest") {
      processForestStep();
      if (state.activeEncounter) return;
      if (state.groundItems.some((item) => item.location === "forest")) showForest();
      else message("숲에서 " + ({up:"앞쪽",down:"뒤쪽",left:"왼쪽",right:"오른쪽"}[direction]) + "으로 이동했다. (" + state.forestSteps + "발자국)", "방향키로 숲을 탐험할 수 있습니다. 마물 조우 판정은 50발자국마다 진행됩니다.");
      return;
    }
    const places = {
      up: "마을 북쪽 길", down: "바텀웨이마을 광장",
      left: "마을 시장", right: "모험가 길드 앞"
    };
    state.position = places[direction];
    message(places[direction] + " 방향으로 이동했습니다.", "방향키 또는 WASD로 마을을 둘러볼 수 있습니다.");
    record("이동", places[direction] + " 방향으로 이동했다.");
  }

  function message(text, gm = text) {
    caption.textContent = text;
    gmText.textContent = gm;
  }

  function showFacilities() {
    const facilities = DATA.facilities;
    const cards = facilities.map((f) =>
      '<button class="facility-card" data-facility="' + f.id + '">' +
      '<span class="facility-icon"><svg viewBox="0 0 160 120"><use href="./assets/facilities.svg#' + f.icon + '"></use></svg></span>' +
      '<span><b>' + escapeHtml(f.name) + '</b><small>' + escapeHtml(f.summary) + '</small></span><i>열기 →</i></button>'
    ).join("");
    openModal("바텀웨이마을 시설", "<p>시설을 선택해 등록된 정보와 이용 규칙을 확인할 수 있습니다.</p>" +
      '<div class="facility-grid">' + cards + "</div>");
  }

  function showFacility(id) {
    if (state.activeEncounter && state.activeEncounter.location === "library") {
      const activeMonster = monsterForEncounter(state.activeEncounter.monsterId);
      if (activeMonster) { displayEncounter(activeMonster); return; }
    }
    const f = DATA.facilities.find((x) => x.id === id);
    if (!f) return;
    const lines = [];
    if (f.owner) lines.push("<p><b>담당 NPC:</b> " + escapeHtml(f.owner) + "</p>");
    if (f.entryFee !== undefined) lines.push("<p><b>입장료:</b> " + f.entryFee + "G</p>");
    if (f.items) {
      lines.push("<h3>판매 목록</h3><div class=\"table-wrap\"><table><thead><tr><th>상품</th><th>가격</th><th>효과·제한</th></tr></thead><tbody>" +
        f.items.map((x) => "<tr><td>" + escapeHtml(x.name) + "</td><td>" + x.price + "G</td><td>" +
          escapeHtml(x.effect) + (x.restriction ? "<small>" + escapeHtml(x.restriction) + "</small>" : "") +
          "</td></tr>").join("") + "</tbody></table></div>");
    }
    if (f.weaponRules) lines.push("<h3>무기 PP 규칙</h3><ul>" + f.weaponRules.map((x) => "<li>" + escapeHtml(x) + "</li>").join("") + "</ul>");
    if (f.books) lines.push("<h3>소장 도서</h3><ul>" + f.books.map((x) => "<li>" + escapeHtml(x) + "</li>").join("") + "</ul>");
    if (f.deities) lines.push("<h3>신앙 대상</h3><p>" + f.deities.map(escapeHtml).join(" · ") + "</p>");
    if (f.npcDetails) lines.push("<h3>NPC 정보</h3><ul>" + f.npcDetails.map((x) => "<li>" + escapeHtml(x) + "</li>").join("") + "</ul>");
    if (f.npcs) lines.push("<h3>NPC 정보</h3>" + f.npcs.map((n) =>
      '<div class="npc-note"><b>' + escapeHtml(n.name || "NPC") +
      (n.role ? " · " + escapeHtml(n.role) : "") + "</b><ul>" +
      (n.details || []).map((x) => "<li>" + escapeHtml(x) + "</li>").join("") + "</ul></div>"
    ).join(""));
    if (f.rules) lines.push("<h3>이용 규칙</h3><ul>" + f.rules.map((x) => "<li>" + escapeHtml(x) + "</li>").join("") + "</ul>");
    if (f.board) lines.push("<h3>의뢰 게시판</h3><ul>" + f.board.map((x) => "<li>" + escapeHtml(x) + "</li>").join("") + "</ul>");
    if (f.id === "library") lines.push("<h3>도서관 의뢰</h3>" + showLibraryQuest() +
      "<h3>서가 탐색</h3><p>누적 탐색 " + state.librarySteps + "발자국 · 50발자국마다 1d100, 20 이하이면 책의 미믹 조우</p>" +
      '<button class="primary-modal" id="libraryStepBtn">서가에서 1발자국 이동</button>' +
      "<h3>도서관 바닥의 아이템</h3>" + renderGroundItems("library"));
    if (f.id === "guild") lines.push("<h3>마물 유해 매입</h3>" +
      '<button class="primary-modal" id="guildBuybackBtn">유해 매입 목록 보기</button>');
    openModal(f.name, "<p>" + escapeHtml(f.summary) + "</p>" + lines.join("") +
      '<button class="primary-modal" id="facilityBack">시설 목록으로</button>');
    record("시설 조사", f.name + "의 정보를 확인했다.");
  }

  function showCharacter() {
    const c = state.character;
    if (!c) {
      createCharacterForm();
      return;
    }
    openModal("캐릭터 정보",
      "<p><b>" + escapeHtml(c.name) + "</b> · " + escapeHtml(c.raceName) +
      " · " + escapeHtml(c.jobName) + " · LEVEL " + c.level + "</p>" +
      statHtml(c) +
      "<p>보유 골드: " + state.gold + "G</p>" +
      "<p>장착 스킬: " + (c.equippedSkills.length ? c.equippedSkills.map(escapeHtml).join(", ") : "아직 등록되지 않음") +
      " (최대 4개)</p>" +
      "<p class=\"muted\">스킬 목록과 전투 피해 계산은 기존 스킬 데이터를 확정한 뒤 연결합니다.</p>"
    );
  }

  function showView(view) {
    if (view === "story") {
      openModal("스토리 기록", "<p>당신은 1876년, 인간 제국 남부의 바텀웨이마을에 도착했습니다.</p><p>이곳에서의 선택과 행동은 로컬 활동 기록으로 저장됩니다.</p>");
    } else if (view === "character") {
      showCharacter();
    } else if (view === "inventory") {
      showInventory();
    } else if (view === "map") {
      openModal("지역 지도", "<p>현재 위치: " + escapeHtml(state.position) + "</p><p>바텀웨이마을과 바텀웨이 숲은 탐험 테스트용으로 연결했습니다. 대륙 지형과 실제 지도는 기존에 확정한 원본 지도를 기준으로 별도 반영합니다.</p>");
    } else if (view === "npcs") {
      showNpcList();
    }
  }

  $("heroName").textContent = state.character ? state.character.name : state.name;
  $("clock").textContent = "DAY " + String(state.day).padStart(2, "0") + " · 1876";
  renderCharacterPanel();
  ensureNpcStats();
  renderRegion();

  $("fullscreenBtn").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      message("이 브라우저에서는 전체 화면 전환을 사용할 수 없습니다.");
    }
  });

  $("newGameBtn").addEventListener("click", createCharacterForm);
  $("createCharacterBtn")?.addEventListener("click", createCharacterForm);

  document.querySelectorAll("[data-direction]").forEach((button) => button.addEventListener("click", () => moveDirection(button.dataset.direction)));

  window.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || modal.hidden === false) return;
    const keys = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    const direction = keys[event.key];
    if (!direction) return;
    event.preventDefault();
    moveDirection(direction);
  });

  $("moveBtn").addEventListener("click", () => moveDirection("up"));

  $("forestBtn").addEventListener("click", () => {
    if (state.activeEncounter) {
      const activeMonster = monsterForEncounter(state.activeEncounter.monsterId);
      if (activeMonster) displayEncounter(activeMonster);
      return;
    }
    if (state.region === "forest") {
      state.region = "village";
      state.position = "바텀웨이마을 광장";
      renderRegion();
      record("지역 이동", "바텀웨이마을로 돌아왔다.");
    } else {
      showForest();
    }
  });

  $("talkBtn").addEventListener("click", () => {
    if (!state.character) { createCharacterForm(); return; }
    if (state.region === "forest") {
      message("나뭇잎이 흔들리고 숲의 바람 소리가 들린다.", "이동 버튼으로 1발자국씩 이동하고, 50발자국마다 마물 조우 판정을 진행합니다.");
      record("탐험", "숲의 소리와 흔적을 살폈다.");
    } else {
      animate("talking", 1000);
      message("마을 주민이 고개를 끄덕이며 인사한다.", "“처음 보는 얼굴이군요. 길드에 가면 초보 의뢰를 받을 수 있을 거예요.”");
      record("대화", "마을 주민과 처음 인사를 나눴다.");
    }
  });

  $("attackBtn").addEventListener("click", () => {
    if (!state.character) { createCharacterForm(); return; }
    animate("attacking", 800);
    message("검을 휘둘러 공격 동작을 연습했다.", "현재는 애니메이션 테스트만 가능합니다. 스킬별 피해 공식과 전투 적용 규칙을 확정한 뒤 실제 전투를 연결합니다.");
    record("훈련 연출", "공격 애니메이션을 확인했다. 실제 피해 판정은 아직 실행하지 않았다.");
  });

  $("sceneInfo").addEventListener("click", () => {
    const region = DATA.regions.find((x) => x.id === state.region) || DATA.regions[0];
    openModal(region.name, "<p>" + escapeHtml(region.summary) + "</p>");
  });

  $("facilityBtn").addEventListener("click", showFacilities);

  document.querySelectorAll("[data-message]").forEach((btn) => btn.addEventListener("click", () => {
    const text = btn.dataset.message;
    message(text, text);
    record("장소 조사", text);
  }));

  document.querySelectorAll("[data-view]").forEach((btn) =>
    btn.addEventListener("click", () => showView(btn.dataset.view))
  );

  $("menuBtn").addEventListener("click", () => openModal("게임 메뉴",
    "<p>AI-TRPG 탐험 프로토타입</p>" +
    '<button class="primary-modal" id="menuNewGame">새 캐릭터 생성</button>' +
    '<button class="primary-modal" id="menuNpc">NPC 능력치</button>' +
    '<button class="primary-modal" id="menuForest">숲 탐험</button>'
  ));

  $("closeModal").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  modalContent.addEventListener("click", (event) => {
    const target = event.target;
    if (target.id === "rollCharacterBtn") {
      rollCharacterPreview();
      return;
    }
    if (target.id === "saveCharacterBtn") {
      saveCharacter();
      return;
    }
    if (target.id === "menuNewGame") {
      createCharacterForm();
      return;
    }
    if (target.id === "menuNpc") {
      showNpcList();
      return;
    }
    if (target.id === "menuForest") {
      showForest();
      return;
    }
    if (target.id === "facilityBack") {
      showFacilities();
      return;
    }
    if (target.id === "acceptLibraryQuestBtn") {
      acceptLibraryQuest();
      return;
    }
    if (target.id === "libraryStepBtn") {
      exploreLibraryStep();
      return;
    }
    if (target.id === "guildBuybackBtn") {
      showGuildBuyback();
      return;
    }
    if (target.id === "registerDefeatBtn") {
      registerMonsterDefeat();
      return;
    }
    if (target.id === "leaveEncounterBtn") {
      leaveEncounter();
      return;
    }
    if (target.dataset.pickup) {
      pickupGroundItem(target.dataset.pickup);
      return;
    }
    if (target.dataset.sellRemains) {
      sellRemains(target.dataset.sellRemains);
      return;
    }
    const facilityButton = target.closest("[data-facility]");
    if (facilityButton) {
      showFacility(facilityButton.dataset.facility);
    }
  });

  if (state.activeEncounter) {
    const activeMonster = monsterForEncounter(state.activeEncounter.monsterId);
    if (activeMonster) displayEncounter(activeMonster);
    else state.activeEncounter = null;
  }

  window.addEventListener("beforeunload", save);
  save();
})();