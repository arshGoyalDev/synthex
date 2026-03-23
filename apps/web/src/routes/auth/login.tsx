import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "../../stores/auth.store";
import { Input } from "../../components/ui/Input";

export const Route = createFileRoute("/auth/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate({ to: "/" });
    } catch {
      // error set in store
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col animate-fade-in">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 lg:px-10 py-5">
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
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-tertiary hidden sm:inline">
            Don't have an account?
          </span>
          <Link
            to="/auth/signup"
            className="px-4 py-2 rounded-lg border border-border-default text-text-primary font-medium no-underline hover:bg-bg-secondary transition-colors text-sm"
          >
            Sign Up
          </Link>
        </div>
      </div>

      {/* Centered form */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold text-accent-primary uppercase tracking-widest mb-2">
              Login
            </p>
            <h1 className="text-3xl font-bold text-text-primary mb-2">
              Welcome Back
            </h1>
            <p className="text-sm text-text-secondary">
              Please enter your account details
            </p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-status-error-light border border-status-error/20 text-status-error text-sm flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={clearError}
                className="text-status-error/50 hover:text-status-error cursor-pointer bg-transparent border-none text-lg leading-none"
              >
                ×
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={
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
              }
            />

            <Input
              id="password"
              type="password"
              label="Password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-lg bg-accent-primary text-white font-semibold text-sm uppercase tracking-wider hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer border-none mt-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </>
              ) : (
                "Continue"
              )}
            </button>
          </form>

          <p className="text-center text-xs text-text-tertiary mt-8">
            By continuing, you agree to our Terms of Use and Privacy Policy.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center gap-6 text-xs text-text-tertiary px-6 py-5">
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
  );
}
