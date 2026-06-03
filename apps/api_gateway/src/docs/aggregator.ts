import type { OpenAPIObject, PathsObject, ComponentsObject } from "openapi3-ts/oas31";
import { env } from "../config";

export const SERVICE_REGISTRY = [
  {
    name: "User Service",
    internalUrl: `${env.USER_SERVICE_URL}/openapi.json`,
    gatewayPrefix: "/api/auth", 
    tags: ["Auth"],
    filterTags: ["Auth"],       
  },
  {
    name: "User Service (Users)",
    internalUrl: `${env.USER_SERVICE_URL}/openapi.json`,
    gatewayPrefix: "/api/users",    
    tags: ["Users"],
    filterTags: ["Users"],
  },
  {
    name: "Project Service",
    internalUrl: `${env.PROJECT_SERVICE_URL}/openapi.json`,
    gatewayPrefix: "/api/projects",
  },
  {
    name: "Container Service",
    internalUrl: `${env.CONTAINER_SERVICE_URL}/openapi.json`,
    gatewayPrefix: "/api/containers",
  },
  {
    name: "Execution Service",
    internalUrl: `${env.EXECUTION_SERVICE_URL}/openapi.json`,
    gatewayPrefix: "/api/execution",
  },
  {
    name: "Storage Service",
    internalUrl: `${env.STORAGE_SERVICE_URL}/openapi.json`,
    gatewayPrefix: "/api/storage",
  },
] as const;


interface ServiceEntry {
  name: string;
  internalUrl: string;
  gatewayPrefix: string;
  filterTags?: readonly string[];
}


async function fetchSpec(entry: ServiceEntry): Promise<OpenAPIObject | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    const res = await fetch(entry.internalUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[aggregator] ${entry.name}: HTTP ${res.status}`);
      return null;
    }

    return (await res.json()) as OpenAPIObject;
  } catch (err: any) {
    console.warn(`[aggregator] ${entry.name}: ${err.message}`);
    return null;
  }
}

function pathMatchesTagFilter(
  pathItem: any,
  filterTags?: readonly string[],
): boolean {
  if (!filterTags || filterTags.length === 0) return true;
  const methods = ["get", "post", "put", "patch", "delete", "options", "head"];
  for (const method of methods) {
    const op = pathItem[method];
    if (op?.tags?.some((t: string) => filterTags.includes(t))) return true;
  }
  return false;
}

function prefixPaths(
  paths: PathsObject,
  prefix: string,
  filterTags?: readonly string[],
): PathsObject {
  const result: PathsObject = {};
  for (const [path, item] of Object.entries(paths)) {
    if (!pathMatchesTagFilter(item, filterTags)) continue;
    const normalizedPath = path === "/" ? "" : path;
    const fullPath = `${prefix}${normalizedPath}`;
    result[fullPath] = item;
  }
  return result;
}

function mergeComponents(
  target: ComponentsObject,
  source: ComponentsObject | undefined,
): ComponentsObject {
  if (!source) return target;
  return {
    schemas: { ...target.schemas, ...(source.schemas ?? {}) },
    securitySchemes: {
      ...target.securitySchemes,
      ...(source.securitySchemes ?? {}),
    },
    responses: { ...target.responses, ...(source.responses ?? {}) },
    parameters: { ...target.parameters, ...(source.parameters ?? {}) },
    requestBodies: { ...target.requestBodies, ...(source.requestBodies ?? {}) },
  };
}

let cachedSpec: OpenAPIObject | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000

export async function buildAggregatedSpec(
  gatewayUrl: string,
): Promise<OpenAPIObject> {
  const now = Date.now();
  if (cachedSpec && now < cacheExpiresAt) return cachedSpec;

  const merged: OpenAPIObject = {
    openapi: "3.1.0",
    info: {
      title: "Synthex – Aggregated API",
      version: "1.0.0",
      description:
        "Unified API documentation for all Synthex microservices, aggregated at the API Gateway.",
    },
    servers: [{ url: gatewayUrl, description: "API Gateway" }],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
    tags: [],
  };

  const seenTags = new Set<string>();

  await Promise.allSettled(
    (SERVICE_REGISTRY as unknown as ServiceEntry[]).map(async (entry) => {
      const spec = await fetchSpec(entry);
      if (!spec) return;

      const prefixed = prefixPaths(
        spec.paths ?? {},
        entry.gatewayPrefix,
        entry.filterTags,
      );
      Object.assign(merged.paths!, prefixed);

      merged.components = mergeComponents(
        merged.components as ComponentsObject,
        spec.components as ComponentsObject | undefined,
      );

      // Collect tags
      for (const tag of spec.tags ?? []) {
        if (!seenTags.has(tag.name)) {
          seenTags.add(tag.name);
          (merged.tags as any[]).push(tag);
        }
      }
    }),
  );

  cachedSpec = merged;
  cacheExpiresAt = now + CACHE_TTL_MS;

  return merged;
}

export function invalidateSpecCache(): void {
  cachedSpec = null;
  cacheExpiresAt = 0;
}
