import { env } from "../config";

const serviceRoutes = [
  {
    path: "/api/auth",
    target: env.USER_SERVICE_URL,
    protected: false,
  },
    {
    path: "/api/users",
    target: env.USER_SERVICE_URL,
    protected: true,
  },
  {
    path: "/api/projects",
    target: env.PROJECT_SERVICE_URL,
    protected: true,
  }, {
    path: "/api/containers",
    target: env.CONTAINER_SERVICE_URL,
    protected: true,
  }, {
    path: "/api/execution",
    target: env.EXECUTION_SERVICE_URL,
    protected: true,
  }, {
    path: "/api/storage",
    target: env.STORAGE_SERVICE_URL,
    protected: true,
  }
]

export { serviceRoutes };