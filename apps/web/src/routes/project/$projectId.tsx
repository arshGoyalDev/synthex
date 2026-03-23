import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useSocket } from "../../contexts/SocketContext";
import { getProjectById, startProject, stopProject } from "../../services/project.service";
import { useProjectStore } from "../../stores/project.store";
import type { Project } from "../../types/project";
import { Loader2, Play, Square, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/project/$projectId")({
  component: ProjectPage,
});

function ProjectPage() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();
  const projects = useProjectStore((s) => s.projects);
  
  const [project, setProject] = useState<Project | null>(() => projects.find((p) => p.id === projectId) || null);
  const [loading, setLoading] = useState(true);
  const [containerStatus, setContainerStatus] = useState<string>(project?.containerStatus || "unknown");
  const [containerMsg, setContainerMsg] = useState<string>("");
  const currentStatusRef = useRef(project?.containerStatus || "unknown");

  useEffect(() => {
    let isCancelled = false;

    async function initializeProject() {
      try {
        setLoading(true);
        let p = projects.find((x) => x.id === projectId);
        
        if (!p) {
          p = await getProjectById(projectId);
        }
        
        if (isCancelled) return;
        
        if (p) {
          setProject(p);
          const initialStatus = p.containerStatus || "unknown";
          setContainerStatus(initialStatus);
          currentStatusRef.current = initialStatus;

          if (initialStatus !== "ready" && initialStatus !== "starting" && initialStatus !== "pending") {
            try {
              // Also wait for start to complete to show a smooth loading if needed
              const startData = await startProject(projectId);
              if (!isCancelled && currentStatusRef.current !== "ready") {
                setContainerStatus(startData.status);
                currentStatusRef.current = startData.status;
                if (startData.message) {
                  setContainerMsg(startData.message);
                }
              }
            } catch (err) {
              console.error("Failed to start project automatically:", err);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch/initialize project", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }
    
    initializeProject();

    return () => {
      isCancelled = true;
    };
  }, [projectId]); // not adding 'projects' to avoid re-triggering, this acts as mount check

  useEffect(() => {
    if (!socket) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onContainerStatus = (data: any) => {
      if (data.projectId === projectId) {
        currentStatusRef.current = data.status;
        setContainerStatus(data.status);
        if (data.message) {
          setContainerMsg(data.message);
        }
      }
    };

    socket.on("container:status", onContainerStatus);

    return () => {
      socket.off("container:status", onContainerStatus);
    };
  }, [socket, projectId]);

  const handleStart = async () => {
    try {
      const startData = await startProject(projectId);
      setContainerStatus(startData.status);
      if (startData.message) {
        setContainerMsg(startData.message);
      }
    } catch (err) {
      console.error("Failed to start project:", err);
    }
  };

  const handleStop = async () => {
    try {
      await stopProject(projectId);
      navigate({ to: "/" });
    } catch (err) {
      console.error("Failed to stop project:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary flex-col gap-4">
        <Loader2 className="animate-spin w-8 h-8 text-accent-primary" />
        <p className="text-sm font-medium animate-pulse">Initializing Project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary text-text-primary">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
          <p className="text-text-secondary">The requested project does not exist or you do not have access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col text-text-primary">
      {/* Top Navbar */}
      <header className="h-14 border-b border-border-default flex items-center justify-between px-4 bg-bg-secondary shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-sm">{project.name}</h1>
          <div className="flex items-center gap-2 text-xs font-medium px-2 py-1 rounded-md bg-bg-tertiary">
            <span className={`w-2 h-2 rounded-full ${
              containerStatus === "ready" ? "bg-green-500" :
              containerStatus === "pending" || containerStatus === "starting" ? "bg-yellow-500 animate-pulse" :
              containerStatus === "error" ? "bg-red-500" :
              "bg-gray-500"
            }`} />
            <span className="capitalize">{containerStatus}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-tertiary mr-2">Socket: {isConnected ? "Connected" : "Disconnected"}</span>
          {(containerStatus === "stopped" || containerStatus === "timeout" || containerStatus === "error" || containerStatus === "unknown") && (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-accent-primary hover:bg-accent-hover text-white rounded-md transition-colors"
            >
              <Play size={14} /> Start Environment
            </button>
          )}
          {containerStatus === "ready" && (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors"
            >
              <Square size={14} /> Stop
            </button>
          )}
        </div>
      </header>
      
      {/* Workspace Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border-default bg-bg-secondary hidden md:flex flex-col">
          <div className="p-3 border-b border-border-subtle text-xs font-semibold text-text-secondary uppercase tracking-wider">
            Files
          </div>
          <div className="p-4 flex-1 text-sm text-text-tertiary text-center flex items-center justify-center">
            File tree not implemented yet.
          </div>
        </aside>
        
        {/* Editor & Terminal Area */}
        <div className="flex-1 flex flex-col bg-bg-primary">
          <div className="flex-1 flex items-center justify-center text-text-tertiary border-b border-border-default">
            {containerStatus === "ready" ? (
               <p>Editor Area. Status: Ready.</p>
            ) : (
               <div className="flex flex-col items-center gap-4">
                 {containerStatus === "pending" || containerStatus === "starting" ? (
                   <>
                    <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
                    <p>Starting container environment...</p>
                    {containerMsg && <p className="text-sm text-text-secondary">{containerMsg}</p>}
                   </>
                 ) : (
                   <p>Start the environment to write code.</p>
                 )}
               </div>
            )}
          </div>
          
          <div className="h-64 bg-[#1e1e1e] p-4 font-mono text-sm overflow-y-auto text-gray-300">
             <div className="text-gray-500 mb-2">// Terminal Output</div>
             <div className="flex gap-2">
               <span className="text-green-400">➜</span>
               <span>~</span>
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}
