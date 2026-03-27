"use client";
import { useState, useMemo, useEffect } from "react";

// ── LOOKUP DEFAULTS ───────────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { id:"cat1", name:"Routing & Config",       color:"#1e40af", bg:"#dbeafe", border:"#bfdbfe" },
  { id:"cat2", name:"DB Operations",          color:"#5b21b6", bg:"#ede9fe", border:"#ddd6fe" },
  { id:"cat3", name:"Settlement Operations",  color:"#065f46", bg:"#d1fae5", border:"#a7f3d0" },
  { id:"cat4", name:"Incident & Escalation",  color:"#991b1b", bg:"#fee2e2", border:"#fecaca" },
  { id:"cat5", name:"Terminal Management",    color:"#92400e", bg:"#fef3c7", border:"#fde68a" },
  { id:"cat6", name:"Dispute Operations",     color:"#0369a1", bg:"#e0f2fe", border:"#bae6fd" },
  { id:"cat7", name:"Communication",          color:"#374151", bg:"#f3f4f6", border:"#e5e7eb" },
  { id:"cat8", name:"Port & Network",         color:"#166534", bg:"#dcfce7", border:"#bbf7d0" },
];
const DEFAULT_FREQUENCIES = [
  { id:"f1", name:"Daily",        color:"#991b1b", bg:"#fee2e2", border:"#fecaca" },
  { id:"f2", name:"Per Incident", color:"#92400e", bg:"#fef3c7", border:"#fde68a" },
  { id:"f3", name:"Per Request",  color:"#1e40af", bg:"#dbeafe", border:"#bfdbfe" },
  { id:"f4", name:"Weekly",       color:"#5b21b6", bg:"#ede9fe", border:"#ddd6fe" },
  { id:"f5", name:"Monthly",      color:"#374151", bg:"#f3f4f6", border:"#e5e7eb" },
];
const DEFAULT_STATUSES = [
  { id:"s1", name:"Fully Manual",         color:"#991b1b", bg:"#fee2e2", border:"#fecaca" },
  { id:"s2", name:"Partially Automated",  color:"#92400e", bg:"#fef3c7", border:"#fde68a" },
  { id:"s3", name:"Automated",            color:"#166534", bg:"#dcfce7", border:"#bbf7d0" },
  { id:"s4", name:"Retired",              color:"#475569", bg:"#f1f5f9", border:"#e2e8f0" },
];
const DEFAULT_EFFORTS = [
  { id:"e1", name:"High",   color:"#991b1b", bg:"#fee2e2", border:"#fecaca" },
  { id:"e2", name:"Medium", color:"#92400e", bg:"#fff7ed", border:"#fed7aa" },
  { id:"e3", name:"Low",    color:"#374151", bg:"#f9fafb", border:"#e5e7eb" },
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

const OCCURRENCE_RATE_OPTIONS = ["1×/day","2×/day","3×/day","4×/day","5×/day","On Request"];

// ── SEED MANUAL TASKS ──────────────────────────────────────────────────────────
const SEED_TASKS = [
  {
    id:"MT-001", task:"Routing Config Switching",
    category:"Routing & Config", frequency:"Daily", effort:"High", status:"Partially Automated",
    occurrenceRate:"2×/day", execTimeMins:20, occurrenceNotes:"",
    whyManual:"No automated detection of processor degradation — engineer must notice failure and manually toggle routes.",
    whatHappens:"When a processor degrades, SRE manually identifies the failing route, turns it off or switches it to a backup config. Requires direct system access and judgment under pressure.",
    riskIfMissed:"Continued routing to degraded processor causes transaction failures for customers.",
    linkedAutomations:["CAR-181"],
    notes:"CAR-181 (Automatic Aptent Routing Config Switching) is designed to fully automate this.",
  },
  {
    id:"MT-002", task:"Requeue Pending Business Settlements",
    category:"Settlement Operations", frequency:"Daily", effort:"Medium", status:"Fully Manual",
    occurrenceRate:"2×/day", execTimeMins:25, occurrenceNotes:"",
    whyManual:"No automatic detection or retry of stuck settlements. Engineer must log into Back Office portal and manually trigger requeue.",
    whatHappens:"Business owner transactions get stuck on 'Pending'. SRE logs into the Back Office web portal, identifies stuck records, and clicks Requeue. Transactions that have fixable issues process; others remain and need further investigation.",
    riskIfMissed:"Merchants not credited for transactions. Complaints and financial impact.",
    linkedAutomations:["CAR-199"],
    notes:"CAR-199 (Automatic Business Settlement Requeue) will automate detection and retry logic.",
  },
  {
    id:"MT-003", task:"Manual Escalation to Processors",
    category:"Incident & Escalation", frequency:"Daily", effort:"High", status:"Fully Manual",
    occurrenceRate:"1×/day", execTimeMins:45, occurrenceNotes:"Triggered per active incident; can spike to 3–4×/day during major outages.",
    whyManual:"No automated sample collection or escalation pipeline. SRE manually spools transaction samples and formats them for processor escalation.",
    whatHappens:"When a processor is failing and interchange is turned off, SRE manually queries transaction logs to gather failing samples, compiles an escalation email or ticket, and sends to the processor's support team. This delays resolution and occupies engineer time during active incidents.",
    riskIfMissed:"Delayed resolution of processor issues. Prolonged customer-facing transaction failures.",
    linkedAutomations:["CAR-200"],
    notes:"CAR-200 (Automatic Escalation System) will automate sample collection and Slack-based escalation routing.",
  },
  {
    id:"MT-004", task:"Update / Insert Dispute & Refund Records",
    category:"Dispute Operations", frequency:"Per Request", effort:"Medium", status:"Partially Automated",
    occurrenceRate:"On Request", execTimeMins:30, occurrenceNotes:"Comes in batches from Disputes team — can be several times a week or not at all for 2–3 weeks.",
    whyManual:"No automated workflow for dispute record corrections. SRE cooks up SQL to update status of stopped disputes or insert corrective refund records.",
    whatHappens:"Disputes team requests status updates on stopped disputes (e.g. pending → failed). SRE writes and executes SQL UPDATE queries on dispute tables. Separately, wrong Settlement Report UIDs require detection and SQL-based correction.",
    riskIfMissed:"Incorrect dispute records. Reconciliation failures. Merchant over/under payments.",
    linkedAutomations:["CAR-215","CAR-214"],
    notes:"CAR-215 (Failed/Stuck Refunds) and CAR-214 (Wrong UID Fix) are both Done — these tasks are now covered.",
  },
  {
    id:"MT-005", task:"Upload Terminal IDs for Swapping",
    category:"Terminal Management", frequency:"Per Request", effort:"Medium", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:40, occurrenceNotes:"Happens before scheduled hardware swap events — may not occur for months then arrive as large batches.",
    whyManual:"No self-service terminal upload tool. SRE manually writes INSERT SQL queries to add terminal records before hardware swap events.",
    whatHappens:"SRE receives a list of terminal IDs to be swapped. They cook up an INSERT query for the terminals table, inserting each record manually. An automated downstream process then picks them up. The insert step itself depends on DB access and manual query writing.",
    riskIfMissed:"Terminals not registered in time for swap. Hardware swap event fails or is delayed.",
    linkedAutomations:["CAR-221"],
    notes:"CAR-221 (Upload Terminals for Swapping) will provide a CSV-driven playbook replacing manual SQL.",
  },
  {
    id:"MT-006", task:"Clear / Update ISW PTSA TID Mapping",
    category:"DB Operations", frequency:"Per Request", effort:"Medium", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:20, occurrenceNotes:"",
    whyManual:"No tooling for TID mapping management. SRE manually writes UPDATE SQL to set source_terminal_id = NULL so fresh TIDs become available for Interswitch transaction mapping.",
    whatHappens:"For every transaction to Interswitch, the system needs to translate the logical terminal ID (on physical device) to a mapped TID stored on the isw_ptsa_tid table. When new terminals start transacting to Interswitch for the first time, TIDs must be made available. SRE sets source_terminal_id = NULL on the relevant records.",
    riskIfMissed:"New terminals cannot transact to Interswitch. TID translation fails causing transaction rejections.",
    linkedAutomations:["CAR-222"],
    notes:"CAR-222 (Update ISW PTSA TID Mapping) replaces this with a validated playbook.",
  },
  {
    id:"MT-007", task:"Reset Terminals for NIBSS Key Download",
    category:"Terminal Management", frequency:"Per Request", effort:"Medium", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:15, occurrenceNotes:"",
    whyManual:"No playbook or tooling. SRE writes SQL to reset terminal key download state by setting card_acceptor_id_state = NULL on the destination interchange status table.",
    whatHappens:"Terminals get stuck waiting for NIBSS key download. SRE identifies the affected terminal IDs, writes UPDATE SQL targeting destination_interchange_status table, sets card_acceptor_id_state = NULL for the specific terminal. This resets the state so the key download can be re-attempted.",
    riskIfMissed:"Terminals remain stuck. POS endpoint transaction failures until manually resolved.",
    linkedAutomations:["CAR-223"],
    notes:"CAR-223 (Reset Terminals for NIBSS Key Download) automates this with a one-click playbook.",
  },
  {
    id:"MT-008", task:"Insert into Destination Interchange Keys Table",
    category:"DB Operations", frequency:"Per Request", effort:"Medium", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:15, occurrenceNotes:"",
    whyManual:"No tooling for interchange key record creation. SRE manually writes INSERT SQL with terminal_id and destination_interchange_id values.",
    whatHappens:"When adding new terminals to an interchange, SRE needs to insert records into the destination interchange keys table. This is a simple two-value INSERT (terminal_id, destination_interchange_id) but requires direct DB access, writing the query manually, and coordinating with the DBA team for access.",
    riskIfMissed:"New terminals cannot be mapped to destination interchange. Transactions fail to route.",
    linkedAutomations:["CAR-223"],
    notes:"Covered under the NIBSS terminal reset playbook scope or can be a separate sub-playbook.",
  },
  {
    id:"MT-009", task:"Update Interchange Specific Data",
    category:"DB Operations", frequency:"Per Request", effort:"High", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:60, occurrenceNotes:"Rare but high-stakes — incorrect config breaks all transactions for that interchange.",
    whyManual:"Interchange-specific data is stored as JSON in the interchange_config table. Values are scattered and easily misconfigured. SRE must manually cook up an UPDATE query for the correct interchange ID.",
    whatHappens:"When onboarding or reconfiguring an interchange, SRE executes: UPDATE interchange_config SET interchange_specific_data = '{...json...}' WHERE id = <interchange_id>. The JSON structure is complex, varies per interchange, and has no validation. A single mistake can break all transactions for that interchange.",
    riskIfMissed:"Wrong interchange config causes widespread transaction failures for affected processor.",
    linkedAutomations:["CAR-224"],
    notes:"CAR-224 (Update interchange_specific_data) adds a guided playbook with JSON validation and dry-run mode.",
  },
  {
    id:"MT-010", task:"Create New Banks on Aptent DB",
    category:"DB Operations", frequency:"Per Request", effort:"Medium", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:45, occurrenceNotes:"",
    whyManual:"No self-service bank onboarding tool. SRE manually writes INSERT queries for all required bank configuration records across multiple tables.",
    whatHappens:"When onboarding a new bank, SRE writes INSERT SQL across the Aptent DB bank tables, creating all required records in the correct dependency order. Missing a step or inserting with wrong values causes configuration gaps that block transactions for that bank.",
    riskIfMissed:"Incomplete bank configuration causes transaction failures for that bank's cards/channels.",
    linkedAutomations:["CAR-225"],
    notes:"CAR-225 (Create Banks - Aptent DB) provides a templated playbook with sequential validation.",
  },
  {
    id:"MT-011", task:"Create Card BIN Records on Aptent DB",
    category:"DB Operations", frequency:"Per Request", effort:"Medium", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:30, occurrenceNotes:"",
    whyManual:"No BIN management tool. SRE manually writes INSERT SQL for new BIN ranges. Format errors or duplicate inserts cause transaction routing failures.",
    whatHappens:"When a new card BIN range needs to be registered, SRE writes INSERT SQL targeting the card_bin table on Aptent DB. The insert requires specific formatting and must pass validation. Errors here cause all cards in that BIN range to fail at the routing step.",
    riskIfMissed:"Cards in the new BIN range fail to transact until the correct record is inserted.",
    linkedAutomations:["CAR-226"],
    notes:"CAR-226 (Create card_bin - Aptent DB) adds schema validation and rollback capability.",
  },
  {
    id:"MT-012", task:"Reset Settlement Status",
    category:"Settlement Operations", frequency:"Per Request", effort:"High", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:35, occurrenceNotes:"Happens intermittently — can go weeks without occurring, or hit multiple times in one day during settlement issues.",
    whyManual:"No tooling for settlement status correction. SRE writes and runs SQL UPDATE under time pressure, risking broader data corruption if wrong records are updated.",
    whatHappens:"A settlement batch shows processor status = 'Completed' but the downstream business or DNS settlement was never actually created. SRE manually writes UPDATE SQL to reset the stuck status so the system re-attempts settlement creation. Requires identifying the exact affected records and correct status values.",
    riskIfMissed:"Merchants not paid. Settlement batch remains stuck indefinitely.",
    linkedAutomations:["CAR-227"],
    notes:"CAR-227 (Reset Settlement Status) provides a safe playbook with pre-flight checks and post-reset verification.",
  },
  {
    id:"MT-013", task:"Move Terminals Between PTSP Key Configs",
    category:"Terminal Management", frequency:"Per Request", effort:"Medium", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:25, occurrenceNotes:"",
    whyManual:"No migration tooling. SRE manually writes UPDATE SQL to change PTSP key config IDs for a batch of terminals.",
    whatHappens:"When terminal routing or key configuration changes, SRE writes UPDATE SQL to change the ptsp_key_config_id column for the affected terminal records. Errors cause terminals to use the wrong encryption keys, breaking transactions.",
    riskIfMissed:"Terminals transact with wrong key config causing encryption failures and declined transactions.",
    linkedAutomations:["CAR-229"],
    notes:"CAR-229 (Move Terminals - ptsp_key_config) will provide a validated migration playbook.",
  },
  {
    id:"MT-014", task:"CS Downtime Communication",
    category:"Communication", frequency:"Per Incident", effort:"Medium", status:"Partially Automated",
    occurrenceRate:"1×/day", execTimeMins:20, occurrenceNotes:"Per incident — during major outages this can happen multiple times across the day.",
    whyManual:"Communication to CS when there is a processor downtime or trading bank issue is still largely manual — composing messages, identifying affected parties, and notifying the right channels.",
    whatHappens:"When a processor goes down or a trading bank is fully offline, SRE needs to notify Customer Support teams so they can communicate to merchants and manage inbound complaints. This involves identifying the scope, drafting a notification, and sending to the right Slack channels or email lists.",
    riskIfMissed:"CS not aware of outage. Merchants and customers get inconsistent or delayed responses.",
    linkedAutomations:["CAR-232"],
    notes:"CAR-232 (Slack Communication Bot) will automate structured downtime notifications to CS and stakeholders.",
  },
  {
    id:"MT-015", task:"Port Management (Add / Delete / Resync)",
    category:"Port & Network", frequency:"Per Request", effort:"Medium", status:"Fully Manual",
    occurrenceRate:"On Request", execTimeMins:30, occurrenceNotes:"Irregular — may not happen for months, then arrive as a batch of port changes for a new processor onboarding.",
    whyManual:"Port additions, deletions, and resyncs require manual Nginx / proxy server configuration changes. No change management tool exists — errors can misconfigure ports silently.",
    whatHappens:"When a processor requests a new port or an existing port needs to be deleted or resynced, SRE manually edits the Nginx / proxy configuration files, applies the change, and verifies the port is active. Mistakes can delete wrong ports or introduce silent misconfigurations.",
    riskIfMissed:"Wrong port config causes routing failures for affected processor. Misconfigured ports may not be caught until transactions fail.",
    linkedAutomations:["CAR-203"],
    notes:"CAR-203 (Automatic Port Addition, Deletion & Resync) will provide atomic, validated port management.",
  },
];

// ── AUTO-STATUS SYNC FROM AUTOMATION INITIATIVES ─────────────────────────────
const STATUS_ORDER = { "Fully Manual":0, "Partially Automated":1, "Automated":2, "Retired":3 };
function deriveTaskStatus(task, initMap) {
  const linked = task.linkedAutomations || [];
  if (!linked.length) return task.status;
  const matches = linked.map(id => initMap[id]).filter(Boolean);
  if (!matches.length) return task.status;
  const doneCount   = matches.filter(i => i.status === "Done").length;
  const activeCount = matches.filter(i =>
    i.status === "In Progress" || i.status === "On Demo (Dev)" || i.status === "Finalizing for Dev"
  ).length;
  if (task.status === "Retired") return task.status;
  let proposed = task.status;
  if (doneCount === matches.length)      proposed = "Automated";
  else if (doneCount > 0 || activeCount > 0) proposed = "Partially Automated";
  const cur = STATUS_ORDER[task.status] ?? 0;
  const prp = STATUS_ORDER[proposed] ?? 0;
  return prp > cur ? proposed : task.status;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const uid      = () => Math.random().toString(36).slice(2,8);
const newMTId  = () => "MT-" + String(Math.floor(Math.random()*900)+100);
const today    = () => new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
const isoToday = () => new Date().toISOString().slice(0,10);

// Calculate estimated weekly hours for a task
function calcWeeklyHours(task) {
  const rate = task.occurrenceRate;
  const time = Number(task.execTimeMins);
  if (!rate || !time || isNaN(time) || time <= 0) return null;
  if (rate === "On Request") return "Variable";
  const rateNum = parseInt(rate); // extracts 1,2,3,4,5 from "N×/day"
  const freq = task.frequency;
  if (freq === "Daily")        return +(rateNum * time * 5 / 60).toFixed(2);
  if (freq === "Weekly")       return +(rateNum * time / 60).toFixed(2);
  if (freq === "Monthly")      return +(rateNum * time / 60 / 4.33).toFixed(2);
  // Per Incident / Per Request — show per-occurrence cost
  return `~${+(rateNum * time / 60).toFixed(1)} hr/occ`;
}

function fmtHrs(val) {
  if (val === null || val === undefined) return "—";
  if (val === "Variable") return <span style={{fontSize:10,color:"#92400e",fontWeight:600}}>Variable</span>;
  if (typeof val === "string") return <span style={{fontSize:10,color:"#6b7280"}}>{val}</span>;
  return <span style={{fontWeight:700,color:"#1d4ed8"}}>{val} <span style={{fontSize:10,fontWeight:400,color:"#6b7280"}}>hrs</span></span>;
}

function exportCSV(items) {
  const esc = v => `"${String(v||"").replace(/"/g,'""')}"`;
  const hdr = ["ID","Task","Category","Frequency","Effort","Status","Occurrence Rate","Exec Time (min)","Weekly Hrs Est.","Why Manual","What Happens","Risk If Missed","Linked Automations","Notes"];
  const rows = items.map(i => {
    const wh = calcWeeklyHours(i);
    const whStr = wh === null ? "" : wh === "Variable" ? "Variable" : String(wh);
    return [i.id, i.task, i.category, i.frequency, i.effort, i.status,
      i.occurrenceRate||"", i.execTimeMins||"", whStr,
      i.whyManual, i.whatHappens, i.riskIfMissed,
      (i.linkedAutomations||[]).join("; "), i.notes
    ].map(esc).join(",");
  });
  const csv  = [hdr.map(esc).join(","), ...rows].join("\n");
  const blob = new Blob([csv], {type:"text/csv"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=`manual-tasks-${isoToday()}.csv`; a.click(); URL.revokeObjectURL(url);
}

// ── ATOMS ─────────────────────────────────────────────────────────────────────
function Badge({ text, color, bg, border, small }) {
  return <span style={{display:"inline-flex",alignItems:"center",padding:small?"2px 8px":"3px 10px",borderRadius:20,fontSize:small?10:11,fontWeight:600,background:bg||"#f3f4f6",color:color||"#374151",border:`1px solid ${border||"#e5e7eb"}`,whiteSpace:"nowrap",lineHeight:1.5}}>{text}</span>;
}
function Stat({ label, value, color, note, sub }) {
  return (
    <div style={{background:"white",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"13px 17px",flex:1,minWidth:100,borderTop:`3px solid ${color}`}}>
      <div style={{fontSize:25,fontWeight:800,color,lineHeight:1}}>{value}</div>
      <div style={{fontSize:11,color:"#6b7280",marginTop:4,fontWeight:500}}>{label}</div>
      {note&&<div style={{fontSize:10,color,marginTop:2,fontWeight:600}}>{note}</div>}
      {sub&&<div style={{fontSize:10,color:"#9ca3af",marginTop:2}}>{sub}</div>}
    </div>
  );
}

// ── FIELD (extracted outside EditModal to prevent remounting on keystroke) ────
function Field({ label, k, type="input", opts, placeholder, f, onChange }) {
  const baseInput = {
    border:"1.5px solid #e5e7eb", borderRadius:8, padding:"9px 12px",
    fontSize:13, fontFamily:"'DM Sans',sans-serif", color:"#111827", outline:"none",
  };
  const handleFocus = e => { e.target.style.borderColor = "#3b82f6"; };
  const handleBlur  = e => { e.target.style.borderColor = "#e5e7eb"; };
  return (
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      <label style={{fontSize:11,fontWeight:700,color:"#374151"}}>{label}</label>
      {type==="textarea"
        ? <textarea value={f[k]||""} onChange={e=>onChange(k,e.target.value)} rows={3} placeholder={placeholder||""}
            style={{...baseInput,resize:"vertical",lineHeight:1.55}}
            onFocus={handleFocus} onBlur={handleBlur}/>
        : type==="select"
        ? <select value={f[k]||""} onChange={e=>onChange(k,e.target.value)}
            style={{...baseInput,background:"white",cursor:"pointer"}}>
            {opts.map(o=><option key={o}>{o}</option>)}
          </select>
        : type==="number"
        ? <input type="number" min={0} value={f[k]||""} onChange={e=>onChange(k,e.target.value===""?"":Number(e.target.value))}
            placeholder={placeholder||""} style={baseInput}
            onFocus={handleFocus} onBlur={handleBlur}/>
        : <input value={f[k]||""} onChange={e=>onChange(k,e.target.value)} placeholder={placeholder||""}
            style={baseInput} onFocus={handleFocus} onBlur={handleBlur}/>
      }
    </div>
  );
}

// ── MANAGE MODAL ──────────────────────────────────────────────────────────────
function ManageModal({ onClose, lookups, setLookups }) {
  const [section,setSection]=useState("categories");
  const [editId,setEditId]=useState(null);
  const [draft,setDraft]=useState(null);
  const [newName,setNewName]=useState("");
  const [newCI,setNewCI]=useState(0);
  const sections=[{key:"categories",label:"Categories",icon:"🏷️",hc:true},{key:"frequencies",label:"Frequency",icon:"🔁",hc:true},{key:"statuses",label:"Status",icon:"📊",hc:true},{key:"efforts",label:"Effort",icon:"⚡",hc:true}];
  const items=lookups[section]||[];
  const hc=sections.find(s=>s.key===section)?.hc;
  const startEdit=i=>{setEditId(i.id);setDraft({...i});};
  const cancelEdit=()=>{setEditId(null);setDraft(null);};
  const saveEdit=()=>{if(!draft.name.trim())return;setLookups(l=>({...l,[section]:l[section].map(i=>i.id===draft.id?draft:i)}));cancelEdit();};
  const removeItem=id=>{if(!window.confirm("Remove? Items using it keep the value."))return;setLookups(l=>({...l,[section]:l[section].filter(i=>i.id!==id)}));};
  const addItem=()=>{const n=newName.trim();if(!n)return;const p=COLOR_PRESETS[newCI];const ni=hc?{id:uid(),name:n,...p}:{id:uid(),name:n};setLookups(l=>({...l,[section]:[...l[section],ni]}));setNewName("");setNewCI(0);};
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(3px)"}}>
      <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:640,maxHeight:"90vh",overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.18)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"18px 24px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div style={{fontSize:17,fontWeight:700,color:"#111827"}}>🏷️ Manage Options</div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:18,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid #e5e7eb",background:"#fafafa",flexShrink:0}}>
          {sections.map(s=><button key={s.key} onClick={()=>{setSection(s.key);cancelEdit();}} style={{flex:1,padding:"10px 6px",fontSize:11,fontWeight:600,border:"none",borderBottom:`2px solid ${section===s.key?"#1d4ed8":"transparent"}`,background:"none",cursor:"pointer",color:section===s.key?"#1d4ed8":"#9ca3af",marginBottom:-1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span>{s.icon}</span>{s.label}</button>)}
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"14px 20px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:14}}>
            {items.map(item=>(
              <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"white",border:"1.5px solid #e5e7eb",borderRadius:8}}>
                {editId===item.id
                  ?<><input value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))} autoFocus style={{flex:1,border:"1.5px solid #3b82f6",borderRadius:7,padding:"5px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none"}}/>
                    {hc&&<div style={{display:"flex",gap:4,flexWrap:"wrap",maxWidth:160}}>{COLOR_PRESETS.map((p,i)=><span key={i} onClick={()=>setDraft(d=>({...d,...p}))} style={{width:18,height:18,borderRadius:"50%",background:p.bg,border:`2px solid ${draft.color===p.color?"#1d4ed8":p.border}`,cursor:"pointer"}}/>)}</div>}
                    <button onClick={saveEdit} style={{background:"#1d4ed8",border:"none",borderRadius:6,color:"white",fontSize:11,fontWeight:700,padding:"5px 12px",cursor:"pointer"}}>Save</button>
                    <button onClick={cancelEdit} style={{background:"#f1f5f9",border:"none",borderRadius:6,color:"#6b7280",fontSize:11,fontWeight:600,padding:"5px 10px",cursor:"pointer"}}>Cancel</button></>
                  :<>{hc?<Badge text={item.name} color={item.color} bg={item.bg} border={item.border} small/>:<span style={{flex:1,fontSize:13,fontWeight:500,color:"#111827"}}>{item.name}</span>}
                    {hc&&<span style={{flex:1}}/>}
                    <button onClick={()=>startEdit(item)} style={{background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,color:"#1d4ed8",fontSize:11,fontWeight:700,padding:"3px 9px",cursor:"pointer"}}>Edit</button>
                    <button onClick={()=>removeItem(item.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,color:"#dc2626",fontSize:11,fontWeight:700,padding:"3px 8px",cursor:"pointer"}}>×</button></>}
              </div>
            ))}
          </div>
          <div style={{background:"#f8fafc",border:"1.5px dashed #d1d5db",borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#6b7280",marginBottom:8}}>ADD NEW</div>
            <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
              <input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Name…" style={{flex:1,minWidth:140,border:"1.5px solid #e5e7eb",borderRadius:8,padding:"7px 11px",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",background:"white"}} onFocus={e=>e.target.style.borderColor="#3b82f6"} onBlur={e=>e.target.style.borderColor="#e5e7eb"}/>
              {hc&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{COLOR_PRESETS.map((p,i)=><span key={i} onClick={()=>setNewCI(i)} style={{width:20,height:20,borderRadius:"50%",background:p.bg,border:`2px solid ${newCI===i?"#1d4ed8":p.border}`,cursor:"pointer"}}/>)}</div>}
              <button onClick={addItem} style={{background:"#1d4ed8",color:"white",border:"none",borderRadius:8,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>+ Add</button>
            </div>
            {hc&&newName&&<div style={{marginTop:8,display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#6b7280"}}>Preview: <Badge text={newName} color={COLOR_PRESETS[newCI].color} bg={COLOR_PRESETS[newCI].bg} border={COLOR_PRESETS[newCI].border} small/></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────────
function EditModal({ item, onSave, onClose, lookups, jiraBase }) {
  const blank = {
    id:newMTId(), task:"", category:lookups.categories[0]?.name||"", frequency:lookups.frequencies[0]?.name||"",
    effort:lookups.efforts[0]?.name||"", status:"Fully Manual",
    occurrenceRate:"", execTimeMins:"", occurrenceNotes:"",
    whyManual:"", whatHappens:"", riskIfMissed:"", linkedAutomations:[], notes:"",
  };
  const [f, setF] = useState(item ? {...item, linkedAutomations:[...(item.linkedAutomations||[])]} : blank);
  const [carInput, setCarInput] = useState("");
  const set = (k, v) => setF(p => ({...p, [k]:v}));
  const addCAR = () => { const c=carInput.trim().toUpperCase(); if(!c||f.linkedAutomations.includes(c))return; set("linkedAutomations",[...f.linkedAutomations,c]); setCarInput(""); };
  const removeCAR = c => set("linkedAutomations", f.linkedAutomations.filter(x=>x!==c));
  const isNew = !item;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(3px)"}}>
      <div style={{background:"white",borderRadius:16,width:"100%",maxWidth:700,maxHeight:"95vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.18)"}}>
        <div style={{padding:"18px 24px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"white",zIndex:10}}>
          <div><div style={{fontSize:10,color:"#9ca3af",letterSpacing:"0.8px",textTransform:"uppercase",fontWeight:700,marginBottom:3}}>{isNew?"New":"Edit"} Manual Task</div><div style={{fontSize:16,fontWeight:700,color:"#111827"}}>{f.task||"Untitled"}</div></div>
          <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:8,width:34,height:34,cursor:"pointer",fontSize:18,color:"#6b7280",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        <div style={{padding:"18px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Task ID" k="id" f={f} onChange={set}/>
            <Field label="Task Name" k="task" f={f} onChange={set}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            <Field label="Category" k="category" type="select" opts={lookups.categories.map(c=>c.name)} f={f} onChange={set}/>
            <Field label="Frequency" k="frequency" type="select" opts={lookups.frequencies.map(f=>f.name)} f={f} onChange={set}/>
            <Field label="Effort / Risk" k="effort" type="select" opts={lookups.efforts.map(e=>e.name)} f={f} onChange={set}/>
          </div>
          <Field label="Automation Status" k="status" type="select" opts={lookups.statuses.map(s=>s.name)} f={f} onChange={set}/>

          {/* Occurrence Rate & Exec Time */}
          <div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#0369a1"}}>⏱ EFFORT METRICS</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Occurrence Rate (per frequency period)" k="occurrenceRate" type="select"
                opts={["", ...OCCURRENCE_RATE_OPTIONS]} f={f} onChange={set}/>
              <Field label="Time to Execute Manually (minutes)" k="execTimeMins" type="number"
                placeholder="e.g. 30" f={f} onChange={set}/>
            </div>
            <Field label="Occurrence Notes (optional — describe variability or context)" k="occurrenceNotes"
              type="textarea" placeholder="e.g. Can happen 3–4× during major incidents, otherwise once a day. Unpredictable during settlement windows." f={f} onChange={set}/>
            {/* Live preview of weekly hours */}
            {f.occurrenceRate && f.execTimeMins ? (
              <div style={{background:"white",border:"1px solid #bae6fd",borderRadius:8,padding:"8px 12px",fontSize:12,color:"#0369a1"}}>
                <strong>Estimated weekly hours: </strong>
                {(()=>{ const wh=calcWeeklyHours(f); if(wh===null)return "—"; if(wh==="Variable")return "Variable (On Request)"; if(typeof wh==="string")return wh; return `${wh} hrs/week`; })()}
              </div>
            ) : null}
          </div>

          <div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#991b1b"}}>📋 TASK DETAILS</div>
            <Field label="Why is this manual today?" k="whyManual" type="textarea" placeholder="What's missing that forces someone to do this by hand?" f={f} onChange={set}/>
            <Field label="What exactly happens? (step by step)" k="whatHappens" type="textarea" placeholder="Describe the manual steps, systems touched, and who does it." f={f} onChange={set}/>
            <Field label="Risk if missed or done incorrectly?" k="riskIfMissed" type="textarea" placeholder="What breaks if this isn't done, or is done wrong?" f={f} onChange={set}/>
          </div>

          {/* Linked automations */}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <label style={{fontSize:11,fontWeight:700,color:"#374151"}}>🔗 Linked Automation Initiatives (CAR numbers)</label>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",minHeight:32,padding:"6px 10px",background:"#f8fafc",border:"1.5px solid #e5e7eb",borderRadius:8,alignItems:"center"}}>
              {f.linkedAutomations.length===0&&<span style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>No linked initiatives yet</span>}
              {f.linkedAutomations.map(c=>(
                <span key={c} style={{display:"inline-flex",alignItems:"center",gap:5,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:12,padding:"3px 10px",fontSize:12,fontWeight:700,color:"#1d4ed8"}}>
                  <a href={`${jiraBase}/${c}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:"#1d4ed8",textDecoration:"none"}}>{c} ↗</a>
                  <span onClick={()=>removeCAR(c)} style={{cursor:"pointer",color:"#93c5fd",fontSize:14,lineHeight:1}}>×</span>
                </span>
              ))}
            </div>
            <div style={{display:"flex",gap:7}}>
              <input value={carInput} onChange={e=>setCarInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCAR()} placeholder="Type CAR-XXX and press Enter or Add…"
                style={{flex:1,border:"1.5px dashed #bfdbfe",borderRadius:8,padding:"8px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",outline:"none",background:"white"}} onFocus={e=>e.target.style.borderColor="#3b82f6"} onBlur={e=>e.target.style.borderColor="#bfdbfe"}/>
              <button onClick={addCAR} style={{background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,color:"#1d4ed8",cursor:"pointer",whiteSpace:"nowrap"}}>+ Link</button>
            </div>
          </div>

          <Field label="Notes" k="notes" type="textarea" placeholder="Any additional context, workarounds, or future plans…" f={f} onChange={set}/>

          <div style={{display:"flex",gap:10,justifyContent:"flex-end",paddingTop:2}}>
            <button onClick={onClose} style={{padding:"9px 20px",borderRadius:8,border:"1.5px solid #e5e7eb",background:"white",color:"#6b7280",fontSize:13,fontWeight:600,cursor:"pointer"}}>Cancel</button>
            <button onClick={()=>{if(!f.task.trim()){alert("Task name required");return;}onSave(f);}} style={{padding:"9px 22px",borderRadius:8,border:"none",background:"#dc2626",color:"white",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px #dc262630"}}>{isNew?"Add Task":"Save Changes"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EXPANDED DETAIL ───────────────────────────────────────────────────────────
function ExpandedDetail({ item, jiraBase, lookups }) {
  const wh = calcWeeklyHours(item);
  return (
    <div style={{borderTop:"1px solid #e5e7eb",background:"#f8fafc",padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
      {/* Effort metrics summary */}
      {(item.occurrenceRate || item.execTimeMins) && (
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {item.occurrenceRate&&<span style={{fontSize:11,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:7,padding:"3px 10px",color:"#1d4ed8",fontWeight:600}}>⏱ Rate: {item.occurrenceRate}</span>}
          {item.execTimeMins&&<span style={{fontSize:11,background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:7,padding:"3px 10px",color:"#1d4ed8",fontWeight:600}}>🕐 Exec: {item.execTimeMins} min/occ</span>}
          {wh!==null&&<span style={{fontSize:11,background:wh==="Variable"?"#fffbeb":"#f0fdf4",border:`1px solid ${wh==="Variable"?"#fde68a":"#bbf7d0"}`,borderRadius:7,padding:"3px 10px",color:wh==="Variable"?"#92400e":"#16a34a",fontWeight:600}}>
            📅 ~{wh==="Variable"?"Variable":typeof wh==="string"?wh:`${wh} hrs`}/week
          </span>}
          {item.occurrenceNotes&&<span style={{fontSize:11,color:"#6b7280",fontStyle:"italic",padding:"3px 0"}}>ℹ {item.occurrenceNotes}</span>}
        </div>
      )}

      {/* Three columns */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14}}>
        {[["🔧 Why Manual",item.whyManual,"#f59e0b"],["📋 What Happens",item.whatHappens,"#3b82f6"],["⚠️ Risk If Missed",item.riskIfMissed,"#ef4444"]].map(([lbl,val,clr])=>(
          <div key={lbl} style={{borderLeft:`3px solid ${clr}`,paddingLeft:12}}>
            <div style={{fontSize:11,fontWeight:700,color:"#374151",marginBottom:6}}>{lbl}</div>
            <div style={{fontSize:12,color:val?"#4b5563":"#9ca3af",lineHeight:1.65,fontStyle:val?"normal":"italic"}}>{val||"Not documented — click Edit to add"}</div>
          </div>
        ))}
      </div>

      {/* Linked automations */}
      {(item.linkedAutomations||[]).length>0&&(
        <div style={{background:"white",border:"1.5px solid #bfdbfe",borderRadius:10,padding:"12px 16px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#1d4ed8",marginBottom:10}}>🔗 AUTOMATION INITIATIVES THAT SOLVE THIS</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {item.linkedAutomations.map(c=>(
              <a key={c} href={`${jiraBase}/${c}`} target="_blank" rel="noopener noreferrer"
                style={{display:"inline-flex",alignItems:"center",gap:5,background:"#eff6ff",border:"1.5px solid #bfdbfe",borderRadius:10,padding:"6px 14px",fontSize:12,fontWeight:700,color:"#1d4ed8",textDecoration:"none"}}>
                {c} ↗
              </a>
            ))}
          </div>
        </div>
      )}
      {(item.linkedAutomations||[]).length===0&&(
        <div style={{background:"#fef9c3",border:"1.5px solid #fde68a",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#92400e"}}>
          ⚠️ No automation initiative linked yet — this task is not covered by any planned automation.
        </div>
      )}

      {item.notes&&<div style={{fontSize:12,color:"#6b7280",fontStyle:"italic",borderTop:"1px solid #e5e7eb",paddingTop:10}}>📝 {item.notes}</div>}
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
export default function ManualTasksTracker() {
  const [lookups,   setLookups]   = useState({categories:DEFAULT_CATEGORIES,frequencies:DEFAULT_FREQUENCIES,statuses:DEFAULT_STATUSES,efforts:DEFAULT_EFFORTS});
  const [items,     setItems]     = useState([]);
  const [loaded,    setLoaded]    = useState(false);
  const [expanded,  setExpanded]  = useState(null);
  const [editing,   setEditing]   = useState(null);
  const [manageOpen,setManageOpen]= useState(false);
  const [editMode,  setEditMode]  = useState(false);
  const [pinModal,  setPinModal]  = useState(false);
  const [pinInput,  setPinInput]  = useState("");
  const [pinError,  setPinError]  = useState("");
  const [jiraBase,  setJiraBase]  = useState("https://your-org.atlassian.net/browse");
  const [saveMsg,   setSaveMsg]   = useState("");
  const [selected,  setSelected]  = useState(new Set());
  const [bulkStatus,setBulkStatus]= useState("");
  const [filterCat,     setFilterCat]     = useState("All");
  const [filterFreq,    setFilterFreq]    = useState("All");
  const [filterStatus,  setFilterStatus]  = useState("All");
  const [filterEffort,  setFilterEffort]  = useState("All");
  const [filterLinked,  setFilterLinked]  = useState("All");
  const [search,    setSearch]    = useState("");
  const [sortBy,    setSortBy]    = useState("id");

  useEffect(()=>{
    (async()=>{
      try {
        const [lk, it, jb, initiatives] = await Promise.all([
          apiGet("mt-lookups"),
          apiGet("mt-items-v1"),
          apiGet("auto-jira"),
          apiGet("auto-v5"),
        ]);
        if(lk) setLookups(lk);
        let tasks = it || SEED_TASKS;
        if (Array.isArray(initiatives) && initiatives.length) {
          const initMap = Object.fromEntries(initiatives.map(i=>[i.id, i]));
          const synced  = tasks.map(t => ({ ...t, status: deriveTaskStatus(t, initMap) }));
          const changed = synced.some((u, i) => u.status !== tasks[i]?.status);
          tasks = synced;
          if (changed && it) { try { await apiSet("mt-items-v1", tasks); } catch {} }
        }
        setItems(tasks);
        if(jb) setJiraBase(jb);
      } catch { setItems(SEED_TASKS); }
      setLoaded(true);
    })();
  },[]);

  useEffect(()=>{ if(typeof window!=="undefined"&&sessionStorage.getItem("editMode")==="1") setEditMode(true); },[]);
  const unlockEdit = async () => {
    const res = await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:pinInput})});
    if(res.ok){const d=await res.json();if(d.ok){sessionStorage.setItem("editMode","1");setEditMode(true);setPinModal(false);setPinInput("");setPinError("");return;}}
    setPinError("Incorrect PIN. Try again.");
  };
  const lockEdit = () => { sessionStorage.removeItem("editMode"); setEditMode(false); };

  const persistItems   = async next=>{ setItems(next); try{ await apiSet("mt-items-v1",next); setSaveMsg("Saved ✓"); setTimeout(()=>setSaveMsg(""),2000); }catch{ setSaveMsg("⚠ Save failed"); }};
  const persistLookups = async next=>{ setLookups(next); try{ await apiSet("mt-lookups",next); }catch{}};
  const saveItem   = form=>{ persistItems(items.findIndex(i=>i.id===form.id)>=0?items.map(i=>i.id===form.id?form:i):[...items,form]); setEditing(null); };
  const deleteItem = id=>{ if(window.confirm("Delete this task?")) persistItems(items.filter(i=>i.id!==id)); setSelected(s=>{const ns=new Set(s);ns.delete(id);return ns;}); };
  const applyBulk  = ()=>{ if(!bulkStatus)return; persistItems(items.map(i=>selected.has(i.id)?{...i,status:bulkStatus}:i)); setSelected(new Set()); setBulkStatus(""); };

  const getCat    = name=>lookups.categories.find(c=>c.name===name)||{color:"#374151",bg:"#f3f4f6",border:"#e5e7eb"};
  const getFreq   = name=>lookups.frequencies.find(f=>f.name===name)||{color:"#374151",bg:"#f9fafb",border:"#e5e7eb"};
  const getStatus = name=>lookups.statuses.find(s=>s.name===name)||{color:"#374151",bg:"#f9fafb",border:"#e5e7eb"};
  const getEffort = name=>lookups.efforts.find(e=>e.name===name)||{color:"#374151",bg:"#f9fafb",border:"#e5e7eb"};

  const filtered = useMemo(()=>{
    let r=[...items];
    if(filterCat!=="All")    r=r.filter(i=>i.category===filterCat);
    if(filterFreq!=="All")   r=r.filter(i=>i.frequency===filterFreq);
    if(filterStatus!=="All") r=r.filter(i=>i.status===filterStatus);
    if(filterEffort!=="All") r=r.filter(i=>i.effort===filterEffort);
    if(filterLinked==="linked")   r=r.filter(i=>(i.linkedAutomations||[]).length>0);
    if(filterLinked==="unlinked") r=r.filter(i=>(i.linkedAutomations||[]).length===0);
    if(search){const q=search.toLowerCase();r=r.filter(i=>i.task.toLowerCase().includes(q)||(i.category||"").toLowerCase().includes(q)||(i.whyManual||"").toLowerCase().includes(q)||(i.whatHappens||"").toLowerCase().includes(q)||(i.linkedAutomations||[]).join(" ").toLowerCase().includes(q));}
    r.sort((a,b)=>sortBy==="id"?a.id.localeCompare(b.id):sortBy==="category"?a.category.localeCompare(b.category):sortBy==="status"?a.status.localeCompare(b.status):sortBy==="effort"?a.effort.localeCompare(b.effort):sortBy==="freq"?a.frequency.localeCompare(b.frequency):a.task.localeCompare(b.task));
    return r;
  },[items,filterCat,filterFreq,filterStatus,filterEffort,filterLinked,search,sortBy]);

  // ── STATS ────────────────────────────────────────────────────────────────
  const stats = useMemo(()=>{
    const total     = items.length;
    const manual    = items.filter(i=>i.status==="Fully Manual").length;
    const partial   = items.filter(i=>i.status==="Partially Automated").length;
    const automated = items.filter(i=>i.status==="Automated").length;
    const unlinked  = items.filter(i=>(i.linkedAutomations||[]).length===0).length;
    const highEffort= items.filter(i=>i.effort==="High").length;
    const pctManual = total ? Math.round((manual+partial)/total*100) : 0;

    // Calculate total weekly hours (only numeric values)
    let totalWklyHrs = 0;
    let wklyHrsCount = 0;
    items.forEach(i=>{
      const wh = calcWeeklyHours(i);
      if(typeof wh === "number") { totalWklyHrs += wh; wklyHrsCount++; }
    });

    // Automation "mode"
    let mode, modeColor;
    if (total === 0)                    { mode="No Tasks";          modeColor="#9ca3af"; }
    else if (automated/total >= 0.7)    { mode="Mostly Automated";  modeColor="#16a34a"; }
    else if ((automated+partial)/total >= 0.5) { mode="Partially Automated"; modeColor="#f59e0b"; }
    else if (manual/total >= 0.7)       { mode="Mostly Manual";     modeColor="#dc2626"; }
    else                                { mode="Mixed Coverage";    modeColor="#7c3aed"; }

    return { total, manual, partial, automated, unlinked, highEffort, pctManual, totalWklyHrs, wklyHrsCount, mode, modeColor };
  },[items]);

  const hasFilter = filterCat!=="All"||filterFreq!=="All"||filterStatus!=="All"||filterEffort!=="All"||filterLinked!=="All"||search;
  const allSel    = filtered.length>0&&filtered.every(i=>selected.has(i.id));

  // ── TABLE COLUMN WIDTHS ──────────────────────────────────────────────────
  const mtGridCols = useMemo(()=>{
    const ch=7.5;
    const badge=s=>(s||"").length*ch+24;
    const text=s=>(s||"").length*ch+16;
    const maxLinked=items.reduce((m,i)=>Math.max(m,(i.linkedAutomations||[]).length*62),60);
    return [
      36,                                                           // checkbox
      72,                                                           // ID
      Math.max(150,...items.map(i=>text(i.task))),                  // task (no effort badge)
      Math.max(90, ...items.map(i=>badge(i.category))),             // category
      Math.max(80, ...items.map(i=>badge(i.frequency))),            // frequency
      Math.max(70, ...items.map(i=>badge(i.effort))),               // effort (own column)
      Math.max(80, ...items.map(i=>badge(i.status))),               // status
      96,                                                           // occurrence rate
      86,                                                           // exec time (min)
      88,                                                           // weekly hrs
      Math.max(120,maxLinked),                                      // linked
      80,                                                           // actions
    ].map(w=>w+"px").join(" ");
  },[items]);

  if(!loaded) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"'DM Sans',sans-serif",color:"#6b7280",fontSize:14}}>Loading…</div>;

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#f8fafc",minHeight:"100vh",color:"#111827"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .trow{transition:background .1s}
        .trow:hover{background:#fff7ed !important}
        .row-act{opacity:0;transition:opacity .15s}
        .trow:hover .row-act{opacity:1}
        button,input,select,textarea{font-family:'DM Sans',sans-serif}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}
      `}</style>

      {manageOpen&&<ManageModal onClose={()=>setManageOpen(false)} lookups={lookups} setLookups={persistLookups}/>}
      {editing&&<EditModal item={editing==="new"?null:editing} onSave={saveItem} onClose={()=>setEditing(null)} lookups={lookups} jiraBase={jiraBase}/>}

      {/* PIN MODAL */}
      {pinModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>{setPinModal(false);setPinInput("");setPinError("");}}>
          <div style={{background:"white",borderRadius:14,padding:"28px 32px",width:320,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:800,color:"#111827",marginBottom:4}}>🔐 Editor Access</div>
            <div style={{fontSize:13,color:"#6b7280",marginBottom:18}}>Enter your PIN to enable editing.</div>
            <input autoFocus type="password" value={pinInput} onChange={e=>{setPinInput(e.target.value);setPinError("");}}
              onKeyDown={e=>e.key==="Enter"&&unlockEdit()} placeholder="Enter PIN…"
              style={{width:"100%",border:`1.5px solid ${pinError?"#fca5a5":"#e5e7eb"}`,borderRadius:8,padding:"10px 13px",fontSize:14,outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
            {pinError&&<div style={{fontSize:12,color:"#dc2626",marginBottom:10}}>{pinError}</div>}
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button onClick={()=>{setPinModal(false);setPinInput("");setPinError("");}} style={{flex:1,padding:"9px",borderRadius:8,border:"1.5px solid #e5e7eb",background:"white",fontSize:13,fontWeight:600,cursor:"pointer",color:"#6b7280"}}>Cancel</button>
              <button onClick={unlockEdit} style={{flex:1,padding:"9px",borderRadius:8,border:"none",background:"#dc2626",color:"white",fontSize:13,fontWeight:700,cursor:"pointer"}}>Unlock</button>
            </div>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{background:"white",borderBottom:"1px solid #e5e7eb",padding:"15px 28px",position:"sticky",top:44,zIndex:100,boxShadow:"0 1px 4px rgba(0,0,0,0.05)"}}>
        <div style={{maxWidth:1440,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:10,color:"#9ca3af",fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",marginBottom:2}}>SRE · Engineering</div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontSize:20,fontWeight:800,color:"#111827"}}>Manual Tasks Register</div>
              <span style={{fontSize:11,background:"#fef2f2",color:"#dc2626",border:"1px solid #fecaca",borderRadius:6,padding:"2px 8px",fontWeight:600}}>Work Audit</span>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            {saveMsg&&<span style={{fontSize:12,fontWeight:600,padding:"4px 10px",borderRadius:6,color:saveMsg.startsWith("⚠")?"#dc2626":"#16a34a",background:saveMsg.startsWith("⚠")?"#fef2f2":"#f0fdf4",border:`1px solid ${saveMsg.startsWith("⚠")?"#fecaca":"#bbf7d0"}`}}>{saveMsg}</span>}
            <span style={{fontSize:11,color:"#9ca3af"}}>Updated: {today()}</span>
            <button onClick={()=>exportCSV(items)} style={{background:"#f0fdf4",color:"#16a34a",border:"1.5px solid #bbf7d0",borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:600,cursor:"pointer"}}>⬇ Export CSV</button>
            {editMode&&<button onClick={()=>setManageOpen(true)} style={{background:"#f8fafc",color:"#475569",border:"1.5px solid #e5e7eb",borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:600,cursor:"pointer"}}>🏷️ Manage Options</button>}
            {editMode&&<button onClick={()=>setEditing("new")} style={{background:"#dc2626",color:"white",border:"none",borderRadius:8,padding:"9px 18px",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 8px #dc262630"}}>+ Add Task</button>}
            <button onClick={editMode?lockEdit:()=>setPinModal(true)} style={{background:editMode?"#f0fdf4":"#f8fafc",color:editMode?"#16a34a":"#6b7280",border:`1.5px solid ${editMode?"#bbf7d0":"#e5e7eb"}`,borderRadius:8,padding:"7px 13px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {editMode?"🔓 Editing":"🔒 Locked"}
            </button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1440,margin:"0 auto",padding:"20px 28px 48px"}}>

        {/* ── STATS ── */}
        <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
          {/* Total */}
          <Stat label="Total Tasks" value={stats.total} color="#374151"/>

          {/* % Manual Records with mode badge */}
          <div style={{background:"white",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"13px 17px",flex:1,minWidth:130,borderTop:`3px solid ${stats.modeColor}`}}>
            <div style={{display:"flex",alignItems:"baseline",gap:6}}>
              <div style={{fontSize:25,fontWeight:800,color:stats.modeColor,lineHeight:1}}>{stats.pctManual}%</div>
              <div style={{fontSize:11,color:"#9ca3af"}}>manual</div>
            </div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:4,fontWeight:500}}>% Manually Operated</div>
            <div style={{marginTop:6,display:"flex",alignItems:"center",gap:5}}>
              <span style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:stats.modeColor,flexShrink:0}}/>
              <span style={{fontSize:10,fontWeight:700,color:stats.modeColor}}>{stats.mode}</span>
            </div>
          </div>

          <Stat label="Partial Automation" value={stats.partial} color="#f59e0b" note={stats.total?`${Math.round(stats.partial/stats.total*100)}% of tasks`:""}/>
          <Stat label="Automated" value={stats.automated} color="#16a34a" note={stats.total?`${Math.round(stats.automated/stats.total*100)}% of tasks`:""}/>
          <Stat label="No Automation Linked" value={stats.unlinked} color="#7c3aed" note="coverage gap" sub={`${stats.highEffort} high-effort tasks`}/>

          {/* Weekly hours */}
          <div style={{background:"white",border:"1.5px solid #e5e7eb",borderRadius:10,padding:"13px 17px",flex:1,minWidth:120,borderTop:"3px solid #0369a1"}}>
            <div style={{fontSize:25,fontWeight:800,color:"#0369a1",lineHeight:1}}>
              {stats.wklyHrsCount>0?`${stats.totalWklyHrs.toFixed(1)}`:"—"}
            </div>
            <div style={{fontSize:11,color:"#6b7280",marginTop:4,fontWeight:500}}>Wkly Manual Hours</div>
            <div style={{fontSize:10,color:"#0369a1",marginTop:2,fontWeight:600}}>
              {stats.wklyHrsCount>0?`across ${stats.wklyHrsCount} tasks with metrics`:"Add occurrence & time data"}
            </div>
          </div>
        </div>

        {/* COVERAGE BANNER */}
        {stats.unlinked>0&&(
          <div style={{background:"#fffbeb",border:"1.5px solid #fde68a",borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div>
              <span style={{fontSize:13,fontWeight:700,color:"#92400e"}}>⚠️ Automation Coverage Gap</span>
              <span style={{fontSize:12,color:"#92400e",marginLeft:8}}>{stats.unlinked} task{stats.unlinked>1?"s":""} have no linked automation initiative.</span>
            </div>
            <button onClick={()=>setFilterLinked("unlinked")} style={{background:"#fef3c7",border:"1px solid #fde68a",borderRadius:7,color:"#92400e",fontSize:12,fontWeight:700,padding:"5px 12px",cursor:"pointer"}}>View unlinked tasks →</button>
          </div>
        )}

        {/* FILTERS */}
        <div style={{background:"white",border:"1px solid #e5e7eb",borderRadius:10,padding:"11px 15px",marginBottom:12,display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search tasks…" style={{border:"1.5px solid #e5e7eb",borderRadius:7,padding:"7px 11px",fontSize:13,minWidth:160,color:"#374151",outline:"none"}}/>
          {[
            {label:"Category",v:filterCat,set:setFilterCat,opts:lookups.categories.map(c=>c.name)},
            {label:"Frequency",v:filterFreq,set:setFilterFreq,opts:lookups.frequencies.map(f=>f.name)},
            {label:"Status",v:filterStatus,set:setFilterStatus,opts:lookups.statuses.map(s=>s.name)},
            {label:"Effort",v:filterEffort,set:setFilterEffort,opts:lookups.efforts.map(e=>e.name)},
          ].map(f=>(
            <select key={f.label} value={f.v} onChange={e=>f.set(e.target.value)} style={{border:"1.5px solid #e5e7eb",borderRadius:7,padding:"7px 9px",fontSize:12,color:f.v!=="All"?"#dc2626":"#6b7280",fontWeight:f.v!=="All"?700:400,background:"white",outline:"none",cursor:"pointer"}}>
              <option value="All">All {f.label}</option>
              {f.opts.map(o=><option key={o}>{o}</option>)}
            </select>
          ))}
          <select value={filterLinked} onChange={e=>setFilterLinked(e.target.value)} style={{border:"1.5px solid #e5e7eb",borderRadius:7,padding:"7px 9px",fontSize:12,color:filterLinked!=="All"?"#dc2626":"#6b7280",fontWeight:filterLinked!=="All"?700:400,background:"white",outline:"none",cursor:"pointer"}}>
            <option value="All">All Automation Coverage</option>
            <option value="linked">Has Linked Automation</option>
            <option value="unlinked">No Automation Linked</option>
          </select>
          {hasFilter&&<button onClick={()=>{setFilterCat("All");setFilterFreq("All");setFilterStatus("All");setFilterEffort("All");setFilterLinked("All");setSearch("");}} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:7,color:"#dc2626",fontSize:12,fontWeight:600,padding:"6px 11px",cursor:"pointer"}}>Clear ×</button>}
          <div style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:"#9ca3af",fontWeight:600,marginRight:2}}>SORT:</span>
            {[["id","ID"],["category","Category"],["status","Status"],["effort","Effort"],["freq","Frequency"],["task","Name"]].map(([k,l])=>(
              <button key={k} onClick={()=>setSortBy(k)} style={{background:sortBy===k?"#fef2f2":"white",border:`1.5px solid ${sortBy===k?"#fecaca":"#e5e7eb"}`,borderRadius:6,color:sortBy===k?"#dc2626":"#6b7280",fontSize:11,fontWeight:600,padding:"4px 8px",cursor:"pointer"}}>{l}</button>
            ))}
          </div>
        </div>

        <div style={{fontSize:12,color:"#9ca3af",marginBottom:10,fontWeight:500}}>
          {filtered.length} of {items.length} tasks{hasFilter&&<span style={{color:"#dc2626"}}> (filtered)</span>}
          <span style={{fontStyle:"italic"}}> · Click row to expand · Hover to edit · ☑ checkbox for bulk status update</span>
        </div>

        {/* BULK BAR */}
        {editMode&&selected.size>0&&(
          <div style={{position:"sticky",top:108,zIndex:90,background:"#dc2626",color:"white",padding:"10px 20px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",boxShadow:"0 4px 16px #dc262640",borderRadius:10,margin:"0 0 12px 0"}}>
            <span style={{fontSize:13,fontWeight:700}}>✓ {selected.size} selected</span>
            <span style={{fontSize:12,opacity:0.85}}>Bulk update status:</span>
            <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)} style={{border:"none",borderRadius:7,padding:"6px 10px",fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#111827",background:"white",outline:"none",cursor:"pointer"}}>
              <option value="">— choose —</option>
              {lookups.statuses.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <button onClick={applyBulk} style={{background:"white",color:"#dc2626",border:"none",borderRadius:7,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>Apply</button>
            <button onClick={()=>{setSelected(new Set());setBulkStatus("");}} style={{background:"transparent",color:"rgba(255,255,255,0.8)",border:"1.5px solid rgba(255,255,255,0.4)",borderRadius:7,padding:"5px 14px",fontSize:12,fontWeight:600,cursor:"pointer",marginLeft:"auto"}}>Deselect All</button>
          </div>
        )}

        {/* TABLE */}
        <div style={{background:"white",border:"1.5px solid #e5e7eb",borderRadius:12,overflowX:"auto",boxShadow:"0 1px 8px rgba(0,0,0,0.04)"}}>
          {/* Header */}
          <div style={{display:"grid",gridTemplateColumns:mtGridCols,background:"#f8fafc",borderBottom:"2px solid #e5e7eb",padding:"10px 18px",alignItems:"center",minWidth:"max-content"}}>
            <div>{editMode&&<input type="checkbox" checked={allSel} onChange={e=>setSelected(e.target.checked?new Set(filtered.map(i=>i.id)):new Set())} style={{cursor:"pointer",width:14,height:14,accentColor:"#dc2626"}}/>}</div>
            {["ID","Manual Task","Category","Frequency","Effort","Status","Occurrence","Exec (min)","Wkly Hrs","Linked Automations",""].map((h,i)=>(
              <div key={i} style={{fontSize:10,fontWeight:700,color:"#6b7280",letterSpacing:"1px",textTransform:"uppercase",paddingLeft:i===0?0:8}}>{h}</div>
            ))}
          </div>

          {filtered.length===0
            ?<div style={{padding:"48px 20px",textAlign:"center",color:"#9ca3af",fontSize:14}}>No tasks match your filters.</div>
            :filtered.map((item,idx)=>{
              const isExp=expanded===item.id;
              const isSel=selected.has(item.id);
              const cs=getCat(item.category);
              const fs=getFreq(item.frequency);
              const ss=getStatus(item.status);
              const es=getEffort(item.effort);
              const linked=item.linkedAutomations||[];
              const wh=calcWeeklyHours(item);
              return (
                <div key={item.id} style={{borderBottom:idx<filtered.length-1?"1px solid #f1f5f9":"none",background:isSel?"#fff7ed":undefined}}>
                  <div className="trow" onClick={()=>setExpanded(isExp?null:item.id)}
                    style={{display:"grid",gridTemplateColumns:mtGridCols,padding:"11px 18px",background:isSel?"#fff7ed":"white",alignItems:"center",cursor:"pointer",userSelect:"none",minWidth:"max-content"}}>

                    <div onClick={e=>e.stopPropagation()}>{editMode&&<input type="checkbox" checked={isSel} onChange={()=>{}} style={{cursor:"pointer",width:14,height:14,accentColor:"#dc2626"}} onClick={e=>{e.stopPropagation();setSelected(s=>{const ns=new Set(s);ns.has(item.id)?ns.delete(item.id):ns.add(item.id);return ns;})}}/>}</div>

                    <div style={{paddingLeft:0}}><span style={{fontSize:10,fontFamily:"'DM Mono',monospace",fontWeight:700,color:"#9ca3af"}}>{item.id}</span></div>

                    {/* Task name — effort badge now in separate column */}
                    <div style={{paddingLeft:8,whiteSpace:"nowrap"}}>
                      <span style={{fontSize:13,fontWeight:600,color:"#111827"}}>{item.task}</span>
                    </div>

                    <div style={{paddingLeft:8,whiteSpace:"nowrap"}}><Badge text={item.category} color={cs.color} bg={cs.bg} border={cs.border} small/></div>
                    <div style={{paddingLeft:8,whiteSpace:"nowrap"}}><Badge text={item.frequency} color={fs.color} bg={fs.bg} border={fs.border} small/></div>

                    {/* Effort — own column */}
                    <div style={{paddingLeft:8,whiteSpace:"nowrap"}}><Badge text={item.effort} color={es.color} bg={es.bg} border={es.border} small/></div>

                    <div style={{paddingLeft:8,whiteSpace:"nowrap"}}><Badge text={item.status} color={ss.color} bg={ss.bg} border={ss.border} small/></div>

                    {/* Occurrence Rate */}
                    <div style={{paddingLeft:8,whiteSpace:"nowrap"}}>
                      {item.occurrenceRate
                        ?<span style={{fontSize:11,fontWeight:600,color:item.occurrenceRate==="On Request"?"#92400e":"#1d4ed8",background:item.occurrenceRate==="On Request"?"#fffbeb":"#eff6ff",border:`1px solid ${item.occurrenceRate==="On Request"?"#fde68a":"#bfdbfe"}`,borderRadius:8,padding:"2px 8px"}}>{item.occurrenceRate}</span>
                        :<span style={{fontSize:10,color:"#d1d5db"}}>—</span>}
                    </div>

                    {/* Exec Time */}
                    <div style={{paddingLeft:8,whiteSpace:"nowrap"}}>
                      {item.execTimeMins
                        ?<span style={{fontSize:11,fontWeight:600,color:"#374151"}}>{item.execTimeMins}<span style={{fontSize:10,color:"#9ca3af",fontWeight:400}}> min</span></span>
                        :<span style={{fontSize:10,color:"#d1d5db"}}>—</span>}
                    </div>

                    {/* Weekly Hours (calculated) */}
                    <div style={{paddingLeft:8,whiteSpace:"nowrap",fontSize:12}}>
                      {fmtHrs(wh)}
                    </div>

                    {/* Linked CARs */}
                    <div style={{paddingLeft:8,display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
                      {linked.length===0
                        ?<span style={{fontSize:10,color:"#fbbf24",fontWeight:600,background:"#fffbeb",border:"1px solid #fde68a",borderRadius:8,padding:"2px 8px"}}>⚠ None</span>
                        :linked.map(c=><span key={c} onClick={e=>e.stopPropagation()}>
                            <a href={`${jiraBase}/${c}`} target="_blank" rel="noopener noreferrer"
                              style={{fontSize:10,fontFamily:"'DM Mono',monospace",fontWeight:700,color:"#1d4ed8",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,padding:"2px 8px",textDecoration:"none",whiteSpace:"nowrap"}}>
                              {c}↗
                            </a>
                          </span>)}
                    </div>

                    <div style={{paddingLeft:8,display:"flex",gap:4,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                      {editMode&&<div className="row-act" style={{display:"flex",gap:4}}>
                        <button onClick={()=>setEditing(item)} style={{background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:6,color:"#ea580c",fontSize:11,fontWeight:700,padding:"4px 8px",cursor:"pointer"}}>Edit</button>
                        <button onClick={()=>deleteItem(item.id)} style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,color:"#dc2626",fontSize:12,fontWeight:700,padding:"4px 7px",cursor:"pointer"}}>×</button>
                      </div>}
                      <span style={{fontSize:10,color:"#d1d5db",marginLeft:2}}>{isExp?"▲":"▼"}</span>
                    </div>
                  </div>

                  {isExp&&<ExpandedDetail item={item} jiraBase={jiraBase} lookups={lookups}/>}
                </div>
              );
            })}
        </div>

        {/* CATEGORY BREAKDOWN */}
        <div style={{marginTop:24}}>
          <div style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.5px"}}>Tasks by Category</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
            {lookups.categories.filter(c=>items.some(i=>i.category===c.name)).map(cat=>{
              const ci=items.filter(i=>i.category===cat.name);
              const linked=ci.filter(i=>(i.linkedAutomations||[]).length>0).length;
              const manual=ci.filter(i=>i.status==="Fully Manual").length;
              const on=filterCat===cat.name;
              return (
                <div key={cat.id} onClick={()=>setFilterCat(on?"All":cat.name)}
                  style={{background:on?cat.bg:"white",border:`1.5px solid ${on?cat.border:"#e5e7eb"}`,borderRadius:10,padding:"12px 15px",cursor:"pointer",transition:"all .15s"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:cat.color,flexShrink:0}}/>
                    <span style={{fontSize:12,fontWeight:700,color:on?cat.color:"#374151"}}>{cat.name}</span>
                  </div>
                  <div style={{display:"flex",gap:10,marginBottom:8}}>
                    <span style={{fontSize:11,color:"#dc2626",fontWeight:600}}>{manual} manual</span>
                    <span style={{fontSize:11,color:"#16a34a",fontWeight:600}}>{linked} linked</span>
                  </div>
                  <div style={{height:4,background:"#f1f5f9",borderRadius:2,overflow:"hidden"}}>
                    <div style={{width:`${ci.length?Math.round(linked/ci.length*100):0}%`,height:"100%",background:cat.color,borderRadius:2,transition:"width .4s"}}/>
                  </div>
                  <div style={{fontSize:10,color:"#9ca3af",marginTop:4}}>{ci.length?Math.round(linked/ci.length*100):0}% automation coverage · {ci.length} tasks</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{marginTop:16,padding:"11px 16px",background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:8,fontSize:12,color:"#92400e",lineHeight:1.7}}>
          <strong>Goal: Reduce manual work by 50% next quarter.</strong> &nbsp;
          Link each task to its CAR initiative using the <strong>Edit</strong> form → Linked Automations field ·
          <strong> ⚠ None</strong> badge = no automation coverage yet ·
          Fill in <strong>Occurrence Rate</strong> + <strong>Exec Time</strong> to unlock weekly hour estimates ·
          <strong> ⬇ Export CSV</strong> exports the full audit for reporting.
        </div>
      </div>
    </div>
  );
}
