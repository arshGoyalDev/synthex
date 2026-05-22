import React from "react";
import { Link } from "@tanstack/react-router";

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-bg-primary pt-2">
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
            className="text-sm font-medium text-text-primary hover:text-text-primary transition-colors no-underline px-4 py-2"
          >
            Sign In
          </Link>
          <Link
            to="/auth/signup"
            className="text-sm font-semibold text-text-primary no-underline px-5 py-2.5"
          >
            Start Building
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

      <div className="flex flex-col text-center items-center justify-center w-full">
        <h1 className="text-5xl sm:text-6xl font-extrabold leading-[1.08] tracking-tight text-text-primary mb-6">
          Code. <span className="text-accent-primary">Build.</span> Test.
        </h1>

        <p className="text-lg text-text-secondary leading-relaxed max-w-lg mb-10">
          A lightning-fast cloud IDE that lets you write, run, and ship code
          from anywhere. No setup required — just open and start building.
        </p>

        <div className="flex flex-wrap gap-4 pb-10">
          <Link
            to="/auth/signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-accent-primary text-white font-semibold text-sm no-underline hover:bg-accent-dark transition-colors shadow-sm"
          >
            Start Building
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

        <div
          className="animate-fade-in hidden lg:block w-full max-w-[800px] mx-10"
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
            <Var>app</Var>.<Fn>get</Fn>
            {"("}
            <Str>"/"</Str>, (<Var>req</Var>, <Var>res</Var>) {"=> {"}
          </CodeLine>
          <CodeLine n={6}>
            <span className="opacity-0">{"djkd"}</span>
            <Var>res</Var>.<Fn>json</Fn>({"{"} <Var>status</Var>:{" "}
            <Str>"running"</Str> {"}"});
          </CodeLine>
          <CodeLine n={7}>{"});"}</CodeLine>
          <CodeLine n={8}>{""}</CodeLine>
          <CodeLine n={9}>
            <Var>app</Var>.<Fn>listen</Fn>(<Num>3000</Num>);
          </CodeLine>
          <CodeLine n={10}>
            <Cmt>{"// ✨ Live at syntex.com/project/${projectId}/preview"}</Cmt>
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
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M17 2v4M12 2v4M7 2v4M2 11h20" />
      </svg>
    ),
    title: "Execute, Preview",
    desc: "Run code with one click and get a live preview URL to share instantly. No more local setup headaches.",
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
    <section id="features" className="py-24 lg:py-32">
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
              className="group bg-bg-card rounded-xl p-7 border border-border-subtle hover:border-accent-primary/30 transition-all duration-300"
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
    title: "Test & Preview",
    desc: "Run your app with one click and get a live preview URL to share with anyone.",
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
    <section className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute top-0 right-0 w-200 h-200 rounded-full bg-accent-primary/10 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-accent-secondary/10 blur-[60px] pointer-events-none" />
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <div className="bg-bg-dark rounded-2xl p-12 sm:p-16 text-center relative overflow-hidden">
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
    <footer className="py-8">
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

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Navbar />
      <div className="mx-10 xl:mx-20 border-border-subtle border-2 rounded-2xl my-2 mb-8">
        <HeroSection />
      </div>
      <div className="mx-10 xl:mx-20 border-transparent border-2 bg-accent-glow/60 rounded-2xl my-2 mb-8">
        <FeaturesSection />
      </div>
      <div className="mx-10 xl:mx-20 border-transparent border-2 bg-bg-card-hover/60 rounded-2xl my-2 mb-8">
        <HowItWorksSection />
      </div>
      <div className="mx-10 xl:mx-20 border-border-subtle border-2 rounded-2xl my-2 mb-10">
        <CtaSection />
      </div>

      <Footer />
    </div>
  );
}
