import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import { X, Check } from "lucide-react";
import { LANGUAGES, TEMPLATES } from "@synthex/types";
import { createProject, type CreateProjectPayload } from "../services/project.service";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "./ui/Input";

interface CreateProjectModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({ isOpen, onOpenChange }: CreateProjectModalProps) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("info");
  
  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const templatesList = Object.values(TEMPLATES);
  const languagesList = Object.values(LANGUAGES);

  // Computed state
  const type = selectedTemplate
    ? "template"
    : selectedLanguages.length > 0
    ? "blank"
    : "raw";

  const handleNext = () => {
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (name.length < 2) {
      setError("Project name must be at least 2 characters.");
      return;
    }
    setError("");
    setActiveTab("review");
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError("");

      const payload: CreateProjectPayload = {
        name,
        description,
        type: type as "template" | "blank" | "raw",
      };

      if (type === "template" && selectedTemplate) {
        payload.template = selectedTemplate;
      } else if (type === "blank") {
        payload.languages = selectedLanguages;
      }

      const project = await createProject(payload);

      // Listen for socket if needed here, but the global root or project page normally listens.
      // E.g., we subscribe to standard events on gateway.
      // Switch frontend to /project/{projectId}
      
      onOpenChange(false);
      navigate({ to: `/project/${project.id}` });
      
    } catch (err: unknown) {
      console.error(err);
      let errorMessage = "Failed to create project";
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      if (err && typeof err === "object" && "response" in err) {
        const resp = (err as { response?: { data?: { message?: string } } }).response;
        if (resp?.data?.message) {
          errorMessage = resp.data.message;
        }
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" />
        <Dialog.Content className="fixed top-1/2 left-1/2 max-h-[85vh] w-[90vw] max-w-150 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-bg-primary border border-border-default shadow-2xl p-6 z-50 flex flex-col focus:outline-none">
          
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-xl font-semibold text-text-primary">
              Create New Project
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="text-text-tertiary hover:text-text-primary transition-colors focus:outline-none"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <Tabs.List className="flex gap-4 border-b border-border-default mb-4">
              <Tabs.Trigger
                value="info"
                className="pb-2 text-sm font-medium transition-colors data-[state=active]:text-accent-primary data-[state=active]:border-b-2 data-[state=active]:border-accent-primary text-text-secondary hover:text-text-primary px-1"
              >
                1. Project Info
              </Tabs.Trigger>
              <Tabs.Trigger
                value="review"
                disabled={!name.trim()}
                className="pb-2 text-sm font-medium transition-colors data-[state=active]:text-accent-primary data-[state=active]:border-b-2 data-[state=active]:border-accent-primary text-text-secondary hover:text-text-primary px-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                2. Review & Create
              </Tabs.Trigger>
            </Tabs.List>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <Tabs.Content value="info" className="space-y-5 focus:outline-none">
                
                {/* Name */}
                <Input
                  label="Project Name *"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-awesome-project"
                />

                {/* Description */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary block">
                    Description <span className="text-text-tertiary font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this project about?"
                    rows={2}
                    className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary transition-all text-sm resize-none"
                  />
                </div>

                {/* Template Selection */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-text-secondary block">
                    Template
                  </label>
                  <div className="text-xs text-text-tertiary mb-2">
                    Select a boilerplate to get started quickly.
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-2 custom-scrollbar pr-1">
                    {templatesList.map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => {
                          setSelectedTemplate(selectedTemplate === tpl.id ? null : tpl.id);
                          if (selectedTemplate !== tpl.id) {
                            setSelectedLanguages([]); // clear languages if template selected
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedTemplate === tpl.id
                            ? "border-accent-primary bg-accent-primary/5"
                            : "border-border-default bg-bg-secondary hover:border-border-hover dark:hover:bg-bg-tertiary"
                        }`}
                      >
                        <div 
                          className="w-8 h-8 rounded shrink-0 flex flex-col justify-center items-center text-white font-bold text-xs" 
                          style={{ backgroundColor: tpl.color }}
                        >
                          {tpl.name.substring(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary truncate">{tpl.name}</div>
                          <div className="text-xs text-text-tertiary truncate">{tpl.description}</div>
                        </div>
                        {selectedTemplate === tpl.id && <Check size={16} className="text-accent-primary shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optional Languages Section (only if no template) */}
                {!selectedTemplate && (
                  <div className="space-y-1.5 pt-2 border-t border-border-default">
                    <label className="text-sm font-medium text-text-secondary block">
                      Or Start Blank with Languages
                    </label>
                    <div className="text-xs text-text-tertiary mb-2">
                      Select up to 5 languages for a blank environment.
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                      {languagesList.map((lang) => {
                        const isSelected = selectedLanguages.includes(lang.id);
                        return (
                          <div
                            key={lang.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedLanguages(selectedLanguages.filter((l) => l !== lang.id));
                              } else {
                                if (selectedLanguages.length < 5) {
                                  setSelectedLanguages([...selectedLanguages, lang.id]);
                                }
                              }
                            }}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                              isSelected
                                ? "border-accent-primary bg-accent-primary/5"
                                : "border-border-default bg-bg-secondary hover:border-border-hover dark:hover:bg-bg-tertiary"
                            } ${!isSelected && selectedLanguages.length >= 5 ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div 
                              className="w-6 h-6 rounded shrink-0" 
                              style={{ backgroundColor: lang.color }}
                            />
                            <div className="flex-1 text-sm font-medium text-text-primary truncate">{lang.name}</div>
                            {isSelected && <Check size={14} className="text-accent-primary shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
              </Tabs.Content>

              <Tabs.Content value="review" className="space-y-5 focus:outline-none">
                <div className="bg-bg-secondary p-4 rounded-xl border border-border-default">
                  <h3 className="text-lg font-semibold text-text-primary mb-1">{name}</h3>
                  {description && <p className="text-sm text-text-tertiary mb-4">{description}</p>}
                  
                  <div className="space-y-3 mt-4">
                    <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                      <span className="text-sm text-text-secondary">Type</span>
                      <span className="text-sm font-medium text-text-primary capitalize bg-bg-tertiary px-2 py-0.5 rounded">
                        {type}
                      </span>
                    </div>

                    {type === "template" && selectedTemplate && (
                      <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                        <span className="text-sm text-text-secondary">Template</span>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: TEMPLATES[selectedTemplate]?.color }} />
                          <span className="text-sm font-medium text-text-primary">{TEMPLATES[selectedTemplate]?.name}</span>
                        </div>
                      </div>
                    )}

                    {type === "blank" && selectedLanguages.length > 0 && (
                      <div className="flex justify-between items-center py-2 border-b border-border-subtle">
                        <span className="text-sm text-text-secondary">Languages</span>
                        <div className="flex gap-2">
                          {selectedLanguages.map(l => (
                            <span key={l} className="text-xs font-medium text-text-primary bg-bg-tertiary px-2 py-0.5 rounded">
                              {LANGUAGES[l]?.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {type === "raw" && (
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600/90 text-sm mt-4">
                        <strong>Raw Project Warning:</strong> No template or languages selected. You will get a completely empty workspace. This requires setting up all configurations manually.
                      </div>
                    )}
                  </div>
                </div>
              </Tabs.Content>
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-border-default">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors text-sm font-medium focus:outline-none"
              >
                Cancel
              </button>
              
              {activeTab === "info" ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-2 rounded-lg bg-accent-primary text-white hover:bg-accent-hover transition-colors text-sm font-medium shadow-sm focus:outline-none"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-accent-primary text-white hover:bg-accent-hover transition-colors text-sm font-medium shadow-sm flex items-center gap-2 disabled:opacity-70 focus:outline-none"
                >
                  {isSubmitting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {isSubmitting ? "Creating..." : "Create Project"}
                </button>
              )}
            </div>
          </Tabs.Root>
          
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
