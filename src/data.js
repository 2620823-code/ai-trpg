window.AITRPG_DATA = {
  village: { name:"바텀웨이마을", year:1876, region:"인간 제국 남부" },
  facilities: [
    {id:"shop",name:"상점",owner:"덴비 월 호웨이",summary:"포션·저급 무기·기초 서적 판매",icon:"shop",
      rules:["덴비는 57세이며 대머리와 풍성한 콧수염, 약간 통통한 체격이다.","T셔츠와 남방 조끼를 입는다.","돈과 용감한 사람을 좋아한다.","가격 흥정을 요구하면 화를 내며 가격을 올릴 수도 있다. 마을 사람들은 그를 친절하다고 말한다."],
      items:[
        {name:"저급 포션",price:10,effect:"HP +50",type:"회복"},
        {name:"중급 포션",price:50,effect:"HP +100",type:"회복"},
        {name:"상급 포션",price:100,effect:"HP +250",type:"회복"},
        {name:"나무 검",price:35,effect:"데미지 보정 +10 · 최대 PP 10",type:"무기",restriction:"검사 계열 전용"},
        {name:"나무 단검",price:15,effect:"데미지 보정 +5 · 최대 PP 10",type:"무기",restriction:"도적 계열 전용"},
        {name:"나무 몽둥이",price:25,effect:"데미지 보정 +3 · 최대 PP 10",type:"무기",restriction:"모든 직업 구매 가능"},
        {name:"나무 지팡이",price:30,effect:"무기 보정치 +10 · 최대 PP 10",type:"무기",restriction:"마법사·암흑술사 전용"},
        {name:"녹슨 철검",price:100,effect:"데미지 보정 +25 · 최대 PP 15",type:"무기",restriction:"기술자·검사·도적 계열 전용",note:"대장간에서 수리할 수 있을 것 같다."},
        {name:"기초 마법서",price:150,effect:"마법사 초급 스킬 하나를 고정 습득",type:"서적",restriction:"마법사·암흑술사·주술사·마검사·마도구학자만 구매·열람 가능"},
        {name:"기초 훈련서",price:150,effect:"격투가 초급 스킬 하나 습득",type:"서적",restriction:"격투가 전용"},
        {name:"저급 스킬북",price:200,effect:"직업에 맞는 저급 스킬 하나를 무작위로 알려줌",type:"서적"}
      ],
      weaponRules:["모든 무기는 소모성이다.","공격이 명중하면 PP 1 감소한다.","공격이 빗나가면 PP는 감소하지 않는다.","PP가 0이 되면 무기가 파괴된다."]
    },
    {id:"library",name:"도서관",owner:"하멜",summary:"도서관 내부에서 책을 열람하고 서가를 탐색할 수 있다. 50발자국마다 책의 미믹 조우 판정을 한다.",icon:"library",
      rules:["길드 등록자는 무료 입장할 수 있다.","길드 미등록자는 입장료 20G를 낸다.","책 대여는 불가능하며 내부 열람만 가능하다.","책을 무단 반출하면 하멜이 적대적으로 변한다.","적대 상태에서 다시 입장하면 하멜이 전투를 건다."],
      books:["중급 마법서","약초학","마물학(저급)","기술서","훈련서","검술서","암흑서"],
      npc:["건장한 체격에 은근히 근육이 많고 펌한 머리와 푸른 눈을 가졌다.","온순하며 밖에 나가는 것을 싫어한다.","평소에는 친절하지만 책 무단 반출자에게 자비를 베풀지 않는다."]
    },
    {id:"sanctuary",name:"성소",owner:"빌리 · 폰타",summary:"부활과 성자 직업 전직 경로가 있는 다신교 성소.",icon:"sanctuary",
      rules:["성소에는 별도의 주인이 없다.","빌리와 폰타는 건실한 종교인 부부다.","사망자를 누군가 성소로 데려와야 한다. 데려오는 사람은 NPC 또는 온라인 동료일 수 있다.","NPC는 사망자를 이동시켜 줄 뿐 부활 비용을 대신 내지 않는다.","성소 부활 비용은 200G이며 사망한 사람의 돈에서 차감한다.","성자 전직 과정에서 네 신 중 하나를 직접 선택한다."],
      deities:["태양신","풍요신","혼돈신","축복신"],
      saint:["선택한 신앙에 따라 성자 스킬이 달라진다."],
      npcs:[
        {name:"빌리",details:["남성, 건장한 체격, 고운 머리, 성자의 모자와 종교 의복","태양신 신앙","매우 착하고 다정하며 폰타의 남편","기초 마법 외에 중급 마법도 안다.","종교 모욕, 폰타 모욕 또는 폰타를 빼앗으려는 행동에 전투로 대응한다."]},
        {name:"폰타",details:["여성, 뒤로 땋은 긴 머리, 종교 의복","매우 착하고 다정하며 빌리의 아내","종교 모욕, 빌리 모욕 또는 빌리를 빼앗으려는 행동을 한 사람을 내쫓는다."]}
      ]
    },
    {id:"training",name:"훈련장",owner:"게일",summary:"허수아비를 이용해 20턴 동안 스킬을 사용하며 검술·마법·격투 등을 단련한다.",icon:"training",
      entryFee:20,
      rules:[
        "훈련장 입장료는 20G다.",
        "훈련 1회는 20턴 동안 진행한다.",
        "훈련 1회 완료 시 훈련 게이지가 +1 증가하며 최대 8까지 쌓인다.",
        "훈련 게이지가 8이 되면 훈련의 성과 아이템으로 전환된다.",
        "훈련의 성과를 사용해 스킬을 최대 3회 각성할 수 있다.",
        "각성할 때마다 SP 소모량 0.5 감소 또는 스킬 배율 +0.1 중 하나를 선택한다.",
        "SP 소모량은 1 미만으로 내려가지 않는다.",
        "이판사판만 사용해 훈련을 5회 완료하면 공용 스킬 브레이브 대쉬를 습득한다.",
        "훈련 중 다른 스킬을 사용해도 훈련 게이지는 정상 증가하지만 브레이브 대쉬 조건 횟수에는 포함되지 않는다."
      ],
      npc:["게일은 전사이며 전신 갑옷을 입고 견고한 철검을 든다.","자신을 모욕하지 않으면 안내 외에는 침묵한다.","길드에 있을 때는 대화할 수 있다.","길드에서 자신을 모욕하면 전투를 건다."]
    },
    {id:"guild",name:"길드",owner:"벨 · 욘 · 처콜",summary:"가입·직업 선택·물품 거래·의뢰 수락을 담당하는 모험가 거점.",icon:"guild",
      rules:["다섯 종족 모두 차별 없이 가입할 수 있다.","0성 길드원은 책 정리와 광장 청소 같은 기초 업무부터 시작한다.","승급에는 같은 등급 길드원 3명과 대결해 최소 2승해야 한다.","욕설이나 모욕적인 말을 하면 길드에서 쫓겨난다.","NPC는 고정·요일별 정기 방문·완전 무작위 방문 유형으로 등장한다. 고정적으로 있는 인물은 길드장들이다."],
      npcs:[
        {name:"벨",role:"길드 가입 및 메인 로비 안내",details:["여성, 금색 포니테일, 길드복","다정하게 말하며 안내가 필요할 때는 정확하고 진지하게 설명한다."]},
        {name:"욘",role:"직업 선택 담당",details:["남성, 곱슬머리, 길드복","차갑고 고집스럽다. 필요한 정보는 알려주고 자기 일을 하는 편이다."]},
        {name:"처콜",role:"길드 상점 매입·판매",details:["남성, 올백 머리, 길드복","돈과 사람들과 어울리는 것을 모두 좋아한다.","흥정은 가격을 올리지 않고 거절한다.","상점의 포션과 저급 무기를 판매하고 플레이어 물품도 매입한다. 매입 가격은 미정이다."]}
      ],
      board:["길드 내부에 별도의 임무·의뢰 게시판이 있다.","중요 의뢰와 기초 의뢰는 사용자가 직접 정한다.","그 밖의 일반 의뢰는 AI GM이 자동 생성한다.","보상은 의뢰 난이도와 별 등급에 따라 달라지며 금전 또는 아이템으로 지급될 수 있다.","의뢰별 보상 금액과 아이템은 개별 설정 또는 AI GM 생성 데이터로 관리한다."]
    }
  ]
};

window.AITRPG_DATA.statRules = {
  hp: { dice: 250, floor: 150, cap: 1000 },
  strength: { dice: 50, cap: 150 },
  intelligence: { dice: 50, cap: 150 },
  defense: { dice: 50, cap: 100 },
  luck: { dice: 25, cap: 100 },
  speed: { dice: 30, cap: 200 },
  precision: { dice: 40, cap: 195 },
  sp: { start: 25, cap: 150 },
  note: "캐릭터 생성용 주사위 범위. NPC·마물에게 적용한 수치는 임시 테스트 초안이며 사용자 확정 규칙이 아님."
};

window.AITRPG_DATA.races = [
  {id:"human",name:"인간",bonus:{strength:5,intelligence:5}},
  {id:"elf",name:"엘프",bonus:{intelligence:10}},
  {id:"orc",name:"오크",bonus:{hp:10}},
  {id:"dwarf",name:"드워프",bonus:{strength:10}},
  {id:"mermaid",name:"인어",bonus:{speed:10}}
];

window.AITRPG_DATA.jobs = [
  {id:"swordsman",name:"검사"},
  {id:"mage",name:"마법사"},
  {id:"technician",name:"기술자"},
  {id:"fighter",name:"격투가"},
  {id:"rogue",name:"도적"}
];

window.AITRPG_DATA.regions = [
  {
    id:"village",
    name:"바텀웨이마을",
    type:"safe-area",
    summary:"인간 제국 남부의 초급 모험가 마을. 상점, 도서관, 성소, 훈련장, 길드가 있다."
  },
  {
    id:"forest",
    name:"바텀웨이 숲",
    type:"field",
    status:"탐험 구역",
    summary:"마을 바깥의 숲 탐험 구역. 50발자국마다 1d100을 굴려 20 이하이면 마물을 조우한다."
  }
];

window.AITRPG_DATA.monsters = [
  {id:"weak-goblin",name:"약골 고블린",kind:"goblin",zone:"forest",spawnWeight:0.5,stats:{hp:100,strength:25,intelligence:5,defense:20,speed:30}},
  {id:"weak-spider",name:"약골 거미",kind:"spider",zone:"forest",spawnWeight:1,stats:{hp:80,strength:40,intelligence:10,defense:5,speed:40}},
  {id:"goblin",name:"고블린",kind:"goblin",zone:"forest",spawnWeight:0.5,stats:{hp:150,strength:40,intelligence:5,defense:25,speed:25}},
  {id:"weak-mimic",name:"약골 미믹",kind:"mimic-base",zone:"variant-template",spawnWeight:0,stats:{hp:1,strength:20,intelligence:20,defense:null,speed:40}},
  {id:"treasure-mimic",name:"보물 속 미믹",kind:"mimic",zone:"forest",variantOf:"weak-mimic",spawnWeight:1,appearance:"treasure"},
  {id:"book-mimic",name:"책의 미믹",kind:"mimic",zone:"library",variantOf:"weak-mimic",spawnWeight:1,appearance:"book"}
];

window.AITRPG_DATA.encounters = {
  forest: {stepInterval:50,rollSides:100,encounterOnOrBelow:20,pool:["weak-goblin","weak-spider","goblin","treasure-mimic"],note:"고블린 계열의 출현 가중치는 다른 마물의 절반으로 임시 설정(0.5)."},
  library: {stepInterval:50,rollSides:100,encounterOnOrBelow:20,pool:["book-mimic"]}
};

window.AITRPG_DATA.forestItems = {
  bigApple: {id:"big-apple",name:"큰사과",type:"consumable",spawnStepMin:1,spawnStepMax:50,spawnMode:"random-step"},
  inventoryLimit:30
};

window.AITRPG_DATA.libraryQuest = {
  id:"book-mimic-hunt",
  name:"도서관의 책의 미믹 퇴치",
  description:"도서관에 출현한 책의 미믹 3마리를 처치한다.",
  targetMonsterId:"book-mimic",
  targetCount:3,
  reward:{gold:20,item:{id:"skill-book",name:"스킬북",type:"skill-book"}}
};

window.AITRPG_DATA.guildBuybackPrices = {
  "마물 유해": null
};


window.AITRPG_DATA.npcs = [
  {id:"denby",name:"덴비 월 호웨이",facility:"상점",role:"상점 주인",temperament:"돈과 용감한 사람을 좋아하며 흥정을 싫어한다.",canBattle:false},
  {id:"hamel",name:"하멜",facility:"도서관",role:"도서관 관리인",temperament:"평소 온순하지만 책을 무단 반출한 사람에게 적대적이다.",canBattle:true},
  {id:"billy",name:"빌리",facility:"성소",role:"성소 관계자",temperament:"태양신을 믿으며 폰타와 종교를 모욕하면 전투로 대응한다.",canBattle:true},
  {id:"fonta",name:"폰타",facility:"성소",role:"성소 관계자",temperament:"빌리나 종교를 모욕하면 상대를 내쫓는다.",canBattle:false},
  {id:"gale",name:"게일",facility:"훈련장",role:"훈련장 안내자",temperament:"평소 안내만 하지만 모욕을 당하면 전투를 건다.",canBattle:true},
  {id:"bell",name:"벨",facility:"길드",role:"길드 가입 및 로비 안내",temperament:"친절하고 정확하게 설명한다.",canBattle:false},
  {id:"yon",name:"욘",facility:"길드",role:"직업 선택 담당",temperament:"차갑고 고집스럽지만 필요한 정보는 알려준다.",canBattle:false},
  {id:"cheorkol",name:"처콜",facility:"길드",role:"길드 상점 담당",temperament:"돈과 사교를 좋아하며 흥정은 거절한다.",canBattle:false}
];

window.AITRPG_DATA.statPrototypeNote = "NPC와 마물 능력치는 캐릭터 생성용 주사위 범위를 임시 재사용한 테스트 값이다. NPC·마물 전용 생성 규칙이나 전투 밸런스로 확정된 것이 아니다.";
