import {randomBytes,createHash,createCipheriv,createDecipheriv} from 'node:crypto';
import {jsonStore,problem,clip} from './crm-store.mjs';
const SCOPES=['https://www.googleapis.com/auth/gmail.readonly','https://www.googleapis.com/auth/gmail.send'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const email=value=>clip(value,254).toLowerCase();
export function addresses(value){return [...new Set((String(value||'').match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[]).map(email))];}
export function messageEvent(message,mailbox) {
  const headers=Object.fromEntries((message.payload?.headers||[]).map(h=>[h.name.toLowerCase(),h.value]));
  const sent=(message.labelIds||[]).includes('SENT'),ts=Number(message.internalDate);
  return {id:`gmail:${mailbox.id}:${message.id}`,provider:'gmail',mailboxId:mailbox.id,messageId:message.id,threadId:message.threadId,
    direction:sent?'out':'in',kind:'email',peers:addresses(sent?headers.to:headers.from).filter(e=>e!==mailbox.email),
    automated:!!headers['auto-submitted']&&headers['auto-submitted']!=='no',subject:clip(headers.subject,500),summary:clip(message.snippet,800),ts:Number.isFinite(ts)?new Date(ts).toISOString():new Date().toISOString()};
}
export function rawEmail({from,to,subject,body,messageId}) {
  if(!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(to)||/[\r\n]/.test(from+to+subject+messageId))throw problem('Invalid email header.');
  const encodedSubject=Buffer.from(subject).toString('base64');
  const content=Buffer.from(body).toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
  return Buffer.from(`From: ${from}\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${encodedSubject}?=\r\nMessage-ID: <${messageId}@maya.manasiyo.com>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${content}`).toString('base64url');
}
export function createGmail(deps) {
  const db=jsonStore(deps),config=deps.config||{},fetcher=deps.fetch||fetch;
  const ready=()=>!!(config.clientId&&config.clientSecret&&config.redirectUri&&/^[a-f0-9]{64}$/i.test(config.encryptionKey||''));
  const credentials=uid=>'private/outbound/gmail/'+encodeURIComponent(uid)+'.json';
  function seal(value,uid){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',Buffer.from(config.encryptionKey,'hex'),iv);cipher.setAAD(Buffer.from(uid));const data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return {iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};}
  function unseal(value,uid){const cipher=createDecipheriv('aes-256-gcm',Buffer.from(config.encryptionKey,'hex'),Buffer.from(value.iv,'base64'));cipher.setAAD(Buffer.from(uid));cipher.setAuthTag(Buffer.from(value.tag,'base64'));return JSON.parse(Buffer.concat([cipher.update(Buffer.from(value.data,'base64')),cipher.final()]).toString());}
  async function oauth(params){const r=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...params,client_id:config.clientId,client_secret:config.clientSecret}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw problem('Gmail authorization expired or was refused. Reconnect this mailbox.',409);const token=await r.json();if(!token.access_token)throw problem('Gmail authorization returned no access token. Reconnect.',409);return token;}
  async function request(token,path,body){const r=await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});if(!r.ok)throw problem('Gmail request failed ('+r.status+').',r.status===404?404:502);return r.json();}
  async function access(uid,id){if(!ready())throw problem('Gmail server setup is not complete.',503);const {value}=await db.get(credentials(uid),{mailboxes:{}}),entry=value.mailboxes[id];if(!entry)throw problem('Connect this Gmail mailbox first.',409);const secret=unseal(entry.secret,uid),token=await oauth({grant_type:'refresh_token',refresh_token:secret.refreshToken});return {token:token.access_token,entry};}
  return {
    ready,
    async list(uid){const {value}=await db.get(credentials(uid),{mailboxes:{}});return Object.values(value.mailboxes).map(({id,email,connectedAt})=>({id,email,connectedAt}));},
    async begin(uid){if(!ready())throw problem('Gmail needs server OAuth configuration before it can connect.',503);const state=randomBytes(32).toString('hex');await db.update('private/outbound/oauth/'+hash(state)+'.json',s=>Object.assign(s,{uid,expires:Date.now()+600000,used:false}));const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:SCOPES.join(' '),access_type:'offline',prompt:'consent select_account',state}).toString();return url.toString();},
    async callback(state,code){if(!ready()||!/^\w{64}$/.test(state||'')||!code)throw problem('Invalid Gmail authorization.');const {result:uid}=await db.update('private/outbound/oauth/'+hash(state)+'.json',s=>{if(!s.uid||s.used||s.expires<Date.now())throw problem('Gmail authorization expired. Start again.');s.used=true;return s.uid;});const token=await oauth({code,grant_type:'authorization_code',redirect_uri:config.redirectUri});if(!token.refresh_token||!SCOPES.every(s=>(token.scope||'').split(' ').includes(s)))throw problem('Approve Gmail read and send access, then reconnect.');const profile=await request(token.access_token,'profile'),mail=email(profile.emailAddress);if(!mail)throw problem('Gmail did not identify this mailbox.');const id=hash(mail).slice(0,24);await db.update(credentials(uid),s=>{s.mailboxes||={};if(!s.mailboxes[id]&&Object.keys(s.mailboxes).length>=2)throw problem('Two mailboxes are already connected. Disconnect one first.');s.mailboxes[id]={id,email:mail,connectedAt:new Date().toISOString(),secret:seal({refreshToken:token.refresh_token},uid)};});return {uid,id,email:mail};},
    async disconnect(uid,id){await db.update(credentials(uid),s=>{delete s.mailboxes?.[id];});},
    async sync(uid,mailbox,cursor={}) {
      const {token,entry}=await access(uid,mailbox.id);if(entry.connectedAt!==mailbox.connectedAt)throw problem('Mailbox changed. Retry sync.',409);
      let next={...cursor},response,ids;
      if(next.pendingIds?.length){ids=next.pendingIds;next=next.afterPending;}
      else if(!next.historyId){
        if(!next.baseline)next.baseline=(await request(token,'profile')).historyId;
        const q=new URLSearchParams({maxResults:'100',q:'newer_than:30d -in:spam -in:trash'});if(next.pageToken)q.set('pageToken',next.pageToken);
        response=await request(token,'messages?'+q);ids=(response.messages||[]).map(m=>m.id);
        if(response.nextPageToken)next.pageToken=response.nextPageToken;else next={historyId:next.baseline};
      }else{
        const q=new URLSearchParams({startHistoryId:next.historyId,maxResults:'100',historyTypes:'messageAdded'});if(next.pageToken)q.set('pageToken',next.pageToken);
        try{response=await request(token,'history?'+q);}catch(e){if(e.status===404)return {events:[],cursor:{},pending:true,reset:true};throw e;}
        ids=[...new Set((response.history||[]).flatMap(h=>(h.messagesAdded||[]).map(x=>x.message.id)))];
        if(ids.length>1000)throw problem('Large mailbox update. Contact support before retrying.',503);
        next=response.nextPageToken?{historyId:next.historyId,pageToken:response.nextPageToken}:{historyId:response.historyId||next.historyId};
      }
      if(ids.length>100){next={pendingIds:ids.slice(100),afterPending:next};ids=ids.slice(0,100);}
      const events=[],deadline=Date.now()+50000;
      // Small parallel batches bound Gmail load; the cursor is committed only with events.
      for(let i=0;i<ids.length;i+=5){const batch=await Promise.all(ids.slice(i,i+5).map(async id=>{try{return messageEvent(await request(token,'messages/'+encodeURIComponent(id)+'?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Auto-Submitted'),mailbox);}catch(e){if(e.status===404)return null;throw e;}}));events.push(...batch.filter(Boolean));if(Date.now()>=deadline&&i+5<ids.length){next={pendingIds:ids.slice(i+5),afterPending:next};break;}}
      return {events,cursor:next,pending:!!(next.pageToken||next.pendingIds)};
    },
    async send(uid,id,draft){const {token,entry}=await access(uid,id);return request(token,'messages/send',{raw:rawEmail({...draft,from:entry.email})});}
  };
}
