import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Globe, Menu, X } from "lucide-react";
import { Route, Switch, useLocation } from "wouter";
import Home from "./pages/Home";
import { InfoPage } from "./pages/InformationPages";
import { NewsPage, NewsDetailPage, CareersPage, CareersDetailPage, ContactPage } from "./pages/Subpages";
import { EnglishNewsPage, EnglishNewsDetailPage, EnglishCareersPage, EnglishCareerDetailPage, EnglishContactPage } from "./pages/EnglishPages";
import "./index.css";
import "./Navigation.css";
import "./ButtonOverrides.css";
import "./HeaderOverrides.css";

type Language = "ko" | "en";
type Group = "solution" | "company";

function isEnglish(path: string) { return /^\/en(?:\/|$)/i.test(path); }
function localPath(path: string, lang: Language) { return lang === "en" ? `/en${path}` : path; }

function Brand({ lang }: { lang: Language }) {
  return <a className="brand" href={lang === "en" ? "/en" : "/"} aria-label={lang === "en" ? "NULL SPACE home" : "NULL SPACE 홈"}><img className="brand-logo" src="/images/nullspace-logo.svg" alt="NULL SPACE" /></a>;
}

function Header({ lang, path }: { lang: Language; path: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Group | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const en = lang === "en";
  const localeLink = en ? (path.replace(/\/+$/, "").toLowerCase() === "/en" ? "/" : path.slice(3)) : (path === "/" ? "/en" : `/en${path}`);

  useEffect(() => {
    if (open) navRef.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [open]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) { setExpanded(null); setOpen(false); }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (expanded) { const group = expanded; setExpanded(null); document.getElementById(`nav-${group}`)?.focus(); }
      else if (open) { setOpen(false); menuRef.current?.focus(); }
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [expanded, open]);

  const closeMenu = () => { setOpen(false); setExpanded(null); };

  return <header className="site-header" ref={headerRef}>
    <div className="header-inner">
      <Brand lang={lang} />
      <nav id="main-navigation" ref={navRef} className={`desktop-nav ${open ? "is-open" : ""}`} aria-label={en ? "Main navigation" : "주 메뉴"}>
        <div className="nav-group">
          <button id="nav-solution" type="button" className="nav-trigger" aria-expanded={expanded === "solution"} aria-controls="submenu-solution" onClick={() => setExpanded(expanded === "solution" ? null : "solution")}>
            {en ? "Solution" : "솔루션"}<ChevronDown size={14} aria-hidden="true" />
          </button>
          <div className="nav-panel nav-solution-panel" id="submenu-solution" hidden={expanded !== "solution"}>
            <a href={localPath("/solution", lang)} onClick={closeMenu}>{en ? "Definition" : "솔루션 소개"}</a>
            <a className="nav-product-heading" href={localPath("/solution/product", lang)} onClick={closeMenu}>{en ? "Product" : "제품"}</a>
            <div className="nav-sublist" aria-label={en ? "Products" : "제품 목록"}>
              <a href={localPath("/solution/product/n-mover", lang)} onClick={closeMenu}>N-MOVER</a>
              <a href={localPath("/solution/product/n-prover", lang)} onClick={closeMenu}>N-PROVER</a>
              <a href={localPath("/solution/product/n-doras", lang)} onClick={closeMenu}>N-DORAS</a>
            </div>
          </div>
        </div>
        <div className="nav-group">
          <button id="nav-company" type="button" className="nav-trigger" aria-expanded={expanded === "company"} aria-controls="submenu-company" onClick={() => setExpanded(expanded === "company" ? null : "company")}>
            {en ? "Company" : "회사"}<ChevronDown size={14} aria-hidden="true" />
          </button>
          <div className="nav-panel" id="submenu-company" hidden={expanded !== "company"}>
            <a href={localPath("/company/team", lang)} onClick={closeMenu}>{en ? "Team" : "팀"}</a>
            <a href={localPath("/company/partners", lang)} onClick={closeMenu}>{en ? "Partners" : "파트너"}</a>
          </div>
        </div>
        <a className="nav-direct" href={localPath("/news", lang)} onClick={closeMenu}>{en ? "News" : "뉴스"}</a>
        <a className="nav-direct" href={localPath("/careers", lang)} onClick={closeMenu}>{en ? "Career" : "커리어"}</a>
        <a className="mobile-contact" href={localPath("/contact", lang)} onClick={closeMenu}>{en ? "Contact" : "문의"}<ArrowUpRight size={16} /></a>
      </nav>
      <div className="header-actions">
        <a className="language-link" href={`${localeLink}${window.location.search}${window.location.hash}`} onClick={event => { event.currentTarget.href = `${localeLink}${window.location.search}${window.location.hash}`; }} aria-label={en ? "한국어로 보기" : "View in English"}><Globe size={15} aria-hidden="true" />{en ? "KO" : "EN"}</a>
        <a className="header-cta" href={localPath("/contact", lang)}>{en ? "Contact" : "문의"}<ArrowUpRight size={15} /></a>
        <button ref={menuRef} className="menu-toggle" type="button" onClick={() => { setOpen(!open); setExpanded(null); }} aria-expanded={open} aria-controls="main-navigation" aria-label={en ? (open ? "Close menu" : "Open menu") : (open ? "메뉴 닫기" : "메뉴 열기")}>{open ? <X size={23} /> : <Menu size={23} />}</button>
      </div>
    </div>
  </header>;
}

function Footer({ lang }: { lang: Language }) {
  const en = lang === "en";
  return <footer className="site-footer">
    <div className="footer-top"><div><h2>Define the null space<span className="lime">.</span></h2></div><div className="footer-statement">{en ? <>We define the null space in data center infrastructure.</> : <>데이터센터의 Null Space를 정의합니다. 인프라의 새로운 표준이 됩니다.</>}</div></div>
    <div className="footer-bottom"><Brand lang={lang} /><div className="footer-links"><a href={localPath("/solution", lang)}>Solution</a><a href={localPath("/company", lang)}>Company</a><a href={localPath("/news", lang)}>News</a><a href={localPath("/careers", lang)}>Career</a><a href={localPath("/contact", lang)}>Contact</a></div><span>© 2026 NULL SPACE</span></div>
  </footer>;
}

const informationPages = [
  ["/solution", "definition"],
  ["/solution/product", "products"],
  ["/solution/product/n-mover", "n-mover"],
  ["/solution/product/n-prover", "n-prover"],
  ["/solution/product/n-doras", "n-doras"],
  ["/company", "company"],
  ["/company/team", "team"],
  ["/company/partners", "partners"],
] as const;

function App() {
  const [path] = useLocation();
  const lang: Language = isEnglish(path) ? "en" : "ko";
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    const normalized = path.replace(/\/+$/, "").toLowerCase() || "/";
    const basePath = isEnglish(normalized) ? normalized.slice(3) || "/" : normalized;
    const hash = window.location.hash.toLowerCase();
    const oldPageTargets: Record<string, [string, string]> = {
      "/solution#products": ["/solution/product", ""], "/solution#traction": ["/company/partners", ""],
      "/company#playbook": ["/company/team", ""],
    };
    const target = oldPageTargets[`${basePath}${hash}`];
    if (target) {
      window.location.replace(`${localPath(target[0], lang)}${window.location.search}${target[1]}`);
    } else if ((basePath === "/" && hash) || (basePath === "/solution" && hash === "#scenario")) {
      requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    }
  }, [lang, path]);

  return <><Header lang={lang} path={path} /><main><Switch>
    <Route path="/" component={Home} />
    <Route path="/en" component={Home} />
    {informationPages.flatMap(([route, page]) => ([
      <Route key={route} path={route}><InfoPage page={page} lang="ko" /></Route>,
      <Route key={`/en${route}`} path={`/en${route}`}><InfoPage page={page} lang="en" /></Route>,
    ]))}
    <Route path="/news" component={NewsPage} />
    <Route path="/news/:slug" component={NewsDetailPage} />
    <Route path="/careers" component={CareersPage} />
    <Route path="/careers/:slug" component={CareersDetailPage} />
    <Route path="/contact" component={ContactPage} />
    <Route path="/en/news" component={EnglishNewsPage} />
    <Route path="/en/news/:slug" component={EnglishNewsDetailPage} />
    <Route path="/en/careers" component={EnglishCareersPage} />
    <Route path="/en/careers/:slug" component={EnglishCareerDetailPage} />
    <Route path="/en/contact" component={EnglishContactPage} />
    <Route><div className="not-found"><h1>Page not found.</h1><a href={lang === "en" ? "/en" : "/"}>{lang === "en" ? "Return home" : "홈으로 돌아가기"} ↗</a></div></Route>
  </Switch></main><Footer lang={lang} /></>;
}

export default App;
