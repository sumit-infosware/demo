import type { Request, Response } from "express";

export function liveness(_req: Request, res: Response): void {
  res.status(200).send({
    message: "Health check live succesfull.",
    status: 200,
    response: null,
  });
}

export function readiness(_req: Request, res: Response): void {
  try {
    res.status(200).send({
      message: "Health check readiness succesfull.",
      status: 200,
      response: null,
    });
  } catch (err) {
    res.status(503).send({
      message: err instanceof Error ? err.message : "unavailable",
      status: 503,
      response: null,
    });
  }
}
