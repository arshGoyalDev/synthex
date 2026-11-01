import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { tokenRef } from "../lib/tokenRef";

interface UseTerminalSocketOptions {
  projectId: string;
  userId: string;
  terminalId: string;
  enabled: boolean;
  onOutput: (data: string) => void;
  onReady: () => void;
  onError: (message: string) => void;
  onExit: () => void;
}

export function useTerminalSocket({
  projectId,
  userId,
  terminalId,
  enabled,
  onOutput,
  onReady,
  onError,
  onExit,
}: UseTerminalSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef({ onOutput, onReady, onError, onExit });

  useEffect(() => {
    handlersRef.current = { onOutput, onReady, onError, onExit };
  }, [onOutput, onReady, onError, onExit]);

  useEffect(() => {
    if (!enabled || !projectId || !userId || !terminalId) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(import.meta.env.VITE_SERVER_URL as string, {
      path: "/terminal/",
      query: { projectId, userId, terminalId },
      auth: { token: tokenRef.current },
      transports: ["polling", "websocket"],
      withCredentials: true,
      autoConnect: true,
    });

    socketRef.current = socket;
    const decoder = new TextDecoder();

    socket.on("terminal:ready", () => {
      handlersRef.current.onReady();
    });

    socket.on("terminal:output", ({ data }: { data: string }) => {
      const binary = atob(data);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      handlersRef.current.onOutput(decoder.decode(bytes, { stream: true }));
    });

    socket.on("terminal:error", ({ message }: { message: string }) => {
      handlersRef.current.onError(message);
    });

    socket.on("terminal:exit", () => {
      handlersRef.current.onExit();
    });

    socket.on("connect_error", (err) => {
      handlersRef.current.onError(`Connection error: ${err.message}`);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, projectId, userId, terminalId]);

  const sendInput = useCallback((data: string) => {
    const bytes = new TextEncoder().encode(data);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const encoded = btoa(binary);
    socketRef.current?.emit("terminal:input", { data: encoded });
  }, []);

  const sendResize = useCallback((rows: number, cols: number) => {
    socketRef.current?.emit("terminal:resize", { rows, cols });
  }, []);

  return { sendInput, sendResize };
}
