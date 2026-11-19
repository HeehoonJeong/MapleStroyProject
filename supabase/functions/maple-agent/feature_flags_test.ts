import {handleMapleRequest, availableMapleTools} from './index.ts';
Deno.env.set('OPENAI_API_KEY','test-key');
Deno.test('disabled tools cannot be invoked directly',async()=>{for(const guest of [true,false]) for(const feature of ['estimate_boss_clear','analyze_auction_screenshot','search_maple_guide']) {const request=new Request('https://example.test',{method:'POST',body:JSON.stringify({prompt:'메이플 질문',feature})});const response=await handleMapleRequest(request,{userClaims:{id:'test'}},guest);if(response.status!==403)throw Error(`${feature}: ${response.status}`);}});

Deno.test("automatic registry excludes disabled tools",()=>{const tools=availableMapleTools({estimate_boss_clear:"boss",analyze_auction_screenshot:"auction",search_maple_guide:"guide",search_maple_notices:"notices"});if(tools.length!==1||tools[0]!=="notices")throw Error("disabled tool included");});
