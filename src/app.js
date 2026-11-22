(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const DATA = window.AITRPG_DATA;
  const STORAGE_KEY = "ai-trpg-prototype-v03";
  const oldKeys = ["ai-trpg-prototype-v02", "ai-trpg-prototype-v01"];
  const defaults = {
    name: "이름 없는 모험가",
    character: null,
    actions: [],
    day: 1,
    position: "바텀웨이마을 광장",
    region: "village",
    gold: 200,
    inventory: [],
    npcStats: {}
  };

  function loadState() {
    try {
      const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (current) return { ...defaults, ...current };
      for (const key of oldKeys) {
        const old = JSON.parse(localStorage.getItem(key));
        if (old) return { ...defaults, ...old };
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
      ["SP", stats.sp + " / " + stats.maxSp]
    ];
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
      if (!state.npcStats[npc.id]) {
        state.npcStats[npc.id] = {
          ...generateBaseStats(npc.name),
          status: "임시 능력치 초안",
          source: "캐릭터 공통 주사위 범위를 임시 적용; NPC 전용 규칙 미확정"
        };
      }
    }
    save();
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
      message("숲의 나무 사이로 바람이 지나간다.", "주변 마물의 흔적을 살피거나 마물 목록에서 능력치를 확인할 수 있습니다.");
    } else {
      message("광장에는 상인들의 목소리와 분수 소리가 잔잔하게 퍼진다.", "바텀웨이마을로 돌아왔습니다. 시설과 NPC를 살펴보세요.");
    }
    save();
  }

  function showForest() {
    if (!state.character) {
      createCharacterForm();
      return;
    }
    state.region = "forest";
    state.position = "바텀웨이 숲";
    renderRegion();
    openModal("바텀웨이 숲",
      "<p>" + escapeHtml(DATA.regions[1].summary) + "</p>" +
      "<p class=\"muted\">현재 등록된 마물이 없습니다. 마물 설정은 사용자가 직접 작성할 예정입니다.</p>"
    );
    record("지역 이동", "바텀웨이 숲에 진입했다. 현재 마물 데이터는 비어 있다.");
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
      "<p class=\"muted\">NPC 능력치는 임시로 플레이어 공통 주사위 범위를 적용해 생성했습니다. NPC 전용 규칙과 개별 밸런스는 아직 확정되지 않았습니다.</p>" + cards);
    record("NPC 조사", "바텀웨이마을 NPC의 임시 능력치 정보를 확인했다.");
  }

  function animate(name, duration) {
    stage.classList.remove("walking", "attacking", "talking");
    void stage.offsetWidth;
    stage.classList.add(name);
    window.setTimeout(() => stage.classList.remove(name), duration);
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
      openModal("가방", "<p>보유 골드: " + state.gold + "G</p><p>보유 아이템: " +
        (state.inventory.length ? state.inventory.map((x) => escapeHtml(x.name)).join(", ") : "없음") + "</p>");
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

  $("moveBtn").addEventListener("click", () => {
    if (!state.character) { createCharacterForm(); return; }
    if (state.region === "forest") {
      state.region = "village";
      state.position = "바텀웨이마을 광장";
      renderRegion();
      record("지역 이동", "바텀웨이마을로 돌아왔다.");
      return;
    }
    animate("walking", 1200);
    const places = ["바텀웨이마을 광장", "모험가 길드 앞", "마을 시장", "남쪽 마을 입구"];
    const current = places.indexOf(state.position);
    state.position = places[(current + 1 + places.length) % places.length];
    message(state.position + "으로 이동했습니다.", "마을 주변을 살펴보세요. 숲 탐험 버튼으로 바깥 지역에 진입할 수 있습니다.");
    record("이동", state.position + "으로 이동했다.");
  });

  $("forestBtn").addEventListener("click", showForest);

  $("talkBtn").addEventListener("click", () => {
    if (!state.character) { createCharacterForm(); return; }
    if (state.region === "forest") {
      message("나뭇잎이 흔들리고 숲 안쪽에서 작은 발소리가 들린다.", "숲의 마물 흔적을 조사할 수 있습니다.");
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
    const facilityButton = target.closest("[data-facility]");
    if (facilityButton) {
      showFacility(facilityButton.dataset.facility);
    }
  });

  window.addEventListener("beforeunload", save);
  save();
})();