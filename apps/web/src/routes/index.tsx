import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { useAuthStore } from "../stores/auth.store";
import { useProjectStore } from "../stores/project.store";
import type { Project } from "../types/project";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

/* ——————————————————————————————————————————————
   Index Page — Landing vs Dashboard
   —————————————————————————————————————————————— */
function IndexPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    if (!isAuthenticated) {
      checkAuth();
    }
  }, [isAuthenticated, checkAuth]);

  return isAuthenticated ? <Dashboard /> : <LandingPage />;
}

/* ══════════════════════════════════════════════
   ██  LANDING PAGE (unauthenticated)
   ══════════════════════════════════════════════ */

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-bg-primary/80 backdrop-blur-lg border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 no-underline">
          <div className="w-8 h-8 rounded-lg bg-accent-primary flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span className="text-lg font-bold text-text-primary tracking-tight">
            Synthex
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors no-underline"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors no-underline"
          >
            How It Works
          </a>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/auth/login"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors no-underline px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            to="/auth/signup"
            className="text-sm font-semibold text-white no-underline px-5 py-2.5 rounded-lg bg-accent-primary hover:bg-accent-dark transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-20 pb-28 lg:pt-32 lg:pb-40 overflow-hidden">
      <div className="absolute top-20 right-0 w-[500px] h-[500px] rounded-full bg-accent-light/50 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent-light/30 blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-16 items-center relative">
        <div className="animate-slide-up">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent-light text-accent-dark text-xs font-semibold mb-8 tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-primary" />
            Now in Public Beta
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.08] tracking-tight text-text-primary mb-6">
            Code. Build.
            <br />
            <span className="gradient-text">Deploy.</span>
          </h1>

          <p className="text-lg text-text-secondary leading-relaxed max-w-lg mb-10">
            A lightning-fast cloud IDE that lets you write, run, and ship code
            from anywhere. No setup required — just open and start building.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-accent-primary text-white font-semibold text-sm no-underline hover:bg-accent-dark transition-colors shadow-sm"
            >
              Start Coding — Free
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg border border-border-default text-text-secondary font-medium text-sm no-underline hover:bg-bg-secondary hover:text-text-primary transition-all"
            >
              Learn More
            </a>
          </div>
        </div>

        <div
          className="animate-fade-in hidden lg:block"
          style={{ animationDelay: "0.2s" }}
        >
          <EditorMockup />
        </div>
      </div>
    </section>
  );
}

function EditorMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 bg-gradient-to-br from-accent-light to-bg-secondary rounded-3xl blur-2xl opacity-60 pointer-events-none" />
      <div className="relative bg-bg-dark rounded-xl overflow-hidden shadow-2xl shadow-black/10 border border-black/5">
        <div className="flex items-center gap-2 px-4 py-3 bg-bg-dark-secondary border-b border-white/5">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex items-center gap-3 ml-4">
            <span className="px-3 py-1 rounded-md bg-white/5 text-xs text-white/60 font-mono">
              main.ts
            </span>
            <span className="text-xs text-white/30 font-mono">
              package.json
            </span>
          </div>
        </div>

        <div className="p-5 font-mono text-[13px] leading-7 text-white/70">
          <CodeLine n={1}>
            <Kw>import</Kw> {"{"} <Fn>createServer</Fn> {"}"} <Kw>from</Kw>{" "}
            <Str>"synthex"</Str>;
          </CodeLine>
          <CodeLine n={2}>{""}</CodeLine>
          <CodeLine n={3}>
            <Kw>const</Kw> <Var>app</Var> = <Fn>createServer</Fn>();
          </CodeLine>
          <CodeLine n={4}>{""}</CodeLine>
          <CodeLine n={5}>
            <Var>app</Var>.<Fn>get</Fn>(<Str>"/"</Str>, (<Var>req</Var>,{" "}
            <Var>res</Var>) {"=> {"})
          </CodeLine>
          <CodeLine n={6}>
            {"  "}
            <Var>res</Var>.<Fn>json</Fn>({"{"} <Var>status</Var>:{" "}
            <Str>"running"</Str> {"}"});
          </CodeLine>
          <CodeLine n={7}>{"});"}</CodeLine>
          <CodeLine n={8}>{""}</CodeLine>
          <CodeLine n={9}>
            <Var>app</Var>.<Fn>listen</Fn>(<Num>3000</Num>);
          </CodeLine>
          <CodeLine n={10}>
            <Cmt>{"// ✨ Live at my-app.synthex.dev"}</Cmt>
          </CodeLine>
        </div>

        <div className="border-t border-white/5 px-5 py-3 bg-bg-dark-secondary">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-green-400">$</span>
            <span className="text-white/50">Server running on port 3000</span>
            <span className="w-2 h-4 bg-green-400/70 animate-pulse ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
}

function CodeLine({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex">
      <span className="w-8 shrink-0 text-right text-white/20 select-none mr-5">
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}
function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-purple-400">{children}</span>;
}
function Fn({ children }: { children: React.ReactNode }) {
  return <span className="text-blue-400">{children}</span>;
}
function Str({ children }: { children: React.ReactNode }) {
  return <span className="text-green-400">{children}</span>;
}
function Var({ children }: { children: React.ReactNode }) {
  return <span className="text-sky-300">{children}</span>;
}
function Num({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-400">{children}</span>;
}
function Cmt({ children }: { children: React.ReactNode }) {
  return <span className="text-white/30 italic">{children}</span>;
}

const FEATURES = [
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="m8 21 4-4 4 4" />
        <path d="m7 10 2 2 4-4" />
      </svg>
    ),
    title: "Instant Environments",
    desc: "Spin up fully configured workspaces in under 3 seconds. Zero downloads, zero setup.",
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    title: "Live Collaboration",
    desc: "Code together in real time with multiplayer cursors, shared terminals, and inline comments.",
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
    title: "Secure by Default",
    desc: "Isolated containers, encrypted storage, and enterprise-grade authentication baked in.",
  },
  {
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    title: "Multi-Language",
    desc: "TypeScript, Python, Go, Rust, and more. Each workspace uses the right runtime out of the box.",
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="py-24 lg:py-32 bg-bg-secondary">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-accent-primary uppercase tracking-widest mb-3">
            Features
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-4">
            Everything you need to ship faster
          </h2>
          <p className="text-text-secondary text-base max-w-2xl mx-auto">
            From prototyping to production, Synthex has every tool you need in
            one place.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="group bg-bg-card rounded-xl p-7 border border-border-subtle hover:border-accent-primary/30 hover:shadow-lg hover:shadow-accent-glow transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-accent-light text-accent-primary flex items-center justify-center mb-5 group-hover:bg-accent-primary group-hover:text-white transition-colors duration-300">
                {f.icon}
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  {
    step: "01",
    title: "Create a Project",
    desc: "Pick a template or start from scratch. Your workspace is ready in seconds.",
  },
  {
    step: "02",
    title: "Write & Run Code",
    desc: "Full editor experience with smart autocomplete, linting, and integrated terminal.",
  },
  {
    step: "03",
    title: "Deploy Instantly",
    desc: "Hit deploy to get a live URL — automatic builds, containers, and CDN included.",
  },
];

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-semibold text-accent-primary uppercase tracking-widest mb-3">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-4">
            Three steps. That's it.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {STEPS.map((s, i) => (
            <div key={i} className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent-light text-accent-primary text-lg font-bold mb-5">
                {s.step}
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                {s.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-24 lg:py-32">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="bg-bg-dark rounded-2xl p-12 sm:p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-accent-primary/10 blur-[80px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-60 h-60 rounded-full bg-accent-secondary/10 blur-[60px] pointer-events-none" />

          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4">
              Ready to start building?
            </h2>
            <p className="text-white/60 text-base mb-10 max-w-md mx-auto">
              Join developers who code, collaborate, and deploy with Synthex
              every day.
            </p>
            <Link
              to="/auth/signup"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-accent-primary text-white font-semibold text-sm no-underline hover:bg-accent-secondary transition-colors"
            >
              Get Started — Free
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border-subtle py-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-accent-primary flex items-center justify-center">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-text-secondary">
            Synthex
          </span>
        </div>
        <div className="flex items-center gap-6 text-xs text-text-tertiary">
          <a
            href="#"
            className="hover:text-text-secondary transition-colors no-underline"
          >
            Terms of Use
          </a>
          <a
            href="#"
            className="hover:text-text-secondary transition-colors no-underline"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="hover:text-text-secondary transition-colors no-underline"
          >
            Contact Us
          </a>
        </div>
        <p className="text-xs text-text-tertiary">
          &copy; {new Date().getFullYear()} Synthex
        </p>
      </div>
    </footer>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CtaSection />
      <Footer />
    </div>
  );
}

/* ══════════════════════════════════════════════
   ██  DASHBOARD (authenticated)
   ══════════════════════════════════════════════ */

/* ——— Language → colour mapping ——— */
const LANG_COLORS: Record<
  string,
  { bg: string; text: string; accent: string }
> = {
  typescript: { bg: "#1e3a5f", text: "#60a5fa", accent: "#3b82f6" },
  javascript: { bg: "#4a3f1f", text: "#fbbf24", accent: "#f59e0b" },
  python: { bg: "#1e3a3a", text: "#34d399", accent: "#10b981" },
  go: { bg: "#1a3040", text: "#67e8f9", accent: "#06b6d4" },
  rust: { bg: "#3b2020", text: "#f87171", accent: "#ef4444" },
  java: { bg: "#3b2a1a", text: "#fb923c", accent: "#f97316" },
  csharp: { bg: "#2e1e4a", text: "#c084fc", accent: "#a855f7" },
  cpp: { bg: "#2e1e4a", text: "#c084fc", accent: "#a855f7" },
  ruby: { bg: "#3b1a1a", text: "#fca5a5", accent: "#ef4444" },
  php: { bg: "#2a2040", text: "#a78bfa", accent: "#8b5cf6" },
};
const DEFAULT_LANG = { bg: "#1a1a2e", text: "#a1a1aa", accent: "#71717a" };
function getLang(lang: string) {
  return LANG_COLORS[lang.toLowerCase()] ?? DEFAULT_LANG;
}

/* ——— Relative-time helper ——— */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/* ——— Icons ——— */
function IconChevronLeft({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function IconChevronRight({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
function IconPlus({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}
function IconDots({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
function IconPin({
  size = 16,
  filled = false,
}: {
  size?: number;
  filled?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}
function IconCode({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function IconLogout({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
function IconEdit({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}
function IconTrash({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

/* ——— Three-Dot Menu ——— */
function ProjectMenu({
  project,
  onDelete,
  onTogglePin,
  onEdit,
}: {
  project: Project;
  onDelete: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-overlay transition-colors bg-transparent border-none cursor-pointer"
      >
        <IconDots size={16} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-44 bg-bg-secondary border border-border-default rounded-xl shadow-xl shadow-black/30 py-1.5 z-50 animate-fade-in"
          style={{ animationDuration: "0.15s" }}
        >
          <MenuBtn
            icon={<IconEdit />}
            label="Edit Details"
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
          />
          <MenuBtn
            icon={<IconPin size={16} filled={project.isPinned} />}
            label={project.isPinned ? "Unpin" : "Pin"}
            onClick={() => {
              onTogglePin();
              setOpen(false);
            }}
          />
          <div className="my-1 border-t border-border-subtle" />
          <MenuBtn
            icon={<IconTrash />}
            label="Delete"
            danger
            onClick={() => {
              onDelete();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuBtn({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm bg-transparent border-none cursor-pointer transition-colors ${
        danger
          ? "text-status-error hover:bg-status-error-light"
          : "text-text-secondary hover:text-text-primary hover:bg-surface-overlay"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ——— Project Card ——— */
function ProjectCard({
  project,
  onDelete,
  onTogglePin,
  onEdit,
}: {
  project: Project;
  onDelete: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
}) {
  const lang = getLang(project.language);

  return (
    <div className="group bg-bg-secondary border border-border-default rounded-xl hover:border-border-focus hover:shadow-xl hover:shadow-black/40 transition-all duration-300 cursor-pointer flex flex-col relative">
      {/* Subtle top accent border based on language */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px] opacity-70 group-hover:opacity-100 transition-opacity rounded-t-xl"
        style={{ backgroundColor: lang.accent }}
      />

      {/* Thumbnail area (cleaner, smaller, flatter) */}
      <div className="h-28 flex items-center justify-center bg-bg-dark relative overflow-hidden rounded-t-xl border-b border-border-subtle">
        {/* Abstract pattern / subtle glow */}
        <div 
          className="absolute inset-0 opacity-10 mix-blend-screen"
          style={{
            background: `radial-gradient(circle at 50% 120%, ${lang.accent} 0%, transparent 70%)`
          }}
        />
        
        <div 
          className="w-12 h-12 rounded-lg bg-surface-elevated border border-border-default flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform duration-300 z-10"
          style={{ color: lang.accent }}
        >
          <IconCode size={24} />
        </div>

        {project.isPinned && (
          <div className="absolute top-3 left-3 text-amber-500 z-10 drop-shadow-md">
            <IconPin size={14} filled />
          </div>
        )}

        <div
          className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase z-10 border border-border-default bg-surface-elevated/80 backdrop-blur-md"
          style={{ color: lang.text }}
        >
          {project.language}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 flex flex-col gap-1.5 bg-bg-secondary group-hover:bg-bg-card-hover rounded-b-xl transition-colors duration-300">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-text-primary truncate m-0 group-hover:text-white transition-colors">
            {project.name}
          </h3>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 -mt-1 -mr-1">
            <ProjectMenu
              project={project}
              onDelete={onDelete}
              onTogglePin={onTogglePin}
              onEdit={onEdit}
            />
          </div>
        </div>
        
        <p className="text-[13px] text-text-tertiary leading-snug line-clamp-2 m-0 flex-1">
          {project.description || <span className="italic opacity-50">No description</span>}
        </p>
        
        <div className="flex items-center justify-between mt-3">
          <p className="text-[11px] font-medium text-text-tertiary m-0 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: lang.accent }} />
            {timeAgo(project.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ——— Modal base ——— */
function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      style={{ animationDuration: "0.15s" }}
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary border border-border-default rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-black/40 animate-slide-up"
        style={{ animationDuration: "0.2s" }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ——— Rename Dialog ——— */
function RenameDialog({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const renameProject = useProjectStore((s) => s.renameProject);
  const [name, setName] = useState(project?.name ?? "");

  useEffect(() => {
    if (project) setName(project.name);
  }, [project]);

  if (!project) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-4 mt-0">
        Rename Project
      </h2>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all mb-5"
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            renameProject(project.id, name.trim());
            onClose();
          }
        }}
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-transparent border border-border-default hover:bg-surface-overlay transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (name.trim()) {
              renameProject(project.id, name.trim());
              onClose();
            }
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent-primary hover:bg-accent-dark transition-colors cursor-pointer border-none"
        >
          Rename
        </button>
      </div>
    </Modal>
  );
}

/* ——— Delete Confirmation ——— */
function DeleteDialog({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const deleteProject = useProjectStore((s) => s.deleteProject);

  if (!project) return null;

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-2 mt-0">
        Delete Project
      </h2>
      <p className="text-sm text-text-secondary mb-6">
        Are you sure you want to delete{" "}
        <strong className="text-text-primary">{project.name}</strong>? This
        action cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-transparent border border-border-default hover:bg-surface-overlay transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            deleteProject(project.id);
            onClose();
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-status-error hover:bg-red-600 transition-colors cursor-pointer border-none"
        >
          Delete
        </button>
      </div>
    </Modal>
  );
}

/* ——— Edit Details Dialog ——— */
function EditDetailsDialog({
  project,
  open,
  onClose,
}: {
  project: Project | null;
  open: boolean;
  onClose: () => void;
}) {
  const updateProject = useProjectStore((s) => s.updateProject);
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [language, setLanguage] = useState(project?.language ?? "");

  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setLanguage(project.language);
    }
  }, [project]);

  if (!project) return null;

  const handleSave = () => {
    updateProject(project.id, {
      name: name.trim() || project.name,
      description: description.trim() || null,
      language: language.trim() || project.language,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-lg font-semibold text-text-primary mb-5 mt-0">
        Edit Project Details
      </h2>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Language
          </label>
          <input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg bg-bg-primary border border-border-default text-text-primary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary bg-transparent border border-border-default hover:bg-surface-overlay transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-accent-primary hover:bg-accent-dark transition-colors cursor-pointer border-none"
        >
          Save
        </button>
      </div>
    </Modal>
  );
}

/* ——— Sidebar ——— */
function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  const navItems = [
    { icon: <IconCode size={18} />, label: "Projects", active: true },
    { icon: <IconPlus size={18} />, label: "Activity", active: false },
    { icon: <IconEdit size={18} />, label: "Settings", active: false },
  ];

  return (
    <aside
      className="h-screen flex flex-col bg-bg-dark border-r border-border-subtle transition-all duration-300 relative flex-shrink-0"
      style={{ width: collapsed ? 68 : 240 }}
    >
      <button
        onClick={onToggle}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-surface-elevated border border-border-default shadow-sm flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-bg-card-hover transition-colors cursor-pointer"
      >
        {collapsed ? (
          <IconChevronRight size={14} />
        ) : (
          <IconChevronLeft size={14} />
        )}
      </button>

      {/* Workspace Header */}
      <div className="flex items-center gap-3 px-4 h-16 flex-shrink-0 mt-2">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-accent-primary to-accent-dark flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent-primary/20">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-text-primary tracking-tight whitespace-nowrap truncate">
              {user?.username ? `${user.username}'s Workspace` : "My Workspace"}
            </span>
            <span className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider">
              Free Plan
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-3 pt-6 pb-3 flex flex-col gap-1">
        {navItems.map((item, idx) => (
          <button
            key={idx}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border-none ${
              item.active
                ? "bg-accent-light/50 text-accent-primary"
                : "bg-transparent text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
            } ${collapsed ? "justify-center px-0" : ""}`}
          >
            {item.icon}
            {!collapsed && item.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* User Profile Footer */}
      <div className="p-3">
        <div
          className={`flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-overlay transition-colors mx-1 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-border-default"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-surface-elevated border border-border-default flex items-center justify-center text-text-secondary font-semibold text-xs flex-shrink-0">
              {user?.username?.charAt(0).toUpperCase() ??
                user?.email?.charAt(0).toUpperCase() ??
                "?"}
            </div>
          )}
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate m-0 leading-tight">
                {user?.username ?? "User"}
              </p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-md text-text-tertiary hover:text-status-error hover:bg-status-error-light transition-colors bg-transparent border-none cursor-pointer"
              title="Logout"
            >
              <IconLogout size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

/* ——— Activity Graph ——— */
function ActivityGraph() {
  // Generate random data for the last 14 weeks (approx 3 months)
  const renderSquare = (level: number, key: string) => {
    let bg = "bg-surface-elevated"; // level 0
    if (level === 1) bg = "bg-accent-light/60";
    if (level === 2) bg = "bg-accent-primary/60";
    if (level === 3) bg = "bg-accent-primary";
    if (level === 4) bg = "bg-accent-dark";

    return (
      <div
        key={key}
        className={`w-[11px] h-[11px] rounded-[2px] ${bg} border border-[rgba(255,255,255,0.02)]`}
        title={`Activity level: ${level}`}
      />
    );
  };

  const weeksData = useMemo(() => {
    const weeks = [];
    for (let w = 0; w < 16; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        // Random activity level favoring 0 and 1
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Supress random warning for mock data
        const r = Math.random();
        let level = 0;
        if (r > 0.6) level = 1;
        if (r > 0.8) level = 2;
        if (r > 0.9) level = 3;
        if (r > 0.97) level = 4;
        days.push(renderSquare(level, `${w}-${d}`));
      }
      weeks.push(
        <div key={w} className="flex flex-col gap-[3px]">
          {days}
        </div>
      );
    }
    return weeks;
  }, []);

  return (
    <div className="mb-10 p-5 rounded-xl border border-border-default bg-bg-secondary flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary m-0">
          Recent Activity
        </h2>
        <span className="text-xs text-text-tertiary font-medium">104 contributions</span>
      </div>
      
      <div className="flex gap-[3px] overflow-hidden">
        {weeksData}
      </div>

      <div className="flex items-center justify-end gap-2 text-[10px] text-text-tertiary mt-1">
        <span>Less</span>
        <div className="flex gap-[3px]">
          {renderSquare(0, "l0")}
          {renderSquare(1, "l1")}
          {renderSquare(2, "l2")}
          {renderSquare(3, "l3")}
          {renderSquare(4, "l4")}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}

/* ——— Projects Grid ——— */
function ProjectsGrid() {
  const { projects, isLoading, fetchProjects, togglePin } = useProjectStore();
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const sorted = [...projects].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });



  return (
    <main className="flex-1 overflow-y-auto bg-bg-primary">
      <div className="max-w-6xl mx-auto px-6 lg:px-10 py-8">
        
        <ActivityGraph />

        {/* Top Header & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight m-0">
              Projects
            </h1>
            <p className="text-sm text-text-tertiary mt-1 m-0">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Fake Search Input */}
            <div className="relative group hidden sm:block">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-tertiary group-focus-within:text-accent-primary transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </svg>
              </div>
              <input 
                type="text" 
                placeholder="Search projects..." 
                className="w-64 pl-9 pr-4 py-2 rounded-lg bg-bg-secondary border border-border-default text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all shadow-sm"
              />
            </div>

            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-text-primary text-bg-primary font-medium text-sm hover:bg-white transition-colors cursor-pointer border-none shadow-sm">
              <IconPlus size={16} />
              New Project
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <span className="w-6 h-6 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4 text-text-tertiary">
              <IconCode size={28} />
            </div>
            <h2 className="text-lg font-semibold text-text-primary mb-2">
              No projects yet
            </h2>
            <p className="text-sm text-text-tertiary mb-6 max-w-sm">
              Create your first project to start coding in the cloud.
            </p>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-text-primary text-bg-primary font-medium text-sm hover:bg-white transition-colors cursor-pointer border-none shadow-sm">
              <IconPlus size={16} />
              Create Project
            </button>
          </div>
        )}

        {!isLoading && projects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 animate-fade-in">
            {sorted.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={() => setDeleteTarget(p)}
                onTogglePin={() => togglePin(p.id)}
                onEdit={() => setEditTarget(p)}
              />
            ))}
          </div>
        )}
      </div>

      <DeleteDialog
        project={deleteTarget}
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
      <EditDetailsDialog
        project={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
      />
    </main>
  );
}

/* ——— Dashboard ——— */
function Dashboard() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <ProjectsGrid />
    </div>
  );
}
