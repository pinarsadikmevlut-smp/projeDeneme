import { useEffect, useState } from "react";

type Health = { status: string; application: string };
const features = [
  { icon: "◇", title: "Modern arayüz", detail: "React ve TypeScript ile hızlı, esnek bir deneyim." },
  { icon: "⌘", title: "Güçlü altyapı", detail: "Flask REST API ile modüler backend servisleri." },
  { icon: "▣", title: "Yerel veri", detail: "PostgreSQL ile kontrolünüzde kalıcı veritabanı." },
];

export default function App() {
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("API unavailable");
        const result: Health = await response.json();
        setHealth(result.status === "ok" ? "online" : "offline");
      })
      .catch(() => { if (!controller.signal.aborted) setHealth("offline"); });
    return () => controller.abort();
  }, []);

  return (
    <div className="site">
      <header className="topbar container">
        <a href="/" className="brand" aria-label="goldenSoft ana sayfa"><span className="brand-mark">g<span>.</span></span>golden<span>Soft</span></a>
        <nav aria-label="Ana menü"><a href="#platform">Platform</a><a href="#about">Hakkında</a><a href="#status">Sistem</a></nav>
        <a className="top-cta" href="#platform">Keşfet <span aria-hidden="true">↗</span></a>
      </header>
      <main>
        <section className="hero container">
          <div className="eyebrow"><span className="spark">✦</span> DIGITAL SOLUTIONS · V0.1</div>
          <h1>Dijital fikirlerin<br /><span>altın çağı.</span></h1>
          <p className="intro">Güçlü teknoloji, yalın tasarım ve sınırsız potansiyel. goldenSoft ile yeni nesil web uygulamalarının temelini atıyoruz.</p>
          <div className="actions"><a className="button-primary" href="#platform">Platformu keşfet <span>↗</span></a><a className="button-secondary" href="#about">Daha fazla bilgi <span>→</span></a></div>
          <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"></div><div className="orbit orbit-two"></div><div className="art-glow"></div><div className="art-core">g<span>.</span></div><span className="tiny-star star-a">✦</span><span className="tiny-star star-b">✧</span></div>
          <div className="hero-index">01 / 03 <span>—</span> BAŞLANGIÇ NOKTASI</div>
        </section>
        <section className="features-wrap" id="platform"><div className="container"><div className="section-head"><div><span className="overline">TEMELLERİMİZ</span><h2>İyi bir başlangıç.<br /><em>Güçlü bir gelecek.</em></h2></div><p>Fikirden ürüne uzanan yolculuk için modern, geliştirilebilir ve sürdürülebilir bir temel.</p></div><div className="features">{features.map((feature, index) => <article className="feature" key={feature.title}><div className="feature-icon">{feature.icon}</div><span className="feature-number">0{index + 1}</span><h3>{feature.title}</h3><p>{feature.detail}</p><span className="feature-arrow" aria-hidden="true">↗</span></article>)}</div></div></section>
        <section className="bottom container" id="about"><div><span className="overline">GOLDENSOFT</span><h2>Henüz yeni<br />başlıyoruz<span className="gold-dot">.</span></h2><p>Bu ekran, yeni full-stack projemizin ilk adımı. Birlikte geliştireceğimiz yeni özellikler için hazır.</p></div><div className="status-card" id="status"><div className="status-top"><span>SİSTEM DURUMU</span><span className="signal">◉</span></div><div className="status-line"><span className={`indicator ${health}`}></span><strong>{health === "online" ? "Backend bağlı" : health === "checking" ? "Bağlantı kontrol ediliyor" : "Backend bağlantısı yok"}</strong></div><p>Flask REST API · /api/health</p><div className="status-foot"><span>goldenSoft</span><span>v0.1.0</span></div></div></section>
      </main>
      <footer className="footer container"><span>© {new Date().getFullYear()} goldenSoft. Built for what's next.</span><span>Designed to evolve <span className="gold-dot">✦</span></span></footer>
    </div>
  );
}
