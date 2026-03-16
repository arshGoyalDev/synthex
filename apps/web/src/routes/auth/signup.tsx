import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "../../stores/auth.store";

export const Route = createFileRoute("/auth/signup")({
  component: SignupPage,
});

/* ——————————————————————————————————————————————
   Left Illustration Panel
   —————————————————————————————————————————————— */

function IllustrationPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-bg-secondary rounded-3xl p-10 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 rounded-full bg-accent-light blur-[60px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 rounded-full bg-accent-light/50 blur-[50px] pointer-events-none" />

      <div className="relative h-full flex flex-col justify-between">
        <div className="flex items-center gap-2.5 mb-16">
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
        </div>

        <div className="space-y-4 w-3/4">
          {/* Feature cards */}
          <div className="bg-bg-card rounded-xl p-5 border border-border-subtle shadow-sm animate-float">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-accent-primary text-white flex items-center justify-center">
                <svg
                  width="18"
                  height="18"
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
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Cloud IDE
                </p>
                <p className="text-xs text-text-tertiary">
                  Write code from anywhere
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="px-2.5 py-1 rounded-md bg-accent-light text-accent-dark text-[10px] font-medium">
                TypeScript
              </span>
              <span className="px-2.5 py-1 rounded-md bg-accent-light text-accent-dark text-[10px] font-medium">
                Python
              </span>
              <span className="px-2.5 py-1 rounded-md bg-accent-light text-accent-dark text-[10px] font-medium">
                Go
              </span>
              <span className="px-2.5 py-1 rounded-md bg-accent-light text-accent-dark text-[10px] font-medium">
                Rust
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div
              className="bg-bg-card rounded-xl p-4 border border-border-subtle"
              style={{ animationDelay: "1s" }}
            >
              <p className="text-2xl font-bold text-accent-primary mb-1">
                10K+
              </p>
              <p className="text-xs text-text-tertiary">Active developers</p>
            </div>
            <div className="bg-bg-card rounded-xl p-4 border border-border-subtle">
              <p className="text-2xl font-bold text-accent-primary mb-1">
                50M+
              </p>
              <p className="text-xs text-text-tertiary">Lines deployed</p>
            </div>
          </div>

          <div className="bg-bg-dark rounded-xl p-4 shadow-lg shadow-black/5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <span className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <span className="w-2 h-2 rounded-full bg-[#28c840]" />
            </div>
            <div className="font-mono text-[11px] leading-5 text-white/60">
              <div>
                <span className="text-green-400">$</span> synthex deploy --prod
              </div>
              <div className="text-white/30">✓ Build successful</div>
              <div className="text-white/30">
                ✓ Deployed to{" "}
                <span className="text-green-400">my-app.synthex.dev</span>
              </div>
            </div>
          </div>
        </div>

      <p className="text-xs text-text-tertiary mt-10 relative">
        Start building in seconds — no credit card required.
      </p>
      </div>
    </div>
  );
}

/* ——————————————————————————————————————————————
   Signup Page
   —————————————————————————————————————————————— */

function SignupPage() {
  const navigate = useNavigate();
  const { signup, isLoading, error, clearError } = useAuthStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters");
      return;
    }

    try {
      await signup(username, email, password);
      navigate({ to: "/" });
    } catch {
      // error set in store
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-bg-primary grid lg:grid-cols-2 p-4 lg:p-6 gap-6 animate-fade-in">
      {/* Left — Illustration */}
      <IllustrationPanel />

      {/* Right — Form */}
      <div className="flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-auto">
          <Link
            to="/"
            className="lg:hidden flex items-center gap-2 no-underline"
          >
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
            <span className="text-lg font-bold text-text-primary">Synthex</span>
          </Link>
          <div className="flex items-center gap-2 ml-auto text-sm">
            <span className="text-text-tertiary hidden sm:inline">
              Already have an account?
            </span>
            <Link
              to="/auth/login"
              className="px-4 py-2 rounded-lg border border-border-default text-text-primary font-medium no-underline hover:bg-bg-secondary transition-colors text-sm"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Form center */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm animate-slide-up">
            <div className="mb-8">
              <p className="text-xs font-semibold text-accent-primary uppercase tracking-widest mb-2">
                Sign Up
              </p>
              <h1 className="text-3xl font-bold text-text-primary mb-2">
                Create Account
              </h1>
              <p className="text-sm text-text-secondary">
                Start coding in seconds — free forever
              </p>
            </div>

            {displayError && (
              <div className="mb-5 px-4 py-3 rounded-lg bg-status-error-light border border-status-error/20 text-status-error text-sm flex items-center justify-between">
                <span>{displayError}</span>
                <button
                  onClick={() => {
                    setLocalError(null);
                    clearError();
                  }}
                  className="text-status-error/50 hover:text-status-error cursor-pointer bg-transparent border-none text-lg leading-none"
                >
                  ×
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="johndoe"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-bg-primary border border-border-default text-text-primary placeholder-text-tertiary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Email
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-lg bg-bg-primary border border-border-default text-text-primary placeholder-text-tertiary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg bg-bg-primary border border-border-default text-text-primary placeholder-text-tertiary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors bg-transparent border-none cursor-pointer p-0"
                  >
                    {showPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-text-primary mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-bg-primary border border-border-default text-text-primary placeholder-text-tertiary text-sm focus:outline-none focus:border-accent-primary focus:ring-2 focus:ring-accent-glow transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-lg bg-accent-primary text-white font-semibold text-sm uppercase tracking-wider hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border-none mt-2"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </form>

            <p className="text-center text-xs text-text-tertiary mt-8">
              By creating an account, you agree to our Terms of Use and Privacy
              Policy.
            </p>
          </div>
        </div>

        {/* Bottom */}
        <div className="flex items-center justify-center gap-6 text-xs text-text-tertiary pt-6">
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
      </div>
    </div>
  );
}
