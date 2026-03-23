const fs = require('fs');
const content = fs.readFileSync('src/routes/index.tsx', 'utf-8');

const landingStart = content.indexOf('function Navbar() {');
const dashboardStart = content.indexOf('/* ——— Language → colour mapping ——— */');

const importsAndIndex = content.slice(0, landingStart);
const landingCode = content.slice(landingStart, dashboardStart);
const dashboardCode = content.slice(dashboardStart);

// We need imports for landing and dashboard separately
const commonImports = `import React, { useEffect, useState, useMemo, useRef } from "react";\nimport { Link, useNavigate, createFileRoute } from "@tanstack/react-router";\nimport { useAuthStore } from "../stores/auth.store";\nimport { useProjectStore } from "../stores/project.store";\nimport type { Project } from "../types/project";\nimport { CreateProjectModal } from "../components/CreateProjectModal";\n\n`;

fs.writeFileSync('src/components/landing/LandingPage.tsx', commonImports + landingCode);
fs.writeFileSync('src/components/dashboard/Dashboard.tsx', commonImports + dashboardCode);

fs.writeFileSync('src/routes/index.tsx', `import { useEffect } from "react";
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
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return isAuthenticated ? <Dashboard /> : <LandingPage />;
}
`);
console.log('Split successful');
