import { Router, Request, Response } from "express";
import { buildAggregatedSpec, invalidateSpecCache } from "./aggregator";
import { env } from "../config";

const docsRouter: Router = Router();

docsRouter.get("/openapi.json", async (req: Request, res: Response) => {
  try {
    const gatewayUrl =
      process.env["PUBLIC_GATEWAY_URL"] ??
      `http://localhost:${env.API_GATEWAY_PORT}`;

    const spec = await buildAggregatedSpec(gatewayUrl);
    res.setHeader("Cache-Control", "public, max-age=30");
    res.json(spec);
  } catch (err: any) {
    console.error("[docs] Failed to build spec:", err.message);
    res.status(500).json({ error: "Failed to generate API spec" });
  }
});

docsRouter.post("/openapi.json/refresh", (_req: Request, res: Response) => {
  invalidateSpecCache();
  res.json({ message: "Spec cache invalidated" });
});


docsRouter.get("/", (_req: Request, res: Response) => {
  const specUrl = "/openapi.json";

  const html = /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Synthex API Documentation – interactive Swagger UI for all microservices." />
    <title>Synthex API Docs</title>

    <!-- Swagger UI CSS -->
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />

    <style>
      /* ── Custom theme ───────────────────────────────────────────────── */
      :root {
        --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
        --bg-page: #0d0f14;
        --bg-card: #161a23;
        --bg-header: #0a0c10;
        --accent: #7c6af7;
        --accent-hover: #9d8fff;
        --text-primary: #e2e8f0;
        --text-muted: #8892a4;
        --border: rgba(255,255,255,0.07);
        --radius: 10px;
      }

      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        background: var(--bg-page);
        color: var(--text-primary);
        font-family: var(--font-sans);
        min-height: 100vh;
      }

      /* ── Custom top header ─────────────────────────────────────────── */
      #synthex-header {
        background: var(--bg-header);
        border-bottom: 1px solid var(--border);
        padding: 0 32px;
        height: 60px;
        display: flex;
        align-items: center;
        gap: 14px;
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(12px);
      }

      #synthex-header .logo {
        display: flex;
        align-items: center;
        gap: 10px;
        text-decoration: none;
      }

      #synthex-header .logo-icon {
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, var(--accent), #a78bfa);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 700;
        color: #fff;
        flex-shrink: 0;
      }

      #synthex-header .logo-text {
        font-size: 17px;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.3px;
      }

      #synthex-header .logo-text span {
        color: var(--accent);
      }

      #synthex-header .badge {
        background: rgba(124,106,247,0.18);
        color: var(--accent-hover);
        font-size: 11px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 20px;
        border: 1px solid rgba(124,106,247,0.3);
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }

      #synthex-header .spacer { flex: 1; }

      #synthex-header .refresh-btn {
        background: rgba(124,106,247,0.12);
        border: 1px solid rgba(124,106,247,0.3);
        color: var(--accent-hover);
        padding: 6px 14px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #synthex-header .refresh-btn:hover {
        background: rgba(124,106,247,0.22);
        border-color: rgba(124,106,247,0.5);
      }
      #synthex-header .refresh-btn.loading {
        opacity: 0.6;
        cursor: not-allowed;
      }

      /* ── Swagger UI overrides ──────────────────────────────────────── */
      .swagger-ui { background: transparent !important; }
      .swagger-ui .topbar { display: none !important; }

      .swagger-ui .info {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 24px 28px;
        margin: 24px 0;
      }
      .swagger-ui .info .title {
        color: var(--text-primary) !important;
        font-size: 24px !important;
        font-weight: 700 !important;
        font-family: var(--font-sans) !important;
      }
      .swagger-ui .info p,
      .swagger-ui .info li,
      .swagger-ui .info .description {
        color: var(--text-muted) !important;
        font-family: var(--font-sans) !important;
      }

      .swagger-ui .scheme-container {
        background: var(--bg-card) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--radius) !important;
        padding: 16px 20px !important;
        box-shadow: none !important;
      }

      /* Tags / operation groups */
      .swagger-ui .opblock-tag {
        color: var(--text-primary) !important;
        border-bottom: 1px solid var(--border) !important;
        font-family: var(--font-sans) !important;
        font-weight: 600 !important;
      }

      .swagger-ui .opblock {
        border-radius: 8px !important;
        border: 1px solid var(--border) !important;
        box-shadow: none !important;
        margin-bottom: 8px !important;
        overflow: hidden !important;
        background: var(--bg-card) !important;
      }

      .swagger-ui .opblock-summary {
        background: var(--bg-card) !important;
      }
      .swagger-ui .opblock-summary:hover {
        background: rgba(255,255,255,0.03) !important;
      }
      .swagger-ui .opblock-summary-description,
      .swagger-ui .opblock-summary-path {
        color: var(--text-primary) !important;
        font-family: var(--font-sans) !important;
      }

      .swagger-ui .opblock-body,
      .swagger-ui .opblock-description-wrapper {
        background: var(--bg-card) !important;
        color: var(--text-primary) !important;
      }

      /* HTTP method badges */
      .swagger-ui .opblock-summary-method {
        border-radius: 4px !important;
        font-family: var(--font-sans) !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        letter-spacing: 0.5px !important;
        min-width: 60px !important;
        text-align: center !important;
      }

      /* Models section */
      .swagger-ui section.models {
        background: var(--bg-card) !important;
        border: 1px solid var(--border) !important;
        border-radius: var(--radius) !important;
      }
      .swagger-ui .model-title,
      .swagger-ui .model-title__text {
        color: var(--text-primary) !important;
        font-family: var(--font-sans) !important;
      }
      .swagger-ui .model-box {
        background: rgba(0,0,0,0.2) !important;
        border-radius: 6px !important;
      }

      /* Inputs */
      .swagger-ui input, .swagger-ui select, .swagger-ui textarea {
        background: rgba(0,0,0,0.3) !important;
        color: var(--text-primary) !important;
        border: 1px solid var(--border) !important;
        border-radius: 6px !important;
        font-family: var(--font-sans) !important;
      }

      /* Buttons */
      .swagger-ui .btn.authorize {
        background: var(--accent) !important;
        border-color: var(--accent) !important;
        color: #fff !important;
        border-radius: 6px !important;
        font-family: var(--font-sans) !important;
        font-weight: 600 !important;
      }
      .swagger-ui .btn.authorize:hover {
        background: var(--accent-hover) !important;
        border-color: var(--accent-hover) !important;
      }
      .swagger-ui .btn.execute {
        background: var(--accent) !important;
        border-color: var(--accent) !important;
        color: #fff !important;
        border-radius: 6px !important;
        font-weight: 600 !important;
      }

      /* Response codes */
      .swagger-ui .response-col_status { color: var(--text-primary) !important; }
      .swagger-ui table thead tr th,
      .swagger-ui table tbody tr td {
        color: var(--text-primary) !important;
        border-color: var(--border) !important;
      }

      /* Code blocks */
      .swagger-ui .highlight-code,
      .swagger-ui .microlight {
        background: rgba(0,0,0,0.35) !important;
        border-radius: 6px !important;
        padding: 12px !important;
      }

      /* Scroll */
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }

      #swagger-ui-wrapper {
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 24px 60px;
      }
    </style>
  </head>
  <body>

    <!-- ── Custom Header ─────────────────────────────────────────────────── -->
    <header id="synthex-header">
      <a class="logo" href="/docs">
        <div class="logo-icon">S</div>
        <span class="logo-text">Synth<span>ex</span></span>
      </a>
      <span class="badge">API Docs</span>
      <div class="spacer"></div>
      <button id="refresh-spec-btn" class="refresh-btn" title="Force-refresh aggregated spec">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
        Refresh Spec
      </button>
    </header>

    <!-- ── Swagger UI ─────────────────────────────────────────────────────── -->
    <div id="swagger-ui-wrapper">
      <div id="swagger-ui"></div>
    </div>

    <!-- Swagger UI bundle (UMD) -->
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>

    <script>
      window.onload = function () {
        const ui = SwaggerUIBundle({
          url: "${specUrl}",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: "StandaloneLayout",
          tryItOutEnabled: true,
          displayRequestDuration: true,
          filter: true,
          persistAuthorization: true,
          syntaxHighlight: {
            activated: true,
            theme: "monokai",
          },
          // Remove the Standalone topbar (we have our own)
          plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        });
        window.ui = ui;

        // ── Refresh button ───────────────────────────────────────────────
        const btn = document.getElementById("refresh-spec-btn");
        btn.addEventListener("click", async () => {
          if (btn.classList.contains("loading")) return;
          btn.classList.add("loading");
          btn.textContent = "Refreshing…";

          try {
            await fetch("/openapi.json/refresh", { method: "POST" });
            ui.specActions.download("${specUrl}");
          } catch (e) {
            console.error("Refresh failed", e);
          } finally {
            btn.classList.remove("loading");
            btn.innerHTML = \`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Refresh Spec\`;
          }
        });
      };
    </script>
  </body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export { docsRouter };
