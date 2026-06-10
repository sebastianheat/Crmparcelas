/* eslint-disable @typescript-eslint/no-explicit-any */
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.NEON!);
const TOKEN=process.env.GHL_TOKEN!, LOC=process.env.GHL_LOC!, BASE="https://services.leadconnectorhq.com";
const CAP_MB = 460;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function g(path:string, params:Record<string,string>={}){
  for(let a=0;a<4;a++){
    const u=new URL(BASE+path);for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);
    const r=await fetch(u,{headers:{Authorization:`Bearer ${TOKEN}`,Version:"2021-07-28",Accept:"application/json"}});
    if(r.status===429){await sleep(2000*(a+1));continue;}
    if(!r.ok){console.log("ERR",path,r.status,(await r.text()).slice(0,120));return null;}
    return r.json();
  } return null;
}
let TID="";
async function tenant(){const a=await sql`select m.tenant_id t from memberships m join users u on u.id=m.user_id where u.email='admin@5000.cl' limit 1`;TID=a[0].t;}
async function dbMB(){const r=await sql`select (pg_database_size(current_database())/1048576.0)::int mb`;return r[0].mb as number;}
async function saveCursor(kind:string,c:any){await sql.transaction([sql`select set_config('app.current_tenant_id',${TID},true)`,
  sql`insert into ghl_snapshots(tenant_id,kind,external_id,payload) values(${TID},'_cursor',${kind},${JSON.stringify(c)}::jsonb)
      on conflict(tenant_id,kind,external_id) do update set payload=excluded.payload,fetched_at=now()`]);}
async function getCursor(kind:string){const r=await sql`select payload from ghl_snapshots where kind='_cursor' and external_id=${kind} and tenant_id=${TID}`;return r[0]?.payload??{};}
async function batch(kind:string,items:any[],idf:(x:any)=>string){
  if(!items.length)return;
  const qs:any[]=[sql`select set_config('app.current_tenant_id',${TID},true)`];
  for(const it of items){const id=idf(it);if(!id)continue;
    qs.push(sql`insert into ghl_snapshots(tenant_id,kind,external_id,payload) values(${TID},${kind},${id},${JSON.stringify(it)}::jsonb)
      on conflict(tenant_id,kind,external_id) do update set payload=excluded.payload,fetched_at=now()`);}
  await sql.transaction(qs);
}
async function cloneContacts(){const c=await getCursor("contacts");if(c.done)return console.log("contacts ya done");
  let {startAfter,startAfterId,page=0}=c;
  while(true){const p:Record<string,string>={locationId:LOC,limit:"100"};if(startAfter)p.startAfter=String(startAfter);if(startAfterId)p.startAfterId=String(startAfterId);
    const d=await g("/contacts/",p);if(!d){console.log("contacts: corte por error");break;}
    const items=d.contacts??[];await batch("contacts",items,(x:any)=>x.id);page++;
    startAfter=d.meta?.startAfter;startAfterId=d.meta?.startAfterId;
    await saveCursor("contacts",{startAfter,startAfterId,page,done:items.length<100});
    if(page%5===0){const mb=await dbMB();console.log(`contacts pág ${page} (~${page*100}/${d.meta?.total}) db=${mb}MB`);if(mb>CAP_MB){console.log("⛔ TOPE de almacenamiento");return false;}}
    if(items.length<100){console.log("✓ contacts COMPLETO:",page*100);break;} await sleep(140);}
  return true;}
async function cloneOpps(){const c=await getCursor("opportunities");if(c.done)return console.log("opps ya done");
  let {startAfter,startAfterId,page=0}=c;
  while(true){const p:Record<string,string>={location_id:LOC,limit:"100"};if(startAfter)p.startAfter=String(startAfter);if(startAfterId)p.startAfterId=String(startAfterId);
    const d=await g("/opportunities/search",p);if(!d){console.log("opps: corte");break;}
    const items=d.opportunities??[];await batch("opportunities",items,(x:any)=>x.id);page++;
    startAfter=d.meta?.startAfter;startAfterId=d.meta?.startAfterId;
    await saveCursor("opportunities",{startAfter,startAfterId,page,done:items.length<100});
    if(page%5===0){const mb=await dbMB();console.log(`opps pág ${page} (~${page*100}/${d.meta?.total}) db=${mb}MB`);if(mb>CAP_MB){console.log("⛔ TOPE");return false;}}
    if(items.length<100){console.log("✓ opps COMPLETO:",page*100);break;} await sleep(140);}
  return true;}
async function cloneConvs(){const c=await getCursor("conversations");if(c.done)return console.log("convs ya done");
  let {startAfterDate,startAfterId,page=0}=c;
  while(true){const p:Record<string,string>={locationId:LOC,limit:"100",sort:"desc",sortBy:"last_message_date"};if(startAfterDate)p.startAfterDate=String(startAfterDate);if(startAfterId)p.startAfterId=String(startAfterId);
    const d=await g("/conversations/search",p);if(!d){console.log("convs: corte");break;}
    const items=d.conversations??[];await batch("conversations",items,(x:any)=>x.id);page++;
    const last=items[items.length-1];startAfterDate=last?.lastMessageDate??last?.dateUpdated;startAfterId=last?.id;
    await saveCursor("conversations",{startAfterDate,startAfterId,page,done:items.length<100});
    if(page%5===0){const mb=await dbMB();console.log(`convs pág ${page} (~${page*100}/${d.total}) db=${mb}MB`);if(mb>CAP_MB){console.log("⛔ TOPE");return false;}}
    if(items.length<100){console.log("✓ convs COMPLETO:",page*100);break;} await sleep(140);}
  return true;}
(async()=>{await tenant();console.log("START clone, db=",await dbMB(),"MB");
  if(await cloneContacts()===false)return;
  if(await cloneOpps()===false)return;
  if(await cloneConvs()===false)return;
  console.log("=== FIN, db=",await dbMB(),"MB ===");
  const cnt:any=await sql.transaction([sql`select set_config('app.current_tenant_id',${TID},true)`,sql`select kind,count(*)::int n from ghl_snapshots group by kind order by kind`]);
  console.log(JSON.stringify(cnt[1]));
})();
