export interface AlertDto {
  id: string;
  type: string;
  severity: string;
  message: string;
  status: string;
  recipientRoles: string[];
  channel: string;
  sourceFn: string | null;
  ref: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
}

import { AlertSeverity } from "../enums/alert.enum.js";
export { AlertSeverity };

export interface RaiseAlertInput {
  type: string;
  severity: AlertSeverity;
  message: string;
  recipientRoles: string[];
  sourceFn?: string;
  ref?: string;
  meta?: Record<string, unknown>;
}
