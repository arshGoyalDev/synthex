import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SocketProvider } from "../contexts/SocketContext";
import { useAuthStore } from "../stores/auth.store";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const isAuthChecking = useAuthStore((s) => s.isAuthChecking);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary">
        <Loader2 className="animate-spin w-8 h-8 text-accent-primary" />
      </div>
    );
  }

  return (
    <SocketProvider>
      <Outlet />
    </SocketProvider>
  );
}
