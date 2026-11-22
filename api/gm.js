const MODEL = "openai/gpt-5.4";
const rateBuckets=new Map();
function isRateLimited(req){
  const ip=String(req.headers&&req.headers["x-forwarded-for"]||"unknown").split(",")[0].trim();
  const now=Date.now(),entry=rateBuckets.get(ip)||{start:now,count:0};
  if(now-entry.start>60000){entry.start=now;entry.count=0;}
  entry.count++;rateBuckets.set(ip,entry);
  if(rateBuckets.size>500){for(const [key,value] of rateBuckets)if(now-value.start>120000)rateBuckets.delete(key);}
  return entry.count>12;
}
const WORLD_RULES = [
  "게임 세계의 현재 연도는 1876년이며 시작 마을은 인간 제국 남부 바텀웨이마을이다.",
  "타르아니움 자원 전쟁은 1116년 전 시작되었고 인간-엘프 마법 전쟁은 500년 전, 수인 전쟁은 310년 전 벰벨트론이 시작했다.",
  "대륙 북동쪽은 인간 제국, 북서쪽은 설원 엘프 지역, 남동쪽은 오크 사막 부족, 남서쪽은 드워프 이르골·그라간티움, 중앙은 풍요의 인어섬이다.",
  "인간은 이르골과 우호적이고 오크와 제한 교류하며 인어와 적대한다. 엘프는 인간·오크와 적대하고 이르골·인어와 우호적이다.",
  "오크는 이르골·그라간티움과 우호적이고 인간·엘프·인어와 거리를 둔다. 인어는 엘프·이르골과 우호적이고 인간·오크·그라간티움과 적대한다.",
  "마을 시설은 상점, 도서관, 성소, 훈련장, 길드 다섯 곳뿐이다. 새 시설·종족·역사·지역을 정식 설정으로 만들지 않는다.",
  "중요 의뢰와 기초 의뢰는 플레이어가 정한다. AI GM은 그 밖의 일반 의뢰만 제안할 수 있다.",
  "전투 판정, 피해, 주사위, LP, 골드, 아이템, 상태 변화는 게임 코드가 결정한다. AI는 수치나 판정 결과를 만들어내지 않는다.",
  "기록에 없는 스킬 공식, 아이템 가격, 직업 승급 조건, 마물 능력치를 확정된 규칙처럼 말하지 않는다."
];
function send(res,status,body){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(body));}
async function ask(messages,maxTokens=700){
  const token=process.env.VERCEL_OIDC_TOKEN||process.env.AI_GATEWAY_API_KEY;
  if(!token)throw new Error("AI_GATEWAY_AUTH_MISSING");
  const response=await fetch("https://ai-gateway.vercel.sh/v1/chat/completions",{
    method:"POST",
    headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify({model:MODEL,messages,max_tokens:maxTokens})
  });
  const raw=await response.text();let data;try{data=JSON.parse(raw);}catch{throw new Error("AI_GATEWAY_BAD_RESPONSE");}
  if(!response.ok)throw new Error("AI_GATEWAY_"+response.status);
  return data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content||"";
}
module.exports=async function handler(req,res){
  if(req.method!=="POST")return send(res,405,{error:"METHOD_NOT_ALLOWED"});
  if(Number(req.headers&&req.headers["content-length"]||0)>12000)return send(res,413,{error:"REQUEST_TOO_LARGE"});
  if(isRateLimited(req))return send(res,429,{error:"RATE_LIMITED",message:"잠시 기다린 뒤 다시 요청하세요."});
  let body=req.body;
  if(typeof body==="string"){try{body=JSON.parse(body);}catch{return send(res,400,{error:"INVALID_JSON"});}}
  if(!body||typeof body!=="object")return send(res,400,{error:"INVALID_BODY"});
  const mode=["review","job","quest"].includes(body.mode)?body.mode:"chat";
  try{
    if(mode==="review"){
      const profile=body.profile||{};
      const background=String(profile.background||"").slice(0,3000);
      if(background.length<200)return send(res,400,{error:"BACKGROUND_TOO_SHORT",message:"배경 설정은 200자 이상이어야 합니다."});
      const payload=JSON.stringify({race:profile.race,job:profile.job,appearance:String(profile.appearance||"").slice(0,500),personality:String(profile.personality||"").slice(0,500),background});
      const prompt="다음 캐릭터 설정을 세 명의 독립 심사관 관점으로 검토하라. 1) 세계관·연대기 심사관 2) 능력·밸런스 심사관 3) 바텀웨이마을 도착 경위·플레이 가능성 심사관. 각자 통과/수정 필요, 근거, 플레이 가능한 수정 제안을 짧게 작성한다. 종족과 직업은 플레이어 선택이므로 변경하지 않는다. 초능력·왕위·신적 존재·전설급 장비·세계의 핵심 사건 해결 등 과도한 설정은 플레이어가 아직 획득하지 않은 것으로 조정한다. 세 심사관이 모두 통과해야 overall='pass'. 응답은 JSON 객체 {overall:'pass'|'revise',reviews:[{reviewer,verdict,reason,suggestion}]}만 반환한다. 세계 규칙: "+WORLD_RULES.join(" ");
      const text=await ask([{role:"system",content:prompt},{role:"user",content:payload}],900);
      let result;try{result=JSON.parse(text.replace(/^\s*```json\s*|\s*```\s*$/g,""));}catch{return send(res,502,{error:"INVALID_REVIEW_FORMAT"});}
      const reviews=Array.isArray(result.reviews)?result.reviews.slice(0,3):[];
      if(reviews.length!==3)return send(res,502,{error:"INCOMPLETE_REVIEW"});
      const allPassed=reviews.every(x=>String(x.verdict||"").includes("통과"))&&result.overall==="pass";
      return send(res,200,{reviews,overall:allPassed?"pass":"revise"});
    }
    if(mode==="job"){
      const character=body.character||{};
      const allowed=Array.isArray(body.allowedJobs)?body.allowedJobs.filter(x=>x&&typeof x.id==="string"&&typeof x.name==="string").slice(0,5):[];
      if(!allowed.length)return send(res,400,{error:"NO_ALLOWED_JOBS"});
      const prompt="너는 바텀웨이마을 모험가 길드의 직업 담당 NPC 욘이다. 아래 캐릭터의 능력치, 종족, 외모, 성격, 배경을 검토해 가장 적합한 기본 직업 하나를 네 판단으로 배정한다. 플레이어에게 선택지를 보여주거나 되묻지 않는다. 반드시 허용된 직업 중 하나만 고른다. 판단은 캐릭터의 강점과 성향을 근거로 하고, 설정만으로 새로운 직업을 만들지 않는다. JSON 객체 {jobId,reason}만 반환한다. reason은 NPC 욘이 플레이어에게 직접 말하는 자연스러운 한국어 2~3문장이다. 허용 직업: "+JSON.stringify(allowed)+" 세계 규칙: "+WORLD_RULES.join(" ");
      const text=await ask([{role:"system",content:prompt},{role:"user",content:JSON.stringify(character)}],300);
      let assignment;try{assignment=JSON.parse(text.replace(/^\\s*```json\\s*|\\s*```\\s*$/g,""));}catch{return send(res,502,{error:"INVALID_JOB_FORMAT"});}
      if(!allowed.some(x=>x.id===assignment.jobId)||!assignment.reason)return send(res,502,{error:"INVALID_JOB_ASSIGNMENT"});
      const job=allowed.find(x=>x.id===assignment.jobId);
      return send(res,200,{jobId:job.id,jobName:job.name,reason:String(assignment.reason).slice(0,500)});
    }
    if(body.mode==="quest"){
      const allowed=Array.isArray(body.allowedTargets)?body.allowedTargets.filter(x=>x&&typeof x.id==="string"&&typeof x.name==="string").slice(0,8):[];
      if(!allowed.length)return send(res,400,{error:"NO_ALLOWED_TARGETS"});
      const prompt="너는 AI-TRPG의 일반 의뢰 생성 담당이다. 제공된 마물 목록 안에서만 대상을 고른다. 새로운 마물·지역·시설·아이템을 만들지 않는다. 중요한 의뢰와 기초 의뢰는 만들지 않는다. 보상은 성공 시 10 LP뿐이며 골드·아이템 보상은 임의로 추가하지 않는다. targetCount는 반드시 1이다. JSON 객체 {title,description,targetMonsterId,targetCount}만 반환한다. targetMonsterId는 허용 목록의 id와 정확히 일치해야 한다. 세계관: "+WORLD_RULES.join(" ")+"\n허용 대상: "+JSON.stringify(allowed);
      const text=await ask([{role:"system",content:prompt},{role:"user",content:"일반 의뢰 하나를 생성해."}],250);
      let q;try{q=JSON.parse(text.replace(/^\\s*```json\\s*|\\s*```\\s*$/g,""));}catch{return send(res,502,{error:"INVALID_QUEST_FORMAT"});}
      if(!allowed.some(x=>x.id===q.targetMonsterId)||!q.title||!q.description)return send(res,502,{error:"INVALID_QUEST_TARGET"});
      return send(res,200,{title:String(q.title).slice(0,80),description:String(q.description).slice(0,240),targetMonsterId:q.targetMonsterId,targetCount:1,rewardLp:10});
    }
    const message=String(body.message||"").trim().slice(0,1600);
    if(!message)return send(res,400,{error:"EMPTY_MESSAGE"});
    const npc=String(body.npc||"GM").slice(0,80);
    const context=JSON.stringify({character:body.character||null,npcProfile:body.npcProfile||null,gameState:body.gameState||null,location:String(body.location||"바텀웨이마을").slice(0,100),recentHistory:Array.isArray(body.history)?body.history.slice(-8):[]}).slice(0,9000);
    const system="너는 AI-TRPG의 게임 마스터다. 한국어로 자연스럽게 대답한다. 세계관과 규칙은 아래 내용만 따른다. 모르는 내용은 모른다고 밝히고 사용자에게 정식 규칙을 물어보라고 한다. 플레이어 선택을 대신하지 않는다. 전투 결과·주사위·피해·LP·골드·아이템을 결정하거나 수치를 제시하지 않는다. 중요한 의뢰·기초 의뢰를 임의로 만들거나 수정하지 않는다. NPC라면 전달된 인물의 말투와 역할을 유지한다. 전투·위험 상황 묘사는 비그래픽으로 유지한다. " + WORLD_RULES.join(" ");
    const reply=await ask([{role:"system",content:system},{role:"system",content:"현재 게임 상태(참고용, 규칙 변경 금지): "+context},{role:"user",content:"대화 상대: "+npc+"\n플레이어 발화: "+message}],500);
    return send(res,200,{reply:String(reply).slice(0,2500)});
  }catch(error){
    const code=String(error&&error.message||"AI_ERROR");
    if(code==="AI_GATEWAY_AUTH_MISSING")return send(res,503,{error:"AI_NOT_CONFIGURED",message:"배포 환경에서 AI Gateway 인증을 사용할 수 없습니다."});
    return send(res,502,{error:"AI_REQUEST_FAILED",message:"AI GM 요청에 실패했습니다.",detail:code.slice(0,100)});
  }
};
