// Deterministic, read-only queue. No AI calls, scheduling, or sending here.
export const SHEET_COLUMNS=['Last email','Category','Company','Full name','Email','Job title','Subject','Status','Reason','Relevance'];
const DAY=86400000;
export function sheetDate(value,reference=Date.now()) {
  const raw=String(value||'').trim();if(!raw)return null;
  const m=raw.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if(!m){const t=/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(raw)?Date.parse(raw):NaN;return Number.isFinite(t)?t:null;}
  const ref=new Date(reference),year=m[3]?Number(m[3]):ref.getUTCFullYear();
  let date=new Date(Date.UTC(year,Number(m[1])-1,Number(m[2])));
  if(date.getUTCMonth()!==Number(m[1])-1||date.getUTCDate()!==Number(m[2]))return null;
  // Yearless Sheet dates mean the most recent occurrence on the sync date.
  if(!m[3]&&date.getTime()>ref.getTime()+DAY)date.setUTCFullYear(year-1);
  return date.getTime();
}
export function priorityInfo(p,now=Date.now()) {
  const status=String(p.sheetStatus||'').toLowerCase();
  const never=/never contacted|not contacted|not sent|unsent/.test(status);
  const match=status.match(/\b(\d+)(?:st|nd|rd|th)\s+touch/);
  let touches=match?Number(match[1]):/\bfirst touch\b/.test(status)?1:null;
  if(never)touches=0;
  const sourceDate=never?null:sheetDate(p.lastEmail,p.sheetData?.syncedAt||now);
  const emails=(p.emailHistory||[]).filter(e=>Number.isFinite(Date.parse(e.ts)));
  // A yearless Sheet date has day precision: same-day messages cannot safely
  // be counted again. Keep recorded touch count; add only later-day evidence.
  const snapshot=Date.parse(p.sheetData?.outreachBaselineAt||p.sheetData?.syncedAt)||0;
  const afterSource=emails.filter(e=>sourceDate===null||Date.parse(e.ts)>=sourceDate+DAY||(snapshot&&Date.parse(e.ts)>snapshot&&Date.parse(e.ts)>=sourceDate));
  if(touches!==null)touches+=afterSource.length;
  else if(!p.sheetStatus&&!p.lastEmail&&emails.length)touches=emails.length;
  const emailDate=Math.max(0,...emails.map(e=>Date.parse(e.ts)),Date.parse(p.lastEmailAt)||0);
  const lastEmailAt=Math.max(sourceDate||0,emailDate)||null;
  const lastContactAt=Math.max(lastEmailAt||0,Date.parse(p.lastOutboundAt)||0)||null;
  const contacted=lastContactAt!==null||['contacted','replied','meeting','closed'].includes(p.stage)||touches>0;
  const held=p.sheetPaused||['suppressed','replied','meeting','closed'].includes(p.stage);
  const actionable=!held;
  const next=!contacted?'First email':touches===null?'Review history':touches>=1?'F'+touches:'Follow up';
  const rank=held?3:!contacted?0:lastContactAt?2:1;
  const label=held?(p.sheetPaused?'Paused':p.stage==='suppressed'?'Do not contact':p.stage==='replied'?'Replied':p.stage==='meeting'?'Meeting':'Closed'):!contacted?'Not contacted':lastContactAt?'Follow up':'Review date';
  const relevance=Number.parseFloat(p.relevance);
  return {rank,label,next,touches,lastContactAt,lastEmailAt,contacted,actionable,hot:rank===0,relevance:Number.isFinite(relevance)?relevance:-1};
}
export function priorityQueue(contacts,now=Date.now()) {
  return contacts.map(p=>({p,info:priorityInfo(p,now)})).filter(x=>x.info.actionable).sort((a,b)=>a.info.rank-b.info.rank||((a.info.rank===2)?a.info.lastContactAt-b.info.lastContactAt:0)||b.info.relevance-a.info.relevance||String(a.p.name||a.p.email||'').localeCompare(String(b.p.name||b.p.email||''))).map(x=>x.p);
}
export function followupSummary(contacts,now=Date.now()) {
  const counts={uncontacted:0,first:0,f1:0,f2:0,review:0,held:0};let latest=null;
  for(const p of contacts){const info=priorityInfo(p,now);
    if(info.lastContactAt&&(!latest||info.lastContactAt>latest.at))latest={p,at:info.lastContactAt};
    if(!info.actionable)counts.held++;
    else if(!info.contacted)counts.uncontacted++;
    else if(info.touches===1)counts.first++;
    else if(info.touches===2)counts.f1++;
    else if(info.touches>=3)counts.f2++;
    else counts.review++;
  }
  return {counts,latest};
}
