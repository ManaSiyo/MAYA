import assert from 'node:assert/strict';
import {createWrStore} from '../docs/server/wr-store.mjs';
const objects=new Map();
const read=async key=>objects.has(key)?{ok:true,buf:Buffer.from(objects.get(key).json),generation:String(objects.get(key).version)}:{ok:false,status:404};
const write=async(key,bytes,type,generation)=>{const old=objects.get(key);if(String(old?.version||0)!==generation)throw Object.assign(Error('conflict'),{status:412});objects.set(key,{json:bytes.toString(),version:(old?.version||0)+1});};
const store=createWrStore({read,write});const id='b7c1f470-9787-4f04-bf55-0f048910d73c',lead={requestId:id,name:'Ada',phone:'123',wave:2,color:'blue',look:'coat'};
assert.deepEqual(await store.list('one'),[]);const one=await store.add('one',lead);assert.equal((await store.add('one',lead)).id,one.id);assert.equal((await store.list('one')).length,1);assert.deepEqual(await store.list('two'),[]);await assert.rejects(store.add('one',{...lead,name:'Different'}),e=>e.status===409);await assert.rejects(store.add('one',{...lead,requestId:crypto.randomUUID(),wave:'2'}),e=>e.status===400);objects.set('private/wr/dGhyZWU.json',{json:'{"leads":{}}',version:1});await assert.rejects(store.add('three',{...lead,requestId:crypto.randomUUID()}),e=>e.status===503);console.log('WR private account isolation, validation and idempotent writes passed.');
