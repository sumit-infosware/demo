import { NotFoundError } from "../errors/errors.js";
import { assetTransferRepository } from "../repositories/asset-transfer.repository.js";
import { getHierarchyTree } from "./storage-hierarchy.service.js";
import type {
  FlatTagDetailsDto,
  SyncHierarchyStorageDto,
  TagDetailsDto,
  TransferItemDetailsDto,
  TransferItemGroupDto,
  TransferDto,
} from "../types/asset-transfer.types.js";

export const assetTransferService = {
  listTransfers: async (): Promise<TransferDto[]> => {
    const items = await assetTransferRepository.listTransfers();
    return items.map((t) => ({ transferId: t.transferId }));
  },

  getSyncLocations: async (): Promise<SyncHierarchyStorageDto[]> => getHierarchyTree(),

  getTransferAllItems: async (transferId: string): Promise<TransferItemGroupDto[]> => {
    const transfer = await assetTransferRepository.findTransferByBusinessId(transferId);
    if (!transfer) throw new NotFoundError("Transfer");

    const { lines, planLines } = await assetTransferRepository.getTransferItemsWithLocations(
      transfer.id,
    );

    const planByTag = new Map<bigint, { binId: string; positionId: string | null }>();
    for (const pl of planLines) {
      if (pl.packetTagId !== null && !planByTag.has(pl.packetTagId)) {
        planByTag.set(pl.packetTagId, { binId: pl.binId, positionId: pl.positionId });
      }
    }

    const groups = new Map<
      string,
      { binId: string; positionId: string | null; details: TransferItemDetailsDto[] }
    >();
    for (const line of lines) {
      const packetTag = line.packetTag;
      if (!packetTag) continue;
      const plan = planByTag.get(packetTag.id);
      if (!plan) continue;

      const key = `${plan.binId}\u0000${plan.positionId}`;
      let group = groups.get(key);
      if (!group) {
        group = { binId: plan.binId, positionId: plan.positionId, details: [] };
        groups.set(key, group);
      }
      group.details.push({
        packageTagId: packetTag.id.toString(),
        epc: packetTag.epc,
        qty: packetTag.qty.toString(),
      });
    }

    const locationCache = new Map<string, { locationId: string; locationNo: string }>();
    const resolveLocation = async (
      binId: string,
    ): Promise<{ locationId: string; locationNo: string }> => {
      const cached = locationCache.get(binId);
      if (cached) return cached;

      const itemLocation = await assetTransferRepository.findItemLocationByBinNo(binId);
      if (itemLocation) {
        const resolved = {
          locationId: itemLocation.id.toString(),
          locationNo: itemLocation.locationNo,
        };
        locationCache.set(binId, resolved);
        return resolved;
      }

      const hierarchyBin = await assetTransferRepository.findHierarchyBinByCode(binId);
      const resolved = {
        locationId: hierarchyBin ? hierarchyBin.id.toString() : binId,
        locationNo: hierarchyBin?.code ?? binId,
      };
      locationCache.set(binId, resolved);
      return resolved;
    };

    const grouped = Array.from(groups.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
    const result: TransferItemGroupDto[] = [];
    let index = 0;
    for (const [, group] of grouped) {
      const { locationId, locationNo } = await resolveLocation(group.binId);
      result.push({
        ItemNo: String(++index),
        locationId,
        locationNo,
        ItemDetails: group.details,
      });
    }
    return result;
  },

  getTagByEpc: async (epc: string): Promise<TagDetailsDto> => {
    const tag = await assetTransferRepository.findTagByEpc(epc);
    if (!tag) throw new NotFoundError("Tag");

    const rrLine = tag.rrLine;

    return {
      epc: tag.epc,
      tag: {
        tagId: tag.id.toString(),
        epc: tag.epc,
        tagType: tag.tagType,
        packetNo: tag.packetNo,
        status: tag.status,
        serialNumber: tag.serialNumber ?? null,
        barcode: tag.barcode ?? null,
        qty: tag.qty.toString(),
        uom: tag.uom,
        batchNo: tag.batchNo ?? null,
        colour: tag.colour ?? null,
        materialType: tag.materialType ?? null,
        isVoided: tag.isVoided,
      },
      asset: {
        assetId: tag.id.toString(),
        itemCode: tag.itemCode,
        itemDescription: rrLine?.itemDesc ?? null,
        category: rrLine?.category ?? null,
        acceptedQty: rrLine?.acceptedQty?.toString() ?? null,
        receivedQty: rrLine?.receivedQty?.toString() ?? null,
        orderedQty: rrLine?.orderedQty?.toString() ?? null,
        stockingUom: rrLine?.stockingUom ?? null,
        ownership: rrLine?.ownership ?? null,
      },
    };
  },

  getTagByEpcFlat: async (epc: string): Promise<FlatTagDetailsDto> => {
    const tag = await assetTransferRepository.findTagByEpc(epc);
    if (!tag) throw new NotFoundError("Tag");

    const rrLine = tag.rrLine;
    return {
      tagId: tag.id.toString(),
      epc: tag.epc,
      tagType: tag.tagType,
      packetNo: tag.packetNo,
      status: tag.status,
      serialNumber: tag.serialNumber ?? null,
      barcode: tag.barcode ?? null,
      qty: tag.qty.toString(),
      isVoided: tag.isVoided,
      itemId: tag.rrLineId.toString(),
      itemCode: tag.itemCode,
      itemDescription: rrLine?.itemDesc ?? null,
      acceptedQty: rrLine?.acceptedQty?.toString() ?? null,
      receivedQty: rrLine?.receivedQty?.toString() ?? null,
      orderedQty: rrLine?.orderedQty?.toString() ?? null,
      ownership: rrLine?.ownership ?? null,
    };
  },
};
