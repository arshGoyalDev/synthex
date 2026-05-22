import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useAuthStore } from "../../stores/auth.store";
import { Loader2, XCircle } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

/**
 * Landing page for GitHub OAuth redirects.
 *
 * The backend sends the browser here after a successful OAuth handshake:
 *   ${ORIGIN}/auth/callback?token=<accessToken>
 *
 * This page reads the token, stores it in the auth store, fetches the user
 * profile, then immediately navigates to the dashboard.
 */
function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loginWithOAuthToken } = useAuthStore();
  const handledRef = useRef(false); // guard against React StrictMode double-invoke

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    if (!token) {
      // No token → something went wrong, go back to login
      navigate({ to: "/auth/login", replace: true });
      return;
    }

    loginWithOAuthToken(token)
      .then(() => navigate({ to: "/", replace: true }))
      .catch(() => navigate({ to: "/auth/login", replace: true }));
  }, [token, loginWithOAuthToken, navigate]);

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center gap-5 animate-fade-in">
      {token ? (
        <>
          {/* Spinner while profile loads */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-accent-primary/10 animate-ping" />
            <div className="relative w-12 h-12 rounded-full bg-accent-primary/15 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-text-primary">
              Signing you in…
            </p>
            <p className="text-sm text-text-tertiary mt-1">
              Just a moment while we finish setting up your account.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Error state */}
          <div className="w-14 h-14 rounded-2xl bg-status-error/10 flex items-center justify-center">
            <XCircle className="w-7 h-7 text-status-error" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-text-primary">
              Authentication failed
            </p>
            <p className="text-sm text-text-tertiary mt-1">
              No token received from GitHub. Redirecting to login…
            </p>
          </div>
        </>
      )}
    </div>
  );
}
