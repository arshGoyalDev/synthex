import { X, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { useSetupStore } from "../../stores/setup.store";

interface InstallStatusBannerProps {
  onViewLogs?: () => void;
}

export function InstallStatusBanner({ onViewLogs }: InstallStatusBannerProps) {
  const showRunning = useSetupStore((s) => s.showInstallRunningBanner);
  const showDone = useSetupStore((s) => s.showInstallDoneBanner);
  const progress = useSetupStore((s) => s.progress);
  const dismiss = useSetupStore((s) => s.dismissInstallBanner);

  if (!showRunning && !showDone) return null;

  return (
    <div
      id="install-status-banner"
      className={`install-banner ${showDone ? "install-banner-done" : "install-banner-running"}`}
      role="status"
      aria-live="polite"
    >
      <div className="install-banner-content">
        {showDone ? (
          <>
            <CheckCircle2 size={13} className="install-banner-icon install-banner-icon-done" />
            <span className="install-banner-text">
              Dependencies installed. Project ready.
            </span>
          </>
        ) : (
          <>
            <Loader2 size={13} className="install-banner-icon animate-spin" />
            <span className="install-banner-text">
              Installing dependencies in background…
            </span>
            {progress > 0 && (
              <span className="install-banner-progress">{progress}%</span>
            )}
          </>
        )}
      </div>

      <div className="install-banner-actions">
        {!showDone && onViewLogs && (
          <button
            id="install-banner-view-btn"
            className="install-banner-action-btn"
            onClick={onViewLogs}
            title="View setup logs"
          >
            <ChevronDown size={12} />
            View
          </button>
        )}
        <button
          id="install-banner-dismiss-btn"
          className="install-banner-dismiss-btn"
          onClick={dismiss}
          title="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
