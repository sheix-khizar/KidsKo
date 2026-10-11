import { useState, useEffect, useRef } from "react";

const T = {
  coral:"#FF6B6B", orange:"#FF9F43", sun:"#FFE66D",
  sky:"#4ECDC4", mint:"#95E1A3", blue:"#74B9FF",
  purple:"#A78BFA", pink:"#FD79A8", green:"#00B894",
  white:"#FFFFFF", bg:"#FFF8F0", text:"#2D3436", sub:"#636E72",
  border:"#F0E6D3",
  pNavy:"#1E3A5F", pBlue:"#2980B9",
};

const CHILD_COLORS = [
  {bg:"linear-gradient(135deg,#FF6B6B,#FF9F43)", emoji:"👧"},
  {bg:"linear-gradient(135deg,#4ECDC4,#74B9FF)", emoji:"👦"},
];

/* ── Phone shell ── */
function Phone({ children, bg = T.bg }) {
  return (
    <div style={{width:375,height:812,borderRadius:50,overflow:"hidden",display:"flex",flexDirection:"column",position:"relative",background:bg,fontFamily:"'Nunito',system-ui,sans-serif",boxShadow:"0 0 0 2px rgba(0,0,0,0.06),0 0 0 10px #1a1a1a,0 0 0 12px #2a2a2a,0 32px 80px rgba(0,0,0,0.5)"}}>
      <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:120,height:32,background:"#111",borderRadius:"0 0 20px 20px",zIndex:300}}/>
      {children}
    </div>
  );
}
function SBar({ color = T.text }) {
  return (
    <div style={{height:46,padding:"16px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,fontWeight:800,color,flexShrink:0,position:"relative",zIndex:5}}>
      <span>9:41</span><span>⚡ 100%</span>
    </div>
  );
}
function BottomNav({ active, setTab, onParents }) {
  return (
    <div style={{height:80,background:"#fff",borderTop:`2px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-around",flexShrink:0,paddingBottom:10,boxShadow:"0 -4px 20px rgba(0,0,0,0.06)"}}>
      {[{id:"chat",icon:"💬",label:"Chat"},{id:"call",icon:"📞",label:"Call"},{id:"parents",icon:"🔒",label:"Parents"}].map(t=>{
        const on=active===t.id;
        return (
          <button key={t.id} onClick={()=>t.id==="parents"?onParents():setTab(t.id)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:on?`${T.coral}18`:"transparent",border:"none",borderRadius:16,padding:"8px 20px",cursor:"pointer",position:"relative"}}>
            <span style={{fontSize:24}}>{t.icon}</span>
            <span style={{fontSize:11,fontWeight:800,color:on?T.coral:T.sub}}>{t.label}</span>
            {on&&<div style={{position:"absolute",bottom:-10,width:20,height:3,borderRadius:2,background:T.coral}}/>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Splash ── */
function Splash({ nav }) {
  return (
    <Phone bg="linear-gradient(160deg,#FFF0F5 0%,#FFF8F0 50%,#F0FFF4 100%)">
      <SBar/>
      <div style={{position:"absolute",width:200,height:200,borderRadius:"50%",background:"rgba(255,107,107,0.12)",filter:"blur(50px)",top:-40,right:-40,pointerEvents:"none"}}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 32px 40px",position:"relative",zIndex:2}}>
        <div style={{width:120,height:120,borderRadius:40,background:`linear-gradient(135deg,${T.coral},${T.orange})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:64,marginBottom:20,boxShadow:"0 12px 40px rgba(255,107,107,0.4)",animation:"owlBounce 3s ease-in-out infinite"}}>🦉</div>
        <div style={{fontSize:42,fontWeight:900,color:T.text,letterSpacing:-1,lineHeight:1}}>Kidsko<span style={{color:T.coral}}>.ai</span></div>
        <p style={{fontSize:15,fontWeight:700,color:T.sub,textAlign:"center",lineHeight:1.65,margin:"10px 0 40px"}}>Your friendly AI teacher! 🎓<br/>Ask me anything, anytime!</p>
        <button onClick={()=>nav("register")} style={{width:"100%",background:`linear-gradient(135deg,${T.coral},${T.orange})`,border:"none",borderRadius:24,padding:"18px 0",fontSize:18,fontWeight:900,color:"#fff",cursor:"pointer",marginBottom:14,boxShadow:"0 8px 28px rgba(255,107,107,0.45)"}}>🚀 Let's Start Learning!</button>
        <button onClick={()=>nav("login")} style={{width:"100%",background:"rgba(255,107,107,0.08)",border:`2px solid ${T.coral}40`,borderRadius:24,padding:"16px 0",fontSize:15,fontWeight:800,color:T.coral,cursor:"pointer"}}>I already have an account</button>
      </div>
    </Phone>
  );
}

/* ── Auth ── */
function AuthScreen({ mode, nav }) {
  const isReg=mode==="register";
  const [show,setShow]=useState({});
  const G="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath fill='%23EA4335' d='M24 9.5c3.5 0 6.6 1.2 9.1 3.2l6.8-6.8C35.8 2.5 30.3 0 24 0 14.8 0 7 5.4 3.2 13.3l7.9 6.1C13 13.7 18 9.5 24 9.5z'/%3E%3Cpath fill='%234285F4' d='M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.1z'/%3E%3Cpath fill='%23FBBC05' d='M11.1 28.6A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.2.8-4.6l-7.9-6.1A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l8.6-6.1z'/%3E%3Cpath fill='%2334A853' d='M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.2 1.5-5 2.3-8.3 2.3-6 0-11.1-4.1-12.9-9.5l-8.6 6.1C7 42.6 14.8 48 24 48z'/%3E%3C/svg%3E";
  const Field=({label,type,placeholder,id})=>(
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:13,fontWeight:800,color:T.sub,marginBottom:6}}>{label}</label>
      <div style={{position:"relative"}}>
        <input type={show[id]?"text":type} placeholder={placeholder} style={{width:"100%",background:"#FFF8F0",border:`2px solid ${T.border}`,borderRadius:16,padding:"14px 40px 14px 16px",fontFamily:"inherit",fontSize:15,fontWeight:600,color:T.text,outline:"none"}}/>
        {type==="password"&&<button onClick={()=>setShow(p=>({...p,[id]:!p[id]}))} style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:16}}>{show[id]?"🙈":"👁️"}</button>}
      </div>
    </div>
  );
  return (
    <Phone bg="#FFF8F0">
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{background:`linear-gradient(135deg,${T.coral},${T.orange})`,padding:"46px 22px 28px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <div style={{width:44,height:44,borderRadius:15,background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>🦉</div>
            <span style={{fontSize:20,fontWeight:900,color:"#fff"}}>Kidsko<span style={{color:T.sun}}>.ai</span></span>
          </div>
          <div style={{fontSize:26,fontWeight:900,color:"#fff"}}>{isReg?"Create your account! 🎉":"Welcome back! 👋"}</div>
          <p style={{fontSize:13,color:"rgba(255,255,255,0.8)",fontWeight:700,marginTop:4}}>{isReg?"Join thousands of young learners":"Let's keep learning today 📚"}</p>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"24px 22px 20px"}}>
          <button onClick={()=>nav("main")} style={{width:"100%",background:"#fff",border:`2px solid ${T.border}`,borderRadius:18,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"center",gap:10,cursor:"pointer",fontSize:15,fontWeight:800,color:T.text,marginBottom:18,boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>
            <img src={G} style={{width:22,height:22}} alt="G"/>{isReg?"Sign up with Google":"Continue with Google"}
          </button>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
            <div style={{flex:1,height:1.5,background:T.border}}/><span style={{fontSize:12,fontWeight:700,color:T.sub}}>or with email</span><div style={{flex:1,height:1.5,background:T.border}}/>
          </div>
          {isReg&&<Field label="Your Name" type="text" placeholder="e.g. Aisha" id="name"/>}
          <Field label="Email" type="email" placeholder="you@gmail.com" id="email"/>
          <Field label="Password" type="password" placeholder="Min 8 characters" id="pw"/>
          {isReg&&<Field label="Confirm Password" type="password" placeholder="Repeat password" id="cpw"/>}
          {!isReg&&<div style={{textAlign:"right",marginBottom:16,marginTop:-6}}><span style={{fontSize:13,fontWeight:700,color:T.coral,cursor:"pointer"}}>Forgot password?</span></div>}
          <button onClick={()=>nav("main")} style={{width:"100%",background:`linear-gradient(135deg,${T.coral},${T.orange})`,border:"none",borderRadius:20,padding:"16px 0",fontSize:17,fontWeight:900,color:"#fff",cursor:"pointer",boxShadow:"0 6px 20px rgba(255,107,107,0.4)",marginBottom:16}}>
            {isReg?"Create Account 🚀":"Sign In →"}
          </button>
          <p style={{textAlign:"center",fontSize:14,fontWeight:700,color:T.sub}}>
            {isReg?"Already have an account? ":"New here? "}
            <span onClick={()=>nav(isReg?"login":"register")} style={{color:T.coral,fontWeight:900,cursor:"pointer"}}>{isReg?"Sign In":"Create account"}</span>
          </p>
        </div>
      </div>
    </Phone>
  );
}

/* ── Main App ── */
function MainApp({ nav }) {
  const [tab,setTab]=useState("chat");
  const [showPin,setShowPin]=useState(false);
  const [showParents,setShowParents]=useState(false);
  const [children,setChildren]=useState([
    {name:"Aisha Khan",age:10,grade:"Grade 5",color:CHILD_COLORS[0]},
    {name:"Omar Khan",age:7,grade:"Grade 2",color:CHILD_COLORS[1]},
  ]);
  const [activeChild,setActiveChild]=useState(0);
  return (
    <Phone bg={T.bg}>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {tab==="chat"&&<ChatTab child={children[activeChild]}/>}
        {tab==="call"&&<CallTab child={children[activeChild]}/>}
        {showPin&&<PinModal onSuccess={()=>{setShowPin(false);setShowParents(true);}} onClose={()=>setShowPin(false)}/>}
        {showParents&&<ParentsDashboard children={children} setChildren={setChildren} activeChild={activeChild} setActiveChild={setActiveChild} onClose={()=>setShowParents(false)}/>}
        <BottomNav active={tab} setTab={setTab} onParents={()=>setShowPin(true)}/>
      </div>
    </Phone>
  );
}

/* ── Chat Tab ── */
function ChatTab({ child }) {
  const [sidebar,setSidebar]=useState(false);
  const [messages,setMessages]=useState([]);
  const [input,setInput]=useState("");
  const [typing,setTyping]=useState(false);
  const [imgPreview,setImgPreview]=useState(null);
  const fileRef=useRef();
  const endRef=useRef();
  const SUGGESTIONS=[{icon:"🌍",text:"Why is the sky blue?"},{icon:"🔢",text:"Help me with maths!"},{icon:"🦕",text:"Tell me about dinosaurs"},{icon:"🌱",text:"What is photosynthesis?"}];
  const RECENT=[{icon:"🔬",bg:"#FFE8E8",title:"What is photosynthesis?",preview:"Plants use sunlight…",time:"Now"},{icon:"🔢",bg:"#FFF4E0",title:"Explain fractions",preview:"A fraction is a part…",time:"1d"},{icon:"🌍",bg:"#E8F8F5",title:"Why is sky blue?",preview:"Sunlight scatters…",time:"2d"},{icon:"🦕",bg:"#F0E8FF",title:"About dinosaurs",preview:"65 million years ago…",time:"3d"}];
  const send=()=>{
    if(!input.trim()&&!imgPreview)return;
    setMessages(m=>[...m,{role:"me",text:input,img:imgPreview}]);
    setInput("");setImgPreview(null);
    setTyping(true);
    setTimeout(()=>{setMessages(m=>[...m,{role:"ai",text:`Great question ${child.name.split(" ")[0]}! 🌟\n\nLet me explain that simply!\n\nPlants are like tiny chefs 👨‍🍳 — they use sunlight ☀️, water 💧, and air 💨 to cook their own food. That's photosynthesis! 🌱`}]);setTyping(false);},2000);
  };
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"})},[messages,typing]);
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
      <SBar/>
      <div style={{height:56,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#fff",borderBottom:`2px solid ${T.border}`,flexShrink:0}}>
        <button onClick={()=>setSidebar(true)} style={{width:40,height:40,borderRadius:14,border:"none",background:T.bg,cursor:"pointer",display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"center",gap:5}}>
          {[22,14,22].map((w,i)=><span key={i} style={{width:w,height:2,background:T.text,borderRadius:2,display:"block"}}/>)}
        </button>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:34,height:34,borderRadius:12,background:child.color.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{child.color.emoji}</div>
          <div>
            <div style={{fontSize:14,fontWeight:900,color:T.text,lineHeight:1}}>{child.name.split(" ")[0]}<span style={{color:T.coral}}>'s Chat</span></div>
            <div style={{fontSize:10,fontWeight:700,color:T.mint,display:"flex",alignItems:"center",gap:3}}><div style={{width:6,height:6,borderRadius:"50%",background:T.mint}}/>Online</div>
          </div>
        </div>
        <button onClick={()=>setMessages([])} style={{width:40,height:40,borderRadius:14,border:"none",background:T.bg,fontSize:20,cursor:"pointer"}}>✏️</button>
      </div>
      {messages.length===0?(
        <div style={{flex:1,overflowY:"auto",padding:"20px 16px 10px",display:"flex",flexDirection:"column",alignItems:"center"}}>
          <div style={{width:"100%",background:child.color.bg,borderRadius:24,padding:"22px 20px",marginBottom:20,textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:8}}>🦉</div>
            <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>Hi {child.name.split(" ")[0]}! 👋</div>
            <p style={{fontSize:13,color:"rgba(255,255,255,0.85)",fontWeight:700,marginTop:4,lineHeight:1.5}}>I'm Kidsko! What do you want to learn today?</p>
          </div>
          <div style={{fontSize:12,fontWeight:800,color:T.sub,letterSpacing:0.5,textTransform:"uppercase",alignSelf:"flex-start",marginBottom:10}}>Try asking me...</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,width:"100%"}}>
            {SUGGESTIONS.map(s=>(
              <div key={s.text} onClick={()=>{setMessages([{role:"me",text:s.text}]);setTyping(true);setTimeout(()=>{setMessages(m=>[...m,{role:"ai",text:"Great question! Let me explain that in a fun way! 🌟"}]);setTyping(false);},1800);}} style={{background:"#fff",borderRadius:18,padding:"14px 12px",cursor:"pointer",border:`2px solid ${T.border}`,boxShadow:"0 3px 12px rgba(0,0,0,0.05)"}}>
                <span style={{fontSize:28,display:"block",marginBottom:6}}>{s.icon}</span>
                <span style={{fontSize:12,fontWeight:800,color:T.text,lineHeight:1.4}}>{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      ):(
        <div style={{flex:1,overflowY:"auto",padding:"16px 14px 10px",display:"flex",flexDirection:"column",gap:14}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:"flex",flexDirection:m.role==="me"?"row-reverse":"row",gap:8,alignItems:"flex-end",maxWidth:"88%",alignSelf:m.role==="me"?"flex-end":"flex-start"}}>
              <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,background:m.role==="ai"?`linear-gradient(135deg,${T.coral},${T.orange})`:child.color.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:m.role==="ai"?16:14,fontWeight:900,color:"#fff"}}>
                {m.role==="ai"?"🦉":child.color.emoji}
              </div>
              <div style={{padding:"13px 16px",borderRadius:22,fontSize:14,fontWeight:600,lineHeight:1.65,background:m.role==="ai"?"#fff":`linear-gradient(135deg,${T.sky},${T.blue})`,color:m.role==="ai"?T.text:"#fff",borderBottomLeftRadius:m.role==="ai"?6:22,borderBottomRightRadius:m.role==="me"?6:22,boxShadow:"0 3px 12px rgba(0,0,0,0.08)"}}>
                {m.img&&<img src={m.img} style={{width:"100%",borderRadius:12,marginBottom:8,display:"block"}} alt="upload"/>}
                {m.text.split("\n").map((l,j)=><span key={j}>{l}<br/></span>)}
              </div>
            </div>
          ))}
          {typing&&(
            <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${T.coral},${T.orange})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🦉</div>
              <div style={{background:"#fff",borderRadius:22,borderBottomLeftRadius:6,padding:"14px 18px",display:"flex",gap:5,boxShadow:"0 3px 12px rgba(0,0,0,0.08)"}}>
                {[0,.2,.4].map((d,i)=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:T.coral,animation:`typingDot 1.2s ${d}s ease-in-out infinite`}}/>)}
              </div>
            </div>
          )}
          <div ref={endRef}/>
        </div>
      )}
      {imgPreview&&(
        <div style={{background:"#fff",borderTop:`2px solid ${T.border}`,padding:"8px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
          <img src={imgPreview} style={{width:48,height:48,borderRadius:12,objectFit:"cover"}} alt="p"/>
          <div><p style={{fontSize:12,fontWeight:800,color:T.text}}>📸 Photo ready!</p><span style={{fontSize:11,color:T.sub,fontWeight:600}}>Type your question and send</span></div>
          <button onClick={()=>setImgPreview(null)} style={{marginLeft:"auto",width:26,height:26,background:"#FFE0E0",border:"none",borderRadius:"50%",color:"#EF4444",fontSize:13,cursor:"pointer",fontWeight:900}}>✕</button>
        </div>
      )}
      <div style={{padding:"10px 12px 16px",background:"#fff",borderTop:`2px solid ${T.border}`,flexShrink:0}}>
        <div style={{background:T.bg,borderRadius:28,display:"flex",alignItems:"center",gap:6,padding:"8px 8px 8px 16px",border:`2px solid ${input?T.coral+"60":T.border}`,transition:"border .2s"}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Ask me anything... 😊" style={{flex:1,background:"transparent",border:"none",outline:"none",fontFamily:"inherit",fontSize:15,fontWeight:600,color:T.text,padding:"4px 0"}}/>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            <input ref={fileRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setImgPreview(ev.target.result);r.readAsDataURL(f);}} style={{display:"none"}}/>
            <button onClick={()=>fileRef.current.click()} style={{width:38,height:38,borderRadius:"50%",border:"none",background:T.bg,fontSize:18,cursor:"pointer"}}>📷</button>
            <button onClick={send} style={{width:38,height:38,background:input||imgPreview?`linear-gradient(135deg,${T.coral},${T.orange})`:"#E0E0E0",border:"none",borderRadius:"50%",color:"#fff",fontSize:16,cursor:"pointer",transition:"background .15s",display:"flex",alignItems:"center",justifyContent:"center"}}>➤</button>
          </div>
        </div>
      </div>
      {sidebar&&<div onClick={()=>setSidebar(false)} style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.45)",zIndex:50,backdropFilter:"blur(3px)"}}/>}
      <div style={{position:"absolute",top:0,left:sidebar?0:-295,bottom:0,width:295,background:"#fff",zIndex:60,transition:"left .26s cubic-bezier(.4,0,.2,1)",display:"flex",flexDirection:"column",borderRight:`2px solid ${T.border}`}}>
        <div style={{background:child.color.bg,padding:"50px 16px 20px",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:50,height:50,borderRadius:18,background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{child.color.emoji}</div>
            <div><div style={{fontSize:16,fontWeight:900,color:"#fff"}}>{child.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.75)",fontWeight:700}}>{child.grade}</div></div>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"10px 10px"}}>
          <button onClick={()=>{setSidebar(false);setMessages([]);}} style={{width:"100%",background:`${T.coral}15`,border:`2px dashed ${T.coral}40`,borderRadius:16,padding:"12px",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:"pointer",fontSize:14,fontWeight:800,color:T.coral,marginBottom:14}}>✏️ New Chat</button>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:1,textTransform:"uppercase",color:T.sub,padding:"4px 6px 8px"}}>Recent Chats</div>
          {RECENT.map((c,i)=>(
            <button key={i} onClick={()=>setSidebar(false)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 10px",borderRadius:14,cursor:"pointer",border:"none",background:i===0?`${T.coral}10`:"transparent",width:"100%",textAlign:"left",marginBottom:2}}>
              <div style={{width:38,height:38,borderRadius:12,background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{c.icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:800,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.title}</div>
                <div style={{fontSize:11,fontWeight:600,color:T.sub,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.preview}</div>
              </div>
              <span style={{fontSize:10,fontWeight:700,color:T.sub,flexShrink:0}}>{c.time}</span>
            </button>
          ))}
        </div>
        <div style={{padding:"12px 10px 20px",borderTop:`2px solid ${T.border}`,flexShrink:0}}>
          {[{icon:"⚙️",bg:"#F0F4FF",label:"Settings"},{icon:"🚪",bg:"#FFF0F0",label:"Sign Out",danger:true}].map(b=>(
            <button key={b.label} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 10px",borderRadius:14,border:"none",background:"transparent",cursor:"pointer",width:"100%",textAlign:"left"}}>
              <div style={{width:34,height:34,borderRadius:10,background:b.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17}}>{b.icon}</div>
              <span style={{fontSize:14,fontWeight:700,color:b.danger?"#EF4444":T.text}}>{b.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   CALL TAB — Voice + AI Vision
══════════════════════════════════════════════ */
function CallTab({ child }) {
  const [screen, setScreen] = useState("home"); // home | voice | vision-loading | vision

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {screen==="home"       && <CallHome child={child} setScreen={setScreen}/>}
      {screen==="voice"      && <VoiceCall child={child} onBack={()=>setScreen("home")}/>}
      {screen==="vision-loading" && <VisionLoading onReady={()=>setScreen("vision")} onBack={()=>setScreen("home")}/>}
      {screen==="vision"     && <VisionCall child={child} onBack={()=>setScreen("home")}/>}
    </div>
  );
}

/* ── Call Home ── */
function CallHome({ child, setScreen }) {
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:`linear-gradient(160deg,#1a1a2e,#16213e,#0f3460)`,position:"relative"}}>
      <SBar color="rgba(255,255,255,0.6)"/>
      <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",background:`radial-gradient(circle,rgba(255,107,107,0.12) 0%,transparent 70%)`,top:"35%",left:"50%",transform:"translate(-50%,-50%)",pointerEvents:"none"}}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"0 28px 20px",position:"relative",zIndex:2}}>
        {/* Owl */}
        <div style={{width:100,height:100,borderRadius:36,background:`linear-gradient(135deg,${T.coral},${T.orange})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:54,marginBottom:18,boxShadow:"0 12px 40px rgba(255,107,107,0.45)",animation:"owlBounce 4s ease-in-out infinite"}}>🦉</div>
        <div style={{fontSize:24,fontWeight:900,color:"#fff",marginBottom:6}}>Talk to Kidsko!</div>
        <p style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.5)",textAlign:"center",marginBottom:36,lineHeight:1.6}}>Choose how you want to talk to me today 👇</p>

        {/* Voice Call Card */}
        <div onClick={()=>setScreen("voice")} style={{width:"100%",background:"rgba(255,255,255,0.07)",border:"1.5px solid rgba(255,255,255,0.1)",borderRadius:24,padding:"20px 18px",marginBottom:14,cursor:"pointer",display:"flex",alignItems:"center",gap:16,transition:"all .2s",backdropFilter:"blur(8px)"}}>
          <div style={{width:58,height:58,borderRadius:20,background:`linear-gradient(135deg,${T.coral},${T.orange})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,flexShrink:0,boxShadow:"0 6px 20px rgba(255,107,107,0.4)"}}>🎤</div>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:900,color:"#fff",marginBottom:3}}>Voice Call</div>
            <p style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>Talk and listen to Kidsko<br/>like a phone call 📞</p>
          </div>
          <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.4)",fontSize:18,flexShrink:0}}>›</div>
        </div>

        {/* AI Vision Card — the new feature */}
        <div onClick={()=>setScreen("vision-loading")} style={{width:"100%",background:"rgba(78,205,196,0.08)",border:"1.5px solid rgba(78,205,196,0.25)",borderRadius:24,padding:"20px 18px",cursor:"pointer",display:"flex",alignItems:"center",gap:16,backdropFilter:"blur(8px)"}}>
          <div style={{width:58,height:58,borderRadius:20,background:`linear-gradient(135deg,${T.sky},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,flexShrink:0,boxShadow:"0 6px 20px rgba(78,205,196,0.4)"}}>👁️</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              <div style={{fontSize:17,fontWeight:900,color:"#fff"}}>AI Vision</div>
              <div style={{background:`linear-gradient(135deg,${T.sky},${T.blue})`,borderRadius:8,padding:"2px 8px",fontSize:10,fontWeight:900,color:"#fff"}}>NEW ✨</div>
            </div>
            <p style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.5)",lineHeight:1.5}}>Point your camera at anything<br/>Kidsko will explain it! 📷🔍</p>
          </div>
          <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(78,205,196,0.1)",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(78,205,196,0.6)",fontSize:18,flexShrink:0}}>›</div>
        </div>

        {/* Tip */}
        <div style={{marginTop:24,background:"rgba(255,255,255,0.05)",borderRadius:16,padding:"12px 16px",width:"100%",display:"flex",gap:10,alignItems:"center"}}>
          <span style={{fontSize:20}}>💡</span>
          <p style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.45)",lineHeight:1.5}}>Tip: Use <b style={{color:"rgba(78,205,196,0.8)"}}>AI Vision</b> to point at your homework and Kidsko will help you solve it!</p>
        </div>
      </div>
    </div>
  );
}

/* ── Vision Loading ── */
function VisionLoading({ onReady, onBack }) {
  const [step, setStep] = useState(0);
  const steps = [
    {icon:"📷", text:"Accessing camera..."},
    {icon:"🔗", text:"Connecting to Kidsko AI..."},
    {icon:"🧠", text:"Loading AI Vision..."},
    {icon:"✅", text:"Ready! Starting..."},
  ];

  useEffect(()=>{
    const intervals = steps.map((_,i)=>setTimeout(()=>setStep(i), i*900));
    const done = setTimeout(onReady, steps.length*900+400);
    return ()=>{intervals.forEach(clearTimeout);clearTimeout(done);};
  },[]);

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"#0a0a14",position:"relative",overflow:"hidden"}}>
      {/* Animated background rings */}
      {[280,220,160].map((s,i)=>(
        <div key={s} style={{position:"absolute",width:s,height:s,borderRadius:"50%",border:`1.5px solid rgba(78,205,196,${0.08+i*0.06})`,animation:`ringPulse 2s ${i*0.4}s ease-in-out infinite`,pointerEvents:"none"}}/>
      ))}

      <SBar color="rgba(255,255,255,0.4)"/>

      <button onClick={onBack} style={{position:"absolute",top:50,left:20,width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.07)",border:"none",color:"rgba(255,255,255,0.6)",fontSize:18,cursor:"pointer",zIndex:10}}>‹</button>

      <div style={{position:"relative",zIndex:2,display:"flex",flexDirection:"column",alignItems:"center"}}>
        {/* Big animated camera icon */}
        <div style={{width:120,height:120,borderRadius:40,background:`linear-gradient(135deg,${T.sky},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:60,marginBottom:32,boxShadow:"0 16px 48px rgba(78,205,196,0.45)",animation:"pulse 1.5s ease-in-out infinite"}}>👁️</div>

        <div style={{fontSize:22,fontWeight:900,color:"#fff",marginBottom:8}}>AI Vision</div>
        <p style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.45)",marginBottom:36,textAlign:"center"}}>Getting everything ready for you...</p>

        {/* Steps */}
        <div style={{display:"flex",flexDirection:"column",gap:14,width:260}}>
          {steps.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,opacity:step>=i?1:0.25,transition:"opacity .4s"}}>
              <div style={{width:38,height:38,borderRadius:14,background:step>i?"rgba(78,205,196,0.2)":step===i?"rgba(78,205,196,0.12)":"rgba(255,255,255,0.05)",border:`1.5px solid ${step>=i?"rgba(78,205,196,0.4)":"rgba(255,255,255,0.06)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"all .4s",flexShrink:0}}>
                {step>i?"✅":s.icon}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:step>=i?"#fff":"rgba(255,255,255,0.3)",transition:"color .4s"}}>{s.text}</div>
                {step===i&&<div style={{height:3,borderRadius:2,background:`linear-gradient(90deg,${T.sky},${T.blue})`,marginTop:5,animation:"loadBar 0.9s ease-out forwards"}}/>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── AI Vision Call ── */
function VisionCall({ child, onBack }) {
  const videoRef = useRef();
  const streamRef = useRef();
  const [camActive, setCamActive] = useState(false);
  const [camError, setCamError] = useState(false);
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [aiMessage, setAiMessage] = useState("Point your camera at anything and I'll tell you about it! 🔍");
  const [aiThinking, setAiThinking] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState(null);
  const [flashVisible, setFlashVisible] = useState(false);
  const canvasRef = useRef();
  const timerRef = useRef();
  const aiRef = useRef();
  const fileRef = useRef();

  const AI_RESPONSES = [
    "Oh wow! 🌟 That looks like a textbook! I can see some words and pictures. Want me to explain what's on this page?",
    "I can see a plant! 🌱 Plants are amazing — they make their own food using sunlight. This one looks healthy!",
    "That looks like a math problem! 🔢 I can see some numbers. Let me help you solve it step by step!",
    "I see what looks like an animal! 🐾 Animals are so interesting. This one looks really cool — want to learn more?",
    "That's a really interesting object! ✨ I'm analyzing it right now. It has some very cool features I can tell you about!",
    "I can see some writing! 📝 Let me read it for you and explain what it means in a simple way!",
    "Ooh, that looks colorful! 🎨 I can see lots of different things here. Point closer and I'll tell you more!",
  ];

  useEffect(()=>{
    startCamera();
    timerRef.current=setInterval(()=>setSeconds(s=>s+1),1000);
    return ()=>{
      streamRef.current?.getTracks().forEach(t=>t.stop());
      clearInterval(timerRef.current);
      clearInterval(aiRef.current);
    };
  },[]);

  const startCamera=async()=>{
    try {
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"},audio:true});
      streamRef.current=stream;
      if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play();}
      setCamActive(true);
      // Auto AI responses every few seconds
      aiRef.current=setInterval(()=>{
        setScanning(true);
        setTimeout(()=>{
          setScanning(false);
          setAiThinking(true);
          setTimeout(()=>{
            setAiThinking(false);
            setAiMessage(AI_RESPONSES[Math.floor(Math.random()*AI_RESPONSES.length)]);
          },1200);
        },800);
      },6000);
    } catch {
      setCamError(true);
    }
  };

  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const captureAndAnalyze=()=>{
    setFlashVisible(true);
    setTimeout(()=>setFlashVisible(false),200);
    // Simulate frame capture
    setScanning(true);
    setAiThinking(false);
    setTimeout(()=>{
      setScanning(false);
      setAiThinking(true);
      setTimeout(()=>{
        setAiThinking(false);
        setAiMessage(AI_RESPONSES[Math.floor(Math.random()*AI_RESPONSES.length)]);
      },1400);
    },600);
  };

  const handleUpload=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      setCapturedFrame(ev.target.result);
      setScanning(true);
      setTimeout(()=>{setScanning(false);setAiThinking(true);setTimeout(()=>{setAiThinking(false);setAiMessage(AI_RESPONSES[Math.floor(Math.random()*AI_RESPONSES.length)]);},1400);},600);
    };
    r.readAsDataURL(f);
  };

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#000",position:"relative"}}>

      {/* Camera feed — full screen */}
      <div style={{position:"absolute",inset:0,background:"#111",zIndex:0}}>
        {camActive&&!camError?(
          <video ref={videoRef} style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.92}} autoPlay muted={muted} playsInline/>
        ):(
          /* Simulated camera view when no real camera */
          <div style={{width:"100%",height:"100%",background:"linear-gradient(160deg,#0a0a14,#0f1a2e)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
            <div style={{fontSize:64,animation:"owlBounce 3s ease-in-out infinite"}}>📷</div>
            <div style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.4)",textAlign:"center",padding:"0 40px",lineHeight:1.6}}>
              {camError?"Camera not available in this browser.\nUse Upload button to share a photo!":"Loading camera..."}
            </div>
          </div>
        )}

        {/* Captured frame overlay */}
        {capturedFrame&&(
          <div style={{position:"absolute",inset:0,background:"#000",zIndex:1}}>
            <img src={capturedFrame} style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.85}} alt="captured"/>
            <button onClick={()=>setCapturedFrame(null)} style={{position:"absolute",top:60,right:16,width:34,height:34,borderRadius:"50%",background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",fontSize:16,cursor:"pointer",zIndex:2}}>✕</button>
          </div>
        )}
      </div>

      {/* Flash effect on capture */}
      {flashVisible&&<div style={{position:"absolute",inset:0,background:"rgba(255,255,255,0.8)",zIndex:50,pointerEvents:"none"}}/>}

      {/* Scanning overlay */}
      {scanning&&(
        <div style={{position:"absolute",inset:0,zIndex:10,pointerEvents:"none"}}>
          {/* Scan line */}
          <div style={{position:"absolute",left:24,right:24,height:2,background:`linear-gradient(90deg,transparent,${T.sky},transparent)`,animation:"scanLine 0.8s ease-in-out",top:"50%"}}/>
          {/* Corner brackets */}
          {[[24,60],[null,60],[24,null],[null,null]].map(([l,r],i)=>(
            <div key={i} style={{position:"absolute",width:30,height:30,top:i<2?60:undefined,bottom:i>=2?100:undefined,left:l!==null?l:undefined,right:r!==null?r:undefined,borderTop:i<2?`3px solid ${T.sky}`:undefined,borderBottom:i>=2?`3px solid ${T.sky}`:undefined,borderLeft:l!==null?`3px solid ${T.sky}`:undefined,borderRight:r!==null?`3px solid ${T.sky}`:undefined}}/>
          ))}
          <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",marginTop:20,background:"rgba(78,205,196,0.15)",borderRadius:12,padding:"6px 16px",border:`1px solid rgba(78,205,196,0.4)`}}>
            <span style={{fontSize:12,fontWeight:800,color:T.sky}}>Scanning... 🔍</span>
          </div>
        </div>
      )}

      {/* Status bar */}
      <div style={{position:"absolute",top:0,left:0,right:0,zIndex:20}}>
        <div style={{height:46,padding:"16px 24px 0",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.7)"}}>
          <span>9:41</span><span>⚡ 100%</span>
        </div>
      </div>

      {/* Top bar */}
      <div style={{position:"absolute",top:44,left:0,right:0,zIndex:20,padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <button onClick={onBack} style={{width:38,height:38,borderRadius:"50%",background:"rgba(0,0,0,0.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>

        {/* Live badge + timer */}
        <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,0,0,0.55)",borderRadius:20,padding:"6px 14px",backdropFilter:"blur(8px)"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#EF4444",animation:"liveDot 1.2s infinite"}}/>
          <span style={{fontSize:12,fontWeight:800,color:"#fff"}}>AI VISION</span>
          <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.55)"}}>{fmt(seconds)}</span>
        </div>

        {/* Mute */}
        <button onClick={()=>setMuted(m=>!m)} style={{width:38,height:38,borderRadius:"50%",background:muted?"rgba(239,68,68,0.7)":"rgba(0,0,0,0.5)",border:"none",color:"#fff",fontSize:18,cursor:"pointer",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {muted?"🔇":"🎤"}
        </button>
      </div>

      {/* Owl avatar — small, floating top-right corner like WhatsApp PiP */}
      <div style={{position:"absolute",top:100,right:14,zIndex:30,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
        <div style={{width:72,height:72,borderRadius:22,background:`linear-gradient(135deg,${T.sky},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,border:"2px solid rgba(255,255,255,0.3)",boxShadow:"0 8px 24px rgba(78,205,196,0.4)",position:"relative"}}>
          🦉
          {/* Thinking indicator */}
          {aiThinking&&(
            <div style={{position:"absolute",bottom:-4,left:"50%",transform:"translateX(-50%)",display:"flex",gap:3,background:"rgba(0,0,0,0.7)",borderRadius:10,padding:"3px 6px"}}>
              {[0,.2,.4].map((d,i)=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:T.sky,animation:`typingDot 1s ${d}s ease-in-out infinite`}}/>)}
            </div>
          )}
        </div>
        <div style={{background:"rgba(0,0,0,0.6)",borderRadius:8,padding:"2px 8px",backdropFilter:"blur(6px)"}}>
          <span style={{fontSize:10,fontWeight:800,color:T.sky}}>Kidsko</span>
        </div>
      </div>

      {/* AI speech bubble — bottom center, above controls */}
      <div style={{position:"absolute",bottom:160,left:14,right:14,zIndex:20}}>
        <div style={{background:"rgba(10,10,20,0.82)",borderRadius:20,padding:"14px 16px",backdropFilter:"blur(16px)",border:"1px solid rgba(78,205,196,0.2)",boxShadow:"0 8px 32px rgba(0,0,0,0.4)"}}>
          {/* Owl label */}
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
            <div style={{width:22,height:22,borderRadius:8,background:`linear-gradient(135deg,${T.sky},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🦉</div>
            <span style={{fontSize:11,fontWeight:800,color:T.sky,letterSpacing:0.3}}>KIDSKO SAYS</span>
            {scanning&&<span style={{fontSize:10,fontWeight:700,color:"rgba(78,205,196,0.6)",marginLeft:"auto"}}>Scanning... 🔍</span>}
            {aiThinking&&<span style={{fontSize:10,fontWeight:700,color:"rgba(78,205,196,0.6)",marginLeft:"auto"}}>Thinking... 🧠</span>}
          </div>
          <p style={{fontSize:14,fontWeight:700,color:"rgba(255,255,255,0.9)",lineHeight:1.6,margin:0}}>
            {aiThinking?"...":`"${aiMessage}"`}
          </p>
        </div>

        {/* Quick reply chips */}
        <div style={{display:"flex",gap:7,marginTop:8,overflowX:"auto"}}>
          {["Tell me more! 🗣️","How does it work? ⚙️","Is it alive? 🌱","What's it called? 🏷️"].map(c=>(
            <div key={c} onClick={captureAndAnalyze} style={{flexShrink:0,background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.18)",borderRadius:20,padding:"7px 13px",fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.85)",cursor:"pointer",whiteSpace:"nowrap",backdropFilter:"blur(6px)"}}>{c}</div>
          ))}
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,zIndex:20,padding:"12px 28px 28px",background:"linear-gradient(0deg,rgba(0,0,0,0.85) 0%,transparent 100%)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:20}}>

          {/* Upload photo */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{display:"none"}}/>
            <button onClick={()=>fileRef.current.click()} style={{width:52,height:52,borderRadius:"50%",border:"2px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>🖼️</button>
            <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>Upload</span>
          </div>

          {/* CAPTURE — big center button */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <button onClick={captureAndAnalyze} style={{width:76,height:76,borderRadius:"50%",border:"4px solid rgba(255,255,255,0.9)",background:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"transform .13s"}}>
              <div style={{width:62,height:62,borderRadius:"50%",background:"rgba(255,255,255,0.9)"}}/>
            </button>
            <span style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.7)"}}>Ask Kidsko 👁️</span>
          </div>

          {/* End call */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <button onClick={onBack} style={{width:52,height:52,borderRadius:"50%",border:"none",background:"#EF4444",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 6px 20px rgba(239,68,68,0.55)"}}>📵</button>
            <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,0.5)"}}>End</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Voice Call ── */
function VoiceCall({ child, onBack }) {
  const [status,setStatus]=useState("idle");
  const [seconds,setSeconds]=useState(0);
  const [muted,setMuted]=useState(false);
  const [speaker,setSpeaker]=useState(true);
  const timerRef=useRef();
  const BARS=[8,14,22,28,20,28,18,12,6];
  const fmt=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  const start=()=>{
    setStatus("connecting");
    setTimeout(()=>{setStatus("active");timerRef.current=setInterval(()=>setSeconds(s=>s+1),1000);},2000);
  };
  const end=()=>{setStatus("idle");setSeconds(0);clearInterval(timerRef.current);onBack();};
  useEffect(()=>()=>clearInterval(timerRef.current),[]);

  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"linear-gradient(160deg,#1a1a2e,#16213e,#0f3460)",position:"relative"}}>
      <SBar color="rgba(255,255,255,0.6)"/>
      <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",background:`radial-gradient(circle,rgba(255,107,107,0.18) 0%,transparent 70%)`,top:"50%",left:"50%",transform:"translate(-50%,-50%)",animation:"orbPulse 3s ease-in-out infinite",pointerEvents:"none"}}/>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 20px 0",flexShrink:0,position:"relative",zIndex:5}}>
        <button onClick={onBack} style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"none",fontSize:18,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
        <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,0.12)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:20,padding:"6px 14px"}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:T.mint,animation:"liveDot 1.5s infinite"}}/>
          <span style={{fontSize:12,fontWeight:700,color:T.mint}}>{status==="active"?"Listening...":status==="connecting"?"Connecting...":"Voice Call"}</span>
        </div>
        <button style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.08)",border:"none",fontSize:18,cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>⋮</button>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",zIndex:5,padding:"10px 0 0"}}>
        <div style={{position:"relative",width:200,height:200,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
          {status==="active"&&[200,162,126].map((s,i)=>(
            <div key={s} style={{position:"absolute",width:s,height:s,borderRadius:"50%",border:`2px solid rgba(255,107,107,${0.2+i*0.12})`,animation:`ringPulse 2.5s ${i*0.35}s ease-in-out infinite`}}/>
          ))}
          <div style={{width:110,height:110,borderRadius:"50%",background:`linear-gradient(135deg,${T.coral},${T.orange})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:58,boxShadow:"0 12px 48px rgba(255,107,107,0.55)",border:"4px solid rgba(255,255,255,0.15)",position:"relative",zIndex:2}}>🦉</div>
          {status==="active"&&(
            <div style={{position:"absolute",bottom:-16,left:"50%",transform:"translateX(-50%)",display:"flex",alignItems:"flex-end",gap:3,height:32,zIndex:3}}>
              {BARS.map((h,i)=><div key={i} style={{width:4,borderRadius:4,background:T.coral,height:h,animation:`waveBar 1s ${i*0.1}s ease-in-out infinite`}}/>)}
            </div>
          )}
        </div>
        <div style={{fontSize:26,fontWeight:900,color:"#fff"}}>Kidsko<span style={{color:T.coral}}>.ai</span></div>
        <p style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.55)",marginTop:4}}>AI Study Buddy · Voice Mode</p>
        {status==="active"&&<div style={{fontSize:18,fontWeight:800,color:"rgba(255,255,255,0.4)",marginTop:8,letterSpacing:2}}>{fmt(seconds)}</div>}
        {status==="active"&&(
          <>
            <div style={{margin:"14px 20px 0",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:18,padding:"13px 15px",width:"100%",maxWidth:320}}>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:1,textTransform:"uppercase",color:"rgba(255,255,255,0.3)",marginBottom:5}}>Kidsko says</div>
              <p style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.75)",lineHeight:1.55}}>
                "Photosynthesis is how plants make their own <span style={{color:T.coral}}>food</span> using sunlight, water and air..."
              </p>
            </div>
            <div style={{display:"flex",gap:7,marginTop:10,overflowX:"auto",width:"100%",padding:"0 20px"}}>
              {["Repeat 🔁","Simpler 🧒","Example 💡","Next ▶️"].map(c=>(
                <div key={c} style={{flexShrink:0,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:20,padding:"7px 14px",fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.85)",cursor:"pointer",whiteSpace:"nowrap"}}>{c}</div>
              ))}
            </div>
          </>
        )}
      </div>
      <div style={{padding:"14px 20px 20px",flexShrink:0,position:"relative",zIndex:5}}>
        {status==="idle"?(
          <button onClick={start} style={{width:"100%",background:`linear-gradient(135deg,${T.coral},${T.orange})`,border:"none",borderRadius:28,padding:"20px 0",fontSize:18,fontWeight:900,color:"#fff",cursor:"pointer",boxShadow:"0 10px 32px rgba(255,107,107,0.55)",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>📞 Start Voice Call</button>
        ):status==="connecting"?(
          <div style={{textAlign:"center",color:"rgba(255,255,255,0.5)",fontSize:14,fontWeight:700,padding:"20px 0"}}>Connecting to Kidsko...</div>
        ):(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:14}}>
            {[
              {icon:muted?"🔇":"🎙️",label:"Mute",bg:muted?"rgba(239,68,68,0.3)":"rgba(255,255,255,0.1)",fn:()=>setMuted(m=>!m),size:52},
              {icon:"⏸",label:"Pause",bg:"rgba(255,255,255,0.1)",fn:()=>{},size:52},
              {icon:"📵",label:"End",bg:"#EF4444",fn:end,size:70,shadow:"0 8px 28px rgba(239,68,68,0.6)"},
              {icon:speaker?"🔊":"🔈",label:"Speaker",bg:speaker?`rgba(78,205,196,0.3)`:"rgba(255,255,255,0.1)",fn:()=>setSpeaker(s=>!s),size:52},
              {icon:"⌨️",label:"Type",bg:"rgba(255,255,255,0.1)",fn:()=>{},size:52},
            ].map(b=>(
              <div key={b.label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7}}>
                <button onClick={b.fn} style={{width:b.size,height:b.size,borderRadius:"50%",border:"none",background:b.bg,fontSize:b.size>60?30:21,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:b.shadow||"none"}}>{b.icon}</button>
                <span style={{fontSize:10,fontWeight:700,color:b.label==="End"?"#EF4444":"rgba(255,255,255,0.5)"}}>{b.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── PIN Modal ── */
function PinModal({ onSuccess, onClose }) {
  const [pin,setPin]=useState("");
  const [error,setError]=useState(false);
  const press=d=>{
    if(pin.length>=4)return;
    const next=pin+d;setPin(next);
    if(next.length===4){
      if(next==="1234"){setTimeout(onSuccess,300);}
      else{setError(true);setTimeout(()=>{setPin("");setError(false);},600);}
    }
  };
  return (
    <div style={{position:"absolute",inset:0,background:"rgba(10,14,26,0.88)",zIndex:200,display:"flex",alignItems:"flex-end",backdropFilter:"blur(8px)"}}>
      <div style={{width:"100%",background:"#fff",borderRadius:"32px 32px 0 0",padding:"28px 28px 36px"}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:48,marginBottom:10}}>🔐</div>
          <div style={{fontSize:22,fontWeight:900,color:T.text}}>Parents Access</div>
          <p style={{fontSize:13,fontWeight:700,color:T.sub,marginTop:4}}>Enter your 4-digit PIN</p>
          <p style={{fontSize:11,color:"#B2BEC3",marginTop:2}}>Hint: 1234</p>
        </div>
        <div style={{display:"flex",justifyContent:"center",gap:14,marginBottom:28}}>
          {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:"50%",background:pin.length>i?(error?"#EF4444":T.coral):"#E0E0E0",transition:"background .2s"}}/>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k,i)=>(
            <button key={i} onClick={()=>k==="⌫"?setPin(p=>p.slice(0,-1)):k&&press(k)} style={{height:62,borderRadius:18,border:"none",background:k?"#F8F9FA":"transparent",fontSize:22,fontWeight:800,color:T.text,cursor:k?"pointer":"default",boxShadow:k?"0 2px 8px rgba(0,0,0,0.06)":"none"}}>{k}</button>
          ))}
        </div>
        <button onClick={onClose} style={{width:"100%",marginTop:16,background:"transparent",border:"none",fontSize:14,fontWeight:800,color:T.sub,cursor:"pointer",padding:"10px 0"}}>Cancel</button>
      </div>
    </div>
  );
}

/* ── Parents Dashboard ── */
function ParentsDashboard({ children, setChildren, activeChild, setActiveChild, onClose }) {
  const [view,setView]=useState("home");
  const [showAdd,setShowAdd]=useState(false);
  const [newChild,setNewChild]=useState({name:"",age:"",grade:"Grade 1"});
  const child=children[activeChild];
  const STATS=[{icon:"💬",label:"Questions Today",value:"23",color:T.coral,bg:"#FFF0F0"},{icon:"🔥",label:"Day Streak",value:"7",color:T.orange,bg:"#FFF5E0"},{icon:"⏱️",label:"Time Today",value:"34m",color:T.sky,bg:"#E0FAFB"},{icon:"⭐",label:"Topics",value:"12",color:T.purple,bg:"#F3EEFF"}];
  const TOPICS=[{icon:"🔬",bg:"#FFF0F0",label:"Science",count:10,pct:70},{icon:"🔢",bg:"#FFF5E0",label:"Maths",count:8,pct:55},{icon:"📖",bg:"#E8F8F0",label:"English",count:5,pct:34}];
  const HISTORY=[{icon:"🔬",bg:"#FFF0F0",title:"What is photosynthesis?",time:"10:30 AM",msgs:6},{icon:"🔢",bg:"#FFF5E0",title:"Explain fractions",time:"Yesterday",msgs:12},{icon:"🌍",bg:"#E8F8F0",title:"Why is the sky blue?",time:"Mon",msgs:8},{icon:"🦕",bg:"#F3EEFF",title:"About dinosaurs",time:"Sun",msgs:10}];
  const addChild=()=>{
    if(!newChild.name.trim())return;
    setChildren(c=>[...c,{name:newChild.name,age:parseInt(newChild.age)||6,grade:newChild.grade,color:CHILD_COLORS[c.length%CHILD_COLORS.length]}]);
    setNewChild({name:"",age:"",grade:"Grade 1"});setShowAdd(false);
  };
  function Tog({on:init}){const[on,setOn]=useState(init);return(<button onClick={()=>setOn(o=>!o)} style={{width:46,height:26,borderRadius:13,border:"none",background:on?T.mint:"#E5E7EB",position:"relative",cursor:"pointer",transition:"background .22s",flexShrink:0}}><div style={{position:"absolute",top:3,left:on?23:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .22s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/></button>);}
  return (
    <div style={{position:"absolute",inset:0,zIndex:190,background:"#F0F4F8",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {showAdd&&(
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",zIndex:300,display:"flex",alignItems:"flex-end",backdropFilter:"blur(6px)"}}>
          <div style={{width:"100%",background:"#fff",borderRadius:"28px 28px 0 0",padding:"24px 24px 36px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={{fontSize:20,fontWeight:900,color:T.text}}>➕ Add Child</div>
              <button onClick={()=>setShowAdd(false)} style={{width:34,height:34,borderRadius:"50%",border:"none",background:"#F0F4F8",fontSize:16,cursor:"pointer"}}>✕</button>
            </div>
            {[{l:"Child's Name",ph:"e.g. Sara",k:"name",t:"text"},{l:"Age",ph:"e.g. 8",k:"age",t:"number"}].map(f=>(
              <div key={f.k} style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:12,fontWeight:800,color:T.sub,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>{f.l}</label>
                <input type={f.t} value={newChild[f.k]} onChange={e=>setNewChild(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{width:"100%",background:"#F8F9FA",border:`2px solid ${T.border}`,borderRadius:14,padding:"13px 16px",fontFamily:"inherit",fontSize:15,fontWeight:600,color:T.text,outline:"none"}}/>
              </div>
            ))}
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:12,fontWeight:800,color:T.sub,marginBottom:6,textTransform:"uppercase",letterSpacing:0.5}}>Grade</label>
              <select value={newChild.grade} onChange={e=>setNewChild(p=>({...p,grade:e.target.value}))} style={{width:"100%",background:"#F8F9FA",border:`2px solid ${T.border}`,borderRadius:14,padding:"13px 16px",fontFamily:"inherit",fontSize:15,fontWeight:600,color:T.text,outline:"none",appearance:"none"}}>
                {["Kindergarten","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6","Grade 7","Grade 8"].map(g=><option key={g}>{g}</option>)}
              </select>
            </div>
            <button onClick={addChild} style={{width:"100%",background:`linear-gradient(135deg,${T.pNavy},${T.pBlue})`,border:"none",borderRadius:18,padding:"16px",fontSize:16,fontWeight:900,color:"#fff",cursor:"pointer"}}>Add Child 🎉</button>
          </div>
        </div>
      )}
      <div style={{background:`linear-gradient(135deg,${T.pNavy},${T.pBlue})`,padding:"50px 18px 0",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div><div style={{fontSize:18,fontWeight:900,color:"#fff"}}>👨‍👩‍👧‍👦 Parent Dashboard</div><div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.6)",marginTop:2}}>Manage your children's learning</div></div>
          <button onClick={onClose} style={{width:36,height:36,borderRadius:"50%",border:"none",background:"rgba(255,255,255,0.15)",color:"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:16}}>
          {children.map((c,i)=>(
            <div key={i} onClick={()=>setActiveChild(i)} style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}}>
              <div style={{width:52,height:52,borderRadius:18,background:c.color.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,border:`3px solid ${activeChild===i?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.2)"}`,transition:"border .2s"}}>{c.color.emoji}</div>
              <div style={{fontSize:11,fontWeight:800,color:activeChild===i?"#fff":"rgba(255,255,255,0.55)",whiteSpace:"nowrap"}}>{c.name.split(" ")[0]}</div>
            </div>
          ))}
          <div onClick={()=>setShowAdd(true)} style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:6,cursor:"pointer"}}>
            <div style={{width:52,height:52,borderRadius:18,background:"rgba(255,255,255,0.1)",border:"2px dashed rgba(255,255,255,0.35)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>➕</div>
            <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.5)"}}>Add</div>
          </div>
        </div>
        <div style={{display:"flex",gap:4,borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:4}}>
          {[{id:"home",l:"Overview"},{id:"history",l:"History"},{id:"limit",l:"Limits"},{id:"settings",l:"Settings"}].map(t=>(
            <button key={t.id} onClick={()=>setView(t.id)} style={{flex:1,padding:"10px 4px",borderRadius:"12px 12px 0 0",border:"none",background:view===t.id?"#F0F4F8":"transparent",color:view===t.id?T.pNavy:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:800,cursor:"pointer",transition:"all .2s"}}>{t.l}</button>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {view==="home"&&(
          <div style={{padding:"16px 14px"}}>
            <div style={{background:"#fff",borderRadius:20,padding:"16px",marginBottom:14,display:"flex",alignItems:"center",gap:13,boxShadow:"0 3px 12px rgba(0,0,0,0.06)"}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:child.color.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>{child.color.emoji}</div>
              <div style={{flex:1}}><div style={{fontSize:16,fontWeight:900,color:T.text}}>{child.name}</div><div style={{fontSize:12,fontWeight:700,color:T.sub,marginTop:2}}>Age {child.age||"—"} · {child.grade}</div></div>
              <div style={{background:"#E8F8F0",borderRadius:10,padding:"5px 12px"}}><span style={{fontSize:12,fontWeight:800,color:T.mint}}>🟢 Active</span></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {STATS.map(s=>(
                <div key={s.label} style={{background:"#fff",borderRadius:18,padding:"16px 14px",boxShadow:"0 3px 12px rgba(0,0,0,0.06)",textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:6}}>{s.icon}</div>
                  <div style={{fontSize:28,fontWeight:900,color:s.color,lineHeight:1}}>{s.value}</div>
                  <div style={{fontSize:11,fontWeight:700,color:T.sub,marginTop:3}}>{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{background:"#fff",borderRadius:20,padding:"16px",marginBottom:14,boxShadow:"0 3px 12px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:14,fontWeight:900,color:T.text,marginBottom:14}}>📚 Topics This Week</div>
              {TOPICS.map(t=>(
                <div key={t.label} style={{marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                    <div style={{width:32,height:32,borderRadius:10,background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{t.icon}</div>
                    <span style={{fontSize:13,fontWeight:800,color:T.text,flex:1}}>{t.label}</span>
                    <span style={{fontSize:12,fontWeight:700,color:T.sub}}>{t.count} Qs</span>
                  </div>
                  <div style={{background:"#F0F4F8",borderRadius:8,height:8,overflow:"hidden"}}><div style={{height:"100%",width:`${t.pct}%`,background:`linear-gradient(90deg,${T.coral},${T.orange})`,borderRadius:8}}/></div>
                </div>
              ))}
            </div>
            <div style={{background:"#fff",borderRadius:20,padding:"16px",boxShadow:"0 3px 12px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:14,fontWeight:900,color:T.text,marginBottom:14}}>📊 Questions This Week</div>
              <div style={{display:"flex",alignItems:"flex-end",gap:8,height:80}}>
                {[{d:"Mon",v:60},{d:"Tue",v:40},{d:"Wed",v:80},{d:"Thu",v:55},{d:"Fri",v:90},{d:"Sat",v:30},{d:"Sun",v:70}].map(({d,v})=>(
                  <div key={d} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                    <div style={{width:"100%",height:v*0.75,background:d==="Fri"?`linear-gradient(180deg,${T.coral},${T.orange})`:"#EEF2FF",borderRadius:"6px 6px 0 0"}}/>
                    <div style={{fontSize:9,fontWeight:800,color:T.sub}}>{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {view==="history"&&(
          <div style={{padding:"16px 14px"}}>
            <div style={{fontSize:14,fontWeight:900,color:T.text,marginBottom:12}}>{child.name.split(" ")[0]}'s Conversations</div>
            <div style={{display:"flex",flexDirection:"column",gap:9}}>
              {HISTORY.map((h,i)=>(
                <div key={i} style={{background:"#fff",borderRadius:16,padding:"13px 14px",display:"flex",alignItems:"center",gap:11,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                  <div style={{width:40,height:40,borderRadius:12,background:h.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{h.icon}</div>
                  <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:800,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{h.title}</div><div style={{fontSize:11,fontWeight:600,color:T.sub,marginTop:1}}>{h.time} · {h.msgs} messages</div></div>
                  <div style={{width:32,height:32,borderRadius:10,background:T.pLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:T.pBlue}}>›</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {view==="limit"&&(
          <div style={{padding:"16px 14px"}}>
            <div style={{background:"#fff",borderRadius:20,padding:"20px 16px",marginBottom:14,boxShadow:"0 3px 12px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:15,fontWeight:900,color:T.text,marginBottom:4}}>⏱️ Daily Question Limit</div>
              <p style={{fontSize:12,fontWeight:600,color:T.sub,marginBottom:16}}>Control how many questions {child.name.split(" ")[0]} can ask per day</p>
              <div style={{textAlign:"center",marginBottom:20}}>
                <div style={{fontSize:48,fontWeight:900,color:T.coral}}>30</div>
                <div style={{fontSize:13,fontWeight:700,color:T.sub}}>questions per day</div>
                <div style={{background:"#F0F4F8",borderRadius:10,height:10,margin:"12px 0 6px",overflow:"hidden"}}><div style={{height:"100%",width:"76%",background:`linear-gradient(90deg,${T.coral},${T.orange})`,borderRadius:10}}/></div>
                <div style={{fontSize:11,fontWeight:700,color:T.sub}}>23 used · 7 remaining</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                {[10,20,30,50,"∞"].map(v=><button key={v} style={{flex:1,padding:"10px 4px",borderRadius:12,border:`2px solid ${v===30?T.coral:T.border}`,background:v===30?`${T.coral}15`:"#F8F9FA",fontSize:13,fontWeight:800,color:v===30?T.coral:T.sub,cursor:"pointer"}}>{v}</button>)}
              </div>
            </div>
            <div style={{background:"#fff",borderRadius:20,padding:"20px 16px",boxShadow:"0 3px 12px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:15,fontWeight:900,color:T.text,marginBottom:16}}>⏰ Study Schedule</div>
              {[{l:"School Hours (8am–3pm)",on:true},{l:"Evening Study (5pm–7pm)",on:true},{l:"Weekend Learning",on:false}].map((s,i)=>{
                function T2({on:init}){const[on,setOn]=useState(init);return(<button onClick={()=>setOn(o=>!o)} style={{width:46,height:26,borderRadius:13,border:"none",background:on?T.mint:"#E5E7EB",position:"relative",cursor:"pointer",transition:"background .22s",flexShrink:0}}><div style={{position:"absolute",top:3,left:on?23:3,width:20,height:20,borderRadius:"50%",background:"#fff",transition:"left .22s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/></button>);}
                return(<div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}><div style={{flex:1,fontSize:13,fontWeight:700,color:T.text}}>{s.l}</div><T2 on={s.on}/></div>);
              })}
            </div>
          </div>
        )}
        {view==="settings"&&(
          <div style={{padding:"16px 14px"}}>
            <div style={{background:"#fff",borderRadius:20,padding:"16px",marginBottom:12,boxShadow:"0 3px 12px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:14,fontWeight:900,color:T.text,marginBottom:14}}>👨‍👩‍👧‍👦 Manage Children</div>
              {children.map((c,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:i<children.length-1?"1px solid #F5F5F5":"none"}}>
                  <div style={{width:40,height:40,borderRadius:14,background:c.color.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{c.color.emoji}</div>
                  <div style={{flex:1}}><div style={{fontSize:13,fontWeight:800,color:T.text}}>{c.name}</div><div style={{fontSize:11,fontWeight:600,color:T.sub,marginTop:1}}>{c.grade}</div></div>
                  <button style={{padding:"6px 14px",borderRadius:10,border:`1.5px solid ${T.border}`,background:"#F8F9FA",fontSize:12,fontWeight:800,color:T.sub,cursor:"pointer"}}>Edit</button>
                </div>
              ))}
              <button onClick={()=>setShowAdd(true)} style={{width:"100%",marginTop:14,background:`${T.coral}15`,border:`2px dashed ${T.coral}50`,borderRadius:14,padding:"12px",fontSize:14,fontWeight:800,color:T.coral,cursor:"pointer"}}>➕ Add Another Child</button>
            </div>
            {[{section:"Safety",items:[{icon:"🔒",bg:"#E8F8F0",l:"Change Parent PIN",s:"Current: ••••"},{icon:"🚫",bg:"#FFF0F0",l:"Content Filter",s:"Strict mode on"}]},{section:"Notifications",items:[{icon:"🔔",bg:"#FFF5E0",l:"Daily Report",s:"Every evening at 7pm"},{icon:"⚠️",bg:"#FFF0F0",l:"Limit Alerts",s:"When 80% used"}]},{section:"",items:[{icon:"🚪",bg:"#FFF0F0",l:"Sign Out Parent",danger:true}]}].map(({section,items})=>(
              <div key={section}>
                {section&&<div style={{fontSize:10,fontWeight:800,letterSpacing:1,textTransform:"uppercase",color:"#9CA3AF",padding:"12px 4px 8px"}}>{section}</div>}
                <div style={{background:"#fff",borderRadius:18,overflow:"hidden",marginBottom:10,boxShadow:"0 2px 8px rgba(0,0,0,0.05)"}}>
                  {items.map((item,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 14px",borderBottom:i<items.length-1?"1px solid #F5F5F5":"none",cursor:"pointer"}}>
                      <div style={{width:36,height:36,borderRadius:11,background:item.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{item.icon}</div>
                      <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:item.danger?"#EF4444":T.text}}>{item.l}</div>{item.s&&<div style={{fontSize:11,fontWeight:600,color:T.sub,marginTop:1}}>{item.s}</div>}</div>
                      {!item.danger&&<span style={{fontSize:16,color:"#D1D5DB"}}>›</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Root ── */
export default function App() {
  const [screen,setScreen]=useState("splash");
  const nav=s=>setScreen(s);
  const SCREENS={splash:<Splash nav={nav}/>,register:<AuthScreen mode="register" nav={nav}/>,login:<AuthScreen mode="login" nav={nav}/>,main:<MainApp nav={nav}/>};
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1a0a2e 0%,#2d1b69 50%,#11998e 100%)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"32px 16px 48px",fontFamily:"'Nunito',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@500;600;700;800;900&display=swap');
        @keyframes owlBounce{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-12px) rotate(3deg)}}
        @keyframes starFloat{0%{transform:translateY(0)}100%{transform:translateY(-8px)}}
        @keyframes orbPulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.8}50%{transform:translate(-50%,-50%) scale(1.2);opacity:.4}}
        @keyframes ringPulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}
        @keyframes waveBar{0%,100%{transform:scaleY(1);opacity:.9}50%{transform:scaleY(0.25);opacity:.4}}
        @keyframes typingDot{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes liveDot{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        @keyframes loadBar{from{width:0}to{width:100%}}
        @keyframes scanLine{0%{top:20%;opacity:0}20%{opacity:1}80%{opacity:1}100%{top:80%;opacity:0}}
        *{box-sizing:border-box}
        input,select,button{font-family:'Nunito',system-ui,sans-serif}
        ::-webkit-scrollbar{width:0}
      `}</style>
      <div style={{textAlign:"center",marginBottom:24}}>
        <h1 style={{fontSize:22,fontWeight:900,color:"#fff",letterSpacing:-0.5}}>Kidsko<span style={{color:"#FFE66D"}}>.ai</span> — Final Prototype</h1>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:12,fontWeight:700,marginTop:5}}>Child-friendly · Voice Call · 👁️ AI Vision (Gemini Live style) · 🔒 Parents</p>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center",marginBottom:22}}>
        {Object.keys(SCREENS).map(s=>(
          <button key={s} onClick={()=>nav(s)} style={{padding:"5px 14px",borderRadius:20,border:`1px solid ${screen===s?"rgba(255,107,107,0.6)":"rgba(255,255,255,0.12)"}`,background:screen===s?"rgba(255,107,107,0.2)":"transparent",color:screen===s?"#FF6B6B":"rgba(255,255,255,0.45)",fontSize:12,fontWeight:800,cursor:"pointer",textTransform:"capitalize"}}>{s}</button>
        ))}
      </div>
      {SCREENS[screen]}
      <p style={{color:"rgba(255,255,255,0.2)",fontSize:11,fontWeight:600,marginTop:18,textAlign:"center"}}>Main → bottom nav · Call tab → choose Voice or AI Vision · 🔒 PIN: 1234</p>
    </div>
  );
}
