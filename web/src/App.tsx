import { useEffect, useRef, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { CONTRACT, EXPLORER, CHAIN_ID, type Case, listCases, writeWith, getCase, getDoctrine, caseCount, txOf, recordTx, txUrl } from "./lib/contract";

const short = (a: string) => (a ? a.slice(0, 6) + "…" + a.slice(-4) : "");
const pct = (bps: number) => (bps / 100).toFixed(0);

const spot = (e: React.MouseEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - r.top}px`);
};

function useReveal() {
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("revealed"), io.unobserve(e.target))), { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
    document.querySelectorAll(".reveal-element").forEach((el) => io.observe(el));
    return () => io.disconnect();
  });
}

function CountUp({ to, dec = 0, suffix = "" }: { to: number; dec?: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.unobserve(el);
      const t0 = performance.now();
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / 1200); setN((1 - Math.pow(1 - p, 3)) * to); if (p < 1) requestAnimationFrame(tick); else setN(to); };
      requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el); return () => io.disconnect();
  }, [to]);
  return <span ref={ref}>{n.toFixed(dec)}{suffix}</span>;
}

function NodeCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!, ctx = c.getContext("2d")!; let raf = 0; let dots: any[] = [];
    const size = () => { const r = c.parentElement!.getBoundingClientRect(); c.width = r.width; c.height = r.height; dots = Array.from({ length: 26 }, () => ({ x: Math.random() * c.width, y: Math.random() * c.height, vx: (Math.random() - .5) * .4, vy: (Math.random() - .5) * .4, r: Math.random() * 2 + 1 })); };
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height); ctx.fillStyle = "#10b981";
      dots.forEach((d) => { d.x += d.vx; d.y += d.vy; if (d.x < 0 || d.x > c.width) d.vx *= -1; if (d.y < 0 || d.y > c.height) d.vy *= -1; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill(); });
      for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) { const a = dots[i], b = dots[j], dist = Math.hypot(a.x - b.x, a.y - b.y); if (dist < 85) { ctx.strokeStyle = `rgba(16,185,129,${1 - dist / 85})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
      raf = requestAnimationFrame(draw);
    };
    size(); draw(); const onR = () => { cancelAnimationFrame(raf); size(); draw(); }; window.addEventListener("resize", onR);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onR); };
  }, []);
  return <canvas ref={ref} className="w-full h-full" />;
}

const MODULES = [
  { n: "01", tag: "SEMANTIC", t: "Plain-language covenants", d: "Bond terms written as prose — “delivered a usable integration”, “materially misleading”. No rigid Solidity encoding of meaning." },
  { n: "02", tag: "CONSENSUS", t: "Validator adjudication", d: "Disputes render live web evidence and an LLM verdict, agreed across heterogeneous validators — not a single trusted oracle." },
  { n: "03", tag: "PRECEDENT", t: "Compiled doctrine", d: "Each resolved holding compiles into a doctrine graph, so recurring clauses settle more predictably over time." },
];

export default function App() {
  const [cases, setCases] = useState<Case[]>([]);
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets[0];
  const acct = wallet?.address || "";
  const [scrolled, setScrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; m: string }[]>([]);
  const [lines, setLines] = useState<{ k: string; t: string }[]>([
    { k: "ok", t: "lexforge-os init… semantic settlement layer online" },
    { k: "dim", t: "bound to GenLayer Bradbury · chain " + CHAIN_ID },
    { k: "norm", t: "type /help for operations, or /docket to read the chain." },
  ]);
  const [input, setInput] = useState("");
  const [palette, setPalette] = useState(false);
  const [clock, setClock] = useState("00:00:00");
  const screenRef = useRef<HTMLDivElement>(null);

  useReveal();
  const refresh = () => listCases().then(setCases).catch((e) => toast(String(e?.message || e)));
  const toast = (m: string) => { const id = Date.now() + Math.random(); setToasts((t) => [...t, { id, m }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200); };
  const print = (t: string, k = "norm") => setLines((l) => [...l, { k, t }]);

  useEffect(() => {
    refresh();
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    const iv = setInterval(() => setClock(new Date().toTimeString().split(" ")[0]), 1000);
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette(true); } if (e.key === "Escape") setPalette(false); };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("scroll", onScroll); clearInterval(iv); window.removeEventListener("keydown", onKey); };
  }, []);
  useEffect(() => { screenRef.current?.scrollTo(0, screenRef.current.scrollHeight); }, [lines]);

  const onConnect = async () => { try { if (!ready) return; authenticated ? await logout() : await login(); } catch (e: any) { toast(e.message); } };

  async function run(raw: string) {
    const v = raw.trim(); if (!v) return; print(v, "cmd"); setInput("");
    const [cmd, ...rest] = v.split(/\s+/); const arg = rest.join(" ");
    try {
      if (cmd === "/help") {
        print("operations:"); print("/docket — list every case on-chain", "ok");
        print("/case <id> — inspect one case", "ok"); print("/doctrine <clause> — read precedent", "ok");
        print("/forge <covenant> | <clause> | <claim> | <url> — open a dispute (wallet)", "ok");
        print("/crank <id> — adjudicate: web + LLM + consensus (wallet)", "ok");
        print("/finalize <id> — emit settlement payload (wallet)", "ok");
        print("/connect — link wallet · /clear — reset console", "ok");
      } else if (cmd === "/connect") { print("opening wallet…"); await onConnect(); print("connected: " + (acct || "see wallet"), "ok"); }
      else if (cmd === "/clear") { setLines([]); }
      else if (cmd === "/docket") {
        const cs = await listCases(); setCases(cs);
        if (!cs.length) print("no cases yet — /forge one.", "dim");
        cs.forEach((c) => print(`#${c.case_id} [${c.status}] ${c.verdict} ${pct(c.payout_bps)}% — ${c.clause_text}`, c.verdict === "PASS" ? "ok" : "norm"));
      } else if (cmd === "/case") {
        const c = await getCase(Number(arg)); print(JSON.stringify(c, null, 1));
      } else if (cmd === "/doctrine") {
        if (!arg) return print("usage: /doctrine <clause text>", "err");
        print(JSON.stringify(await getDoctrine(arg)));
      } else if (cmd === "/forge") {
        const p = arg.split("|").map((s) => s.trim());
        if (p.length !== 4 || p.some((x) => !x)) return print("usage: /forge covenant | clause | claim | url", "err");
        await tx("open_case", p); 
      } else if (cmd === "/crank") { if (!arg) return print("usage: /crank <id>", "err"); await tx("crank", [Number(arg)]); }
      else if (cmd === "/finalize") { if (!arg) return print("usage: /finalize <id>", "err"); await tx("finalize", [Number(arg)]); }
      else print(`unknown command "${v}" — try /help`, "err");
    } catch (e: any) { print(e?.shortMessage || e?.message || String(e), "err"); }
  }

  async function tx(fn: string, args: any[]) {
    setBusy(true); print(`submitting ${fn}… (web render + LLM + validator consensus may take a minute)`, "dim");
    try {
      if (!wallet) { await login(); throw new Error("connect a wallet, then run the command again"); }
      await wallet.switchChain(CHAIN_ID);
      const provider = await wallet.getEthereumProvider();
      const h = await writeWith(provider, wallet.address, fn, args);
      const cid = typeof args[0] === "number" ? args[0] : await caseCount();
      recordTx(cid, h);
      print(`accepted · ${h.slice(0, 14)}…`, "ok"); toast(`${fn} accepted`); await refresh();
    }
    catch (e: any) { print(e?.shortMessage || e?.message || String(e), "err"); }
    finally { setBusy(false); }
  }

  const resolved = cases.filter((c) => c.status === "RESOLVED" || c.status === "FINAL").length;
  const finalized = cases.filter((c) => c.status === "FINAL").length;
  const passed = cases.filter((c) => c.verdict === "PASS").length;
  const passRate = cases.length ? (passed / cases.length) * 100 : 0;

  const L = "font-mono text-[10px] uppercase tracking-[0.2em]";

  return (
    <>
      <div className="fixed top-[15%] left-[-10%] w-[450px] h-[450px] morphing-glow bg-cyberemerald/10 blur-[110px] pointer-events-none z-0" />
      <div className="fixed bottom-[20%] right-[-10%] w-[500px] h-[500px] morphing-glow bg-cyberemerald/5 blur-[130px] pointer-events-none z-0" style={{ animationDelay: "-5s" }} />

      {/* NAV */}
      <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 border-b transition-premium ${scrolled ? "bg-cyberblack/85 backdrop-blur-md border-white/10" : "border-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#hero" className="flex items-center space-x-3 group">
            <div className="w-8 h-8 rounded-lg bg-cyberwhite text-cyberblack grid place-items-center font-bold transition-transform duration-700 transition-premium group-hover:rotate-[360deg]">⌘</div>
            <span className={`${L} text-cyberwhite group-hover:text-cyberemerald transition-colors`}>LexForge // PCSB</span>
          </a>
          <nav className="hidden md:flex items-center space-x-10">
            {[["#modules", "Modules"], ["#docket", "Docket"], ["#console", "Console"], [EXPLORER, "Explorer"]].map(([h, t]) => (
              <a key={t} href={h} target={h.startsWith("http") ? "_blank" : undefined} className={`${L} text-cyberwhite/60 hover:text-cyberwhite emerald-underline py-1`}>{t}</a>
            ))}
          </nav>
          <div className="flex items-center space-x-3">
            <a href="https://github.com/YoneCode/LexForge" target="_blank" rel="noopener noreferrer" title="GitHub" className="text-white/50 hover:text-cyberemerald transition-colors">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-5 h-5"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            </a>
            <a href="https://x.com/YoneCode" target="_blank" rel="noopener noreferrer" title="X" className="text-white/50 hover:text-cyberemerald transition-colors">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <button onClick={() => setPalette(true)} className="p-2 border border-white/10 hover:border-cyberemerald/50 rounded-lg text-white/50 hover:text-cyberemerald transition-all" title="Command palette (Ctrl+K)">
              <span className="font-mono text-[10px] tracking-wider hidden lg:inline mr-2">CMD + K</span><kbd className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-mono">⌘</kbd>
            </button>
            {authenticated ? (
              <div className="flex items-center space-x-2">
                <span className="px-4 py-2.5 rounded-full font-mono text-[10px] uppercase tracking-[0.15em] border border-white/10 text-cyberwhite">{short(acct)}</span>
                <button onClick={() => logout()} title="Disconnect wallet" className="px-4 py-2.5 rounded-full font-mono text-[10px] uppercase tracking-[0.15em] border border-white/10 text-white/60 hover:border-red-400/50 hover:text-red-400 transition-all">Disconnect</button>
              </div>
            ) : (
              <button onClick={onConnect} className="px-5 py-2.5 rounded-full font-mono text-[10px] uppercase tracking-[0.15em] bg-cyberwhite text-cyberblack hover:bg-cyberemerald transition-all duration-500 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)]">Connect Wallet</button>
            )}
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="hero" className="relative min-h-screen w-full flex items-center pt-32 pb-24 px-6 z-10">
        <div className="max-w-[100rem] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 flex flex-col space-y-8">
            <div className="flex items-center space-x-3">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyberemerald opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-cyberemerald" /></span>
              <span className={`${L} text-cyberemerald font-medium`}>Settlement layer // Bradbury {CHAIN_ID} · Active</span>
            </div>
            <h1 className="font-serif text-[4.5rem] md:text-[6.5rem] leading-[0.95] font-light tracking-tighter text-cyberwhite max-w-2xl">
              Covenants that settle on <span className="italic text-cyberemerald font-extralight tracking-normal">meaning</span>.
            </h1>
            <p className="font-sans text-white/55 text-lg leading-relaxed font-light max-w-xl">
              Bond-backed promises written in plain language. GenLayer’s validators read the evidence, agree on the verdict, and settle — no trusted oracle, no off-chain judge, no rigid Solidity.
            </p>
            <div className="flex flex-wrap items-center gap-5 pt-4">
              <a href="#console" className="px-8 py-4 bg-cyberwhite text-cyberblack font-mono text-xs uppercase tracking-[0.2em] rounded-full hover:bg-cyberemerald transition-all duration-500 hover:-translate-y-0.5 shadow-[0_4px_24px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_30px_rgba(16,185,129,0.5)] transition-premium">Open the console</a>
              <a href="#docket" className="px-8 py-4 border border-white/20 hover:border-white text-cyberwhite font-mono text-xs uppercase tracking-[0.2em] rounded-full hover:bg-white/5 transition-all duration-500 hover:-translate-y-0.5 transition-premium">Read the docket</a>
            </div>
            <div className="grid grid-cols-3 gap-6 pt-10 border-t border-white/10 max-w-lg font-mono">
              {[["Cases filed", cases.length + ""], ["Resolved", resolved + ""], ["Pass rate", pct(passRate * 100) + "%"]].map(([k, v]) => (
                <div key={k}><div className="text-[9px] uppercase tracking-widest text-white/40 mb-1">{k}</div><div className="text-sm font-semibold text-cyberwhite">{v}</div></div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 relative w-full flex justify-end">
            <div className="relative w-full min-h-[520px] glass-panel rounded-3xl p-6 flex flex-col justify-between overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] hover:border-cyberemerald/30 transition-all duration-700 transition-premium">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center space-x-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500/40" /><span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" /><span className="w-2.5 h-2.5 rounded-full bg-cyberemerald/40" /></div>
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/40">DISPUTE_MONITOR // BRADBURY</div>
                <span className="w-1.5 h-1.5 bg-cyberemerald rounded-full animate-pulse" />
              </div>
              <div className="absolute inset-0 z-0 top-16 opacity-35"><NodeCanvas /></div>
              <div className="relative z-10 glass-panel p-3 rounded-xl bg-cyberblack/65 mt-4 flex-1 overflow-y-auto" style={{ maxHeight: 300 }}>
                <div className="flex items-center justify-between mb-2 px-1"><span className="font-mono text-[8px] tracking-[0.25em] text-cyberemerald uppercase">Live docket · {cases.length}</span><span className="text-[8px] font-mono text-white/40">{clock}</span></div>
                {cases.length === 0 && <p className="font-mono text-[10px] text-white/40 px-1 py-2">Reading the chain…</p>}
                {cases.map((c) => {
                  const tx = txOf(c.case_id);
                  return (
                    <a key={c.case_id} href={tx ? txUrl(tx) : EXPLORER} target="_blank" className="flex items-center justify-between gap-3 py-2 px-1 border-t border-white/5 group">
                      <div className="min-w-0">
                        <div className="font-mono text-[8px] text-white/40">#{c.case_id} · {c.covenant_ref}</div>
                        <div className="font-serif text-xs text-cyberwhite truncate">{c.clause_text}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-mono text-[9px] uppercase ${c.verdict === "PASS" ? "text-cyberemerald" : c.verdict === "FAIL" ? "text-red-400" : "text-white/40"}`}>{c.verdict}</span>
                        <div className="font-mono text-[8px] text-cyberemerald/70 group-hover:text-cyberemerald group-hover:underline">{tx ? "tx ↗" : "view ↗"}</div>
                      </div>
                    </a>
                  );
                })}
              </div>
              <div className="relative z-10 grid grid-cols-2 gap-4 mt-auto">
                <div className="glass-panel p-4 rounded-xl bg-cyberblack/80">
                  <div className="text-[8px] font-mono text-white/40 uppercase tracking-widest mb-1">Pass rate</div>
                  <div className="flex items-baseline space-x-2"><span className="text-xl font-mono text-cyberwhite font-bold">{pct(passRate * 100)}</span><span className="text-[9px] font-mono text-cyberemerald">%</span></div>
                  <div className="w-full bg-white/10 h-[2px] mt-2 rounded-full overflow-hidden"><div className="bg-cyberemerald h-[2px] transition-all duration-1000" style={{ width: `${passRate}%` }} /></div>
                </div>
                <div className="glass-panel p-4 rounded-xl bg-cyberblack/80">
                  <div className="text-[8px] font-mono text-white/40 uppercase tracking-widest mb-1">Resolved</div>
                  <div className="flex items-baseline space-x-2"><span className="text-xl font-mono text-cyberemerald font-bold">{resolved}</span><span className="text-[9px] font-mono text-white/50">/ {cases.length}</span></div>
                  <div className="w-full bg-white/10 h-[2px] mt-2 rounded-full overflow-hidden"><div className="bg-cyberemerald/60 h-[2px] animate-pulse" style={{ width: `${cases.length ? (resolved / cases.length) * 100 : 0}%` }} /></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section id="modules" className="relative py-32 px-6 border-t border-white/5 bg-cyberblack z-10">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-xl mb-24 reveal-element">
            <div className={`${L} text-cyberemerald mb-3`}>The primitive</div>
            <h2 className="font-serif text-5xl md:text-6xl font-light tracking-tighter text-cyberwhite mb-6">A self-modifying <br /><span className="italic font-extralight text-cyberwhite/50">enforcement function</span>.</h2>
            <p className="font-sans text-white/50 leading-relaxed font-light">Collateralized commitments whose enforcement is interpreted — and refined — by semantic consensus, not rigid code.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {MODULES.map((m, i) => {
              const inner = (
                <>
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 grid place-items-center mb-10 text-cyberemerald text-2xl transition-transform duration-700 transition-premium hover:rotate-45">§</div>
                    <h3 className="font-serif text-3xl font-light text-cyberwhite mb-4">{m.t}</h3>
                    <p className="font-sans text-white/50 text-sm leading-relaxed font-light">{m.d}</p>
                  </div>
                  <div className={`${L} text-white/40 pt-8 border-t border-white/5 mt-8`}>MODULE-{m.n} // {m.tag}</div>
                </>
              );
              return i === 0 ? (
                <div key={m.n} className="shimmer-card reveal-element" style={{ transitionDelay: `${i * 100}ms` }}><div className="shimmer-content p-10 flex flex-col justify-between min-h-[400px]">{inner}</div></div>
              ) : (
                <div key={m.n} onMouseMove={spot} className="spotlight-card rounded-3xl p-10 flex flex-col justify-between min-h-[400px] reveal-element" style={{ transitionDelay: `${i * 100}ms` }}>{inner}</div>
              );
            })}
          </div>
        </div>
      </section>

      {/* DOCKET / TELEMETRY */}
      <section id="docket" className="relative py-32 px-6 border-t border-white/5 z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-4 reveal-element">
            <div className={`${L} text-cyberemerald mb-3`}>Live on Bradbury</div>
            <h2 className="font-serif text-5xl font-light tracking-tighter text-cyberwhite mb-6">The <span className="italic font-extralight text-cyberemerald">docket</span>.</h2>
            <p className="font-sans text-white/50 text-sm leading-relaxed font-light mb-8">Every dispute, verdict and settlement — read straight from the chain via the CORS-open RPC. No backend, no indexer.</p>
            <div className="grid grid-cols-2 gap-px bg-white/5 rounded-2xl overflow-hidden font-mono">
              {[["Cases", cases.length, 0], ["Resolved", resolved, 0], ["Passed", passed, 0], ["Finalized", finalized, 0]].map(([k, v]) => (
                <div key={k as string} className="bg-cyberblack p-5"><div className="text-[9px] uppercase tracking-widest text-white/40 mb-2">{k}</div><div className="text-3xl text-cyberemerald font-light"><CountUp to={v as number} /></div></div>
              ))}
            </div>
            <button onClick={refresh} className="mt-6 w-full px-4 py-3 border border-white/15 hover:border-cyberemerald/50 text-white/60 hover:text-cyberemerald rounded-xl font-mono text-[10px] uppercase tracking-[0.15em] transition-all">↻ Refresh from chain</button>
          </div>
          <div className="lg:col-span-8 glass-panel p-8 rounded-3xl reveal-element overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-white/10">{["Case", "Clause", "Verdict", "Payout"].map((h) => <th key={h} className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 pb-4 font-normal pr-4">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-white/5 font-sans">
                {cases.length === 0 && <tr><td colSpan={4} className="py-8 text-white/40 font-mono text-xs">No cases yet — open one in the console below.</td></tr>}
                {cases.map((c) => (
                  <tr key={c.case_id}>
                    <td className="py-5 pr-4 font-mono text-white/40">#{c.case_id}<div className="text-[9px] text-white/30">{c.covenant_ref}</div></td>
                    <td className="py-5 pr-4 font-light text-cyberwhite max-w-md">{c.clause_text}{c.rationale && <div className="text-[11px] text-white/35 italic mt-1">“{c.rationale}”</div>}</td>
                    <td className="py-5 pr-4">
                      <span className={`font-mono text-[11px] uppercase tracking-wider ${c.verdict === "PASS" ? "text-cyberemerald" : c.verdict === "FAIL" ? "text-red-400" : "text-white/40"}`}>{c.verdict}</span>
                      <div className="text-[9px] font-mono text-white/30">{c.status}</div>
                    </td>
                    <td className="py-5 font-mono text-cyberemerald">{pct(c.payout_bps)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CONSOLE */}
      <section id="console" className="relative py-32 px-6 border-t border-white/5 bg-cyberblack/60 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-xl mx-auto text-center mb-16 reveal-element">
            <div className={`${L} text-cyberemerald mb-3`}>Interactive · real on-chain</div>
            <h2 className="font-serif text-4xl md:text-5xl font-light tracking-tighter text-cyberwhite">Drive a <span className="italic font-extralight text-cyberemerald">dispute</span></h2>
            <p className="font-sans text-white/50 text-sm leading-relaxed font-light mt-4">Forge a covenant, crank the adjudication (real web render + LLM + validator consensus), and emit the settlement — live on Bradbury.</p>
          </div>
          <div className="max-w-4xl mx-auto glass-panel rounded-3xl overflow-hidden shadow-2xl reveal-element">
            <div className="bg-black/50 px-6 py-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center space-x-2"><span className="w-3 h-3 rounded-full bg-red-500/50" /><span className="w-3 h-3 rounded-full bg-yellow-500/50" /><span className="w-3 h-3 rounded-full bg-cyberemerald/50" /><span className="font-mono text-[10px] text-white/40 pl-4 tracking-wider">{acct ? short(acct) : "guest"}@lexforge ~ bradbury</span></div>
              <span className="font-mono text-[9px] px-2.5 py-1 bg-white/5 text-white/50 rounded-md border border-white/10 uppercase tracking-widest">SH-PROMPT</span>
            </div>
            <div ref={screenRef} className="p-8 bg-cyberblack/90 font-mono text-xs space-y-2 min-h-[360px] max-h-[520px] overflow-y-auto">
              {lines.map((l, i) => (
                <div key={i} className={l.k === "ok" ? "text-cyberemerald" : l.k === "err" ? "text-red-400" : l.k === "dim" ? "text-white/40" : l.k === "cmd" ? "text-white/50 mt-3" : "text-white/75"}>
                  {l.k === "cmd" ? <><span className="text-cyberemerald font-bold">❯</span> {l.t}</> : <span style={{ whiteSpace: "pre-wrap" }}>{l.t}</span>}
                </div>
              ))}
            </div>
            <div className="bg-black/60 p-4 border-t border-white/10 flex items-center space-x-3">
              <span className="text-cyberemerald font-mono text-sm pl-2">❯</span>
              <input value={input} disabled={busy} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run(input)} placeholder={busy ? "working…" : "/forge vault-1 | the deliverable works | it works | https://example.com"} className="w-full bg-transparent outline-none border-none text-cyberwhite font-mono text-xs placeholder-white/30" />
              <button onClick={() => run(input)} disabled={busy} className="px-4 py-2 bg-cyberemerald/10 hover:bg-cyberemerald/25 text-cyberemerald border border-cyberemerald/20 hover:border-cyberemerald/50 rounded-lg text-[10px] font-mono uppercase tracking-wider transition-all disabled:opacity-40">Run</button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-40 px-6 border-t border-white/5 z-10 text-center">
        <div className="max-w-4xl mx-auto flex flex-col items-center space-y-10 reveal-element">
          <div className={`${L} text-cyberemerald`}>Collateralized commitments, settled by meaning</div>
          <h2 className="font-serif text-5xl md:text-8xl font-light tracking-tighter leading-none">Settle the <br /><span className="gradient-text font-extralight italic">unsettleable</span>.</h2>
          <p className="font-sans text-white/50 text-lg font-light max-w-xl">Disputes too semantic for Solidity, settled with hard finality on GenLayer.</p>
          <a href="#console" className="px-10 py-5 bg-cyberwhite text-cyberblack font-mono text-xs uppercase tracking-[0.25em] rounded-full hover:bg-cyberemerald transition-all duration-700 shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:shadow-[0_0_50px_rgba(16,185,129,0.7)] hover:-translate-y-1 transition-premium">Forge a covenant</a>
        </div>
      </section>

      <footer className="relative py-12 px-6 border-t border-white/5 bg-cyberblack z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          <div>© 2026 LexForge · Precedent-Compiled Semantic Bonds</div>
          <a href={EXPLORER} target="_blank" className="hover:text-cyberemerald transition-colors">{short(CONTRACT)} · Bradbury {CHAIN_ID}</a>
        </div>
      </footer>

      {/* TOASTS */}
      <div className="fixed bottom-6 right-6 space-y-3 z-[100] max-w-sm">
        {toasts.map((t) => <div key={t.id} className="glass-panel p-4 rounded-xl flex items-center space-x-3 text-xs font-mono shadow-xl"><div className="w-2 h-2 rounded-full bg-cyberemerald animate-pulse" /><div className="text-cyberwhite">{t.m}</div></div>)}
      </div>

      {/* COMMAND PALETTE */}
      <div className={`fixed inset-0 bg-cyberblack/95 backdrop-blur-md z-[200] transition-all duration-500 flex items-start justify-center pt-[15vh] ${palette ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className={`w-full max-w-xl bg-cyberblack/90 border border-white/10 rounded-2xl shadow-2xl p-6 transition-transform duration-500 ${palette ? "scale-100" : "scale-95"}`}>
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
            <div className="flex items-center space-x-2"><span className="w-2.5 h-2.5 rounded-full bg-cyberemerald animate-pulse" /><span className="font-mono text-[10px] uppercase tracking-wider text-white/50">LexForge command palette</span></div>
            <button onClick={() => setPalette(false)} className="text-white/40 hover:text-white font-mono text-[10px] tracking-wider">CLOSE [ESC]</button>
          </div>
          {[["/docket", "List all cases from chain"], ["/help", "Show operations"], ["/connect", "Link wallet"], ["/clear", "Reset console"]].map(([c, d]) => (
            <div key={c} onClick={() => { setPalette(false); document.getElementById("console")?.scrollIntoView({ behavior: "smooth" }); run(c); }} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-cyberemerald/10 border border-white/5 hover:border-cyberemerald/30 cursor-pointer transition-all mb-2">
              <span className="font-mono text-[11px] text-cyberwhite font-semibold">{c}</span><span className="text-[9px] font-mono text-white/40 uppercase">{d}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
