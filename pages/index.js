import { useState, useEffect } from "react";
import Head from "next/head";

const C = {
  bg:"#03070a",bg1:"#060d12",bg2:"#0a1520",
  border:"rgba(0,255,136,0.1)",bord2:"rgba(255,255,255,0.05)",
  green:"#00ff88",green2:"#00cc6a",red:"#ff3355",
  yellow:"#ffd700",orange:"#ff9500",blue:"#4da6ff",
  purple:"#b06aff",muted:"#4a6a7a",text:"#c8d8e8",
};
const mono = s => ({fontFamily:"'DM Mono',monospace",...s});
const rugColor = r => ({LOW:C.green,MEDIUM:C.yellow,HIGH:C.red}[r]||"#888");
const chainIcon = c => ({eth:"⧠",solana:"◎",bsc:"🔶"}[c]||"🔗");
const typeColor = t => ({SMART_MONEY:C.green,WHALE:C.blue,MEME_SNIPER:C.purple,INFLUENCER:C.yellow,EXCHANGE:C.muted}[t]||"#888");

function Card({children,style={},glow}){
  return <div style={{background:C.bg1,borderRadius:12,padding:16,border:`1px solid ${glow?C.green+"35":C.bord2}`,...(glow?{boxShadow:`0 0 25px rgba(0,255,136,0.07)`}:{}),...style}}>{children}</div>;
}
function Label({children,style={}}){
  return <div style={{color:C.muted,fontSize:10,letterSpacing:2,textTransform:"uppercase",marginBottom:6,...mono(),...style}}>{children}</div>;
}
function Pill({children,color=C.green,small}){
  return <span style={{background:color+"18",border:`1px solid ${color}35`,color,borderRadius:5,padding:small?"2px 7px":"4px 10px",fontSize:small?10:11,...mono(),display:"inline-block",lineHeight:1.5,whiteSpace:"nowrap"}}>{children}</span>;
}
function Spinner({size=28}){
  return <div style={{width:size,height:size,flexShrink:0,border:"2px solid rgba(0,255,136,0.12)",borderTop:`2px solid ${C.green}`,borderRadius:"50%",animation:"spin .7s linear infinite"}}/>;
}

function WalletCard({wallet}){
  const tc = typeColor(wallet.type);
  return (
    <div style={{background:C.bg2,borderRadius:8,padding:"10px 12px",display:"flex",gap:10,alignItems:"center"}}>
      <div style={{fontSize:20,flexShrink:0}}>{chainIcon(wallet.chain)}</div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:3}}>
          <span style={{color:"#fff",fontSize:13,fontWeight:700}}>{wallet.label}</span>
          <Pill color={tc} small>{wallet.type}</Pill>
        </div>
        <div style={{color:C.muted,fontSize:10,...mono(),overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{wallet.address}</div>
        {wallet.notes&&<div style={{color:"#555",fontSize:10,marginTop:2}}>{wallet.notes}</div>}
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <div style={{color:wallet.knownWinRate>=80?C.green:wallet.knownWinRate>=70?C.yellow:C.orange,fontSize:14,fontWeight:900,...mono()}}>{wallet.knownWinRate}%</div>
        <div style={{color:C.muted,fontSize:9}}>win rate</div>
      </div>
    </div>
  );
}

function AlertCard({trade}){
  const {wallet,tokenName,tokenSymbol,price,usdValue,analysis,apexPrompt,timestamp} = trade;
  const [open,setOpen] = useState(true);
  const [copied,setCopied] = useState(false);
  const rc = rugColor(analysis.rugRisk);
  const time = new Date(timestamp).toLocaleTimeString();

  const copyApexPrompt = () => {
    navigator.clipboard?.writeText(apexPrompt);
    setCopied(true);
    setTimeout(()=>setCopied(false),2000);
  };

  return (
    <Card glow={analysis.shouldCopy} style={{marginBottom:12,borderLeft:`4px solid ${analysis.shouldCopy?C.green:C.red}`}}>
      <div style={{cursor:"pointer",display:"flex",gap:10,alignItems:"flex-start"}} onClick={()=>setOpen(o=>!o)}>
        <div style={{fontSize:28,flexShrink:0}}>{chainIcon(wallet.chain)}</div>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
            <span style={{color:"#fff",fontSize:16,fontWeight:700,...mono()}}>{tokenSymbol}</span>
            <span style={{color:C.muted,fontSize:12}}>{tokenName}</span>
            <Pill color={rc} small>{analysis.rugRisk} RUG RISK</Pill>
            {analysis.shouldCopy&&<Pill color={C.green} small>COPY</Pill>}
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <span style={{color:C.muted,fontSize:11}}>👛 {wallet.label} ({wallet.knownWinRate}% WR)</span>
            <span style={{color:C.yellow,fontSize:11,...mono()}}>~${usdValue?.toLocaleString()}</span>
            <span style={{color:C.muted,fontSize:10}}>{time}</span>
          </div>
        </div>
        <div style={{color:C.muted,fontSize:16,flexShrink:0}}>{open?"▲":"▼"}</div>
      </div>

      {open&&(
        <div style={{marginTop:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:8,marginBottom:12}}>
            {[
              {l:"CURRENT",v:`$${price}`,c:"#fff"},
              {l:"ENTRY",v:analysis.copyEntry,c:"#fff"},
              {l:"STOP",v:analysis.copyStop,c:C.red},
              {l:"T1",v:analysis.copyTarget1,c:"#7fff7f"},
              {l:"T2",v:analysis.copyTarget2,c:C.green},
            ].filter(x=>x.v).map(({l,v,c})=>(
              <div key={l} style={{background:c+"08",border:`1px solid ${c}20`,borderRadius:7,padding:"8px 10px"}}>
                <Label style={{marginBottom:3}}>{l}</Label>
                <div style={{color:c,fontSize:12,fontWeight:700,...mono()}}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            <div style={{background:C.bg2,borderRadius:7,padding:10}}>
              <Label>Catalyst</Label>
              <p style={{color:C.text,fontSize:11,lineHeight:1.5}}>{analysis.catalyst||"Unknown"}</p>
            </div>
            <div style={{background:C.bg2,borderRadius:7,padding:10}}>
              <Label>Claude Says</Label>
              <p style={{color:C.text,fontSize:11,lineHeight:1.5}}>{analysis.reason}</p>
              <Pill color={analysis.confidence>=7?C.green:analysis.confidence>=5?C.yellow:C.red} small>Confidence {analysis.confidence}/10</Pill>
            </div>
          </div>

          <div style={{background:C.bg2,borderRadius:7,padding:10,marginBottom:10}}>
            <Label>Contract Address</Label>
            <div style={{color:C.blue,fontSize:11,...mono(),wordBreak:"break-all",cursor:"pointer"}} onClick={()=>navigator.clipboard?.writeText(trade.tokenAddress)}>
              {trade.tokenAddress}
            </div>
          </div>

          {apexPrompt&&(
            <div style={{background:"rgba(0,255,136,0.04)",border:`1px solid ${C.green}30`,borderRadius:10,padding:12,marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <Label style={{marginBottom:0}}>APEX Verification Prompt</Label>
                <button onClick={copyApexPrompt} style={{background:copied?C.green+"20":"rgba(0,255,136,0.1)",color:copied?C.green:"#00cc6a",border:`1px solid ${C.green}35`,borderRadius:6,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                  {copied?"Copied!":"Copy Prompt"}
                </button>
              </div>
              <p style={{color:C.muted,fontSize:11,marginBottom:8}}>Paste this directly into APEX to get full institutional analysis on this whale trade:</p>
              <div style={{background:C.bg,borderRadius:6,padding:10,fontSize:10,...mono(),color:"#7fa",lineHeight:1.6,maxHeight:120,overflow:"auto",whiteSpace:"pre-wrap"}}>
                {apexPrompt}
              </div>
            </div>
          )}

          {analysis.warning&&(
            <div style={{background:"rgba(255,149,0,0.06)",border:`1px solid ${C.orange}25`,borderRadius:7,padding:10}}>
              <div style={{color:C.orange,fontSize:12}}>⚠ {analysis.warning}</div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Home(){
  const [loading,setLoading] = useState(false);
  const [results,setResults] = useState([]);
  const [wallets,setWallets] = useState([]);
  const [lastScan,setLastScan] = useState(null);
  const [notifTest,setNotifTest] = useState(null);
  const [activeTab,setActiveTab] = useState("alerts");
  const [stats,setStats] = useState(null);

  useEffect(()=>{ fetch("/api/wallets").then(r=>r.json()).then(d=>setWallets(d.wallets||[])); },[]);

  const runScan = async()=>{
    setLoading(true);
    try{
      const res = await fetch("/api/track",{method:"POST"});
      const json = await res.json();
      setResults(json.results||[]);
      setStats({walletsChecked:json.walletsChecked,tradesFound:json.results?.length||0,alertsSent:json.alerts?.length||0});
      setLastScan(new Date().toLocaleTimeString());
    }catch(e){ console.error(e); }
    setLoading(false);
  };

  const testTelegram = async()=>{
    setNotifTest("sending");
    try{
      await fetch("/api/track",{method:"POST"});
      setNotifTest("sent");
    }catch{ setNotifTest("failed"); }
    setTimeout(()=>setNotifTest(null),3000);
  };

  const copyTrades = results.filter(r=>r.analysis?.shouldCopy&&r.analysis?.rugRisk!=="HIGH");
  const allTrades = results;
  const tabs=[
    {id:"alerts",label:`COPY Alerts (${copyTrades.length})`},
    {id:"all",label:`All Found (${allTrades.length})`},
    {id:"wallets",label:`Wallets (${wallets.length})`},
  ];
  const displayTrades = activeTab==="alerts"?copyTrades:activeTab==="all"?allTrades:[];

  return(
    <>
      <Head><title>Whale Tracker</title><meta name="viewport" content="width=device-width, initial-scale=1"/></Head>
      <div style={{minHeight:"100vh",background:C.bg}}>
        <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(3,7,10,0.96)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${C.border}`,padding:"0 20px",height:52,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:4,color:C.green}}>WHALE</span>
            <span style={{color:C.muted,fontSize:11}}>TRACKER</span>
            <Pill color={C.green} small>COPY TRADES</Pill>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {lastScan&&<span style={{color:C.muted,fontSize:10,...mono()}}>Last: {lastScan}</span>}
            {stats&&<span style={{color:C.green,fontSize:10,...mono()}}>{stats.alertsSent} alerts sent</span>}
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:C.green,animation:"pulse 2s infinite"}}/>
              <span style={{color:C.green,fontSize:10,...mono()}}>AUTO 5M</span>
            </div>
          </div>
        </nav>

        <div style={{display:"flex",gap:2,padding:"0 20px",borderBottom:`1px solid ${C.bord2}`,background:"rgba(3,7,10,0.7)"}}>
          {tabs.map(({id,label})=>(
            <button key={id} onClick={()=>setActiveTab(id)} style={{background:"none",border:"none",padding:"10px 14px",fontSize:12,fontWeight:activeTab===id?700:400,color:activeTab===id?C.green:C.muted,borderBottom:activeTab===id?`2px solid ${C.green}`:"2px solid transparent",cursor:"pointer"}}>
              {label}
            </button>
          ))}
        </div>

        <main style={{maxWidth:860,margin:"0 auto",padding:"22px 18px 80px"}}>
          {results.length===0&&!loading&&(
            <div style={{textAlign:"center",padding:"32px 0 24px"}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:"clamp(36px,7vw,60px)",lineHeight:.9,marginBottom:12,letterSpacing:4}}>
                COPY THE<br/><span style={{color:C.green}}>SMARTEST WALLETS.</span>
              </div>
              <p style={{color:C.muted,fontSize:13,maxWidth:440,margin:"0 auto 24px",lineHeight:1.8}}>
                Tracks {wallets.length} elite wallets every 5 minutes. When a whale buys — Claude analyzes it, generates your APEX verification prompt, and alerts your phone instantly.
              </p>
              <Card style={{maxWidth:440,margin:"0 auto 20px",textAlign:"left"}}>
                <Label>Required Environment Variables</Label>
                <p style={{color:C.muted,fontSize:12,lineHeight:1.8}}>
                  MORALIS_API_KEY — moralis.io free signup<br/>
                  ANTHROPIC_API_KEY — same key from APEX<br/>
                  TELEGRAM_BOT_TOKEN — from @BotFather<br/>
                  TELEGRAM_CHAT_ID — from @userinfobot<br/>
                  MIN_TRADE_USD — minimum trade size e.g. 5000
                </p>
              </Card>
            </div>
          )}

          {!loading&&(
            <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
              <button onClick={runScan} style={{background:`linear-gradient(135deg,${C.green},${C.green2})`,color:"#000",border:"none",borderRadius:10,padding:"12px 32px",fontWeight:800,cursor:"pointer",fontFamily:"'Bebas Neue'",fontSize:17,letterSpacing:3,boxShadow:`0 0 24px ${C.green}20`}}>
                {results.length>0?"SCAN AGAIN":"SCAN WALLETS NOW"}
              </button>
            </div>
          )}

          {loading&&(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"40px 20px"}}>
              <Spinner size={44}/>
              <div style={{color:C.green,fontSize:12,...mono()}}>SCANNING {wallets.length} ELITE WALLETS...</div>
            </div>
          )}

          {activeTab!=="wallets"&&!loading&&(
            <div>
              {displayTrades.length>0?(
                displayTrades.map((t,i)=><AlertCard key={i} trade={t}/>)
              ):(
                <Card style={{textAlign:"center",padding:"40px 20px"}}>
                  <div style={{fontSize:40,marginBottom:12}}>👀</div>
                  <div style={{color:C.muted,fontSize:14}}>No {activeTab==="alerts"?"copy trade alerts":"trades"} this scan.</div>
                </Card>
              )}
            </div>
          )}

          {activeTab==="wallets"&&(
            <div>
              <div style={{color:"#fff",fontSize:14,fontWeight:800,marginBottom:14}}>Tracked Wallets</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {wallets.map((w,i)=><WalletCard key={i} wallet={w}/>)}
              </div>
            </div>
          )}
        </main>

        <div style={{borderTop:`1px solid ${C.bord2}`,padding:"12px 20px",color:"#1a2a2a",fontSize:9,textAlign:"center",...mono()}}>
          NOT FINANCIAL ADVICE — COPY TRADING INVOLVES SIGNIFICANT RISK
        </div>
      </div>
    </>
  );
}
