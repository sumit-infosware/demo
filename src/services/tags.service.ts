import { Prisma } from "../../prisma/generated/prisma/client.js";
import { writeAudit } from "../audit/audit.service.js";
import type { AuditContext } from "../audit/audit.types.js";
import { prisma } from "../config/clients.js";
import { EVENT_TYPES } from "../constants/event-types.js";
import { AuditAction, AuditResource, AuditResult } from "../enums/audit.enum.js";
import { ColourCategory, PacketTagStatus, PrintStatus } from "../enums/status.enum.js";
import { ConflictError, NotFoundError, ValidationError } from "../errors/errors.js";
import { colourList } from "../helpers/colour-list.helper.js";
import { epcHelper } from "../helpers/epc-generator.helper.js";
import { eventLogger } from "../helpers/event-logger.helper.js";
import { moveSessionPhotosToTag, saveTagPhoto } from "../helpers/photo-storage.helper.js";
import { isTaggableQcStatus } from "../ifs/status/ifs-status.js";
import { lineCountRepository } from "../repositories/line-count.repository.js";
import { tagRepository, packetTagSelect } from "../repositories/tags.repository.js";
import { handheldService } from "./handheld.service.js";

import type {
  GenerateTagInput,
  GenerateTagResult,
  LabelPayload,
  PacketTagDto,
} from "../types/tags.types.js";

type Actor = { userId: string; email?: string };

type PacketTagRow = Prisma.PacketTagGetPayload<{ select: typeof packetTagSelect }>;

function toPacketTagDto(t: PacketTagRow): PacketTagDto {
  return {
    id: t.id.toString(),
    epc: t.epc,
    rrLineId: t.rrLineId.toString(),
    packetNo: t.packetNo,
    batchNo: t.batchNo,
    colour: t.colour,
    itemCode: t.itemCode,
    originalItemCode: t.originalItemCode,
    isAlternate: t.originalItemCode !== null,
    qty: Number(t.qty.toString()),
    uom: t.uom,
    status: t.status,
    taggedBy: t.taggedBy,
    taggedAt: t.taggedAt,
    tagType: t.tagType ?? "RFID",
    serialNumber: t.serialNumber ?? null,
    barcode: t.barcode ?? null,
    materialType: t.materialType ?? null,
    isVoided: t.isVoided ?? false,
    voidReason: t.voidReason ?? null,
    voidedAt: t.voidedAt ?? null,
  };
}

async function resolveAlternate(orderedItemCode: string, requestedAlternate?: string) {
  if (!requestedAlternate || requestedAlternate === orderedItemCode)
    return {
      tagAsItem: orderedItemCode,
      originalItem: null,
      isAlternate: false,
    };
  const approved = await tagRepository.findApprovedAlternates(orderedItemCode);
  const approvedCodes = approved.map((a) => a.alternateItem);
  if (approvedCodes.length === 0)
    return {
      tagAsItem: requestedAlternate,
      originalItem: orderedItemCode,
      isAlternate: true,
    };
  if (!approvedCodes.includes(requestedAlternate))
    throw new ValidationError(
      `Alternate item ${requestedAlternate} is not approved for ${orderedItemCode}`,
    );
  return {
    tagAsItem: requestedAlternate,
    originalItem: orderedItemCode,
    isAlternate: true,
  };
}

async function attachPhotosToTag(photoRequestId: string | undefined, tagId: string): Promise<void> {
  if (!photoRequestId) return;
  try {
    const request = handheldService.get(photoRequestId);
    if (!request || request.capturedPhotos.length === 0) return;

    const moved = await moveSessionPhotosToTag(request.sessionId, tagId);
    if (moved.length > 0) {
      const photosJson = JSON.stringify({
        photos: moved.map((p) => ({
          sequence: p.sequence,
          url: p.url,
          capturedAt: p.capturedAt,
        })),
      });
      await prisma.packetTag.update({
        where: { id: BigInt(tagId) },
        data: { cocDocLink: photosJson },
      });
    }
    handheldService.markConsumed(photoRequestId, tagId);
  } catch (err) {
    console.warn(`[generateTag] photo attach failed for tag ${tagId}:`, err);
  }
}

export const tagService = {
  getAvailableColours: () => {
    const all = colourList.getAll();
    return {
      colours: all,
      total: all.length,
      categories: {
        SINGLE: all.filter((c) => c.category === ColourCategory.SINGLE).length,
        DUAL: all.filter((c) => c.category === ColourCategory.DUAL).length,
        TRIPLE: all.filter((c) => c.category === ColourCategory.TRIPLE).length,
      },
    };
  },

  generateTag: async (
    input: GenerateTagInput,
    actor: Actor,
    auditCtx?: AuditContext,
  ): Promise<GenerateTagResult> => {
    const rrLineId = BigInt(input.rrLineId);

    const line = await lineCountRepository.findRrLineForCounting(rrLineId);
    if (!line) throw new NotFoundError("RR Line");

    // 1. QC gate
    if (!isTaggableQcStatus(line.qcStatus)) {
      throw new ValidationError(`RR line QC status is ${line.qcStatus}; cannot tag`);
    }

    // 2. Colour validation (Safely handle optional 'NONE' override without failing colourList checks)
    const isNoneColour = !input.colour || input.colour === "NONE";
    if (!isNoneColour && !colourList.isValid(input.colour)) {
      throw new ValidationError(`Invalid colour code: ${input.colour}`);
    }

    // 3. Serialized path
    if (line.isSerialized) {
      if (!input.serialNumber)
        throw new ValidationError("Serial number required for serialized items");

      const validSerials = (line.serialNumbers ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (validSerials.length === 0) {
        throw new ValidationError("Serials missing in IFS. Enter serials in IFS first.");
      }
      if (!validSerials.includes(input.serialNumber))
        throw new ValidationError(`Serial ${input.serialNumber} not found in IFS records`);

      const existingSerial = await prisma.packetTag.findUnique({
        where: { serialNumber: input.serialNumber },
      });
      if (existingSerial) throw new ConflictError(`Serial ${input.serialNumber} already tagged`);
    } else {
      // 4. Non-serialized path
      const latestCount = await lineCountRepository.findLatestByRrLineId(rrLineId);
      if (!latestCount) {
        throw new ValidationError("Line counting must be completed before tagging");
      }
      if (input.packetIndex > latestCount.numPackages) {
        throw new ValidationError(`packetIndex ${input.packetIndex} exceeds numPackages`);
      }
    }

    // 5. Duplicate packetNo guard
    const existingPacket = await prisma.packetTag.findUnique({
      where: {
        rrLineId_packetNo: { rrLineId, packetNo: input.packetIndex },
      },
    });

    if (existingPacket) {
      const allExisting = await prisma.packetTag.findMany({
        where: { rrLineId, isVoided: false },
        select: { packetNo: true },
        orderBy: { packetNo: "asc" },
      });
      const used = new Set(allExisting.map((p) => p.packetNo));
      let nextFree = 1;
      while (used.has(nextFree)) nextFree++;
      throw new ConflictError(
        `Packet ${input.packetIndex} already tagged. Next available slot: ${nextFree}. Void the old tag first if needed.`,
      );
    }

    // 6. Alternate
    const alt = await resolveAlternate(line.itemCode, input.alternateItemCode);

    // 7. Generate UNIQUE 24-Hex EPC + barcode
    const epc = epcHelper.generateEpc(alt.tagAsItem, input.packetIndex);
    const barcode = epcHelper.generateBarcode(line.rr.rrNo, line.rrLineNo, input.packetIndex);

    // 8. Determine Tag Type (Includes user input tagType if provided)
    const baseTagType =
      line.itemType === "RAW_MATERIAL_BARCODE"
        ? "BARCODE_ONLY"
        : line.isSerialized
          ? "RFID"
          : line.requiresEngraving
            ? "RFID_ENGRAVED"
            : "RFID";

    const finalTagType = input.tagType || baseTagType;

    // 9. Determine routing for Frontend (ZT411 Printer OR Desktop USB Reader)
    const isHardTag = ["HARD", "RFID_ENGRAVED", "HARD_RFID"].includes(finalTagType);
    const targetDevice = isHardTag ? "DESKTOP-ENCODER-01" : "ZT411-TRANSIT-01";

    const qtyOnTag: Prisma.Decimal = line.isSerialized
      ? new Prisma.Decimal(1)
      : new Prisma.Decimal(input.packetQty);

    const latestCount = line.isSerialized
      ? null
      : await lineCountRepository.findLatestByRrLineId(rrLineId);

    // 10. Create tag
    const tag = await prisma.packetTag.create({
      data: {
        epc,
        barcode,
        rrLineId,
        lineCountId: latestCount?.id,
        packetNo: input.packetIndex,
        serialNumber: input.serialNumber ?? null,
        itemCode: alt.tagAsItem,
        originalItemCode: alt.originalItem,
        qty: qtyOnTag,
        uom: line.stockingUom ?? "NOS",
        colour: isNoneColour ? "NONE" : input.colour,
        colourCategory: isNoneColour ? null : colourList.getCategory(input.colour),
        materialType: line.materialType ?? null,
        tagType: finalTagType,
        batchNo: line.batchNo ?? null,
        status: PacketTagStatus.CREATED,
        printStatus: PrintStatus.PENDING,
        taggedBy: actor.userId,
      },
    });

    // 11. Attach Photos (Captured via Session IDs prior to tag generation)
    await attachPhotosToTag(
      (input as GenerateTagInput & { photoRequestId?: string }).photoRequestId,
      tag.id.toString(),
    );

    await eventLogger.log({
      ref: epc,
      eventType: EVENT_TYPES.TAG_GENERATED,
      phase: "4-Tag",
      appUser: actor.userId,
      payload: {
        tagId: tag.id.toString(),
        serialNumber: input.serialNumber,
        colour: isNoneColour ? "NONE" : input.colour,
        photoRequestId: (input as GenerateTagInput & { photoRequestId?: string }).photoRequestId,
      },
    });

    await writeAudit(auditCtx, {
      action: AuditAction.TAG_GENERATE,
      resource: AuditResource.PACKET_TAG,
      resourceId: tag.id.toString(),
      result: AuditResult.SUCCESS,
      meta: { epc, colour: isNoneColour ? "NONE" : input.colour, serialNumber: input.serialNumber },
    });

    return {
      tagId: tag.id.toString(),
      epc: tag.epc,
      barcode: tag.barcode ?? "",
      labelPayload: {
        epc,
        barcode,
        itemCode: alt.tagAsItem,
        itemDesc: line.itemDesc ?? null,
        qty: Number(qtyOnTag.toString()),
        uom: line.stockingUom ?? "NOS",
        batchNo: line.batchNo ?? null,
        serialNumber: input.serialNumber ?? null,
        colour: isNoneColour ? "NONE" : input.colour,
        packetNo: `${input.packetIndex}/${input.totalPackets}`,
        rrNo: line.rr.rrNo,
        vendorName: null,
        materialType: line.materialType ?? null,
      },
      printCommand: {
        printerId: targetDevice, // Tells frontend if it should print (Label) or use Desktop USB (Hard Tag)
        copies: 1,
        encodeRfid: finalTagType !== "BARCODE_ONLY",
      },
    };
  },

  /**
   * Marks a tag as "PRINTED". For Desktop-encoded Hard Tags, hitting this state implies it
   * has successfully encoded over USB and is ready for binning (skipping the commission step).
   */
  markPrinted: async (id: string, actor: Actor, auditCtx?: AuditContext) => {
    const tagId = BigInt(id);
    const tag = await tagRepository.findById(tagId);
    if (!tag) throw new NotFoundError("Tag");

    const updated = await prisma.packetTag.update({
      where: { id: tagId },
      data: {
        printStatus: PrintStatus.PRINTED,
        printedAt: new Date(),
        status: PacketTagStatus.PRINTED, // Acts as "Completed" for the generation flow
      },
    });

    await eventLogger.log({
      ref: tag.epc,
      eventType: EVENT_TYPES.TAG_PRINTED,
      phase: "4-Tag",
      appUser: actor.userId,
    });

    await writeAudit(auditCtx, {
      action: AuditAction.TAG_MARK_PRINTED,
      resource: AuditResource.PACKET_TAG,
      resourceId: tagId.toString(),
      result: AuditResult.SUCCESS,
      meta: { epc: tag.epc },
    });

    return toPacketTagDto(updated);
  },

  /**
   * Commissioning step is removed from the Receiving Tag Generation UI Flow.
   * Retained in backend solely for serialized holding audit steps.
   */
  commissionTag: async (
    id: string,
    data: { readBackEpc: string },
    actor: Actor,
    auditCtx?: AuditContext,
  ): Promise<PacketTagDto> => {
    const tagId = BigInt(id);
    const tag = await tagRepository.findById(tagId);
    if (!tag) throw new NotFoundError("Packet tag");

    if (![PacketTagStatus.CREATED, PacketTagStatus.PRINTED].includes(tag.status as PacketTagStatus))
      throw new ConflictError(`Tag is ${tag.status}; cannot commission`);

    if (tag.epc !== data.readBackEpc) {
      // If EPC mismatch, VOID this tag automatically and alert user
      await tagService.voidTagAndReprint(id, "EPC mismatch on commission", actor, auditCtx);
      throw new ValidationError(
        "EPC mismatch on read-back. Tag has been voided automatically. Please generate a new tag.",
        { expected: tag.epc, readBack: data.readBackEpc },
      );
    }

    const updated = await prisma.packetTag.update({
      where: { id: tagId },
      data: {
        status: PacketTagStatus.COMMISSIONED,
        commissionedAt: new Date(),
        readBackEpc: data.readBackEpc,
      },
    });

    await eventLogger.log({
      ref: tag.epc,
      eventType: EVENT_TYPES.TAG_COMMISSIONED,
      phase: "4-Tag",
      appUser: actor.userId,
    });

    await writeAudit(auditCtx, {
      action: AuditAction.TAG_COMMISSION,
      resource: AuditResource.PACKET_TAG,
      resourceId: tagId.toString(),
      result: AuditResult.SUCCESS,
      meta: { epc: tag.epc, readBackEpc: data.readBackEpc },
    });

    return toPacketTagDto(updated);
  },

  /** Voids a tag. Used when a print fails, or desktop encoder fails. */
  voidTagAndReprint: async (
    tagId: string,
    reason: string,
    actor: Actor,
    auditCtx?: AuditContext,
  ) => {
    const tagIdBig = BigInt(tagId);
    const tag = await tagRepository.findById(tagIdBig);
    if (!tag) throw new NotFoundError("Tag");
    if ((tag.status as PacketTagStatus) === PacketTagStatus.COMMISSIONED)
      throw new ConflictError("Cannot void a COMMISSIONED tag");

    // 1. Mark as VOIDED in the database
    await prisma.packetTag.update({
      where: { id: tagIdBig },
      data: {
        isVoided: true,
        voidReason: reason,
        voidedAt: new Date(),
        status: PacketTagStatus.VOIDED,
      },
    });

    await eventLogger.log({
      ref: tag.epc,
      eventType: EVENT_TYPES.TAG_VOIDED,
      phase: "4-Tag",
      appUser: actor.userId,
      payload: { reason, oldTagId: tagId },
    });

    // 2. Generate a fresh Tag to replace it
    const newTag = await tagService.generateTag(
      {
        rrLineId: tag.rrLineId.toString(),
        packetIndex: tag.packetNo, // Reusing the same packet number
        totalPackets: 1,
        packetQty: Number(tag.qty),
        colour: tag.colour ?? "NONE",
        serialNumber: tag.serialNumber ?? undefined,
        tagType: tag.tagType,
      },
      actor,
      auditCtx,
    );

    await writeAudit(auditCtx, {
      action: AuditAction.TAG_VOID,
      resource: AuditResource.PACKET_TAG,
      resourceId: tagId,
      result: AuditResult.SUCCESS,
      meta: { reason, oldTagId: tagId },
    });

    return { voidedTagId: tagId, newTag };
  },

  attachTopMarkingPhoto: async (
    tagId: string,
    photoUrl: string,
    _actor: Actor,
    auditCtx?: AuditContext,
  ) => {
    const id = BigInt(tagId);
    const tag = await tagRepository.findById(id);
    if (!tag) throw new NotFoundError("Tag");

    const stored = await saveTagPhoto(tagId, 1, photoUrl);
    const cocJson = JSON.stringify({
      photos: [
        {
          sequence: stored.sequence,
          url: stored.url,
          capturedAt: stored.capturedAt,
        },
      ],
    });

    await prisma.packetTag.update({
      where: { id },
      data: { cocDocLink: cocJson },
    });

    await writeAudit(auditCtx, {
      action: AuditAction.TAG_PHOTO_ATTACH,
      resource: AuditResource.PACKET_TAG,
      resourceId: tagId,
      result: AuditResult.SUCCESS,
      meta: { photoUrl: stored.url },
    });

    return { tagId, photoUrl: stored.url };
  },

  getLabel: async (id: string): Promise<LabelPayload> => {
    const tag = await tagRepository.findById(BigInt(id));
    if (!tag) throw new NotFoundError("Packet tag");
    const line = await tagRepository.findRrLineForTagging(tag.rrLineId);
    if (!line) throw new NotFoundError("RR Line");
    return {
      epc: tag.epc,
      barcode: tag.barcode ?? "",
      itemCode: tag.itemCode,
      itemDesc: null,
      qty: Number(tag.qty.toString()),
      uom: tag.uom,
      batchNo: tag.batchNo,
      colour: tag.colour,
      packetNo: tag.packetNo,
      rrNo: line.rr.rrNo,
      lineNo: line.rrLineNo,
    };
  },

  getTagById: async (id: string, auditCtx?: AuditContext) => {
    const tag = await tagRepository.findById(BigInt(id));
    if (!tag) throw new NotFoundError("Tag");
    await writeAudit(auditCtx, {
      action: AuditAction.TAG_READ,
      resource: AuditResource.PACKET_TAG,
      resourceId: id,
      result: AuditResult.SUCCESS,
    });
    return toPacketTagDto(tag);
  },

  getTagsByLine: async (rrLineId: string) => {
    const tags = await tagRepository.findByRrLineId(BigInt(rrLineId));
    return { rrLineId, total: tags.length, tags: tags.map(toPacketTagDto) };
  },

  listTags: async (
    options: {
      rrLineId?: string;
      status?: string;
      page: number;
      limit: number;
    },
    auditCtx?: AuditContext,
  ) => {
    const { items, total } = await tagRepository.list({
      rrLineId: options.rrLineId ? BigInt(options.rrLineId) : undefined,
      status: options.status,
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
    await writeAudit(auditCtx, {
      action: AuditAction.TAG_LIST,
      resource: AuditResource.PACKET_TAG,
      result: AuditResult.SUCCESS,
      meta: { count: items.length, total, page: options.page, limit: options.limit },
    });
    return {
      tags: items.map(toPacketTagDto),
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages: Math.ceil(total / options.limit),
      },
    };
  },
};
