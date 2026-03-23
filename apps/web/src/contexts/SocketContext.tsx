/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { tokenRef } from "../lib/tokenRef";
import { useAuthStore } from "../stores/auth.store";

export interface SocketContextData {
  socket: Socket | null;
  isConnected: boolean;
}

export const SocketContext = createContext<SocketContextData>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    const socketInstance = io(import.meta.env.VITE_SERVER_URL as string, {
      auth: {
        token: tokenRef.current,
      },
      transports: ["websocket", "polling"],
      autoConnect: true,
      withCredentials: true,
    });

    socketInstance.on("connect", () => {
      console.log("[socket] Connected", socketInstance.id);
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      console.log("[socket] Disconnected");
      setIsConnected(false);
    });

    socketInstance.on("connect_error", (err) => {
      console.error("[socket] Connection error:", err.message);
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
