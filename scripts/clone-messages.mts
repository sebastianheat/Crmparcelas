/* eslint-disable @typescript-eslint/no-explicit-any */
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.NEON!);
const TOKEN=process.env.GHL_TOKEN!, BASE="https://services.leadconnectorhq.com";
const CONC=5, CAP_MB=500;
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function g(path:string,params:Record<string,string>={}){
  for(let a=0;a<5;a++){const u=new URL(BASE+path);for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);
    let r:Response; try{r=await fetch(u,{headers:{Authorization:`Bearer ${TOKEN}`,Version:"2021-07-28",Accept:"application/json"}});}catch{await sleep(1500);continue;}
    if(r.status===429||r.status>=500){await sleep(1500*(a+1));continue;}
    if(!r.ok)return null; return r.json();}
  return null;}
async function msgsFor(convId:string){
  const out:any[]=[]; let lastId:string|undefined;
  for(let p=0;p<20;p++){const q:Record<string,string>={limit:"100"};if(lastId)q.lastMessageId=lastId;
    const d=await g(`/conversations/${convId}/messages`,q);if(!d)break;
    const wrap=d.messages??{}; const arr=(wrap.messages??d.messages??[]) as any[]; if(!Array.isArray(arr)||!arr.length)break;
    out.push(...arr); const nl=wrap.lastMessageId??arr[arr.length-1]?.id;
    if(!nl||nl===lastId||arr.length<100)break; lastId=String(nl);}
  return out;}
(async()=>{
  const t=await sql`select m.tenant_id tid from memberships m join users u on u.id=m.user_id where u.email='admin@5000.cl' limit 1`;
  const TID=t[0].tid;
  const total=(await sql`select count(*)::int n from ghl_snapshots where kind='conversations' and tenant_id=${TID}`)[0].n;
  let done=(await sql`select count(*)::int n from ghl_snapshots where kind='messages' and tenant_id=${TID}`)[0].n;
  console.log(`START mensajes: ${done}/${total} ya hechos`);
  while(true){
    const pend:any[]=await sql`
      select c.external_id id from ghl_snapshots c
      left join ghl_snapshots m on m.kind='messages' and m.tenant_id=c.tenant_id and m.external_id=c.external_id
      where c.kind='conversations' and c.tenant_id=${TID} and m.external_id is null limit 1500`;
    if(!pend.length){console.log("✓ COMPLETO");break;}
    for(let i=0;i<pend.length;i+=CONC){
      const slice=pend.slice(i,i+CONC);
      const results=await Promise.all(slice.map(async(c)=>({id:c.id,msgs:await msgsFor(c.id)})));
      const qs:any[]=[sql`select set_config('app.current_tenant_id',${TID},true)`];
      for(const r of results){qs.push(sql`insert into ghl_snapshots(tenant_id,kind,external_id,parent_id,payload)
        values(${TID},'messages',${r.id},${r.id},${JSON.stringify({n:r.msgs.length,messages:r.msgs})}::jsonb)
        on conflict(tenant_id,kind,external_id) do update set payload=excluded.payload,fetched_at=now()`);}
      await sql.transaction(qs); done+=results.length;
      if(done% (CONC*20) < CONC){const mb=(await sql`select (pg_database_size(current_database())/1048576.0)::int mb`)[0].mb;
        console.log(`mensajes ${done}/${total} db=${mb}MB`); if(mb>CAP_MB){console.log("⛔ TOPE",mb);return;}}
      await sleep(120);
    }
  }
  console.log("FIN, db=",(await sql`select pg_size_pretty(pg_database_size(current_database())) s`)[0].s);
})();
