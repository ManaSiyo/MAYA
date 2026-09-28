import {randomUUID} from 'node:crypto';
import {jsonStore,problem,clip} from './crm-store.mjs';
// Standard text rates, USD per million tokens. Verified against provider docs 2026-09-27.
// Only these priced models may use the CRM's daily allowance. No tools or image inputs.
export const ECONOMY_MODELS={
  openai:{model:'gpt-5-nano',input:.05,output:.4},
  anthropic:{model:'claude-haiku-4-5-20251001',input:1,output:5},
  gemini:{model:'gemini-2.5-flash-lite',input:.1,output:.4}
};
export const budgetDay=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function createCrmAI(deps) {
  const db=jsonStore(deps),keys=deps.keys||{},fetcher=deps.fetch||fetch,clock=deps.now||(()=>new Date());
  const path=(uid,day)=>'private/outbound/usage/'+encodeURIComponent(uid)+'/'+day+'.json';
  const vertex=deps.vertex;
  const connected=()=>Object.entries(ECONOMY_MODELS).map(([provider,p])=>({provider,...p,connected:!!keys[provider]||(provider==='gemini'&&!!vertex),transport:provider==='gemini'&&vertex?'vertex':'api',verification:'configured'}));
  async function vertexRequest(model){
    const [project,token]=await Promise.all([vertex.project(),vertex.token()]);
    const location=vertex.location||'global';
    if(!/^[a-z0-9-]+$/.test(project)||!/^[a-z0-9-]+$/.test(location)||!token)throw problem('Vertex AI identity is unavailable.',503);
    return {url:'https://'+(location==='global'?'':location+'-')+'aiplatform.googleapis.com/v1/projects/'+project+'/locations/'+location+'/publishers/google/models/'+model+':generateContent',headers:{Authorization:'Bearer '+token}};
  }
  const totals=value=>Object.values(value.calls||{}).reduce((r,c)=>{r.spentUsd+=c.actual??0;r.reservedUsd+=c.actual==null?c.reserve:0;r.providers[c.provider]=(r.providers[c.provider]||0)+(c.actual??0);return r;},{spentUsd:0,reservedUsd:0,providers:{}});
  return {
    connected,
    async meter(uid){const day=budgetDay(clock()),{value}=await db.get(path(uid,day),{calls:{}});return {day,timeZone:'America/Los_Angeles',limitUsd:1,scope:'CRM text AI',basis:'Provider token usage × published rates; not a provider invoice',...totals(value),models:connected(),updatedAt:clock().toISOString()};},
    async complete(uid,instructions,data,preferred='auto',options={}) {
      const input=JSON.stringify(data);if(Buffer.byteLength(input)>32000)throw problem('AI input is too large. Use a smaller selection.');
      const choices=connected().filter(p=>p.connected&&(preferred==='auto'||preferred===p.provider));
      if(!choices.length)throw problem('No connected AI provider is available for this choice.',503);
      const maxOutput=1800,inputBound=Buffer.byteLength(input+instructions)+2048;
      choices.sort((a,b)=>(inputBound*a.input+maxOutput*a.output)-(inputBound*b.input+maxOutput*b.output));
      const chosen=choices[0],reserve=(inputBound*chosen.input+maxOutput*chosen.output)/1e6;
      // Resolve identity before reserving: no inference has happened if auth fails.
      let vertexAuth;
      if(chosen.provider==='gemini'&&vertex){try{vertexAuth=await vertexRequest(chosen.model);}catch{throw problem('Vertex AI identity is unavailable. Check the Cloud Run service account.',503);}}
      const day=budgetDay(clock()),key=path(uid,day),id=randomUUID();
      await db.update(key,s=>{s.calls||={};const sum=totals(s);if(sum.spentUsd+sum.reservedUsd+reserve>1)throw problem('The combined $1 daily Outbound AI limit is reached. Sync continues without AI.',429);s.calls[id]={provider:chosen.provider,model:chosen.model,reserve,ts:clock().toISOString()};});
      let url,headers,body;
      if(chosen.provider==='openai'){
        url='https://api.openai.com/v1/responses';headers={Authorization:'Bearer '+keys.openai};
        body={model:chosen.model,instructions,input,max_output_tokens:maxOutput,reasoning:{effort:'minimal'},store:false};
      }else if(chosen.provider==='anthropic'){
        url='https://api.anthropic.com/v1/messages';headers={'x-api-key':keys.anthropic,'anthropic-version':'2023-06-01'};
        body={model:chosen.model,system:instructions,messages:[{role:'user',content:input}],max_tokens:maxOutput};
      }else{
        if(vertexAuth){url=vertexAuth.url;headers=vertexAuth.headers;}else{url='https://generativelanguage.googleapis.com/v1beta/models/'+chosen.model+':generateContent';headers={'x-goog-api-key':keys.gemini};}
        body={systemInstruction:{parts:[{text:instructions}]},contents:[{role:'user',parts:[{text:input}]}],generationConfig:{maxOutputTokens:maxOutput,thinkingConfig:{thinkingBudget:0}}};
      }
      let response;
      try{response=await fetcher(url,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(options.timeoutMs||45000)});}
      catch{throw problem('AI did not confirm completion. Its reserved cost remains counted today.',502);}
      if(!response.ok){
        // Refusals before inference are free. Ambiguous server failures retain their reserve.
        if([400,401,403,404,429].includes(response.status))await db.update(key,s=>{s.calls[id].actual=0;s.calls[id].status='refused';});
        throw problem('AI request failed ('+response.status+'). No automatic paid retry was made.',502);
      }
      const j=await response.json();let output,usage;
      if(chosen.provider==='openai'){output=(j.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n');usage={input:j.usage?.input_tokens,output:j.usage?.output_tokens};}
      else if(chosen.provider==='anthropic'){output=(j.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');usage={input:j.usage?.input_tokens,output:j.usage?.output_tokens};}
      else{output=(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('\n');usage={input:j.usageMetadata?.promptTokenCount,output:Number.isFinite(j.usageMetadata?.candidatesTokenCount)?j.usageMetadata.candidatesTokenCount+(j.usageMetadata.thoughtsTokenCount||0):undefined};}
      const measured=Number.isFinite(usage.input)&&Number.isFinite(usage.output),actual=measured?(usage.input*chosen.input+usage.output*chosen.output)/1e6:null;
      await db.update(key,s=>{Object.assign(s.calls[id],{actual,status:measured?'measured':'usage unavailable',usage});});
      if(!output)throw problem('AI returned no usable text. Any reported usage is included in the meter.',502);
      return {text:clip(output,12000),provider:chosen.provider,model:chosen.model,costUsd:actual};
    }
  };
}
