"use client";
import { useState, useEffect } from "react";

// ── 6 LEVELS × 6 BANDS ───────────────────────────────────────────────────────
// L1=20 → Very materially below (0-39)
// L2=47 → Below expectations   (40-54)
// L3=60 → In line               (55-64)  ← all-L3 engineer = 60% exactly
// L4=70 → Above expectations    (65-74)
// L5=82 → Significantly above   (75-89)
// L6=95 → Extraordinary         (90-100)
const LEVEL_SCORE = { 1:20, 2:47, 3:60, 4:70, 5:82, 6:95 };
const LEVEL_LABEL = { 1:"Needs Guidance", 2:"Developing", 3:"Independent", 4:"Proficient", 5:"Advanced", 6:"Expert" };
const LEVEL_COLOR = { 1:"#ef4444", 2:"#f97316", 3:"#eab308", 4:"#3b82f6", 5:"#8b5cf6", 6:"#22c55e" };

const SOURCE_COLOR = {
  "PagerDuty":"#818cf8", "Jira":"#38bdf8", "Jira / PagerDuty":"#34d399",
  "On-Call / Jira / Tech Docs":"#f59e0b", "On-Call / Escalations / Postmortems":"#f472b6",
  "GitHub / Manual":"#a78bfa", "Manual":"#475569",
  "PagerDuty / Slack":"#818cf8", "PagerDuty / Jira":"#34d399",
  "Jira / Documentation":"#38bdf8", "Grafana / Manual":"#f59e0b",
};

// ── DB HELPERS ────────────────────────────────────────────────────────────────
const apiGet = async key => { try { const r=await fetch(`/api/data/${key}`); if(!r.ok) return null; return r.json(); } catch { return null; } };
const apiSet = async (key,val) => { try { await fetch(`/api/data/${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(val)}); } catch {} };

// ── DERIVE monitoring_observability LEVEL FROM AUTOMATION INITIATIVES ─────────
function deriveAutoLevel(initiatives) {
  if (!Array.isArray(initiatives) || !initiatives.length) return null;
  const done    = initiatives.filter(i => i.status === "Done" || i.status === "Finalizing for Dev");
  const scored  = initiatives.filter(i => (i.criteria||[]).some(c=>c.score>0));
  const allScores = scored.flatMap(i => (i.criteria||[]).filter(c=>c.score>0).map(c=>c.score));
  const avgScore  = allScores.length ? allScores.reduce((a,b)=>a+b,0)/allScores.length : 0;
  const doneRatio = done.length / initiatives.length;
  const combined  = avgScore > 0
    ? (avgScore/5)*100*0.55 + doneRatio*100*0.45
    : doneRatio*100;
  if (combined >= 75) return 5;
  if (combined >= 58) return 4;
  if (combined >= 42) return 3;
  if (combined >= 25) return 2;
  return 1;
}

const BANDS = [
  { min:90, max:100, label:"Extraordinary & Exceptional",         sub:"Performance well above expectations",      color:"#22c55e", bg:"#052e16", border:"#14532d" },
  { min:75, max:89,  label:"Significantly Above Expectations",    sub:"Strong performer — consistently exceeds",  color:"#8b5cf6", bg:"#1e1040", border:"#4c1d95" },
  { min:65, max:74,  label:"Above Expectations",                  sub:"Performing beyond standard in key areas",  color:"#3b82f6", bg:"#0c1a3a", border:"#1e3a5f" },
  { min:55, max:64,  label:"In Line With Expectations",           sub:"Solid independent contributor",            color:"#60a5fa", bg:"#0a1628", border:"#1e3a5f" },
  { min:40, max:54,  label:"Below Expectations",                  sub:"Needs focused support and coaching",       color:"#f97316", bg:"#1c0f04", border:"#7c2d12" },
  { min:0,  max:39,  label:"Very Materially Below Expectations",  sub:"Significant performance concerns",         color:"#ef4444", bg:"#1c0505", border:"#7f1d1d" },
];

function getInterp(score) {
  return BANDS.find(b => score >= b.min && score <= b.max) || BANDS[BANDS.length-1];
}

const contrib = (level, effW) => (LEVEL_SCORE[level] / 100) * effW;

// ── SKILLS WITH 6 LEVELS ──────────────────────────────────────────────────────
const SKILLS = [
  {
    id:"incident_coordination", name:"Incident Coordination & Management",
    defaultWeight:20, dataSource:"PagerDuty / Slack",
    nyo_reason:"No incidents during review period",
    description:"Ability to coordinate incidents, communicate updates, and manage response.",
    metrics:["Acknowledgement time", "Communication updates", "Escalation accuracy"],
    levels:[
      "Cannot coordinate incident response; communication is reactive and unstructured. Relies on others to initiate calls or updates.",
      "Participates in incidents with direction; provides basic status updates but struggles under pressure or with non-technical stakeholders.",
      "Coordinates incidents end-to-end; posts timely structured updates to stakeholders; follows escalation procedures correctly.",
      "Manages complex incidents involving multiple teams; ensures clear communication channels; escalates accurately and proactively.",
      "Leads major incidents across the organisation; sets communication cadence and standards; drives post-incident review processes.",
      "Defines incident management strategy and tooling; trains the team; owns the incident coordination framework organisation-wide.",
    ],
  },
  {
    id:"incident_resolution", name:"Incident Resolution Capability",
    defaultWeight:25, dataSource:"PagerDuty / Jira",
    nyo_reason:"No production incidents requiring resolution during review period",
    description:"Ability to troubleshoot and fix production issues.",
    metrics:["Root cause identification", "Correct fixes applied", "Resolution time"],
    levels:[
      "Can identify that something is wrong but cannot isolate or fix the root cause independently.",
      "Applies known fixes from runbooks but cannot diagnose novel failures without guidance.",
      "Identifies root cause of common production issues and applies correct fixes independently; resolution within expected timeframes.",
      "Diagnoses complex, multi-system failures; understands cascading effects; applies targeted fixes without introducing side effects.",
      "Resolves the most complex production incidents including novel failure modes; documents and improves resolution playbooks.",
      "Defines resolution standards; builds diagnostic tooling; eliminates entire classes of failures through systemic changes.",
    ],
  },
  {
    id:"technical_depth", name:"Technical Depth & Product Understanding",
    defaultWeight:20, dataSource:"Jira / Documentation",
    nyo_reason:null,
    description:"Ability to investigate logs, traces, and metrics. Understanding system architecture and dependencies.",
    metrics:["Investigation quality", "Technical accuracy", "Correct hypothesis", "Architectural understanding", "Correct diagnosis of failures"],
    levels:[
      "Limited understanding of how the product works; cannot trace a request through the system independently.",
      "Understands individual services in isolation; cannot reliably predict failure propagation or trace cross-service issues.",
      "Understands service dependencies, data flows, and how failures propagate; can investigate logs, traces, and metrics accurately.",
      "Deep understanding of the full product architecture; identifies correct hypotheses quickly; diagnoses architectural failures across domains.",
      "Expert-level product knowledge; anticipates failure modes at design time; produces technically accurate architectural analysis.",
      "Defines technical direction; owns architectural documentation; is the definitive reference for product understanding across the organisation.",
    ],
  },
  {
    id:"monitoring_observability", name:"Monitoring & Observability",
    defaultWeight:20, dataSource:"Grafana / Manual",
    nyo_reason:null,
    description:"Ability to design monitoring, alerts, dashboards and remove manual work via automation.",
    metrics:["Alerts created", "Dashboards designed", "Signal-to-noise ratio", "Automations built", "Manual steps removed", "Reliability improvements"],
    levels:[
      "Uses existing dashboards and alerts but cannot create or modify them independently.",
      "Makes minor modifications to existing alerts or dashboards; understands basic monitoring concepts.",
      "Designs and implements alerts and dashboards independently; improves signal-to-noise ratio; automates basic manual checks.",
      "Builds comprehensive observability coverage for a service domain; significantly reduces toil through automation; improves reliability metrics.",
      "Designs observability systems at scale; leads monitoring strategy for the team; achieves measurably improved signal quality and reduced manual work.",
      "Defines the observability and automation standard for the organisation; architects reliability platforms; drives org-wide monitoring excellence.",
    ],
  },
  {
    id:"manager_evaluation", name:"Manager's Evaluation",
    defaultWeight:15, dataSource:"Manual",
    nyo_reason:null,
    description:"Manager's holistic assessment of professionalism, ownership, initiative, and team contribution.",
    metrics:["Professionalism", "Initiative", "Reliability", "Collaboration", "Team contribution"],
    levels:[
      "Performance falls significantly below expectations in professionalism, ownership, and team contribution.",
      "Shows developing professionalism but requires coaching in ownership, initiative, and collaboration.",
      "Meets expected standards for professionalism, reliability, and collaboration; works well within the team.",
      "Goes beyond expectations in team contribution, initiative, and reliability; positively impacts team culture.",
      "Significantly above expectations; drives a culture of improvement and excellence; a trusted team leader.",
      "Extraordinary contributor; sets the standard for the entire team; exemplifies the values of the SRE function.",
    ],
  },
];

// ── SCORE RING ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size=120 }) {
  const r=42, circ=2*Math.PI*r;
  const dash = Math.min(score/100,1)*circ;
  const { color } = getInterp(score);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#1e293b" strokeWidth="9"/>
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{transition:"stroke-dasharray 0.55s cubic-bezier(.4,0,.2,1),stroke 0.3s"}}/>
      <text x="50" y="43" textAnchor="middle" fill="#f1f5f9" fontSize="19"
        fontFamily="'DM Mono',monospace" fontWeight="700">{Math.round(score)}%</text>
      <text x="50" y="68" textAnchor="middle" fill="#334155" fontSize="7"
        fontFamily="'DM Mono',monospace">OVERALL</text>
    </svg>
  );
}

// ── SCALE LEGEND ──────────────────────────────────────────────────────────────
function ScaleLegend({ overallScore, compact=false }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:compact?"2px":"4px"}}>
      {!compact && (
        <div style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:"#1e3a5f",letterSpacing:"2px",marginBottom:"8px"}}>
          SCORE INTERPRETATION SCALE
        </div>
      )}
      {BANDS.map(band => {
        const isActive = overallScore >= band.min && overallScore <= band.max;
        return (
          <div key={band.label} style={{
            display:"flex", alignItems:"center", gap:"10px",
            padding: compact?"3px 6px":"5px 10px", borderRadius:"5px",
            background: isActive ? band.color+"18" : "transparent",
            border: isActive ? `1px solid ${band.color}40` : "1px solid transparent",
            transition:"all 0.2s",
          }}>
            <div style={{width:"8px",height:"8px",borderRadius:"2px",background:band.color,flexShrink:0}}/>
            <span style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:"#334155",width:"52px",flexShrink:0}}>
              {band.min===0?"0–39":`${band.min}–${band.max}`}
            </span>
            <div style={{flex:1}}>
              <div style={{fontSize:compact?"11px":"12px",color:isActive?band.color:"#475569",fontWeight:isActive?"600":"400"}}>
                {band.label}
              </div>
              {!compact && <div style={{fontSize:"10px",color:"#334155",marginTop:"1px"}}>{band.sub}</div>}
            </div>
            {isActive && (
              <span style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:band.color,flexShrink:0}}>
                ← {overallScore.toFixed(1)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SCORECARD MODAL ───────────────────────────────────────────────────────────
function ScorecardModal({ onClose, engineerName, reviewPeriod, overallScore, nyoSkills, pendingSkills, assessments, effectiveWeights }) {
  const interp = getInterp(overallScore);
  const today  = new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"long",year:"numeric"});

  const handlePrint = () => {
    const win = window.open("","_blank","width=900,height=700");
    win.document.write(`
      <html><head><title>SRE Scorecard — ${engineerName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;600&family=DM+Sans:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'DM Sans',sans-serif;background:#fff;color:#0f172a;padding:40px;max-width:820px;margin:0 auto}
        .hdr{border-bottom:3px solid #0f172a;padding-bottom:20px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end}
        .eyebrow{font-size:10px;letter-spacing:3px;color:#64748b;font-family:'DM Mono',monospace;margin-bottom:6px}
        .name{font-size:30px;font-weight:700}
        .meta{font-size:12px;color:#64748b;margin-top:4px}
        .score-num{font-size:52px;font-weight:700;font-family:'DM Mono',monospace;color:${interp.color};text-align:right;line-height:1}
        .score-lbl{font-size:12px;font-weight:600;color:${interp.color};text-align:right;margin-top:4px}
        .verdict{border-left:4px solid ${interp.color};padding:12px 16px;margin-bottom:24px;background:#f8fafc;border-radius:0 6px 6px 0}
        .v-eye{font-size:10px;font-family:'DM Mono',monospace;letter-spacing:2px;color:#94a3b8;margin-bottom:3px}
        .v-txt{font-size:16px;font-weight:700;color:${interp.color}}
        .v-sub{font-size:12px;color:#64748b;margin-top:3px}
        table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px}
        th{background:#0f172a;color:#fff;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:1px;padding:8px 10px;text-align:left}
        td{padding:9px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;line-height:1.45}
        tr:nth-child(even) td{background:#f8fafc}
        .badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:10px;font-family:'DM Mono',monospace;font-weight:600}
        .nyo td{color:#94a3b8;font-style:italic}
        .total td{border-top:2px solid #0f172a;font-weight:700;background:#f1f5f9 !important;font-size:14px}
        .mono{font-family:'DM Mono',monospace}
        .band-row{display:flex;gap:8px;align-items:center;padding:4px 8px;border-radius:4px;margin-bottom:2px}
        .dot{width:9px;height:9px;border-radius:2px;flex-shrink:0}
        .footer{margin-top:28px;font-size:10px;color:#94a3b8;font-family:'DM Mono',monospace;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between}
        .anchor-note{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:11px;color:#92400e;line-height:1.6}
      </style></head><body>
      <div class="hdr">
        <div>
          <div class="eyebrow">SRE PERFORMANCE SCORECARD</div>
          <div class="name">${engineerName}</div>
          <div class="meta">Review Period: ${reviewPeriod} &nbsp;·&nbsp; Generated: ${today}</div>
        </div>
        <div>
          <div class="score-num">${(Math.round(overallScore*100)/100).toFixed(2)}%</div>
          <div class="score-lbl">${interp.label}</div>
        </div>
      </div>

      <div class="verdict">
        <div class="v-eye">OVERALL VERDICT</div>
        <div class="v-txt">${interp.label}</div>
        <div class="v-sub">${interp.sub}</div>
      </div>

      <table>
        <thead><tr>
          <th>#</th><th>Skill Area</th><th>Level</th><th>Capability Demonstrated</th><th>Formula</th><th style="text-align:right">Score</th>
        </tr></thead>
        <tbody>
          ${SKILLS.map((s,i) => {
            const a=assessments[s.id], isNyo=a?.nyo, lvl=a?.level;
            const effW=effectiveWeights[s.id];
            const c=lvl?contrib(lvl,effW):0;
            const lc=lvl?LEVEL_COLOR[lvl]:"#94a3b8";
            if (isNyo) return `<tr class="nyo"><td>${i+1}</td><td>${s.name}</td><td colspan="3">Not Yet Observed — weight redistributed to other skills</td><td class="mono" style="text-align:right">—</td></tr>`;
            if (!lvl)  return `<tr class="nyo"><td>${i+1}</td><td>${s.name}</td><td colspan="3">Not scored this period</td><td class="mono" style="text-align:right">—</td></tr>`;
            return `<tr>
              <td>${i+1}</td>
              <td><strong>${s.name}</strong></td>
              <td><span class="badge" style="background:${lc}20;color:${lc};border:1px solid ${lc}40">L${lvl} · ${LEVEL_LABEL[lvl]}</span></td>
              <td style="color:#334155">${s.levels[lvl-1]}</td>
              <td class="mono" style="color:#94a3b8">${LEVEL_SCORE[lvl]}%×${effW.toFixed(1)}%÷100</td>
              <td class="mono" style="text-align:right;color:${lc};font-weight:700">${c.toFixed(2)}%</td>
            </tr>`;
          }).join("")}
          <tr class="total">
            <td colspan="5" style="text-align:right;font-family:'DM Mono',monospace;letter-spacing:1px">OVERALL SCORE</td>
            <td class="mono" style="text-align:right;color:${interp.color};font-size:16px">${(Math.round(overallScore*100)/100).toFixed(2)}%</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-bottom:8px;font-size:10px;font-family:'DM Mono',monospace;letter-spacing:2px;color:#64748b">SCORE INTERPRETATION SCALE</div>
      ${BANDS.map(b => {
        const active = overallScore>=b.min && overallScore<=b.max;
        return `<div class="band-row" style="background:${active?b.color+'15':'transparent'};border:1px solid ${active?b.color+'40':'transparent'}">
          <div class="dot" style="background:${b.color}"></div>
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:#64748b;width:55px">${b.min===0?'0–39':`${b.min}–${b.max}`}</span>
          <span style="font-size:12px;color:${active?b.color:'#475569'};font-weight:${active?'700':'400'}">${b.label}</span>
          ${active?`<span style="margin-left:auto;font-family:'DM Mono',monospace;font-size:10px;color:${b.color}">← ${overallScore.toFixed(1)}%</span>`:''}
        </div>`;
      }).join("")}

      <div class="anchor-note" style="margin-top:16px">
        <strong>Score calibration:</strong> L3 (Independent) = 60% — middle of "In Line With Expectations". 
        An engineer rated L3 across all skills scores exactly 60%.
        ${nyoSkills.length>0?`<br/><strong>NYO skills (${nyoSkills.map(s=>s.name).join(", ")}):</strong> not penalised — their weight was redistributed proportionally.`:""}
      </div>

      <div class="footer">
        <span>Formula: score = Σ (level_anchor / 100) × effective_weight &nbsp;·&nbsp; Levels: L1=20% L2=47% L3=60% L4=70% L5=82% L6=95%</span>
        <span>${today}</span>
      </div>
      </body></html>
    `);
    win.document.close();
    setTimeout(()=>win.print(),500);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{background:"#0a1220",border:"1px solid #1e3a5f",borderRadius:"12px",width:"100%",maxWidth:"640px",maxHeight:"90vh",overflow:"auto",boxShadow:"0 25px 60px rgba(0,0,0,0.7)"}}>
        
        {/* Sticky header */}
        <div style={{padding:"20px 24px",borderBottom:"1px solid #0f1a2e",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:"#0a1220",zIndex:10}}>
          <div>
            <div style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:"#334155",letterSpacing:"2px",marginBottom:"4px"}}>SCORECARD PREVIEW</div>
            <div style={{fontSize:"18px",fontWeight:"700",color:"#f1f5f9"}}>{engineerName}</div>
            <div style={{fontSize:"11px",color:"#475569",marginTop:"2px"}}>{reviewPeriod} · {today}</div>
          </div>
          <div style={{display:"flex",gap:"10px",alignItems:"center"}}>
            <button onClick={handlePrint} style={{background:"#1e3a5f",border:"1px solid #3b82f6",borderRadius:"7px",color:"#60a5fa",fontSize:"12px",fontFamily:"'DM Mono',monospace",padding:"8px 16px",cursor:"pointer"}}>
              🖨 Print / Save PDF
            </button>
            <button onClick={onClose} style={{background:"transparent",border:"1px solid #1e293b",borderRadius:"7px",color:"#475569",fontSize:"18px",width:"34px",height:"34px",cursor:"pointer"}}>×</button>
          </div>
        </div>

        {/* Score banner */}
        <div style={{margin:"20px 24px 0",padding:"16px 20px",borderRadius:"9px",background:interp.bg,border:`1px solid ${interp.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:"#475569",letterSpacing:"2px",marginBottom:"4px"}}>OVERALL SCORE</div>
            <div style={{fontSize:"14px",fontWeight:"700",color:interp.color}}>{interp.label}</div>
            <div style={{fontSize:"11px",color:"#64748b",marginTop:"3px"}}>{interp.sub}</div>
            {nyoSkills.length>0 && <div style={{fontSize:"11px",color:"#78350f",marginTop:"6px"}}>{nyoSkills.length} skill{nyoSkills.length>1?"s":""} NYO — weight redistributed</div>}
          </div>
          <div style={{fontSize:"44px",fontFamily:"'DM Mono',monospace",fontWeight:"700",color:interp.color,lineHeight:1}}>
            {(Math.round(overallScore*100)/100).toFixed(2)}%
          </div>
        </div>

        {/* Skill breakdown */}
        <div style={{padding:"16px 24px",display:"flex",flexDirection:"column",gap:"8px"}}>
          <div style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:"#1e3a5f",letterSpacing:"2px",marginBottom:"4px"}}>SKILL BREAKDOWN</div>
          {SKILLS.map((s,i) => {
            const a=assessments[s.id], isNyo=a?.nyo, lvl=a?.level;
            const effW=effectiveWeights[s.id], c=lvl?contrib(lvl,effW):null;
            return (
              <div key={s.id} style={{background:isNyo?"#060b12":"#060d1a",border:`1px solid ${isNyo?"#0d1525":lvl?LEVEL_COLOR[lvl]+"30":"#0f1a2e"}`,borderRadius:"7px",padding:"10px 14px",opacity:isNyo?0.5:1}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:"10px"}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"#1e3a5f",minWidth:"20px",marginTop:"2px"}}>{String(i+1).padStart(2,"0")}</span>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px"}}>
                      <span style={{fontSize:"13px",fontWeight:"600",color:isNyo||!lvl?"#334155":"#e2e8f0"}}>{s.name}</span>
                      {c!==null && <span style={{fontFamily:"'DM Mono',monospace",fontSize:"13px",fontWeight:"700",color:LEVEL_COLOR[lvl],flexShrink:0}}>{c.toFixed(2)}%</span>}
                      {isNyo && <span style={{fontSize:"10px",color:"#78350f",fontFamily:"'DM Mono',monospace",flexShrink:0}}>NYO</span>}
                      {!lvl&&!isNyo && <span style={{fontSize:"10px",color:"#334155",fontFamily:"'DM Mono',monospace",flexShrink:0}}>—</span>}
                    </div>
                    {lvl&&!isNyo && (
                      <div style={{marginTop:"4px"}}>
                        <div style={{fontSize:"11px",fontFamily:"'DM Mono',monospace",color:LEVEL_COLOR[lvl],marginBottom:"3px"}}>
                          L{lvl} · {LEVEL_LABEL[lvl]} · {LEVEL_SCORE[lvl]}% × {effW.toFixed(1)}% ÷ 100
                        </div>
                        <div style={{fontSize:"12px",color:"#64748b",lineHeight:"1.5"}}>{s.levels[lvl-1]}</div>
                      </div>
                    )}
                    {isNyo && <div style={{fontSize:"11px",color:"#78350f",marginTop:"3px"}}>{s.nyo_reason||"Not observed this period"} — weight redistributed</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scale */}
        <div style={{margin:"0 24px 24px",background:"#060d1a",border:"1px solid #0f1a2e",borderRadius:"8px",padding:"14px 16px"}}>
          <ScaleLegend overallScore={overallScore} compact={false}/>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function SREMatrix() {
  const [weights,setWeights]               = useState(Object.fromEntries(SKILLS.map(s=>[s.id,s.defaultWeight])));
  const [assessments,setAssessments]       = useState(Object.fromEntries(SKILLS.map(s=>[s.id,{level:null,nyo:false}])));
  const [engineerName,setEngineerName]     = useState("Engineer Name");
  const [editingName,setEditingName]       = useState(false);
  const [expandedSkill,setExpandedSkill]   = useState(null);
  const [showFormula,setShowFormula]       = useState(false);
  const [reviewPeriod,setReviewPeriod]     = useState("Q2 2025");
  const [showScorecard,setShowScorecard]   = useState(false);
  const [autoLevel,setAutoLevel]           = useState(null);
  const [autoStats,setAutoStats]           = useState(null);
  const [loaded,setLoaded]                 = useState(false);

  // ── LOAD saved state + derive auto-level from automation initiatives ──
  useEffect(() => {
    (async () => {
      const [saved, initiatives] = await Promise.all([
        apiGet("sre-matrix-v1"),
        apiGet("auto-v5"),
      ]);
      if (saved) {
        if (saved.engineerName) setEngineerName(saved.engineerName);
        if (saved.reviewPeriod) setReviewPeriod(saved.reviewPeriod);
        if (saved.assessments)  setAssessments(saved.assessments);
        if (saved.weights)      setWeights(saved.weights);
      }
      if (Array.isArray(initiatives) && initiatives.length) {
        const lvl    = deriveAutoLevel(initiatives);
        const done   = initiatives.filter(i => i.status === "Done" || i.status === "Finalizing for Dev");
        const inProg = initiatives.filter(i => i.status === "In Progress" || i.status === "On Demo (Dev)");
        setAutoLevel(lvl);
        setAutoStats({ total: initiatives.length, done: done.length, inProg: inProg.length });
        // Auto-apply only if user hasn't already set a value
        if (!saved?.assessments?.monitoring_observability?.level && lvl) {
          setAssessments(p => ({...p, monitoring_observability: { level: lvl, nyo: false }}));
        }
      }
      setLoaded(true);
    })();
  }, []);

  // ── PERSIST on every meaningful change ──
  useEffect(() => {
    if (!loaded) return;
    apiSet("sre-matrix-v1", { engineerName, reviewPeriod, assessments, weights });
  }, [loaded, engineerName, reviewPeriod, assessments, weights]);

  const effectiveWeights = (() => {
    const obs=SKILLS.filter(s=>!assessments[s.id]?.nyo);
    const tot=obs.reduce((sum,s)=>sum+(weights[s.id]||0),0);
    return Object.fromEntries(SKILLS.map(s=>[s.id, assessments[s.id]?.nyo?0: tot>0?((weights[s.id]||0)/tot)*100:0]));
  })();

  const assessedSkills = SKILLS.filter(s=>!assessments[s.id]?.nyo&&assessments[s.id]?.level);
  const nyoSkills      = SKILLS.filter(s=>assessments[s.id]?.nyo);
  const pendingSkills  = SKILLS.filter(s=>!assessments[s.id]?.nyo&&!assessments[s.id]?.level);
  const totalEffW      = assessedSkills.reduce((sum,s)=>sum+effectiveWeights[s.id],0);
  const rawScore       = assessedSkills.reduce((sum,s)=>sum+contrib(assessments[s.id].level,effectiveWeights[s.id]),0);
  const overallScore   = totalEffW>0?(rawScore/totalEffW)*100:0;
  const totalRawW      = SKILLS.reduce((sum,s)=>sum+(weights[s.id]||0),0);
  const interp         = getInterp(overallScore);

  const setLevel  = (id,lvl) => setAssessments(p=>({...p,[id]:{level:lvl,nyo:false}}));
  const toggleNYO = (id)     => setAssessments(p=>({...p,[id]:{level:null,nyo:!p[id]?.nyo}}));
  const setWeight = (id,v)   => setWeights(p=>({...p,[id]:Math.max(0,Math.min(50,Number(v)))}));

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#080d17",minHeight:"100vh",color:"#e2e8f0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .lbtn{transition:all .14s;cursor:pointer;border:none}
        .lbtn:hover{transform:translateY(-2px);filter:brightness(1.3)}
        .lbtn:active{transform:translateY(0)}
        .srow{transition:background .15s,opacity .2s}
        .srow:hover{background:#0e1524 !important}
        .dcard{transition:all .15s;cursor:pointer}
        .dcard:hover{background:#0e1524 !important;border-color:#334155 !important}
        .nyob{transition:all .15s;cursor:pointer;border:none;font-family:'DM Mono',monospace}
        .gen-btn{transition:all .2s;cursor:pointer}
        .gen-btn:hover{filter:brightness(1.15);transform:translateY(-1px)}
        input[type=number]::-webkit-inner-spin-button{opacity:1}
        input:focus{outline:none}
      `}</style>

      {showScorecard && (
        <ScorecardModal
          onClose={()=>setShowScorecard(false)}
          engineerName={engineerName} reviewPeriod={reviewPeriod}
          overallScore={overallScore} assessedSkills={assessedSkills}
          nyoSkills={nyoSkills} pendingSkills={pendingSkills}
          assessments={assessments} effectiveWeights={effectiveWeights} weights={weights}
        />
      )}

      {/* ── HEADER ── */}
      <div style={{background:"linear-gradient(160deg,#0d1525 0%,#080d17 100%)",borderBottom:"1px solid #0f1a2e",padding:"28px 32px 22px"}}>
        <div style={{maxWidth:"960px",margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"20px"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:"10px",letterSpacing:"3.5px",color:"#1e3a5f",fontFamily:"'DM Mono',monospace",marginBottom:"10px"}}>SRE PERFORMANCE ASSESSMENT</div>
              {editingName?(
                <input autoFocus value={engineerName}
                  onChange={e=>setEngineerName(e.target.value)}
                  onBlur={()=>setEditingName(false)}
                  onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
                  style={{background:"transparent",border:"none",borderBottom:"1px solid #3b82f6",color:"#f1f5f9",fontSize:"28px",fontWeight:"700",fontFamily:"'DM Sans',sans-serif",width:"300px"}}/>
              ):(
                <div onClick={()=>setEditingName(true)} style={{fontSize:"28px",fontWeight:"700",color:"#f1f5f9",cursor:"text",display:"flex",alignItems:"center",gap:"8px"}}>
                  {engineerName}<span style={{fontSize:"12px",color:"#1e3a5f"}}>✎</span>
                </div>
              )}
              <div style={{marginTop:"8px",display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                <input value={reviewPeriod} onChange={e=>setReviewPeriod(e.target.value)}
                  style={{background:"#0a1628",border:"1px solid #0f2744",borderRadius:"4px",color:"#60a5fa",fontSize:"11px",fontFamily:"'DM Mono',monospace",padding:"2px 8px"}}/>
                <span style={{fontSize:"12px",color:"#334155"}}>{assessedSkills.length} of {SKILLS.length-nyoSkills.length} scored</span>
                {nyoSkills.length>0&&<span style={{fontSize:"10px",color:"#854d0e",background:"#1c1007",padding:"2px 8px",borderRadius:"10px",fontFamily:"'DM Mono',monospace"}}>{nyoSkills.length} NYO</span>}
                {pendingSkills.length>0&&<span style={{fontSize:"10px",color:"#334155",background:"#0d1525",padding:"2px 8px",borderRadius:"10px",fontFamily:"'DM Mono',monospace"}}>{pendingSkills.length} pending</span>}
              </div>
              {assessedSkills.length>0&&(
                <div style={{marginTop:"12px",display:"inline-flex",alignItems:"center",gap:"8px",background:interp.bg,border:`1px solid ${interp.border}`,borderRadius:"6px",padding:"6px 12px"}}>
                  <div style={{width:"8px",height:"8px",borderRadius:"2px",background:interp.color}}/>
                  <div>
                    <div style={{fontSize:"12px",fontWeight:"600",color:interp.color}}>{interp.label}</div>
                    <div style={{fontSize:"10px",color:"#475569",marginTop:"1px"}}>{interp.sub}</div>
                  </div>
                </div>
              )}
            </div>

            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"12px"}}>
              <ScoreRing score={overallScore} size={116}/>
              {assessedSkills.length>0&&(
                <button className="gen-btn" onClick={()=>setShowScorecard(true)} style={{background:"linear-gradient(135deg,#1e3a5f,#0f2744)",border:"1px solid #3b82f6",borderRadius:"7px",color:"#60a5fa",fontSize:"11px",fontFamily:"'DM Mono',monospace",padding:"8px 16px",letterSpacing:"0.5px",boxShadow:"0 0 16px #3b82f620"}}>
                  📋 Generate Scorecard
                </button>
              )}
            </div>
          </div>

          {/* Weight bar */}
          <div style={{marginTop:"20px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
              <span style={{fontSize:"10px",color:"#1e3a5f",fontFamily:"'DM Mono',monospace",letterSpacing:"2px"}}>
                WEIGHT DISTRIBUTION {totalRawW!==100&&<span style={{color:"#f97316"}}>· RAW {totalRawW}% — NYO REDISTRIBUTED</span>}
              </span>
              <button onClick={()=>setShowFormula(f=>!f)} style={{background:showFormula?"#0f2744":"transparent",border:"1px solid #0f2744",borderRadius:"4px",color:"#60a5fa",fontSize:"10px",fontFamily:"'DM Mono',monospace",padding:"2px 8px",cursor:"pointer"}}>
                {showFormula?"hide":"show"} formula
              </button>
            </div>
            <div style={{display:"flex",height:"7px",borderRadius:"4px",overflow:"hidden",gap:"2px"}}>
              {SKILLS.map(s=>!assessments[s.id]?.nyo&&(
                <div key={s.id} style={{flex:effectiveWeights[s.id],background:assessments[s.id]?.level?LEVEL_COLOR[assessments[s.id].level]:"#151f2e",transition:"flex 0.35s ease"}} title={`${s.name}: ${effectiveWeights[s.id].toFixed(1)}%`}/>
              ))}
            </div>
          </div>

          {showFormula&&(
            <div style={{marginTop:"12px",background:"#040810",border:"1px solid #0f1a2e",borderRadius:"8px",padding:"14px 16px"}}>
              <div style={{fontSize:"11px",fontFamily:"'DM Mono',monospace",color:"#3b82f6",marginBottom:"10px",letterSpacing:"1px"}}>SCORING FORMULA</div>
              <div style={{fontSize:"14px",fontFamily:"'DM Mono',monospace",color:"#e2e8f0",marginBottom:"12px"}}>
                overall = Σ <span style={{color:"#60a5fa"}}>(level_anchor / 100)</span> × <span style={{color:"#a78bfa"}}>effective_weight</span>
              </div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}>
                {[1,2,3,4,5,6].map(l=>(
                  <div key={l} style={{background:LEVEL_COLOR[l]+"15",border:`1px solid ${LEVEL_COLOR[l]}30`,borderRadius:"5px",padding:"5px 10px",fontSize:"11px",fontFamily:"'DM Mono',monospace",color:LEVEL_COLOR[l]}}>
                    L{l} = {LEVEL_SCORE[l]}% anchor · {LEVEL_LABEL[l]}
                  </div>
                ))}
              </div>
              <div style={{fontSize:"11px",color:"#334155",fontFamily:"'DM Mono',monospace"}}>
                All-L3 = {LEVEL_SCORE[3]}% → "In Line With Expectations" &nbsp;·&nbsp; All-L5 = {LEVEL_SCORE[5]}% → "Significantly Above Expectations"
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{maxWidth:"960px",margin:"0 auto",padding:"20px 32px 32px"}}>

        {/* NYO info */}
        <div style={{background:"#04080f",border:"1px solid #0f2744",borderRadius:"7px",padding:"10px 14px",marginBottom:"16px",display:"flex",gap:"10px"}}>
          <span style={{fontSize:"13px"}}>ℹ</span>
          <div style={{fontSize:"12px",color:"#334155"}}>
            <span style={{color:"#3b82f6",fontFamily:"'DM Mono',monospace"}}>NYO</span>
            {" "}= Not Yet Observed. If no incidents occurred, mark those skills NYO — their weight redistributes proportionally to the skills you can fairly evaluate. No penalty, no inflation.
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
          {SKILLS.map((skill,idx)=>{
            const a=assessments[skill.id], isNyo=a?.nyo, level=a?.level;
            const effW=effectiveWeights[skill.id], isExpanded=expandedSkill===skill.id;
            const srcColor=SOURCE_COLOR[skill.dataSource]||"#475569";
            return (
              <div key={skill.id} className="srow" style={{background:isNyo?"#060b12":"#0a1220",border:`1px solid ${isNyo?"#0d1525":level?LEVEL_COLOR[level]+"35":"#0f1a2e"}`,borderRadius:"9px",padding:"14px 18px",opacity:isNyo?0.4:1}}>
                
                {/* Row */}
                <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                  <span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"#1e3a5f",minWidth:"22px"}}>{String(idx+1).padStart(2,"0")}</span>
                  <div style={{flex:1,minWidth:"150px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap"}}>
                      <span style={{fontWeight:"600",fontSize:"13.5px",color:isNyo?"#334155":"#e2e8f0"}}>{skill.name}</span>
                      <span style={{display:"inline-flex",alignItems:"center",padding:"1px 7px",borderRadius:"3px",fontSize:"10px",fontFamily:"'DM Mono',monospace",letterSpacing:"0.5px",background:srcColor+"12",color:srcColor,border:`1px solid ${srcColor}20`}}>
                        {skill.dataSource}
                      </span>
                    </div>
                    <div style={{fontSize:"10px",color:"#1e3a5f",fontFamily:"'DM Mono',monospace",marginTop:"2px"}}>
                      {isNyo?"weight redistributed":`eff. weight ${effW.toFixed(1)}% · raw ${weights[skill.id]}%`}
                    </div>
                  </div>

                  {/* Weight */}
                  <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                    <span style={{fontSize:"10px",color:"#1e3a5f",fontFamily:"'DM Mono',monospace"}}>w</span>
                    <input type="number" value={weights[skill.id]} onChange={e=>setWeight(skill.id,e.target.value)} min={0} max={50} disabled={isNyo}
                      style={{width:"44px",background:"#060b14",border:"1px solid #0f1a2e",borderRadius:"4px",color:"#7dd3fc",fontSize:"12px",padding:"3px 5px",fontFamily:"'DM Mono',monospace",opacity:isNyo?0.2:1,textAlign:"center"}}/>
                    <span style={{fontSize:"10px",color:"#1e3a5f",fontFamily:"'DM Mono',monospace"}}>%</span>
                  </div>

                  {/* 6 Level buttons */}
                  <div style={{display:"flex",gap:"4px"}}>
                    {[1,2,3,4,5,6].map(lvl=>(
                      <button key={lvl} className="lbtn" onClick={()=>setLevel(skill.id,lvl)} disabled={isNyo}
                        style={{width:"32px",height:"32px",borderRadius:"6px",background:level===lvl?LEVEL_COLOR[lvl]:"#0a1220",color:level===lvl?"#fff":"#1e3a5f",fontSize:"12px",fontWeight:"700",fontFamily:"'DM Mono',monospace",opacity:isNyo?0.2:1,boxShadow:level===lvl?`0 0 12px ${LEVEL_COLOR[lvl]}45`:"none",border:`1px solid ${level===lvl?"transparent":"#0f1a2e"}`}}>
                        {lvl}
                      </button>
                    ))}
                  </div>

                  <button className="nyob" onClick={()=>toggleNYO(skill.id)}
                    style={{padding:"5px 10px",borderRadius:"5px",background:isNyo?"#1c1007":"transparent",color:isNyo?"#f97316":"#1e3a5f",fontSize:"10px",letterSpacing:"1px",border:`1px solid ${isNyo?"#92400e":"#0f1a2e"}`}}>
                    NYO
                  </button>
                  <button onClick={()=>setExpandedSkill(isExpanded?null:skill.id)}
                    style={{background:"none",border:"none",color:"#1e3a5f",cursor:"pointer",fontSize:"11px",padding:"4px"}}>
                    {isExpanded?"▲":"▼"}
                  </button>
                </div>

                {/* Selected level capability */}
                {level&&!isNyo&&(
                  <div style={{marginTop:"9px",display:"flex",alignItems:"flex-start",gap:"10px",flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:"200px",fontSize:"12px",color:LEVEL_COLOR[level],background:LEVEL_COLOR[level]+"0d",border:`1px solid ${LEVEL_COLOR[level]}25`,borderLeft:`3px solid ${LEVEL_COLOR[level]}`,padding:"6px 10px",borderRadius:"0 5px 5px 0",lineHeight:"1.5",fontStyle:"italic"}}>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",opacity:0.6,display:"block",marginBottom:"2px",letterSpacing:"0.5px"}}>
                        L{level} · {LEVEL_LABEL[level]} · anchor {LEVEL_SCORE[level]}%
                      </span>
                      {skill.levels[level-1]}
                    </div>
                    <div style={{display:"inline-flex",alignItems:"center",gap:"5px",background:"#040810",border:"1px solid #0f1a2e",borderRadius:"5px",padding:"3px 9px",flexShrink:0,fontSize:"11px",fontFamily:"'DM Mono',monospace",color:"#475569",alignSelf:"center"}}>
                      <span style={{color:"#60a5fa"}}>{LEVEL_SCORE[level]}%</span>
                      <span>×</span>
                      <span style={{color:"#a78bfa"}}>{effW.toFixed(1)}%</span>
                      <span>÷100 =</span>
                      <span style={{color:LEVEL_COLOR[level],fontWeight:"700"}}>{contrib(level,effW).toFixed(2)}%</span>
                    </div>
                  </div>
                )}

                {/* Auto-signal from Automation Initiatives tracker */}
                {skill.id==="monitoring_observability" && autoStats && (
                  <div style={{marginTop:"8px",display:"flex",alignItems:"center",gap:"10px",padding:"6px 10px",background:"#040c1a",border:"1px dashed #0f2744",borderRadius:"6px",flexWrap:"wrap"}}>
                    <span style={{fontSize:"9px",fontFamily:"'DM Mono',monospace",color:"#3b82f6",letterSpacing:"1.5px",flexShrink:0}}>AUTO · INITIATIVES</span>
                    <span style={{fontSize:"11px",color:"#334155",flex:1}}>
                      {autoStats.done} delivered · {autoStats.inProg} in-progress · {autoStats.total} total
                    </span>
                    {autoLevel && assessments[skill.id]?.level !== autoLevel && (
                      <button onClick={()=>setLevel(skill.id,autoLevel)} style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",padding:"3px 9px",background:"#0f2744",border:"1px solid #3b82f6",borderRadius:"4px",color:"#60a5fa",cursor:"pointer",flexShrink:0}}>
                        Apply L{autoLevel} suggestion
                      </button>
                    )}
                    {autoLevel && assessments[skill.id]?.level === autoLevel && (
                      <span style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:"#22c55e",flexShrink:0}}>✓ auto-applied L{autoLevel}</span>
                    )}
                  </div>
                )}

                {/* Expanded level picker */}
                {isExpanded&&(
                  <div style={{marginTop:"14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
                    {skill.levels.map((desc,i)=>(
                      <div key={i} className="dcard" onClick={()=>setLevel(skill.id,i+1)}
                        style={{padding:"10px 12px",borderRadius:"7px",background:level===i+1?LEVEL_COLOR[i+1]+"12":"#060a12",border:`1px solid ${level===i+1?LEVEL_COLOR[i+1]+"45":"#0d1525"}`}}>
                        <div style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:LEVEL_COLOR[i+1],marginBottom:"5px",letterSpacing:"0.5px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"4px"}}>
                          <span>L{i+1} · {LEVEL_LABEL[i+1]}</span>
                          <span style={{opacity:0.7}}>anchor {LEVEL_SCORE[i+1]}% → {((LEVEL_SCORE[i+1]/100)*weights[skill.id]).toFixed(2)}%</span>
                        </div>
                        <div style={{fontSize:"12px",color:"#4b6278",lineHeight:"1.55"}}>{desc}</div>
                      </div>
                    ))}
                    {skill.nyo_reason&&(
                      <div style={{gridColumn:"1/-1",padding:"8px 12px",borderRadius:"6px",background:"#1c1007",border:"1px solid #78350f25",fontSize:"11px",color:"#78350f"}}>
                        <strong>NYO scenario:</strong> {skill.nyo_reason}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* SCORE BREAKDOWN */}
        {assessedSkills.length>0&&(
          <div style={{marginTop:"24px",background:"#0a1220",border:"1px solid #0f1a2e",borderRadius:"10px",padding:"20px"}}>
            <div style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:"#1e3a5f",letterSpacing:"2.5px",marginBottom:"16px"}}>
              SCORE BREAKDOWN — (level_anchor / 100) × effective_weight
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
              {assessedSkills.map(s=>{
                const lvl=assessments[s.id].level, effW=effectiveWeights[s.id], c=contrib(lvl,effW);
                return (
                  <div key={s.id}>
                    <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px"}}>
                      <span style={{width:"175px",fontSize:"12px",color:"#94a3b8",flexShrink:0}}>{s.name}</span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:"10px",color:"#334155",flex:1}}>
                        {LEVEL_SCORE[lvl]}% × {effW.toFixed(1)}% ÷ 100
                      </span>
                      <span style={{fontFamily:"'DM Mono',monospace",fontSize:"13px",color:LEVEL_COLOR[lvl],fontWeight:"700"}}>{c.toFixed(2)}%</span>
                    </div>
                    <div style={{height:"5px",background:"#060b12",borderRadius:"3px",overflow:"hidden"}}>
                      <div style={{width:`${(LEVEL_SCORE[lvl]/100)*100}%`,height:"100%",background:LEVEL_COLOR[lvl],borderRadius:"3px",transition:"width 0.4s ease"}}/>
                    </div>
                  </div>
                );
              })}
              <div style={{borderTop:"1px solid #0f1a2e",marginTop:"6px",paddingTop:"14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:"12px",color:"#334155"}}>
                    {assessedSkills.length} skills scored
                    {nyoSkills.length>0&&<span style={{color:"#78350f"}}> · {nyoSkills.length} NYO</span>}
                    {pendingSkills.length>0&&<span style={{color:"#f97316"}}> · {pendingSkills.length} unscored</span>}
                  </div>
                  <div style={{marginTop:"6px",display:"inline-flex",alignItems:"center",gap:"6px",background:interp.bg,border:`1px solid ${interp.border}`,borderRadius:"5px",padding:"3px 10px"}}>
                    <div style={{width:"6px",height:"6px",borderRadius:"2px",background:interp.color}}/>
                    <span style={{fontSize:"11px",color:interp.color,fontWeight:"600"}}>{interp.label}</span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:"36px",fontFamily:"'DM Mono',monospace",fontWeight:"700",lineHeight:1,color:interp.color}}>
                    {(Math.round(overallScore*100)/100).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SCALE */}
        <div style={{marginTop:"20px",background:"#0a1220",border:"1px solid #0f1a2e",borderRadius:"10px",padding:"16px 20px"}}>
          <ScaleLegend overallScore={overallScore} compact={false}/>
        </div>

        {/* LEVEL ANCHOR LEGEND */}
        <div style={{marginTop:"14px",display:"flex",gap:"5px",flexWrap:"wrap",justifyContent:"center"}}>
          {[1,2,3,4,5,6].map(l=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:"6px",background:"#0a1220",border:"1px solid #0f1a2e",borderRadius:"5px",padding:"4px 10px"}}>
              <div style={{width:"7px",height:"7px",borderRadius:"2px",background:LEVEL_COLOR[l]}}/>
              <span style={{fontSize:"10px",color:"#334155",fontFamily:"'DM Mono',monospace"}}>
                L{l} = {LEVEL_SCORE[l]}% · {LEVEL_LABEL[l]}
              </span>
            </div>
          ))}
        </div>

        {/* INTEGRATION ROADMAP */}
        <div style={{marginTop:"20px",background:"#040810",border:"1px dashed #0f2744",borderRadius:"10px",padding:"16px 20px"}}>
          <div style={{fontSize:"10px",fontFamily:"'DM Mono',monospace",color:"#1e3a5f",letterSpacing:"2.5px",marginBottom:"12px"}}>FUTURE INTEGRATIONS</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"10px"}}>
            {[
              {src:"PagerDuty",   skills:"Incident Response, Communication, Architecture", signal:"Auto-suggest levels from MTTA/MTTR, escalations, postmortems", color:"#818cf8"},
              {src:"Jira",        skills:"Troubleshooting, Architecture",                  signal:"Ticket complexity, velocity & resolution signals",             color:"#38bdf8"},
              {src:"Email / PDF", skills:"All skills",                                     signal:"Scorecard report → SendGrid / AWS SES",                       color:"#34d399"},
            ].map(item=>(
              <div key={item.src} style={{background:"#080d17",border:`1px solid ${item.color}18`,borderRadius:"7px",padding:"10px 12px"}}>
                <div style={{fontSize:"11px",fontFamily:"'DM Mono',monospace",color:item.color,marginBottom:"5px"}}>{item.src}</div>
                <div style={{fontSize:"10px",color:"#334155",marginBottom:"4px"}}>{item.skills}</div>
                <div style={{fontSize:"10px",color:"#1e3a5f",fontStyle:"italic"}}>{item.signal}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
