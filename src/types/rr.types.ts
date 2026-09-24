export interface RrLineDto {
  id: string;
  rrId: string;
  rrNo: string;
  ifsRrNo: string;
  gateEntryNo: string;
  rrLineNo: string;
  vendorName: string | null;
  vendorNo: string | null;
  itemCode: string;
  itemDesc: string | null;
  category: string | null;
  orderedQty: number;
  receivedQty: number | null;
  vendorUom: string | null;
  stockingUom: string | null;
  qcStatus: string | null;
  chargeStatus: string | null;
  batchNo: string | null;
  numPackages: number | null;
  qtyPerPackage: number | null;
  isTaggable: boolean;
  totalTagsCreated: number;
  fetchedAt: Date;
  // v2 fields
  itemType: string;
  serialNumbers: string | null;
  isSerialized: boolean;
  materialType: string | null;
  requiresEngraving: boolean;
  isFractionalQty: boolean;
  ifsRejected: boolean;
  ifsRejectedAt: Date | null;
  serialsMissingAlerted: boolean;
  serialsMissingAlertedAt: Date | null;
}

export interface RrListItem {
  id: string;
  rrNo: string;
  ifsRrNo: string;
  gateEntryNo: string;
  // vendorName: string | null;
  vendorNo: string | null;
  rrStatus: string;
  rrDate: Date;
  totalLines: number;
  taggableLines: number;
  fetchedAt: Date;
}

export interface SerialCheckResult {
  rrLineId: string;
  itemCode: string;
  isSerialized: boolean;
  expectedQty: number;
  serialsInIfs: string[];
  serialsCount: number;
  canProceedTagging: boolean;
  issues: Array<{
    code: string;
    severity: "BLOCKER" | "WARNING";
    message: string;
    action: string;
  }>;
}
