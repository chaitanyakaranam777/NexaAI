import React, {useEffect, useMemo, useState} from "react";
import {createRoot} from "react-dom/client";
import {Bot, MessageSquare, GitBranch, FileText, Activity, Settings2, Send, Sparkles, ShieldCheck, Zap, Copy, Check, Menu, X, Code2, BarChart3} from "lucide-react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const nav = [
  ["chat","AI Chat",MessageSquare],["compare","Model Compare",GitBranch],["review","Code Review",Code2],
  ["docs","Document AI",FileText],["observe","Observability",Activity]
];

function App(){
  const [page,setPage]=useState("chat"), [mobile,setMobile]=useState(false);
  const [models,setModels]=useState([]), [metrics,setMetrics]=useState({requests:0,avg_latency_ms:0,chat:0,compare:0,code_review:0,document:0});
  const [dark,setDark]=useState(true);
  useEffect(()=>{fetch(API+"/models").then(r=>r.json()).then(x=>setModels(x.providers)).catch(()=>{}); fetch(API+"/metrics").then(r=>r.json()).then(setMetrics).catch(()=>{})},[]);
  const current=nav.find(x=>x[0]===page);
  return <div className={dark?"app dark":"app"}>
    <aside className={mobile?"sidebar open":"sidebar"}>
      <div className="brand"><div className="brandmark"><Sparkles size={19}/></div><div><b>NEXA</b><span>AI WORKBENCH</span></div><button className="close" onClick={()=>setMobile(false)}><X/></button></div>
      <div className="workspace"><div className="avatar">CK</div><div><b>Engineering Lab</b><small>Personal workspace</small></div><span className="dot"/></div>
      <nav>{nav.map(([id,label,Icon])=><button className={page===id?"nav active":"nav"} onClick={()=>{setPage(id);setMobile(false)}} key={id}><Icon size={18}/><span>{label}</span>{id==="observe"&&<em>LIVE</em>}</button>)}</nav>
      <div className="sidecard"><ShieldCheck size={18}/><div><b>Private by design</b><p>API keys stay on the backend.</p></div></div>
      <div className="sidebottom"><button className="nav"><Settings2 size={18}/><span>Settings</span></button><button className="nav"><Zap size={18}/><span>API Playground</span></button></div>
    </aside>
    <main>
      <header><button className="hamb" onClick={()=>setMobile(true)}><Menu/></button><div><span className="eyebrow">AI ENGINEERING PLATFORM</span><h1>{current?.[1]}</h1></div><div className="header-actions"><span className="status"><i/> API ONLINE</span><button className="iconbtn" onClick={()=>setDark(!dark)}>{dark?"☼":"☾"}</button></div></header>
      <section className="content">
        {page==="chat"&&<Chat models={models}/>}
        {page==="compare"&&<Compare models={models}/>}
        {page==="review"&&<Review/>}
        {page==="docs"&&<Docs/>}
        {page==="observe"&&<Observe metrics={metrics}/>}
      </section>
    </main>
  </div>
}

function Select({value,onChange,models}){return <select value={value} onChange={e=>onChange(e.target.value)}>{(models.length?models:[{id:"demo",name:"NEXA Demo",model:"nexa-demo"}]).map(m=><option key={m.id} value={m.id}>{m.name} · {m.model}</option>)}</select>}

function Chat({models}){
  const [messages,setMessages]=useState([{role:"assistant",content:"Welcome to NEXA. I’m your AI engineering copilot. Ask me to architect a system, debug code, analyze a trade-off, or turn an idea into an implementation plan."}]);
  const [input,setInput]=useState(""),[provider,setProvider]=useState("demo"),[loading,setLoading]=useState(false),[copied,setCopied]=useState(false);
  async function send(){if(!input.trim()||loading)return; const q=input; setInput(""); setMessages(m=>[...m,{role:"user",content:q}]);setLoading(true);
    try{let r=await fetch(API+"/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:q,provider,model:models.find(x=>x.id===provider)?.model||"nexa-demo",history:messages})});let d=await r.json();setMessages(m=>[...m,{role:"assistant",content:d.answer,meta:`${d.latency_ms}ms · ${d.provider}`}])}catch(e){setMessages(m=>[...m,{role:"assistant",content:"Backend unavailable. Start FastAPI on port 8000."}])}finally{setLoading(false)}}
  return <div className="pagegrid"><div className="chatpanel card"><div className="paneltop"><div><b>Conversation</b><small>Provider-routed AI responses</small></div><Select value={provider} onChange={setProvider} models={models}/></div><div className="messages">{messages.map((m,i)=><div className={"msg "+m.role} key={i}><div className="msgavatar">{m.role==="assistant"?<Sparkles size={15}/>: "Y"}</div><div><div className="msgtext">{m.content}</div>{m.meta&&<small className="meta">{m.meta}</small>}</div></div>)}{loading&&<div className="msg assistant"><div className="msgavatar"><Sparkles size={15}/></div><div className="typing"><i/><i/><i/></div></div>}</div><div className="composer"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Ask NEXA anything… (Enter to send)"/><button onClick={send}><Send size={17}/></button></div></div>
    <aside className="rail"><div className="card mini"><div className="miniicon"><Zap/></div><b>Fast model routing</b><p>Switch providers without changing application code.</p></div><div className="card mini"><div className="miniicon"><BarChart3/></div><b>Built for evaluation</b><p>Latency and provider metadata are returned with every request.</p></div><div className="card promptcard"><span>TRY A PROMPT</span><button onClick={()=>setInput("Design a fault-tolerant real-time data pipeline for 10M events/day.")}>System architecture →</button><button onClick={()=>setInput("Review this Python code for performance, reliability and security.")}>Code review →</button><button onClick={()=>setInput("Explain CAP theorem using a production incident example.")}>Engineering concept →</button></div></aside></div>
}

function Compare({models}){
  const [prompt,setPrompt]=useState("Design a scalable event-driven data pipeline for 10 million events per day."),[left,setLeft]=useState("demo"),[right,setRight]=useState("demo"),[data,setData]=useState(null),[loading,setLoading]=useState(false);
  async function run(){setLoading(true);try{let r=await fetch(API+"/compare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt,left_provider:left,left_model:models.find(x=>x.id===left)?.model||"nexa-demo",right_provider:right,right_model:models.find(x=>x.id===right)?.model||"nexa-demo"})});setData(await r.json())}finally{setLoading(false)}}
  return <div><div className="hero card"><div><span className="eyebrow">EVALUATION LAB</span><h2>Compare models side-by-side.</h2><p>Same prompt, separate provider routes, measurable latency.</p></div><Sparkles size={46}/></div><div className="card formcard"><label>Evaluation prompt</label><textarea value={prompt} onChange={e=>setPrompt(e.target.value)}/><div className="twocol"><div><label>Left model</label><Select value={left} onChange={setLeft} models={models}/></div><div><label>Right model</label><Select value={right} onChange={setRight} models={models}/></div></div><button className="primary" onClick={run}>{loading?"Running evaluation…":"Run comparison"} <GitBranch size={17}/></button></div>{data&&<div className="twocol results"><Result title="MODEL A" data={data.left}/><Result title="MODEL B" data={data.right}/></div>}</div>
}
function Result({title,data}){return <div className="card result"><div className="resulthead"><b>{title}</b><span>{data.latency_ms} ms</span></div><div className="answer">{data.answer}</div></div>}

function Review(){
 const [code,setCode]=useState(`def get_users(users):\n    result = []\n    for user in users:\n        if user["active"]:\n            result.append(user)\n    return result`),[answer,setAnswer]=useState(""),[loading,setLoading]=useState(false);
 async function run(){setLoading(true);let r=await fetch(API+"/code-review",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({language:"python",code})});let d=await r.json();setAnswer(d.answer);setLoading(false)}
 return <div className="twocol reviewgrid"><div className="card editor"><div className="paneltop"><div><b>Code Review Lab</b><small>Paste production code for an engineering review</small></div><span className="lang">PYTHON</span></div><textarea className="codearea" value={code} onChange={e=>setCode(e.target.value)}/><button className="primary" onClick={run}>{loading?"Analyzing…":"Review code"} <Code2 size={17}/></button></div><div className="card result"><div className="resulthead"><b>AI ENGINEERING REPORT</b><span>quality · performance · security</span></div><div className="answer">{answer||"Your structured review will appear here. NEXA evaluates correctness, complexity, performance, security, maintainability, and testing strategy."}</div></div></div>
}

function Docs(){
 const [file,setFile]=useState(null),[q,setQ]=useState("Summarize the architecture and identify the most important engineering decisions."),[answer,setAnswer]=useState(""),[loading,setLoading]=useState(false);
 async function ask(){if(!file)return;setLoading(true);let fd=new FormData();fd.append("file",file);let r=await fetch(API+"/document/ask?question="+encodeURIComponent(q),{method:"POST",body:fd});let d=await r.json();setAnswer(d.answer);setLoading(false)}
 return <div className="pagegrid"><div className="card formcard"><div className="upload"><FileText size={28}/><b>{file?file.name:"Drop a document here"}</b><span>TXT or Markdown · up to 2 MB</span><input type="file" accept=".txt,.md" onChange={e=>setFile(e.target.files[0])}/></div><label>Your question</label><textarea value={q} onChange={e=>setQ(e.target.value)}/><button className="primary" disabled={!file} onClick={ask}>{loading?"Reading document…":"Ask document"} <Sparkles size={17}/></button></div><div className="card result"><div className="resulthead"><b>GROUNDED ANSWER</b><span>document context</span></div><div className="answer">{answer||"Upload a specification, README, design note, or text document and ask a question. The backend extracts the content and sends grounded context to the selected AI provider."}</div></div></div>
}

function Observe({metrics}){
 const cards=[["Total requests",metrics.requests],["Avg latency",`${metrics.avg_latency_ms||0} ms`],["Chat runs",metrics.chat],["Comparisons",metrics.compare],["Code reviews",metrics.code_review],["Document queries",metrics.document]];
 return <div><div className="hero card"><div><span className="eyebrow">SYSTEM OBSERVABILITY</span><h2>Know what your AI app is doing.</h2><p>Lightweight metrics returned directly from the FastAPI service.</p></div><Activity size={46}/></div><div className="metricgrid">{cards.map(c=><div className="card metric" key={c[0]}><small>{c[0]}</small><strong>{c[1]}</strong><span>live process metric</span></div>)}</div><div className="card architecture"><div><b>Production evolution</b><p>Redis → rate limits & sessions</p><p>PostgreSQL → users, prompts & evaluations</p><p>Object storage → document ingestion</p><p>OpenTelemetry → traces and provider latency</p></div><div className="pipeline"><span>UI</span><i>→</i><span>API</span><i>→</i><span>Gateway</span><i>→</i><span>Model</span></div></div></div>
}
createRoot(document.getElementById("root")).render(<App/>);
