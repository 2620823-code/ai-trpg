(() => {
  const $ = (id) => document.getElementById(id);
  const stage = $("heroStage");
  const logList = $("logList");
  const caption = $("sceneCaption");
  const gmText = $("gmText");
  const saveState = $("saveState");
  const modal = $("modal");
  const modalContent = $("modalContent");
  const STORAGE_KEY = "ai-trpg-prototype-v01";
  const state = loadState();

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { name: "이름 없는 모험가", actions: [], day: 1, position: "바텀웨이마을 광장" };
    } catch { return { name: "이름 없는 모험가", actions: [], day: 1, position: "바텀웨이마을 광장" }; }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveState.textContent = "● 기록 저장됨";
  }
  function record(type, detail) {
    const entry = { at: new Date().toISOString(), day: state.day, type, detail, place: state.position };
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
  function openModal(title, html) {
    modalContent.innerHTML = "<h2>" + title + "</h2>" + html;
    modal.hidden = false;
  }
  function closeModal() { modal.hidden = true; }

  $("heroName").textContent = state.name;
  $("clock").textContent = "DAY " + String(state.day).padStart(2, "0") + " · 1876";
  save();

  $("fullscreenBtn").addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch { message("이 브라우저에서는 전체 화면 전환을 사용할 수 없습니다."); }
  });
  $("menuBtn").addEventListener("click", () => openModal("게임 메뉴", '<p>AI-TRPG 초기 프로토타입입니다.</p><ul><li>스토리 모드</li><li>캐릭터 및 기록</li><li>보너스 모드 연결은 기존 DICE RPG와의 안전한 연결 단계에서 추가됩니다.</li></ul><button class="primary-modal" id="renameBtn">캐릭터 이름 설정</button>'));
  $("moveBtn").addEventListener("click", () => {
    animate("walking", 1600);
    const places = ["바텀웨이마을 광장", "모험가 길드 앞", "마을 시장", "남쪽 마을 입구"];
    const next = places[(places.indexOf(state.position) + 1) % places.length];
    state.position = next;
    message(next + "으로 이동했습니다.", "주변 풍경을 살펴보세요. 이동 기록은 계정 활동 기록에 저장됩니다.");
    record("이동", next + "으로 이동했다.");
  });
  $("talkBtn").addEventListener("click", () => {
    animate("talking", 1000);
    message("마을 주민이 고개를 끄덕이며 인사한다.", "“처음 보는 얼굴이군요. 길드에 가면 초보 의뢰를 받을 수 있을 거예요.”");
    record("대화", "마을 주민과 처음 인사를 나눴다.");
  });
  $("attackBtn").addEventListener("click", () => {
    animate("attacking", 800);
    message("검을 휘둘러 공격 동작을 연습했다.", "훈련용 공격 애니메이션입니다. 아직 전투 판정이나 피해는 발생하지 않습니다.");
    record("훈련", "검 휘두르기 동작을 연습했다. 실제 전투 판정은 아직 연결되지 않았다.");
  });
  $("sceneInfo").addEventListener("click", () => openModal("바텀웨이마을", "<p>인간 제국 남부에 위치한 초급 모험가 구역입니다.</p><p>마을 광장과 시장, 분수대, 모험가 길드가 자리하고 있습니다.</p><p>현재는 시작 지역의 시각적·탐색 프로토타입이며, 실제 지도 좌표와 이동 규칙은 추후 연결합니다.</p>"));
  $("facilityBtn").addEventListener("click", showFacilities);
  function showFacilities() {
    const facilities = window.AITRPG_DATA.facilities;
    const cards = facilities.map(f => '<button class="facility-card" data-facility="' + f.id + '"><span class="facility-icon"><svg viewBox="0 0 160 120"><use href="./assets/facilities.svg#' + f.icon + '"></use></svg></span><span><b>' + f.name + '</b><small>' + f.summary + '</small></span><i>열기 →</i></button>').join("");
    openModal("바텀웨이마을 시설", '<p>시설을 선택해 등록된 정보와 이용 규칙을 확인할 수 있습니다.</p><div class="facility-grid">' + cards + '</div>');
  }
  function showFacility(id) {
    const f = window.AITRPG_DATA.facilities.find(x => x.id === id);
    if (!f) return;
    const lines = [];
    if (f.owner) lines.push('<p><b>담당 NPC:</b> ' + f.owner + '</p>');
    if (f.entryFee !== undefined) lines.push('<p><b>입장료:</b> ' + f.entryFee + 'G</p>');
    if (f.items) lines.push('<h3>판매 목록</h3><div class="table-wrap"><table><thead><tr><th>상품</th><th>가격</th><th>효과·제한</th></tr></thead><tbody>' + f.items.map(x => '<tr><td>' + x.name + '</td><td>' + x.price + 'G</td><td>' + x.effect + (x.restriction ? '<small>' + x.restriction + '</small>' : '') + '</td></tr>').join("") + '</tbody></table></div>');
    if (f.weaponRules) lines.push('<h3>무기 PP 규칙</h3><ul>' + f.weaponRules.map(x=>'<li>'+x+'</li>').join("") + '</ul>');
    if (f.books) lines.push('<h3>소장 도서</h3><ul>' + f.books.map(x=>'<li>'+x+'</li>').join("") + '</ul>');
    if (f.deities) lines.push('<h3>신앙 대상</h3><p>' + f.deities.join(" · ") + '</p>');
    if (f.npcDetails) lines.push('<h3>NPC 정보</h3><ul>' + f.npcDetails.map(x=>'<li>'+x+'</li>').join("") + '</ul>');
    if (f.npcs) lines.push('<h3>NPC 정보</h3>' + f.npcs.map(n => '<div class="npc-note"><b>' + (n.name || "NPC") + (n.role ? ' · ' + n.role : '') + '</b><ul>' + (n.details || []).map(x=>'<li>'+x+'</li>').join("") + '</ul></div>').join(""));
    if (f.rules) lines.push('<h3>이용 규칙</h3><ul>' + f.rules.map(x=>'<li>'+x+'</li>').join("") + '</ul>');
    if (f.board) lines.push('<h3>의뢰 게시판</h3><ul>' + f.board.map(x=>'<li>'+x+'</li>').join("") + '</ul>');
    openModal(f.name, '<p>' + f.summary + '</p>' + lines.join("") + '<button class="primary-modal" id="facilityBack">시설 목록으로</button>');
    record("시설 조사", f.name + "의 정보를 확인했다.");
  }
  document.querySelectorAll("[data-message]").forEach(btn => btn.addEventListener("click", () => {
    const text = btn.dataset.message;
    message(text, text);
    record("장소 조사", text);
  }));
  document.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => showView(btn.dataset.view)));
  function showView(view) {
    const content = {
      story: ["스토리 기록", "<p>당신은 1876년, 인간 제국 남부의 바텀웨이마을에 도착했습니다.</p><p>이곳에서의 선택과 행동은 활동 기록으로 저장됩니다.</p>"],
      character: ["캐릭터 정보", '<p>이름: ' + escapeHtml(state.name) + '</p><p>종족과 직업, 주사위 기반 능력치 생성은 다음 구현 단계에서 연결합니다. 아직 생성되지 않은 스탯은 임의로 채우지 않습니다.</p>'],
      inventory: ["가방", "<p>현재 보유 아이템은 없습니다. 장비 및 인벤토리 시스템은 다음 구현 단계에서 추가됩니다.</p>"],
      facilities: ["시설", "<p>바텀웨이마을의 시설 정보를 확인하세요.</p><button class=\"primary-modal\" id=\"openFacilities\">시설 목록 열기</button>"],\n      map: ["세계 지도", "<p>현재 위치: " + escapeHtml(state.position) + "</p><p>대륙의 실제 지형과 지역 연결은 네가 확정한 원본 지도를 기준으로 반영할 예정입니다. 임시 지도 데이터로 확정 지형을 대체하지 않습니다.</p>"],
    }[view];
    if (content) openModal(content[0], content[1]);\n    if (view === "facilities") showFacilities();
  }
  $("closeModal").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
  modalContent.addEventListener("click", (event) => {
    if (event.target.id === "openFacilities") { showFacilities(); return; }\n    if (event.target.id === "facilityBack") { showFacilities(); return; }\n    const facilityButton = event.target.closest("[data-facility]");
    if (facilityButton) { showFacility(facilityButton.dataset.facility); return; }\n    if (event.target.id === "renameBtn") {
      modalContent.innerHTML = '<h2>캐릭터 이름</h2><label for="nameInput">이름</label><input id="nameInput" maxlength="20" value="' + escapeHtml(state.name) + '"><button class="primary-modal" id="saveName">저장</button>';
    }
    if (event.target.id === "saveName") {
      const value = $("nameInput").value.trim();
      if (!value) return;
      state.name = value;
      $("heroName").textContent = value;
      record("캐릭터", "캐릭터 이름을 " + value + "으로 설정했다.");
      closeModal();
    }
  });
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }
  window.addEventListener("beforeunload", save);
})();