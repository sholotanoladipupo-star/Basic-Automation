"use client";
import { useState, useMemo, useEffect } from "react";

// ── LOOKUP DEFAULTS ──────────────────────────────────────────────────────────
const DEFAULT_TYPES = [
  { id:"t1", name:"DB Operational Playbook",   color:"#5b21b6", bg:"#ede9fe", border:"#ddd6fe" },
  { id:"t2", name:"Operational Playbook",       color:"#5b21b6", bg:"#ede9fe", border:"#ddd6fe" },
  { id:"t3", name:"Internal Tooling / Bot",     color:"#0369a1", bg:"#e0f2fe", border:"#bae6fd" },
  { id:"t4", name:"Observability",              color:"#065f46", bg:"#d1fae5", border:"#a7f3d0" },
  { id:"t5", name:"Reporting & Analytics",      color:"#92400e", bg:"#fef3c7", border:"#fde68a" },
  { id:"t6", name:"Incident Management",        color:"#991b1b", bg:"#fee2e2", border:"#fecaca" },
  { id:"t7", name:"Process Automation",         color:"#1e40af", bg:"#dbeafe", border:"#bfdbfe" },
  { id:"t8", name:"Financial Automation",       color:"#065f46", bg:"#d1fae5", border:"#a7f3d0" },
  { id:"t9", name:"Infrastructure Automation",  color:"#374151", bg:"#f3f4f6", border:"#e5e7eb" },
];
const DEFAULT_TEAMS = [
  { id:"tm1", name:"Card Payment (General)" },
  { id:"tm2", name:"Transaction Processing" },
  { id:"tm3", name:"Merchant Settlements" },
  { id:"tm4", name:"Disputes" },
];
const DEFAULT_STATUSES = [
  { id:"s1", name:"Backlog",             color:"#475569", bg:"#f1f5f9", border:"#e2e8f0" },
  { id:"s2", name:"In Progress",         color:"#1e40af", bg:"#dbeafe", border:"#bfdbfe" },
  { id:"s3", name:"On Demo (Dev)",       color:"#5b21b6", bg:"#ede9fe", border:"#ddd6fe" },
  { id:"s4", name:"Finalizing for Dev",  color:"#92400e", bg:"#fef3c7", border:"#fde68a" },
  { id:"s5", name:"Done",               color:"#166534", bg:"#dcfce7", border:"#bbf7d0" },
];
const DEFAULT_IMPACTS = [
  { id:"i1", name:"High",   color:"#991b1b", bg:"#fee2e2", border:"#fecaca" },
  { id:"i2", name:"Medium", color:"#92400e", bg:"#fff7ed", border:"#fed7aa" },
  { id:"i3", name:"Low",    color:"#374151", bg:"#f9fafb", border:"#e5e7eb" },
];
const DEFAULT_CRITERIA = [
  { id:"c1", name:"Delivery Quality"        },
  { id:"c2", name:"Automation Correctness"  },
  { id:"c3", name:"Documentation"           },
  { id:"c4", name:"On-time Delivery"        },
  { id:"c5", name:"Reliability & Stability" },
  { id:"c6", name:"Reusability"             },
];
const COLOR_PRESETS = [
  { color:"#1e40af", bg:"#dbeafe", border:"#bfdbfe" },
  { color:"#5b21b6", bg:"#ede9fe", border:"#ddd6fe" },
  { color:"#065f46", bg:"#d1fae5", border:"#a7f3d0" },
  { color:"#92400e", bg:"#fef3c7", border:"#fde68a" },
  { color:"#991b1b", bg:"#fee2e2", border:"#fecaca" },
  { color:"#0369a1", bg:"#e0f2fe", border:"#bae6fd" },
  { color:"#374151", bg:"#f3f4f6", border:"#e5e7eb" },
  { color:"#166534", bg:"#dcfce7", border:"#bbf7d0" },
  { color:"#6b21a8", bg:"#f3e8ff", border:"#e9d5ff" },
  { color:"#be185d", bg:"#fce7f3", border:"#fbcfe8" },
  { color:"#4d7c0f", bg:"#f7fee7", border:"#d9f99d" },
  { color:"#b45309", bg:"#fef3c7", border:"#fde68a" },
];

// ── HELPERS ──────────────────────────────────────────────────────────────────
const uid      = () => Math.random().toString(36).slice(2,8);
const newId    = () => "NEW-" + uid().toUpperCase();
const today    = () => new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
const isoToday = () => new Date().toISOString().slice(0,10);
const avg      = arr => { const s=(arr||[]).filter(c=>c.score>0); return s.length?(s.reduce((a,c)=>a+c.score,0)/s.length).toFixed(1):null; };
const scColor  = v => v===null?"#9ca3af":v>=4?"#16a34a":v>=3?"#1d4ed8":v>=2?"#f59e0b":"#dc2626";

function inferType(name, types) {
  const n=name.toLowerCase();
  if (n.includes("playbook")&&(n.includes("db")||n.includes("aptent")||n.includes("card bin")||n.includes("bank")||n.includes("interchange")||n.includes("tid")||n.includes("terminal")||n.includes("ptsp")||n.includes("nibss")||n.includes("isw"))) return types.find(t=>t.name==="DB Operational Playbook")?.name||types[0]?.name||"";
  if (n.includes("playbook"))  return types.find(t=>t.name==="Operational Playbook")?.name||types[0]?.name||"";
  if (n.includes("bot")||n.includes("slack")) return types.find(t=>t.name==="Internal Tooling / Bot")?.name||types[0]?.name||"";
  if (n.includes("monitor")||n.includes("alert")) return types.find(t=>t.name==="Observability")?.name||types[0]?.name||"";
  if (n.includes("report")||n.includes("daily")) return types.find(t=>t.name==="Reporting & Analytics")?.name||types[0]?.name||"";
  if (n.includes("escalat")) return types.find(t=>t.name==="Incident Management")?.name||types[0]?.name||"";
  if (n.includes("onboard")) return types.find(t=>t.name==="Process Automation")?.name||types[0]?.name||"";
  if (n.includes("settlement")||n.includes("refund")||n.includes("dispute")) return types.find(t=>t.name==="Financial Automation")?.name||types[0]?.name||"";
  if (n.includes("routing")||n.includes("port")||n.includes("config")||n.includes("switching")) return types.find(t=>t.name==="Infrastructure Automation")?.name||types[0]?.name||"";
  return types.find(t=>t.name==="Process Automation")?.name||types[0]?.name||"";
}

function makeSeed(types) {
  const raw = [
    { id:"CAR-232", initiative:"Slack Communication Bot",                          team:"Card Payment (General)", status:"On Demo (Dev)",      impact:"High",   assignee:"", description:"A Slack bot that surfaces operational information and communication directly inside Slack channels.", problem:"Engineers switch context between multiple tools during incidents, slowing down communication and response times.", solution:"Centralised Slack bot that brings alerts, status updates, and commands into a single interface without leaving Slack.", startDate:"2026-01-15", endDate:"2026-04-30" },
    { id:"CAR-231", initiative:"Runbook Bot",                                      team:"Card Payment (General)", status:"Backlog",             impact:"High",   assignee:"", description:"Slack command that retrieves and surfaces the correct runbook for a given incident type.", problem:"Engineers waste time searching Confluence for runbooks during active incidents.", solution:"Slash command that instantly fetches and displays the relevant runbook inline in the incident channel.", startDate:"2026-04-01", endDate:"2026-06-30" },
    { id:"CAR-230", initiative:"On-Call Tool Bot (Slack)",                         team:"Card Payment (General)", status:"Backlog",             impact:"Medium", assignee:"", description:"Slack-native bot for managing on-call rotations, handoffs, and acknowledgements.", problem:"On-call coordination requires jumping between PagerDuty and Slack.", solution:"Bot that surfaces on-call schedules, allows ack/escalation directly from Slack.", startDate:"2026-05-01", endDate:"2026-07-31" },
    { id:"CAR-229", initiative:"Playbook: Move Terminals (ptsp_key_config)",       team:"Transaction Processing", status:"Backlog",             impact:"Medium", assignee:"", description:"Automated playbook to move terminals from one ptsp_key_config to another.", problem:"Manual terminal migration is error-prone and requires direct DB access.", solution:"Runnable playbook that validates input, executes the migration safely, and logs every change.", startDate:"2026-03-01", endDate:"2026-05-31" },
    { id:"CAR-228", initiative:"Playbook: Insert International Card Bin",          team:"Transaction Processing", status:"In Progress",         impact:"High",   assignee:"", description:"Automated playbook for inserting entries into the international card bin table.", problem:"Manual bin table inserts require DBA involvement and are prone to format errors.", solution:"Validated playbook with pre-checks and rollback capability.", startDate:"2026-01-10", endDate:"2026-03-31" },
    { id:"CAR-227", initiative:"Playbook: Reset Settlement Status",                team:"Merchant Settlements",   status:"In Progress",         impact:"High",   assignee:"", description:"Playbook to reset withdrawal business, processor, and DNS settlement statuses.", problem:"Stuck settlements require manual SQL intervention.", solution:"Safe, idempotent playbook with pre-flight checks.", startDate:"2026-02-01", endDate:"2026-04-15" },
    { id:"CAR-226", initiative:"Playbook: Create card_bin (Aptent DB)",            team:"Transaction Processing", status:"In Progress",         impact:"High",   assignee:"", description:"Automated playbook for creating new card_bin records on the Aptent database.", problem:"Card bin provisioning requires direct DB access and has historically caused downtime.", solution:"Guided playbook with schema validation, dry-run mode, and automatic rollback.", startDate:"2026-01-20", endDate:"2026-03-20" },
    { id:"CAR-225", initiative:"Playbook: Create Banks (Aptent DB)",               team:"Transaction Processing", status:"In Progress",         impact:"Medium", assignee:"", description:"Playbook to onboard new banks onto the Aptent database.", problem:"Bank onboarding is a manual, multi-step process with no audit trail.", solution:"Templated playbook with required fields, validation, and automatic Confluence logging.", startDate:"2026-02-10", endDate:"2026-04-10" },
    { id:"CAR-224", initiative:"Playbook: Update interchange_specific_data",       team:"Transaction Processing", status:"In Progress",         impact:"Medium", assignee:"", description:"Automated playbook for updating interchange_specific_data fields.", problem:"Interchange data updates require specialist knowledge and manual DB changes.", solution:"Self-service playbook accessible to any SRE with guardrails.", startDate:"2026-02-15", endDate:"2026-04-15" },
    { id:"CAR-223", initiative:"Playbook: Reset Terminals for NIBSS Key Download", team:"Transaction Processing", status:"In Progress",         impact:"High",   assignee:"", description:"Playbook to reset terminals ahead of NIBSS key download operations.", problem:"NIBSS key download failures often require urgent terminal resets at odd hours.", solution:"Pre-validated playbook that resets affected terminals in batch.", startDate:"2026-01-05", endDate:"2026-03-15" },
    { id:"CAR-222", initiative:"Playbook: Update ISW PTSA TID Mapping",            team:"Transaction Processing", status:"In Progress",         impact:"High",   assignee:"", description:"Playbook to update the isw_ptsa_tid mapping table.", problem:"Incorrect TID mappings cause transaction routing failures.", solution:"Automated mapping update with pre-check validation against live TID registry.", startDate:"2026-01-08", endDate:"2026-03-08" },
    { id:"CAR-221", initiative:"Playbook: Upload Terminals for Swapping",          team:"Transaction Processing", status:"In Progress",         impact:"Medium", assignee:"", description:"Playbook to bulk upload terminal records for hardware swap events.", problem:"Terminal swap events require bulk DB updates that are currently done manually.", solution:"CSV-driven bulk upload playbook with validation, preview mode, and rollback.", startDate:"2026-02-20", endDate:"2026-04-20" },
    { id:"CAR-215", initiative:"Automate Failed/Stuck Refund Updates",             team:"Disputes",               status:"Done",                impact:"High",   assignee:"", description:"Automation to detect and update failed or stuck refund records.", problem:"Stuck refunds block dispute resolution queues.", solution:"Scheduled job that identifies stuck refunds, applies correction logic, and generates a daily report.", startDate:"2025-10-01", endDate:"2026-01-31" },
    { id:"CAR-214", initiative:"Automate Wrong Settlement Report UID Fix",         team:"Disputes",               status:"Done",                impact:"High",   assignee:"", description:"Automation to detect and correct wrong Settlement Report Unique Identifier values.", problem:"Incorrect UIDs in settlement reports cause reconciliation failures.", solution:"Detection script that flags mismatches and auto-corrects using source-of-truth data.", startDate:"2025-11-01", endDate:"2026-02-15" },
    { id:"CAR-207", initiative:"Automatic Monitoring Setup for New Resources",     team:"Card Payment (General)", status:"In Progress",         impact:"High",   assignee:"", description:"Automatically configure monitoring, alerts, and dashboards when a new service is provisioned.", problem:"New services launch without monitoring coverage.", solution:"Resource provisioning hook that auto-generates Datadog monitors and alert policies.", startDate:"2026-01-15", endDate:"2026-05-30" },
    { id:"CAR-206", initiative:"Automatic Onboarding",                             team:"Card Payment (General)", status:"Backlog",             impact:"High",   assignee:"", description:"End-to-end automation for onboarding new merchants, terminals, or services.", problem:"Manual onboarding takes days due to multi-team handoffs.", solution:"Orchestrated onboarding workflow with approval gates and automated provisioning steps.", startDate:"2026-06-01", endDate:"2026-09-30" },
    { id:"CAR-203", initiative:"Automatic Port Addition, Deletion & Resync",       team:"Transaction Processing", status:"In Progress",         impact:"Medium", assignee:"", description:"Automated management of port-level configuration.", problem:"Port configuration changes require manual steps across multiple systems.", solution:"Single command that applies port changes atomically across all affected systems.", startDate:"2026-02-01", endDate:"2026-05-01" },
    { id:"CAR-201", initiative:"Daily Transaction Success Rate Report",            team:"Transaction Processing", status:"In Progress",         impact:"Medium", assignee:"", description:"Automated daily report showing transaction success rates.", problem:"Success rate visibility requires manual data pulls from multiple sources.", solution:"Scheduled pipeline that aggregates data and distributes a formatted report to Slack and email.", startDate:"2026-01-20", endDate:"2026-03-20" },
    { id:"CAR-200", initiative:"Automatic Escalation System (Slack)",              team:"Card Payment (General)", status:"Finalizing for Dev",  impact:"High",   assignee:"", description:"Automated escalation routing system that surfaces the right engineer via Slack.", problem:"Escalations during incidents are ad-hoc — engineers don't know who to page.", solution:"Rules-based escalation engine integrated with PagerDuty and Slack.", startDate:"2026-01-01", endDate:"2026-04-01" },
    { id:"CAR-199", initiative:"Automatic Business Settlement Requeue",            team:"Merchant Settlements",   status:"Backlog",             impact:"High",   assignee:"", description:"Automation to detect and requeue failed business settlement jobs.", problem:"Failed settlement jobs sit in error state until an engineer notices.", solution:"Polling job that detects failed settlements and applies retry logic.", startDate:"2026-05-01", endDate:"2026-08-31" },
    { id:"CAR-181", initiative:"Automatic Aptent Routing Config Switching",        team:"Transaction Processing", status:"In Progress",         impact:"High",   assignee:"", description:"System to automatically switch Aptent routing configurations in response to processor degradation.", problem:"Processor degradation requires manual config changes under pressure.", solution:"Monitoring-triggered automation that detects degradation signals and switches routing config.", startDate:"2025-12-01", endDate:"2026-04-30" },
  ];
  return raw.map(r=>({ ...r, type:inferType(r.initiative,types), scoreNotes:"", scores:DEFAULT_CRITERIA.map(c=>({...c,score:0})), scoreHistory:[] }));
}

// ── SMALL ATOMS ───────────────────────────────────────────────────────────────
function Badge({ text, color, bg, border, small }) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:small?"2px 8px":"3px 10px",borderRadius:20,fontSize:small?10:11,fontWeight:600,background:bg||"#f3f4f6",color:color||"#374151",border:`1px solid ${border||"#e5e7eb"}`,whiteSpace:"nowrap",lineHeight:1.5}}>{text}</span>;
}

function Avatar({ name, size=26 }) {
  if(!name) return <span title="Unassigned" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,borderRadius:"50%",background:"#f1f5f9",border:"1.5px dashed #d1d5db",fontSize:10,color:"#9ca3af",flexShrink:0}}>?</span>;
  const ini=name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const hue=name.split("").reduce((a,c)=>a+c.charCodeAt(0),0)%360;
  return <span title={name} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,borderRadius:"50%",background:`hsl(${hue},55%,88%)`,border:`1.5px solid hsl(${hue},45%,75%)`,fontSize:size>24?11:9,fontWeight:700,color:`hsl(${hue},45%,30%)`,flexShrink:0,userSelect:"none"}}>{ini}</span>;
}

function Stars({ value, onChange }) {
  const [hov,setHov]=useState(0);
  return <span style={{display:"inline-flex",gap:2,alignItems:"center"}}>{[1,2,3,4,5].map(n=><span key={n} onClick={()=>onChange(value===n?0:n)} onMouseEnter={()=>setHov(n)} onMouseLeave={()=>setHov(0)} style={{fontSize:18,cursor:"pointer",color:(hov||value)>=n?"#f59e0b":"#e5e7eb",lineHeight:1}}>★</span>)}{value>0&&<span style={{fontSize:11,color:"#6b7280",marginLeft:4}}>{value}/5</span>}</span>;
}

function Stat({ label, value, color, note }) {
  return <div style={{background:"white",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"13px 17px",flex:1,minWidth:88,borderTop:`3px solid ${color}`}}><div style={{fontSize:25,fontWeight:800,color,lineHeight:1}}>{value}</div><div style={{fontSize:11,color:"#6b7280",marginTop:4,fontWeight:500}}>{label}</div>{note&&<div style={{fontSize:10,color,marginTop:2,fontWeight:600}}>{note}</div>}</div>;
}

// ── CSV EXPORT ────────────────────────────────────────────────────────────────
function exportCSV(items) {
  const escCSV = v => `"${String(v||"").replace(/"/g,'""')}"`;
  const header = ["Jira Key","Initiative","Type","Team","Assignee","Status","Impact","Start Date","End Date","Description","Problem","Solution","Avg Score","Score Notes","Criteria Ratings"];
  const rows = items.map(i=>{
    const sc = avg(i.scores||[]);
    const crit = (i.scores||[]).map(c=>`${c.name}:${c.score||0}`).join("; ");
    return [i.id,i.initiative,i.type,i.team,i.assignee||"",i.status,i.impact,i.startDate||"",i.endDate||"",i.description||"",i.problem||"",i.solution||"",sc||"",i.scoreNotes||"",crit].map(escCSV).join(",");
  });
  const csv = [header.map(escCSV).join(","), ...rows].join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=`automation-initiatives-${isoToday()}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ── SCORE PANEL ───────────────────────────────────────────────────────────────
function ScorePanel({ item, onUpdate }) {
  const [newName,setNewName]=useState("");
  const [periodLabel,setPeriodLabel]=useState("");
  const scores=item.scores||[];
  const history=item.scoreHistory||[];
  const overall=avg(scores);
  const oc=scColor(overall?parseFloat(overall):null);
  const setScore=(id,score)=>onUpdate({...item,scores:scores.map(c=>c.id===id?{...c,score}:c)});
  const removeRow=id=>onUpdate({...item,scores:scores.filter(c=>c.id!==id)});
  const addRow=()=>{const n=newName.trim();if(!n)return;onUpdate({...item,scores:[...scores,{id:"c"+uid(),name:n,score:0}]});setNewName("");};
  const saveSnapshot=()=>{
    const label=periodLabel.trim()||`Snapshot ${new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}`;
    const snap={id:uid(),period:label,date:isoToday(),scores:scores.map(c=>({...c})),notes:item.scoreNotes||"",avg:overall};
    onUpdate({...item,scoreHistory:[...history,snap]});
    setPeriodLabel("");
  };
  const removeSnap=id=>onUpdate({...item,scoreHistory:history.filter(s=>s.id!==id)});

  return (
    <div style={{padding:"16px 22px 20px",background:"#fafbfc",borderTop:"1px solid #e5e7eb"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:13,fontWeight:700,color:"#374151"}}>Delivery Scorecard</span>
          {overall?<span style={{background:oc,color:"white",borderRadius:20,padding:"2px 12px",fontSize:12,fontWeight:700}}>★ {overall} / 5</span>:<span style={{fontSize:11,color:"#9ca3af",fontStyle:"italic"}}>Not yet scored</span>}
        </div>
        <span style={{fontSize:11,color:"#9ca3af"}}>{scores.filter(c=>c.score>0).length}/{scores.length} rated</span>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
        {scores.length===0&&<div style={{fontSize:12,color:"#9ca3af",fontStyle:"italic",padding:"4px 0"}}>No criteria — add one below.</div>}
        {scores.map(c=>(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:"white",border:"1.5px solid #e5e7eb",borderRadius:8,flexWrap:"wrap"}}>
            <span style={{flex:1,fontSize:13,color:"#111827",fontWeight:500,minWidth:160}}>{c.name}</span>
            <Stars value={c.score} onChange={s=>setScore(c.id,s)}/>
            <button onClick={()=>removeRow(c.id)} style={{background:"none",border:"none",color:"#d1d5db",fontSize:18,cursor:"pointer",padding:"0 4px",lineHeight:1}}>×</button>
          </div>
        ))}
      </div>
      <div style={{marginBottom:14}}>
        <div style={{fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:6}}>NOTES</div>
        <textarea value={item.scoreNotes||""} onChange={e=>onUpdate({...item,scoreNotes:e.target.value})} rows={2}
          placeholder="Add notes about delivery quality, issues, or observations…"
          style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"9px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#374151",resize:"vertical",outline:"none",lineHeight:1.55}}
          onFocus={e=>e.target.style.borderColor="#3b82f6"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addRow()}
          placeholder="Add a new scoring criterion…"
          style={{flex:1,border:"1.5px dashed #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#374151",outline:"none",background:"white"}}
          onFocus={e=>e.target.style.borderColor="#3b82f6"} onBlur={e=>e.target.style.borderColor="#d1d5db"}/>
        <button onClick={addRow} style={{background:"#f8fafc",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,color:"#374151",cursor:"pointer",whiteSpace:"nowrap"}}>+ Add</button>
      </div>
      <div style={{borderTop:"1px solid #e5e7eb",paddingTop:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:12,fontWeight:700,color:"#374151"}}>📊 Score History</span>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <input value={periodLabel} onChange={e=>setPeriodLabel(e.target.value)} placeholder="Label (e.g. Q1 2026)"
              style={{border:"1.5px solid #e5e7eb",borderRadius:7,padding:"5px 10px",fontSize:12,fontFamily:"'DM Sans',sans-serif",outline:"none",width:150}}
              onFocus={e=>e.target.style.borderColor="#3b82f6"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
            <button onClick={saveSnapshot}
              style={{background:"#1d4ed8",border:"none",borderRadius:7,color:"white",fontSize:12,fontWeight:700,padding:"5px 14px",cursor:"pointer",whiteSpace:"nowrap"}}>
              Save Snapshot
            </button>
          </div>
        </div>
        {history.length===0
          ? <div style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>No snapshots yet. Score this initiative and click Save Snapshot to track progress over time.</div>
          : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {history.length>1 && (
                <div style={{background:"white",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"12px 14px",marginBottom:4}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:10}}>SCORE TREND</div>
                  <div style={{display:"flex",alignItems:"flex-end",gap:6,height:60}}>
                    {history.map((snap)=>{
                      const v=parseFloat(snap.avg||0);
                      const pct=Math.round((v/5)*100);
                      const c=scColor(v||null);
                      return (
                        <div key={snap.id} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1,gap:3}}>
                          <span style={{fontSize:9,fontWeight:700,color:c}}>{snap.avg||"—"}</span>
                          <div style={{width:"100%",background:"#f1f5f9",borderRadius:4,overflow:"hidden",height:40,display:"flex",alignItems:"flex-end"}}>
                            <div style={{width:"100%",height:`${pct}%`,background:c,borderRadius:4,transition:"height .3s"}}/>
                          </div>
                          <span style={{fontSize:8,color:"#9ca3af",textAlign:"center",lineHeight:1.2,maxWidth:60,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{snap.period}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {[...history].reverse().map(snap=>(
                <div key={snap.id} style={{background:"white",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"10px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:snap.scores?.length?8:0,gap:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:"#374151"}}>{snap.period}</span>
                      <span style={{fontSize:10,color:"#9ca3af"}}>{snap.date}</span>
                      {snap.avg&&<span style={{fontSize:11,fontWeight:700,color:scColor(parseFloat(snap.avg)),background:"#f8fafc",border:`1.5px solid ${scColor(parseFloat(snap.avg))}`,borderRadius:10,padding:"1px 8px"}}>★ {snap.avg}</span>}
                    </div>
                    <button onClick={()=>removeSnap(snap.id)} style={{background:"none",border:"none",color:"#d1d5db",fontSize:16,cursor:"pointer",padding:"0 2px",lineHeight:1}}>×</button>
                  </div>
                  {snap.scores?.length>0&&(
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      {snap.scores.filter(c=>c.score>0).map(c=>(
                        <span key={c.id} style={{fontSize:10,background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:6,padding:"2px 8px",color:"#374151"}}>
                          {c.name}: <strong style={{color:scColor(c.score)}}>{c.score}/5</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  {snap.notes&&<div style={{fontSize:11,color:"#6b7280",marginTop:6,fontStyle:"italic"}}>"{snap.notes}"</div>}
                </div>
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ── EXPANDED ROW ──────────────────────────────────────────────────────────────
function ExpandedRow({ item, tab, setTab, onUpdate }) {
  const sc=avg(item.scores||[]);
  const histCount=(item.scoreHistory||[]).length;
  return (
    <div style={{borderTop:"1px solid #e5e7eb"}}>
      <div style={{display:"flex",gap:0,background:"#f8fafc",borderBottom:"1px solid #e5e7eb",paddingLeft:18}}>
        {["Details","Score"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"9px 20px",fontSize:12,fontWeight:600,border:"none",borderBottom:`2px solid ${tab===t?"#1d4ed8":"transparent"}`,background:"none",cursor:"pointer",color:tab===t?"#1d4ed8":"#9ca3af",marginBottom:-1}}>
            {t==="Score"?`★ Score${sc?` · ${sc}/5`:""}${histCount?` · ${histCount} snapshot${histCount>1?"s":""}`:""}`:"📋 Details"}
          </button>
        ))}
      </div>
      {tab==="Details"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,padding:"16px 22px",background:"#f8fafc"}}>
          {[["📝 Description",item.description,"#3b82f6"],["🔴 Problem Solved",item.problem,"#ef4444"],["✅ Solution",item.solution,"#16a34a"]].map(([lbl,val,clr])=>(
            <div key={lbl} style={{borderLeft:`3px solid ${clr}`,paddingLeft:12}}>
              <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:6}}>{lbl}</div>
              <div style={{fontSize:12,color:val?"#4b5563":"#9ca3af",lineHeight:1.65,fontStyle:val?"normal":"italic"}}>{val||"Not documented — click Edit to add"}</div>
            </div>
          ))}
        </div>
      )}
      {tab==="Score"&&<ScorePanel item={item} onUpdate={onUpdate}/>}
    </div>
  );
}

// ── MANAGE MODAL ──────────────────────────────────────────────────────────────
function ManageModal({ onClose, lookups, setLookups }) {
  const [local,setLocal]=useState({types:[...lookups.types],teams:[...lookups.teams],statuses:[...lookups.statuses],impacts:[...lookups.impacts]});
  const [section,setSection]=useState("types");
  const [editingId,setEditingId]=useState(null);
  const [draft,setDraft]=useState(null);
  const [newName,setNewName]=useState("");
  const [newColorIdx,setNewColorIdx]=useState(0);
  const sections=[{key:"types",label:"Types",icon:"🏷️",hasColor:true},{key:"teams",label:"Teams",icon:"👥",hasColor:false},{key:"statuses",label:"Statuses",icon:"📍",hasColor:true},{key:"impacts",label:"Impacts",icon:"⚡",hasColor:true}];
  const items=local[section]||[];
  const hasColor=sections.find(s=>s.key===section)?.hasColor;
  const startEdit=item=>{setEditingId(item.id);setDraft({...item});};
  const cancelEdit=()=>{setEditingId(null);setDraft(null);};
  const saveEdit=()=>{if(!draft.name.trim())return;setLocal(l=>({...l,[section]:l[section].map(i=>i.id===draft.id?draft:i)}));cancelEdit();};
  const removeItem=id=>{if(!window.confirm("Remove? Initiatives using it keep the value."))return;setLocal(l=>({...l,[section]:l[section].filter(i=>i.id!==id)}));};
  const addItem=()=>{const n=newName.trim();if(!n)return;const preset=COLOR_PRESETS[newColorIdx];const ni=hasColor?{id:uid(),name:n,...preset}:{id:uid(),name:n};setLocal(l=>({...l,[section]:[...l[section],ni]}));setNewName("");setNewColorIdx(0);};
  const handleSave=()=>{setLookups(local);onClose();};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(3px)"}}>
      <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:680,maxHeight:"90vh",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.18)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 24px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div><div style={{fontSize:10,color:"#9ca3af",letterSpacing:"0.8px",textTransform:"uppercase",fontWeight:700,marginBottom:3}}>Configuration</div><div style={{fontSize:17,fontWeight:700,color:"#111827"}}>Manage Options</div></div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:18,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid #e5e7eb",background:"#fafafa",flexShrink:0}}>
          {sections.map(s=><button key={s.key} onClick={()=>{setSection(s.key);cancelEdit();}} style={{flex:1,padding:"11px 8px",fontSize:12,fontWeight:600,border:"none",borderBottom:`2px solid ${section===s.key?"#1d4ed8":"transparent"}`,background:"none",cursor:"pointer",color:section===s.key?"#1d4ed8":"#9ca3af",marginBottom:-1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><span style={{fontSize:16}}>{s.icon}</span>{s.label}</button>)}
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"16px 22px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16}}>
            {items.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"white",border:"1.5px solid #e5e7eb",borderRadius:9}}>
                {editingId===item.id?(
                  <>{hasColor?<Badge text={draft.name||item.name} color={draft.color} bg={draft.bg} border={draft.border} small/>:<span style={{flex:1,fontSize:13,fontWeight:500}}>{draft.name}</span>}
                  <input value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} autoFocus style={{flex:1,border:"1.5px solid #3b82f6",borderRadius:7,padding:"6px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
                  {hasColor&&<div style={{display:"flex",gap:4,flexWrap:"wrap",maxWidth:180}}>{COLOR_PRESETS.map((p,i)=><span key={i} onClick={()=>setDraft(d=>({...d,...p}))} style={{width:20,height:20,borderRadius:"50%",background:p.bg,border:`2px solid ${draft.color===p.color?"#1d4ed8":p.border}`,cursor:"pointer"}}/>)}</div>}
                  <button onClick={saveEdit} style={{background:"#1d4ed8",border:"none",borderRadius:7,color:"white",fontSize:12,fontWeight:700,padding:"6px 14px",cursor:"pointer"}}>Done</button>
                  <button onClick={cancelEdit} style={{background:"#f1f5f9",border:"none",borderRadius:7,color:"#6b7280",fontSize:12,fontWeight:600,padding:"6px 12px",cursor:"pointer"}}>Cancel</button></>
                ):(
                  <>{hasColor?<Badge text={item.name} color={item.color} bg={item.bg} border={item.border} small/>:<span style={{flex:1,fontSize:13,fontWeight:500,color:"#111827"}}>{item.name}</span>}
                  {hasColor&&<span style={{flex:1}}/>}
                  <button onClick={()=>startEdit(item)} style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,color:"#1d4ed8",fontSize:11,fontWeight:700,padding:"4px 10px",cursor:"pointer"}}>Edit</button>
                  <button onClick={()=>removeItem(item.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,color:"#dc2626",fontSize:11,fontWeight:700,padding:"4px 9px",cursor:"pointer"}}>Remove</button></>
                )}
              </div>
            ))}
            {items.length===0&&<div style={{fontSize:12,color:"#9ca3af",fontStyle:"italic",padding:"8px 0"}}>No options yet.</div>}
          </div>
          <div style={{background:"#f8fafc",border:"1.5px dashed #d1d5db",borderRadius:10,padding:"14px 16px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:10}}>ADD NEW</div>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder={`New ${section.slice(0,-1)} name…`}
                style={{flex:1,minWidth:160,border:"1.5px solid #e5e7eb",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",background:"white"}}
                onFocus={e=>e.target.style.borderColor="#3b82f6"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
              {hasColor&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{COLOR_PRESETS.map((p,i)=><span key={i} onClick={()=>setNewColorIdx(i)} style={{width:22,height:22,borderRadius:"50%",background:p.bg,border:`2px solid ${newColorIdx===i?"#1d4ed8":p.border}`,cursor:"pointer"}}/>)}</div>}
              <button onClick={addItem} style={{background:"#1d4ed8",color:"white",border:"none",borderRadius:8,padding:"8px 18px",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ Add</button>
            </div>
            {hasColor&&newName&&<div style={{marginTop:10,display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#6b7280"}}>Preview: <Badge text={newName} color={COLOR_PRESETS[newColorIdx].color} bg={COLOR_PRESETS[newColorIdx].bg} border={COLOR_PRESETS[newColorIdx].border} small/></div>}
          </div>
        </div>
        <div style={{padding:"14px 22px",borderTop:"1px solid #e5e7eb",display:"flex",justifyContent:"flex-end",gap:8,flexShrink:0,background:"white"}}>
          <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e5e7eb",background:"white",color:"#6b7280",fontSize:13,fontWeight:600,cursor:"pointer"}}>Discard</button>
          <button onClick={handleSave} style={{padding:"9px 22px",borderRadius:8,border:"none",background:"#1d4ed8",color:"white",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px #1d4ed830"}}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── EDIT FIELD ────────────────────────────────────────────────────────────────
function EditField({ label, value, onChange, type="input", opts }) {
  const base={border:"1.5px solid #e5e7eb",borderRadius:8,padding:"9px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",color:"#111827",outline:"none"};
  const fo=e=>e.target.style.borderColor="#3b82f6";
  const bl=e=>e.target.style.borderColor="#e5e7eb";
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:11,fontWeight:700,color:"#374151"}}>{label}</label>
      {type==="textarea"
        ?<textarea value={value||""} onChange={e=>onChange(e.target.value)} rows={3} style={{...base,resize:"vertical",lineHeight:1.55}} onFocus={fo} onBlur={bl}/>
        :type==="select"
        ?<select value={value||""} onChange={e=>onChange(e.target.value)} style={{...base,background:"white",cursor:"pointer"}}>{opts.map(o=><option key={o}>{o}</option>)}</select>
        :type==="date"
        ?<input type="date" value={value||""} onChange={e=>onChange(e.target.value)} style={base} onFocus={fo} onBlur={bl}/>
        :<input value={value||""} onChange={e=>onChange(e.target.value)} style={base} onFocus={fo} onBlur={bl}/>
      }
    </div>
  );
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────────
function EditModal({ item, onSave, onClose, lookups }) {
  const blank={id:newId(),initiative:"",team:lookups.teams[0]?.name||"",status:lookups.statuses[0]?.name||"",impact:lookups.impacts[0]?.name||"",type:lookups.types[0]?.name||"",assignee:"",description:"",problem:"",solution:"",scoreNotes:"",scores:DEFAULT_CRITERIA.map(c=>({...c,score:0})),scoreHistory:[],startDate:"",endDate:""};
  const [f,setF]=useState(item?{...item}:blank);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const isNew=!item;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(3px)"}}>
      <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:680,maxHeight:"93vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"20px 24px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"white",zIndex:10}}>
          <div><div style={{fontSize:10,color:"#9ca3af",letterSpacing:"0.8px",textTransform:"uppercase",fontWeight:700,marginBottom:3}}>{isNew?"New":"Edit"} Initiative</div><div style={{fontSize:16,fontWeight:700,color:"#111827"}}>{f.initiative||"Untitled"}</div></div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:18,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <EditField label="Jira Key" value={f.id} onChange={v=>set("id",v)}/>
            <EditField label="Assignee" value={f.assignee} onChange={v=>set("assignee",v)}/>
          </div>
          <EditField label="Initiative Name" value={f.initiative} onChange={v=>{set("initiative",v);if(isNew)set("type",inferType(v,lookups.types));}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <EditField label="Type" value={f.type} onChange={v=>set("type",v)} type="select" opts={lookups.types.map(t=>t.name)}/>
            <EditField label="Team" value={f.team} onChange={v=>set("team",v)} type="select" opts={lookups.teams.map(t=>t.name)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <EditField label="Status" value={f.status} onChange={v=>set("status",v)} type="select" opts={lookups.statuses.map(s=>s.name)}/>
            <EditField label="Impact" value={f.impact} onChange={v=>set("impact",v)} type="select" opts={lookups.impacts.map(i=>i.name)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <EditField label="📅 Start Date" value={f.startDate} onChange={v=>set("startDate",v)} type="date"/>
            <EditField label="📅 End Date" value={f.endDate} onChange={v=>set("endDate",v)} type="date"/>
          </div>
          <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"14px 16px",display:"flex",flexDirection:"column",gap:13}}>
            <div style={{fontSize:11,fontWeight:700,color:"#92400e"}}>⚡ KEY DETAILS</div>
            <EditField label="📝 Description" value={f.description} onChange={v=>set("description",v)} type="textarea"/>
            <EditField label="🔴 Problem" value={f.problem} onChange={v=>set("problem",v)} type="textarea"/>
            <EditField label="✅ Solution" value={f.solution} onChange={v=>set("solution",v)} type="textarea"/>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:2}}>
            <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e5e7eb",background:"white",color:"#6b7280",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>{if(!f.initiative.trim()){alert("Initiative name required");return;}onSave(f);}} style={{padding:"9px 22px",borderRadius:8,border:"none",background:"#1d4ed8",color:"white",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px #1d4ed830"}}>{isNew?"Add Initiative":"Save Changes"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── JIRA MODAL ────────────────────────────────────────────────────────────────
function JiraModal({ url, onSave, onClose }) {
  const [val,setVal]=useState(url);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(3px)"}}>
      <div style={{background:"white",borderRadius:14,width:"100%",maxWidth:500,padding:28,boxShadow:"0 20px 60px rgba(0,0,0,0.15)"}}>
        <div style={{fontSize:16,fontWeight:700,color:"#111827",marginBottom:6}}>⚙️ Jira Base URL</div>
        <div style={{fontSize:13,color:"#6b7280",marginBottom:16,lineHeight:1.6}}>Set your Atlassian domain so Jira key links open the right tickets.<br/><span style={{fontSize:12}}>Example: <code style={{background:"#f1f5f9",padding:"2px 6px",borderRadius:4,fontSize:11}}>https://yourcompany.atlassian.net/browse</code></span></div>
        <input value={val} onChange={e=>setVal(e.target.value)} placeholder="https://yourcompany.atlassian.net/browse" style={{width:"100%",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"10px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",marginBottom:20}} onFocus={e=>e.target.style.borderColor="#3b82f6"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"9px 20px",border:"1.5px solid #e5e7eb",borderRadius:8,background:"white",color:"#6b7280",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onSave(val.replace(/\/+$/,""))} style={{padding:"9px 20px",border:"none",borderRadius:8,background:"#1d4ed8",color:"white",fontSize:13,fontWeight:600,cursor:"pointer"}}>Save URL</button>
        </div>
      </div>
    </div>
  );
}

// ── GANTT VIEW ────────────────────────────────────────────────────────────────
function GanttView({ items, lookups, jiraBase, onEdit }) {
  const withDates = items.filter(i=>i.startDate&&i.endDate).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const noDates   = items.filter(i=>!i.startDate||!i.endDate);
  if(items.length===0) return <div style={{padding:"48px 20px",textAlign:"center",color:"#9ca3af",fontSize:14}}>No initiatives to display.</div>;

  const allDates = withDates.flatMap(i=>[i.startDate,i.endDate]);
  const minDate  = allDates.length ? allDates.reduce((a,b)=>a<b?a:b) : isoToday();
  const maxDate  = allDates.length ? allDates.reduce((a,b)=>a>b?a:b) : isoToday();
  const msMin    = new Date(minDate).getTime();
  const msMax    = new Date(maxDate).getTime();
  const span     = msMax-msMin||1;

  const ticks=[];
  let d=new Date(minDate); d.setDate(1);
  while(d<=new Date(maxDate)){
    ticks.push({label:d.toLocaleDateString("en-GB",{month:"short",year:"2-digit"}),pct:((d.getTime()-msMin)/span)*100});
    d=new Date(d.getFullYear(),d.getMonth()+1,1);
  }

  const todayPct=Math.min(100,Math.max(0,((new Date().getTime()-msMin)/span)*100));
  const getStatus=name=>lookups.statuses.find(s=>s.name===name)||{color:"#475569",bg:"#f1f5f9"};

  return (
    <div style={{background:"white",border:"1.5px solid #e5e7eb",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 8px rgba(0,0,0,0.04)"}}>
      <div style={{display:"grid",gridTemplateColumns:"260px 1fr",background:"#f8fafc",borderBottom:"2px solid #e5e7eb"}}>
        <div style={{padding:"10px 18px",fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:"1px",textTransform:"uppercase"}}>Initiative</div>
        <div style={{position:"relative",height:36,borderLeft:"1px solid #e5e7eb",overflow:"hidden"}}>
          {ticks.map((t,i)=>(
            <div key={i} style={{position:"absolute",left:`${t.pct}%`,top:0,height:"100%",borderLeft:"1px solid #e5e7eb"}}>
              <span style={{position:"absolute",top:10,left:4,fontSize:9,color:"#9ca3af",fontWeight:600,whiteSpace:"nowrap"}}>{t.label}</span>
            </div>
          ))}
          <div style={{position:"absolute",left:`${todayPct}%`,top:0,width:2,height:"100%",background:"#ef4444",opacity:0.7}}/>
        </div>
      </div>
      {withDates.map((item,idx)=>{
        const s   = (new Date(item.startDate).getTime()-msMin)/span*100;
        const e   = (new Date(item.endDate).getTime()-msMin)/span*100;
        const w   = Math.max(0.5,e-s);
        const ss  = getStatus(item.status);
        return (
          <div key={item.id} style={{display:"grid",gridTemplateColumns:"260px 1fr",borderBottom:idx<withDates.length-1?"1px solid #f1f5f9":"none",minHeight:44}}>
            <div style={{padding:"8px 18px",display:"flex",flexDirection:"column",justifyContent:"center",gap:3,borderRight:"1px solid #f1f5f9"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <a href={`${jiraBase}/${item.id}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()}
                  style={{fontSize:10,fontFamily:"monospace",color:"#1d4ed8",textDecoration:"none",fontWeight:600,whiteSpace:"nowrap"}}>
                  {item.id}
                </a>
                {item.assignee&&<Avatar name={item.assignee} size={18}/>}
              </div>
              <div style={{fontSize:12,fontWeight:600,color:"#111827",lineHeight:1.3,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{item.initiative}</div>
            </div>
            <div style={{position:"relative",background:idx%2===0?"white":"#fafbfc"}}>
              {ticks.map((t,i)=><div key={i} style={{position:"absolute",left:`${t.pct}%`,top:0,width:1,height:"100%",background:"#f1f5f9"}}/>)}
              <div style={{position:"absolute",left:`${todayPct}%`,top:0,width:1.5,height:"100%",background:"#ef444430"}}/>
              <div style={{position:"absolute",top:"50%",transform:"translateY(-50%)",left:`${s}%`,width:`${w}%`,minWidth:3,height:20,borderRadius:4,background:ss.bg,border:`1.5px solid ${ss.border||"#e5e7eb"}`,display:"flex",alignItems:"center",overflow:"hidden",cursor:"pointer"}} onClick={()=>onEdit(item)}>
                <div style={{height:"100%",background:ss.color,opacity:0.25,borderRadius:4,width:"100%",position:"absolute"}}/>
                <span style={{position:"relative",fontSize:9,fontWeight:700,color:ss.color,paddingLeft:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",zIndex:1}}>{item.initiative}</span>
              </div>
            </div>
          </div>
        );
      })}
      {noDates.length>0&&(
        <div style={{padding:"10px 18px",background:"#fffbeb",borderTop:"1px solid #fde68a",fontSize:12,color:"#92400e"}}>
          <strong>{noDates.length} initiative{noDates.length>1?"s":""}</strong> without dates are hidden from this view.
        </div>
      )}
      <div style={{padding:"10px 18px",borderTop:"1px solid #e5e7eb",background:"#f8fafc",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:11,color:"#6b7280",fontWeight:600}}>Click a bar to edit &nbsp;·&nbsp; </span>
        <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:20,height:3,background:"#ef4444",borderRadius:2}}/><span style={{fontSize:11,color:"#6b7280"}}>Today</span></div>
        {lookups.statuses.map(s=><div key={s.id} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:12,height:12,borderRadius:3,background:s.bg,border:`1.5px solid ${s.border}`}}/><span style={{fontSize:10,color:"#6b7280"}}>{s.name}</span></div>)}
      </div>
    </div>
  );
}

// ── BULK STATUS BAR ───────────────────────────────────────────────────────────
function BulkBar({ count, statuses, onApply, onClear }) {
  const [pick,setPick]=useState("");
  return (
    <div style={{position:"sticky",top:108,zIndex:90,background:"#1d4ed8",color:"white",padding:"10px 20px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",boxShadow:"0 4px 16px #1d4ed840",borderRadius:10,margin:"0 0 12px 0"}}>
      <span style={{fontSize:13,fontWeight:700}}>✓ {count} selected</span>
      <span style={{fontSize:12,opacity:0.8}}>Bulk update status:</span>
      <select value={pick} onChange={e=>setPick(e.target.value)} style={{border:"none",borderRadius:7,padding:"6px 10px",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#111827",background:"white",outline:"none",cursor:"pointer"}}>
        <option value="">— choose status —</option>
        {statuses.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
      </select>
      <button onClick={()=>{if(!pick){alert("Choose a status first.");return;}onApply(pick);setPick("");}} style={{background:"white",color:"#1d4ed8",border:"none",borderRadius:7,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Apply</button>
      <button onClick={onClear} style={{background:"transparent",color:"rgba(255,255,255,0.8)",border:"1.5px solid rgba(255,255,255,0.4)",borderRadius:7,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",marginLeft:"auto"}}>Deselect All</button>
    </div>
  );
}

// ── API HELPERS ───────────────────────────────────────────────────────────────
async function apiGet(key) {
  const res = await fetch(`/api/data/${key}`);
  if (!res.ok) return null;
  return res.json();
}

async function apiSet(key, value) {
  await fetch(`/api/data/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function AutomationTracker() {
  const [lookups,    setLookups]   = useState({types:DEFAULT_TYPES,teams:DEFAULT_TEAMS,statuses:DEFAULT_STATUSES,impacts:DEFAULT_IMPACTS});
  const [items,      setItems]     = useState([]);
  const [loaded,     setLoaded]    = useState(false);
  const [expanded,   setExpanded]  = useState(null);
  const [tabMap,     setTabMap]    = useState({});
  const [editing,    setEditing]   = useState(null);
  const [manageOpen, setManageOpen]= useState(false);
  const [jiraModal,  setJiraModal] = useState(false);
  const [jiraBase,   setJiraBase]  = useState("https://your-org.atlassian.net/browse");
  const [saveMsg,    setSaveMsg]   = useState("");
  const [activeView, setActiveView]= useState("table");
  const [selected,   setSelected]  = useState(new Set());
  const [filterStatus,   setFilterStatus]   = useState("All");
  const [filterTeam,     setFilterTeam]     = useState("All");
  const [filterImpact,   setFilterImpact]   = useState("All");
  const [filterType,     setFilterType]     = useState("All");
  const [filterAssignee, setFilterAssignee] = useState("All");
  const [search,  setSearch]  = useState("");
  const [sortBy,  setSortBy]  = useState("id");

  // ── Load from DB on mount ────────────────────────────────────────────────
  useEffect(()=>{
    (async()=>{
      try {
        const [lkData, itData, jbData] = await Promise.all([
          apiGet("auto-lookups"),
          apiGet("auto-v5"),
          apiGet("auto-jira"),
        ]);
        const fl = lkData || {types:DEFAULT_TYPES,teams:DEFAULT_TEAMS,statuses:DEFAULT_STATUSES,impacts:DEFAULT_IMPACTS};
        if (lkData) setLookups(lkData);
        if (itData) setItems(itData);
        else setItems(makeSeed(fl.types));
        if (jbData) setJiraBase(jbData);
      } catch {
        setItems(makeSeed(DEFAULT_TYPES));
      }
      setLoaded(true);
    })();
  },[]);

  // ── Persist helpers ──────────────────────────────────────────────────────
  const persistItems = async next => {
    setItems(next);
    try {
      await apiSet("auto-v5", next);
      setSaveMsg("Saved ✓");
      setTimeout(()=>setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("⚠ Save failed");
    }
  };
  const persistLookups = async next => {
    setLookups(next);
    try { await apiSet("auto-lookups", next); } catch {}
  };
  const persistJira = async url => {
    setJiraBase(url);
    setJiraModal(false);
    try { await apiSet("auto-jira", url); } catch {}
  };

  const saveItem   = form => { persistItems(items.findIndex(i=>i.id===form.id)>=0?items.map(i=>i.id===form.id?form:i):[...items,form]); setEditing(null); };
  const updateItem = upd  => persistItems(items.map(i=>i.id===upd.id?upd:i));
  const deleteItem = id   => { if(window.confirm("Delete this initiative?")) persistItems(items.filter(i=>i.id!==id)); setSelected(s=>{const ns=new Set(s);ns.delete(id);return ns;}); };

  const applyBulkStatus = status => {
    persistItems(items.map(i=>selected.has(i.id)?{...i,status}:i));
    setSelected(new Set());
  };
  const toggleSelect = (id,e) => {
    e.stopPropagation();
    setSelected(s=>{ const ns=new Set(s); ns.has(id)?ns.delete(id):ns.add(id); return ns; });
  };
  const toggleSelectAll = checked => setSelected(checked?new Set(filtered.map(i=>i.id)):new Set());

  const getType   = name=>lookups.types.find(t=>t.name===name);
  const getStatus = name=>lookups.statuses.find(s=>s.name===name);
  const getImpact = name=>lookups.impacts.find(i=>i.name===name);
  const allAssignees=[...new Set(items.map(i=>i.assignee||"").filter(Boolean))].sort();

  const filtered=useMemo(()=>{
    let r=[...items];
    if(filterStatus!=="All")   r=r.filter(i=>i.status===filterStatus);
    if(filterTeam!=="All")     r=r.filter(i=>i.team===filterTeam);
    if(filterImpact!=="All")   r=r.filter(i=>i.impact===filterImpact);
    if(filterType!=="All")     r=r.filter(i=>i.type===filterType);
    if(filterAssignee!=="All") r=r.filter(i=>i.assignee===filterAssignee);
    if(search){const q=search.toLowerCase();r=r.filter(i=>i.initiative.toLowerCase().includes(q)||(i.type||"").toLowerCase().includes(q)||i.team.toLowerCase().includes(q)||(i.assignee||"").toLowerCase().includes(q)||(i.description||"").toLowerCase().includes(q));}
    r.sort((a,b)=>sortBy==="id"?a.id.localeCompare(b.id):sortBy==="status"?a.status.localeCompare(b.status):sortBy==="type"?(a.type||"").localeCompare(b.type||""):sortBy==="team"?a.team.localeCompare(b.team):sortBy==="assignee"?(a.assignee||"").localeCompare(b.assignee||""):a.initiative.localeCompare(b.initiative));
    return r;
  },[items,filterStatus,filterTeam,filterImpact,filterType,filterAssignee,search,sortBy]);

  const stats={total:items.length,done:items.filter(i=>i.status==="Done").length,active:items.filter(i=>!["Done","Backlog"].includes(i.status)).length,backlog:items.filter(i=>i.status==="Backlog").length,high:items.filter(i=>i.impact==="High").length};
  const hasFilter=filterStatus!=="All"||filterTeam!=="All"||filterImpact!=="All"||filterType!=="All"||filterAssignee!=="All"||search;
  const allFilteredSelected=filtered.length>0&&filtered.every(i=>selected.has(i.id));
  const getTab=id=>tabMap[id]||"Details";
  const setTab=(id,t)=>setTabMap(p=>({...p,[id]:t}));

  if(!loaded) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"'DM Sans',sans-serif",color:"#6b7280",fontSize:14}}>Loading…</div>;

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#f8fafc",minHeight:"100vh",color:"#111827"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .trow{transition:background .1s}
        .trow:hover{background:#f0f4ff !important}
        .row-act{opacity:0;transition:opacity .15s}
        .trow:hover .row-act{opacity:1}
        button,input,select,textarea{font-family:'DM Sans',sans-serif}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}
      `}</style>

      {manageOpen&&<ManageModal onClose={()=>setManageOpen(false)} lookups={lookups} setLookups={persistLookups}/>}
      {editing&&<EditModal item={editing==="new"?null:editing} onSave={saveItem} onClose={()=>setEditing(null)} lookups={lookups}/>}
      {jiraModal&&<JiraModal url={jiraBase} onSave={persistJira} onClose={()=>setJiraModal(false)}/>}

      {/* TOP BAR */}
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:"15px 28px",position:"sticky",top:44,zIndex:100,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{maxWidth:1440,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:10,color:"#9ca3af",fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:2}}>SRE · Engineering</div>
            <div style={{fontSize:20,fontWeight:800,color:"#111827"}}>Automation Initiatives</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            {saveMsg&&<span style={{fontSize:12,fontWeight:600,padding:"4px 10px",borderRadius:6,color:saveMsg.startsWith("⚠")?"#dc2626":"#16a34a",background:saveMsg.startsWith("⚠")?"#fef2f2":"#f0fdf4",border:`1px solid ${saveMsg.startsWith("⚠")?"#fecaca":"#bbf7d0"}`}}>{saveMsg}</span>}
            <div style={{display:"flex",border:"1.5px solid #e5e7eb",borderRadius:8,overflow:"hidden"}}>
              {[["table","⊞ Table"],["roadmap","📅 Roadmap"]].map(([v,l])=>(
                <button key={v} onClick={()=>setActiveView(v)} style={{padding:"7px 14px",fontSize:12,fontWeight:600,border:"none",background:activeView===v?"#1d4ed8":"white",color:activeView===v?"white":"#6b7280",cursor:"pointer",borderRight:v==="table"?"1.5px solid #e5e7eb":"none"}}>{l}</button>
              ))}
            </div>
            <span style={{fontSize:11,color:"#9ca3af"}}>Updated: {today()}</span>
            <button onClick={()=>exportCSV(items)} style={{background:"#f0fdf4",color:"#16a34a",border:"1.5px solid #bbf7d0",borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:600,cursor:"pointer"}}>⬇ Export CSV</button>
            <button onClick={()=>setJiraModal(true)} style={{background:"#f8fafc",color:"#475569",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:600,cursor:"pointer"}}>⚙️ Jira URL</button>
            <button onClick={()=>setManageOpen(true)} style={{background:"#f8fafc",color:"#475569",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:600,cursor:"pointer"}}>🏷️ Manage Options</button>
            <button onClick={()=>setEditing("new")} style={{background:"#1d4ed8",color:"white",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 8px #1d4ed830"}}>+ Add Initiative</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1440,margin:"0 auto",padding:"20px 28px 48px"}}>
        {/* STATS */}
        <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
          <Stat label="Total" value={stats.total} color="#1d4ed8"/>
          <Stat label="Completed" value={stats.done} color="#16a34a" note={`${stats.total?Math.round(stats.done/stats.total*100):0}%`}/>
          <Stat label="In Flight" value={stats.active} color="#7c3aed"/>
          <Stat label="Backlog" value={stats.backlog} color="#6b7280"/>
          <Stat label="High Impact" value={stats.high} color="#dc2626"/>
        </div>

        {/* FILTERS */}
        <div style={{background:"white",border:"1px solid #e5e7eb",borderRadius:10,padding:"11px 15px",marginBottom:12,display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search…" style={{border:"1.5px solid #e5e7eb",borderRadius:7,padding:"7px 11px",fontSize:13,minWidth:160,color:"#374151",outline:"none"}}/>
          {[{label:"Status",v:filterStatus,set:setFilterStatus,opts:lookups.statuses.map(s=>s.name)},{label:"Type",v:filterType,set:setFilterType,opts:lookups.types.map(t=>t.name)},{label:"Team",v:filterTeam,set:setFilterTeam,opts:lookups.teams.map(t=>t.name)},{label:"Impact",v:filterImpact,set:setFilterImpact,opts:lookups.impacts.map(i=>i.name)},{label:"Assignee",v:filterAssignee,set:setFilterAssignee,opts:allAssignees}].map(f=>(
            <select key={f.label} value={f.v} onChange={e=>f.set(e.target.value)} style={{border:"1.5px solid #e5e7eb",borderRadius:7,padding:"7px 9px",fontSize:12,color:f.v!=="All"?"#1d4ed8":"#6b7280",fontWeight:f.v!=="All"?700:400,background:"white",outline:"none",cursor:"pointer"}}>
              <option value="All">All {f.label}s</option>
              {f.opts.map(o=><option key={o}>{o}</option>)}
            </select>
          ))}
          {hasFilter&&<button onClick={()=>{setFilterStatus("All");setFilterTeam("All");setFilterImpact("All");setFilterType("All");setFilterAssignee("All");setSearch("");}} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:7,color:"#dc2626",fontSize:12,fontWeight:600,padding:"6px 11px",cursor:"pointer"}}>Clear ×</button>}
          {activeView==="table"&&(
            <div style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:"#9ca3af",fontWeight:600,marginRight:2}}>SORT:</span>
              {[["id","Key"],["type","Type"],["status","Status"],["team","Team"],["assignee","Assignee"],["initiative","Name"]].map(([k,l])=>(
                <button key={k} onClick={()=>setSortBy(k)} style={{background:sortBy===k?"#eff6ff":"white",border:`1.5px solid ${sortBy===k?"#bfdbfe":"#e5e7eb"}`,borderRadius:6,color:sortBy===k?"#1d4ed8":"#6b7280",fontSize:11,fontWeight:600,padding:"4px 8px",cursor:"pointer"}}>{l}</button>
              ))}
            </div>
          )}
        </div>

        <div style={{fontSize:12,color:"#9ca3af",marginBottom:10,fontWeight:500}}>
          {filtered.length} of {items.length} initiatives{hasFilter&&<span style={{color:"#1d4ed8"}}> (filtered)</span>}
          {activeView==="table"&&<span style={{fontStyle:"italic"}}> · Click row to expand · Hover to edit · Check boxes for bulk update</span>}
        </div>

        {selected.size>0&&(
          <BulkBar count={selected.size} statuses={lookups.statuses} onApply={applyBulkStatus} onClear={()=>setSelected(new Set())}/>
        )}

        {activeView==="roadmap"&&(
          <GanttView items={filtered} lookups={lookups} jiraBase={jiraBase} onEdit={item=>setEditing(item)}/>
        )}

        {activeView==="table"&&(
          <div style={{background:"white",border:"1.5px solid #e5e7eb",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 8px rgba(0,0,0,0.04)"}}>
            <div style={{display:"grid",gridTemplateColumns:"36px 88px 240px 190px 120px 115px 130px 90px 72px",background:"#f8fafc",borderBottom:"2px solid #e5e7eb",padding:"10px 18px",alignItems:"center"}}>
              <div style={{paddingLeft:2}}>
                <input type="checkbox" checked={allFilteredSelected} onChange={e=>toggleSelectAll(e.target.checked)} style={{cursor:"pointer",width:14,height:14,accentColor:"#1d4ed8"}}/>
              </div>
              {["Jira Key","Initiative","Type","Team","Assignee","Status","Impact",""].map((h,i)=>(
                <div key={i} style={{fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:"1px",textTransform:"uppercase",paddingLeft:i===0?0:8}}>{h}</div>
              ))}
            </div>

            {filtered.length===0
              ? <div style={{padding:"48px 20px",textAlign:"center",color:"#9ca3af",fontSize:14}}>No initiatives match your filters.</div>
              : filtered.map((item,idx)=>{
                const isExp=expanded===item.id;
                const isSel=selected.has(item.id);
                const ts=getType(item.type)||{color:"#374151",bg:"#f3f4f6",border:"#e5e7eb"};
                const ss=getStatus(item.status)||{color:"#475569",bg:"#f1f5f9",border:"#e2e8f0"};
                const is=getImpact(item.impact)||{color:"#374151",bg:"#f9fafb",border:"#e5e7eb"};
                const sc=avg(item.scores||[]);
                const scc=scColor(sc?parseFloat(sc):null);
                return (
                  <div key={item.id} style={{borderBottom:idx<filtered.length-1?"1px solid #f1f5f9":"none",background:isSel?"#eff6ff":"white"}}>
                    <div className="trow" onClick={()=>setExpanded(isExp?null:item.id)}
                      style={{display:"grid",gridTemplateColumns:"36px 88px 240px 190px 120px 115px 130px 90px 72px",padding:"11px 18px",alignItems:"center",cursor:"pointer",userSelect:"none",background:isSel?"#eff6ff":undefined}}>
                      <div onClick={e=>toggleSelect(item.id,e)} style={{paddingLeft:2}}>
                        <input type="checkbox" checked={isSel} onChange={()=>{}} style={{cursor:"pointer",width:14,height:14,accentColor:"#1d4ed8"}} onClick={e=>e.stopPropagation()}/>
                      </div>
                      <div onClick={e=>e.stopPropagation()}>
                        <a href={`${jiraBase}/${item.id}`} target="_blank" rel="noopener noreferrer"
                          style={{fontSize:11,fontFamily:"monospace",fontWeight:600,color:"#1d4ed8",textDecoration:"none",borderBottom:"1px dashed #93c5fd",paddingBottom:1}}>
                          {item.id} →
                        </a>
                      </div>
                      <div style={{paddingLeft:8,overflow:"hidden"}}>
                        <div style={{display:"flex",alignItems:"center",gap:7,overflow:"hidden"}}>
                          <span style={{fontSize:13,fontWeight:600,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.initiative}</span>
                          {sc&&<span style={{fontSize:10,fontWeight:700,color:scc,border:`1.5px solid ${scc}`,borderRadius:10,padding:"1px 6px",lineHeight:1.5,background:"white"}}>★ {sc}</span>}
                          {(item.scoreHistory||[]).length>0&&<span style={{fontSize:9,color:"#9ca3af",background:"#f1f5f9",borderRadius:8,padding:"1px 6px"}}>{item.scoreHistory.length} snap</span>}
                        </div>
                      </div>
                      <div style={{paddingLeft:8}}><Badge text={item.type||"—"} color={ts.color} bg={ts.bg} border={ts.border} small/></div>
                      <div style={{paddingLeft:8,fontSize:12,color:"#374151",fontWeight:500}}>{item.team}</div>
                      <div style={{paddingLeft:8,display:"flex",alignItems:"center",gap:6}}>
                        <Avatar name={item.assignee} size={24}/>
                        {item.assignee?<span style={{fontSize:12,color:"#374151",fontWeight:500}}>{item.assignee}</span>:<span style={{fontSize:11,color:"#d1d5db",fontStyle:"italic"}}>Unassigned</span>}
                      </div>
                      <div style={{paddingLeft:8}}><Badge text={item.status} color={ss.color} bg={ss.bg} border={ss.border} small/></div>
                      <div style={{paddingLeft:8}}><Badge text={item.impact} color={is.color} bg={is.bg} border={is.border} small/></div>
                      <div style={{paddingLeft:8,display:"flex",gap:4,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                        <div className="row-act" style={{display:"flex",gap:4}}>
                          <button onClick={()=>setEditing(item)} style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,color:"#1d4ed8",fontSize:11,fontWeight:700,padding:"4px 8px",cursor:"pointer"}}>Edit</button>
                          <button onClick={()=>deleteItem(item.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,color:"#dc2626",fontSize:12,fontWeight:700,padding:"4px 7px",cursor:"pointer"}}>×</button>
                        </div>
                        <span style={{fontSize:10,color:"#d1d5db",marginLeft:2}}>{isExp?"▲":"▼"}</span>
                      </div>
                    </div>
                    {isExp&&<ExpandedRow item={item} tab={getTab(item.id)} setTab={t=>setTab(item.id,t)} onUpdate={updateItem}/>}
                  </div>
                );
              })}
          </div>
        )}

        {/* TEAM PROGRESS */}
        {activeView==="table"&&(
          <div style={{marginTop:24}}>
            <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px"}}>Progress by Team</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
              {lookups.teams.filter(t=>items.some(i=>i.team===t.name)).map(team=>{
                const ti=items.filter(i=>i.team===team.name);
                const done=ti.filter(i=>i.status==="Done").length;
                const act=ti.filter(i=>!["Done","Backlog"].includes(i.status)).length;
                const pct=ti.length?Math.round(done/ti.length*100):0;
                const on=filterTeam===team.name;
                return (
                  <div key={team.id} onClick={()=>setFilterTeam(on?"All":team.name)} style={{background:on?"#eff6ff":"white",border:`1.5px solid ${on?"#bfdbfe":"#e5e7eb"}`,borderRadius:10,padding:"13px 16px",cursor:"pointer",transition:"all .15s"}}>
                    <div style={{fontSize:12,fontWeight:700,color:on?"#1d4ed8":"#374151",marginBottom:7}}>{team.name}</div>
                    <div style={{display:"flex",gap:10,marginBottom:9}}>
                      <span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>{done} done</span>
                      <span style={{fontSize:11,color:"#7c3aed",fontWeight:600}}>{act} active</span>
                      <span style={{fontSize:11,color:"#9ca3af",fontWeight:600}}>{ti.length-done-act} backlog</span>
                    </div>
                    <div style={{height:5,background:"#f1f5f9",borderRadius:3,overflow:"hidden"}}>
                      <div style={{width:`${pct}%`,height:"100%",background:pct===100?"#16a34a":"#1d4ed8",borderRadius:3,transition:"width .4s"}}/>
                    </div>
                    <div style={{fontSize:11,color:"#9ca3af",marginTop:4,fontWeight:500}}>{pct}% · {ti.length} total</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{marginTop:16,padding:"11px 16px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:12,color:"#1e40af",lineHeight:1.7}}>
          <strong>Tips:</strong>&nbsp;
          <strong>⊞ / 📅</strong> toggle Table and Roadmap view ·
          <strong> Checkboxes</strong> → bulk-change status ·
          <strong> ⬇ Export CSV</strong> downloads all initiatives + scores ·
          <strong> ★ Score → Save Snapshot</strong> tracks delivery ratings over time
        </div>
      </div>
    </div>
  );
}
