const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/gm.js");

function responseMock() {
  return { statusCode: 0, headers: {}, body: "", setHeader(k,v){this.headers[k]=v;}, end(v){this.body=v;} };
}
function completion(content) {
  return { ok:true, status:200, text:async()=>JSON.stringify({choices:[{message:{content:JSON.stringify(content)}}]}) };
}
const passingReview = {
  overall:"pass",
  reviews:[
    {reviewer:"세계관 심사관",verdict:"통과",reason:"일치",suggestion:"없음"},
    {reviewer:"밸런스 심사관",verdict:"통과",reason:"적절",suggestion:"없음"},
    {reviewer:"플레이 가능성 심사관",verdict:"통과",reason:"가능",suggestion:"없음"}
  ]
};

test("GM endpoint rejects non-POST requests", async () => {
  const res=responseMock();await handler({method:"GET",headers:{}},res);
  assert.equal(res.statusCode,405);
});

test("character review enforces the 200-character background minimum", async () => {
  const res=responseMock();await handler({method:"POST",headers:{"x-forwarded-for":"test-short"},body:{mode:"review",profile:{background:"짧은 설정"}}},res);
  assert.equal(res.statusCode,400);
  assert.equal(JSON.parse(res.body).error,"BACKGROUND_TOO_SHORT");
});

test("character review authenticates with the Vercel request OIDC header and requests JSON", async () => {
  const previousFetch=global.fetch;
  const previousKey=process.env.AI_GATEWAY_API_KEY;
  const previousToken=process.env.VERCEL_OIDC_TOKEN;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  let requestOptions;
  global.fetch=async(_url,options)=>{requestOptions=options;return completion(passingReview);};
  try {
    const res=responseMock();
    await handler({
      method:"POST",
      headers:{"x-forwarded-for":"test-review-auth","x-vercel-oidc-token":"request-scoped-test-token"},
      body:{mode:"review",profile:{background:"배경 설명 ".repeat(60)}}
    },res);
    assert.equal(res.statusCode,200);
    assert.equal(JSON.parse(res.body).overall,"pass");
    assert.equal(JSON.parse(res.body).reviews.length,3);
    assert.equal(requestOptions.headers.Authorization,"Bearer request-scoped-test-token");
    assert.deepEqual(JSON.parse(requestOptions.body).response_format,{type:"json_object"});
  } finally {
    global.fetch=previousFetch;
    if(previousKey===undefined)delete process.env.AI_GATEWAY_API_KEY;else process.env.AI_GATEWAY_API_KEY=previousKey;
    if(previousToken===undefined)delete process.env.VERCEL_OIDC_TOKEN;else process.env.VERCEL_OIDC_TOKEN=previousToken;
  }
});

test("character review reports missing authentication without calling the gateway", async () => {
  const previousFetch=global.fetch;
  const previousKey=process.env.AI_GATEWAY_API_KEY;
  const previousToken=process.env.VERCEL_OIDC_TOKEN;
  delete process.env.AI_GATEWAY_API_KEY;
  delete process.env.VERCEL_OIDC_TOKEN;
  global.fetch=async()=>{throw new Error("Gateway should not be called without authentication");};
  try {
    const res=responseMock();
    await handler({method:"POST",headers:{"x-forwarded-for":"test-no-auth"},body:{mode:"review",profile:{background:"배경 설명 ".repeat(60)}}},res);
    assert.equal(res.statusCode,503);
    assert.equal(JSON.parse(res.body).error,"AI_NOT_CONFIGURED");
  } finally {
    global.fetch=previousFetch;
    if(previousKey!==undefined)process.env.AI_GATEWAY_API_KEY=previousKey;
    if(previousToken!==undefined)process.env.VERCEL_OIDC_TOKEN=previousToken;
  }
});

test("quest generation only accepts a target from the supplied allowlist", async () => {
  const previous=global.fetch;
  global.fetch=async()=>completion({title:"임의 의뢰",description:"허용되지 않은 대상",targetMonsterId:"not-allowed",targetCount:1});
  try {
    const res=responseMock();
    await handler({method:"POST",headers:{"x-forwarded-for":"test-quest","x-vercel-oidc-token":"test-token"},body:{mode:"quest",allowedTargets:[{id:"weak-spider",name:"약골 거미"}]}},res);
    assert.equal(res.statusCode,502);
    assert.equal(JSON.parse(res.body).error,"INVALID_QUEST_TARGET");
  } finally { global.fetch=previous; }
});

test("AI GM returns exactly three story options with at least 200 characters each", async () => {
  const previous=global.fetch;
  const paragraph="바텀웨이마을에 도착하기 전, 이 인물은 가족의 생계를 돕기 위해 여러 마을을 오가며 평범한 일을 했다. 낯선 곳에서 작은 실수를 겪기도 했지만, 그 과정에서 다른 사람의 사정을 듣고 도움을 주는 법을 배웠다. 어느 날 남부로 향하는 상인의 짐을 나르는 일을 맡았고, 그 여정의 끝에서 모험가 길드의 소문을 들었다. 특별한 혈통이나 힘은 없지만 새로운 삶을 시작하고 싶어 바텀웨이마을에 머물기로 했다.";
  global.fetch=async()=>completion({options:[
    {title:"상인의 동행자",background:paragraph,hook:"상단 일을 돕다 길드의 소문을 들었다."},
    {title:"잃어버린 편지",background:paragraph+" 마을에 도착한 뒤 오래된 편지를 전할 사람을 찾고 있다.",hook:"평범한 부탁을 해결하며 모험을 시작한다."},
    {title:"새로운 기술",background:paragraph+" 이전의 일을 정리하고 새로운 기술을 배우려 마을에 왔다.",hook:"작은 일부터 시작하려 한다."}
  ]});
  try{
    const res=responseMock();
    await handler({method:"POST",headers:{"x-forwarded-for":"test-story-options","x-vercel-oidc-token":"test-token"},body:{mode:"storyOptions",profile:{race:"인간",appearance:"여행자",personality:"신중함",background:"기존 설정"},feedback:"왕족 설정은 유지하고 싶지 않음"}},res);
    const result=JSON.parse(res.body);
    assert.equal(res.statusCode,200);
    assert.equal(result.options.length,3);
    assert.ok(result.options.every(x=>x.background.length>=200));
  }finally{global.fetch=previous;}
});

test("AI GM rejects generated story options shorter than 200 characters", async () => {
  const previous=global.fetch;
  global.fetch=async()=>completion({options:[
    {title:"짧은 이야기",background:"너무 짧은 설정",hook:"요약"},
    {title:"짧은 이야기 2",background:"너무 짧은 설정",hook:"요약"},
    {title:"짧은 이야기 3",background:"너무 짧은 설정",hook:"요약"}
  ]});
  try{
    const res=responseMock();
    await handler({method:"POST",headers:{"x-forwarded-for":"test-story-short","x-vercel-oidc-token":"test-token"},body:{mode:"storyOptions",profile:{race:"인간"}}},res);
    assert.equal(res.statusCode,502);
    assert.equal(JSON.parse(res.body).error,"INVALID_STORY_OPTIONS");
  }finally{global.fetch=previous;}
});

test("AI Gateway access restrictions return a safe account-admin message", async () => {
  const previous=global.fetch;
  global.fetch=async()=>({ok:false,status:403,text:async()=>JSON.stringify({error:{message:"AI Gateway requires a valid credit card on file to service requests."}})});
  try{
    const res=responseMock();
    await handler({method:"POST",headers:{"x-forwarded-for":"test-gateway-403","x-vercel-oidc-token":"test-token"},body:{mode:"storyOptions",profile:{race:"인간"}}},res);
    const result=JSON.parse(res.body);
    assert.equal(res.statusCode,503);
    assert.equal(result.error,"AI_ACCESS_RESTRICTED");
    assert.ok(!JSON.stringify(result).toLowerCase().includes("credit card"));
  }finally{global.fetch=previous;}
});
