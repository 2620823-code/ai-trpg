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
    await handler({method:"POST",headers:{"x-forwarded-for":"test-quest"},body:{mode:"quest",allowedTargets:[{id:"weak-spider",name:"약골 거미"}]}},res);
    assert.equal(res.statusCode,502);
    assert.equal(JSON.parse(res.body).error,"INVALID_QUEST_TARGET");
  } finally { global.fetch=previous; }
});
