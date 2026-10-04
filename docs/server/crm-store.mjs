// Account-scoped, generation-checked JSON documents. Mutation callbacks are pure.
export const problem=(message,status=400)=>Object.assign(new Error(message),{status});
export const clip=(value,max=500)=>String(value??'').trim().slice(0,max);
export function jsonStore({read,write}) {
  async function get(key,fallback={}) {
    const item=await read(key);
    if(!item.ok){if(item.status===404)return {value:structuredClone(fallback),generation:'0'};throw problem('Storage is unavailable.',503);}
    if(!item.generation)throw problem('Storage revision unavailable.',503);
    return {value:JSON.parse(item.buf.toString()),generation:item.generation};
  }
  async function update(key,fn,fallback={}) {
    for(let attempt=0;attempt<6;attempt++) {
      const {value,generation}=await get(key,fallback),result=fn(value);
      try {await write(key,Buffer.from(JSON.stringify(value)),'application/json',generation);return {value,result};}
      catch(error){if(error.status!==412)throw error;}
    }
    throw problem('Another update is in progress. Try again.',409);
  }
  return {get,update};
}
