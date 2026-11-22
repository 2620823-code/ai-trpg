(function(root){
  "use strict";
  function requiredLp(level){return Math.max(1,Math.min(10000,Number(level)||1))*50;}
  function applyLp(character,amount){
    if(!character||character.dead||!Number.isFinite(amount)||amount<=0)return {gained:0,remaining:character&&character.lp||0,level:character&&character.level||1};
    character.level=Math.max(1,Math.min(10000,Number(character.level)||1));
    character.lp=Math.max(0,Number(character.lp)||0)+amount;
    character.nextLp=Number(character.nextLp)||requiredLp(character.level);
    let gained=0;
    while(character.level<10000&&character.lp>=character.nextLp){
      character.lp-=character.nextLp;character.level++;character.statPoints=(Number(character.statPoints)||0)+1;
      gained++;character.nextLp=requiredLp(character.level);
    }
    character.exp=character.lp;character.nextExp=character.nextLp;
    return {gained,remaining:character.lp,level:character.level,nextLp:character.nextLp};
  }
  root.AITRPG_PROGRESSION={requiredLp,applyLp};
})(window);
