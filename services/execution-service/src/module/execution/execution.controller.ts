import { Request, Response, NextFunction } from "express";
import { ExecutionService } from "./execution.service";
import { startExecutionSchema, startPreviewSchema } from "./execution.schema";
import { AppError } from "../../utils/AppError";

const executionService = new ExecutionService();

class ExecutionController {
  async startExecution(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      const dto = startExecutionSchema.parse(req.body);
      const result = await executionService.startExecution(userId, dto);
      res.status(202).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async startPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;
      const dto = startPreviewSchema.parse(req.body);
      const result = await executionService.startPreview(userId, dto);
      res.status(202).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async stopPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;

      if (!req.params.projectId) {
        throw new AppError("No projectId provided", 400);
      }

      const result = await executionService.stopPreview(
        req.params.projectId,
        userId,
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async killExecution(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.headers["x-user-id"] as string;

      if (!req.params.executionId) {
        throw new AppError("No executionId provided", 400);
      }

      const result = await executionService.killExecution(
        req.params.executionId,
        userId,
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getExecution(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.params.executionId) {
        throw new AppError("No executionId provided", 400);
      }

      const exec = await executionService.getExecution(req.params.executionId);
      res.json({ data: exec });
    } catch (err) {
      next(err);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.params.projectId) {
        throw new AppError("No executionId provided", 400);
      }

      const history = await executionService.getExecutionHistory(
        req.params.projectId,
      );
      res.json({ data: history });
    } catch (err) {
      next(err);
    }
  }

  async getBuffer(req: Request, res: Response, next: NextFunction) {
    try {
      const fromSeq = parseInt((req.query.fromSeq as string) ?? "0");

      if (!req.params.executionId) {
        throw new AppError("No executionId provided", 400);
      }

      const chunks = await executionService.getBufferedOutput(
        req.params.executionId,
        fromSeq,
      );
      res.json({ data: chunks });
    } catch (err) {
      next(err);
    }
  }
}

export { ExecutionController };
