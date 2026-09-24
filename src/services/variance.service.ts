import { Prisma } from "../../prisma/generated/prisma/client.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { VarianceDisposition } from "../enums/status.enum.js";
import { ConflictError, NotFoundError } from "../errors/errors.js";
import { varianceRepository } from "../repositories/variance.repository.js";
import type { VarianceDto } from "../types/variance.types.js";

const { create, findById, list, resolve } = varianceRepository;

type Actor = { userId: string; email?: string };

function toVarianceDto(v: {
  id: bigint;
  context: string;
  ref: string;
  expectedQty: Prisma.Decimal | null;
  actualQty: Prisma.Decimal | null;
  varianceAmount: Prisma.Decimal | null;
  disposition: string;
  raisedBy: string | null;
  raisedAt: Date;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  notes: string | null;
}): VarianceDto {
  return {
    id: v.id.toString(),
    context: v.context,
    ref: v.ref,
    expectedQty: v.expectedQty ? Number(v.expectedQty.toString()) : null,
    actualQty: v.actualQty ? Number(v.actualQty.toString()) : null,
    varianceAmount: v.varianceAmount ? Number(v.varianceAmount.toString()) : null,
    disposition: v.disposition,
    raisedBy: v.raisedBy,
    raisedAt: v.raisedAt,
    resolvedBy: v.resolvedBy,
    resolvedAt: v.resolvedAt,
    notes: v.notes,
  };
}

export const varianceService = {
  /**
   * Records a variance. Used by baseline, count check, holding receive.
   * Never throws — caller uses the returned record to link/log.
   */
  record: async (input: {
    context: string;
    ref: string;
    expectedQty?: number;
    actualQty?: number;
    raisedBy?: string;
    notes?: string;
    auditCtx?: AuditContext;
  }) => {
    const expected =
      input.expectedQty !== undefined ? new Prisma.Decimal(input.expectedQty) : undefined;
    const actual = input.actualQty !== undefined ? new Prisma.Decimal(input.actualQty) : undefined;
    const amount =
      expected !== undefined && actual !== undefined ? actual.minus(expected) : undefined;

    const variance = await create({
      context: input.context,
      ref: input.ref,
      expectedQty: expected,
      actualQty: actual,
      varianceAmount: amount,
      raisedBy: input.raisedBy,
      notes: input.notes,
    });

    await writeAudit(input.auditCtx, {
      action: AuditAction.VARIANCE_RAISE,
      resource: AuditResource.VARIANCE,
      resourceId: variance.id.toString(),
      result: AuditResult.SUCCESS,
      meta: {
        context: input.context,
        ref: input.ref,
        expectedQty: input.expectedQty,
        actualQty: input.actualQty,
      },
    });

    return variance;
  },

  listVariances: async (
    options: {
      context?: string;
      disposition?: string;
      page: number;
      limit: number;
    },
    auditCtx?: AuditContext,
  ) => {
    const page = Math.max(1, options.page);
    const limit = Math.max(1, options.limit);
    const { items, total } = await list({
      context: options.context,
      disposition: options.disposition,
      skip: (page - 1) * limit,
      take: limit,
    });

    await writeAudit(auditCtx, {
      action: AuditAction.VARIANCE_LIST,
      resource: AuditResource.VARIANCE,
      result: AuditResult.SUCCESS,
    });

    return {
      variances: items.map(toVarianceDto),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  getVariance: async (id: string, auditCtx?: AuditContext) => {
    const variance = await findById(BigInt(id));
    if (!variance) throw new NotFoundError(`Variance ${id}`);
    await writeAudit(auditCtx, {
      action: AuditAction.VARIANCE_READ,
      resource: AuditResource.VARIANCE,
      resourceId: id,
      result: AuditResult.SUCCESS,
    });
    return toVarianceDto(variance);
  },

  resolveVariance: async (
    id: string,
    data: {
      disposition: Exclude<VarianceDisposition, VarianceDisposition.PENDING>;
      notes?: string;
    },
    actor: Actor,
    auditCtx?: AuditContext,
  ) => {
    const varianceId = BigInt(id);
    const existing = await findById(varianceId);
    if (!existing) throw new NotFoundError(`Variance ${id}`);
    if ((existing.disposition as VarianceDisposition) !== VarianceDisposition.PENDING) {
      throw new ConflictError(
        `Variance is already resolved (disposition: ${existing.disposition})`,
      );
    }

    const updated = await resolve(varianceId, {
      disposition: data.disposition,
      resolvedBy: actor.userId,
      notes: data.notes,
    });

    await writeAudit(auditCtx, {
      action: AuditAction.VARIANCE_RESOLVE,
      resource: AuditResource.VARIANCE,
      resourceId: id,
      result: AuditResult.SUCCESS,
      meta: { disposition: data.disposition },
    });

    return toVarianceDto(updated);
  },
};
