// Shared voice delivery and ephemeral-session protocol. No persisted credentials.
export const VOICE_DELIVERY = 'VOICE DELIVERY: Start with the useful answer, in one or two short spoken sentences. Speak clearly at a natural, slightly brisk pace. Avoid filler, repeated acknowledgements and recapping the question. Pause for the person; ask one focused question when needed. Give more detail when asked. State uncertainty plainly, and only claim an action succeeded after its tool confirms it.';

export function voiceTurnDetection(silenceMs=300) {
  return {type:'server_vad',silence_duration_ms:Math.max(250,Math.min(1500,Number(silenceMs)||300)),prefix_padding_ms:250,create_response:true,interrupt_response:true};
}

export function webVoiceSession({model,voice='marin',instructions,tools}) {
  return {type:'realtime',model,instructions:instructions+'\n\n'+VOICE_DELIVERY,tools,
    audio:{input:{noise_reduction:{type:'far_field'},transcription:{model:'gpt-4o-mini-transcribe'},turn_detection:voiceTurnDetection()},output:{voice,speed:1.05}}};
}

// One total deadline, including body parsing and the optional compatibility retry.
// Never retry authentication, quota, throttling, network or provider failures.
export async function createVoiceSecret({apiKey,session,fetchImpl=fetch,timeoutMs=10000,onTiming=()=>{}}) {
  const controller=new AbortController(),started=Date.now();let timer,attempts=0;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('realtime_timeout'));},timeoutMs);});
  const run=async()=>{
    let current=session;
    for(let attempt=0;attempt<2;attempt++){
      attempts++;
      const response=await fetchImpl('https://api.openai.com/v1/realtime/client_secrets',{
        method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},signal:controller.signal,
        body:JSON.stringify({expires_after:{anchor:'created_at',seconds:120},session:current}),
      });
      const data=await response.json().catch(()=>({}));
      if(controller.signal.aborted)throw new Error('realtime_timeout');
      if(response.ok){
        if(typeof data.value!=='string'||!data.value||!Number.isFinite(data.expires_at)||data.expires_at<=Date.now()/1000)throw new Error('realtime_invalid_secret');
        return {value:data.value,expires_at:data.expires_at};
      }
      const param=String(data.error?.param||'');
      if(attempt===0&&response.status===400&&/^(session\.)?audio\.input\.(noise_reduction|transcription)(\.|$)/.test(param)){
        current=structuredClone(session);delete current.audio.input.noise_reduction;
        current.audio.input.transcription={model:'whisper-1'};
        continue;
      }
      const quota=/insufficient_quota|billing|exceeded your current quota|hard limit/i.test(String(data.error?.code||'')+' '+String(data.error?.message||''));
      throw new Error(quota?'insufficient_quota':response.status===401||response.status===403?'realtime_auth':response.status===429?'realtime_rate_limited':response.status>=500?'realtime_provider_unavailable':'realtime_request_rejected');
    }
  };
  try{return await Promise.race([run(),timeout]);}
  finally{clearTimeout(timer);try{onTiming({ms:Date.now()-started,attempts});}catch{}}
}
