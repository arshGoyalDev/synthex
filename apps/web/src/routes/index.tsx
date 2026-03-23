import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "../stores/auth.store";
import { Dashboard } from "../components/dashboard/Dashboard";
import { LandingPage } from "../components/landing/LandingPage";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

/* ——————————————————————————————————————————————
   Index Page — Landing vs Dashboard
   —————————————————————————————————————————————— */
function IndexPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return isAuthenticated ? <Dashboard /> : <LandingPage />;
}
