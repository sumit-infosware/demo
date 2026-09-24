import { createHash } from "node:crypto";

/**
 * EPC & Barcode generation helpers.
 *
 * EPCs are generated as unique 96-bit (24 hex char) identifiers.
 * Format used here (24 hex chars):
 *   [ 'E' (1 char) ][ 11 hex : ms timestamp ][ 8 hex : item hash ][ 4 hex : packet no ]
 * Example: E018ED3C4A5B7F28A1C0001
 */

export const epcHelper = {
  /** Generates a universally unique 24-Hex character EPC starting with 'E'. */
  generateEpc: (itemCode: string, packetNo: number): string => {
    // 1. Prefix 'E' (1 char)
    const prefix = "E";

    // 2. Timestamp (Current time in ms converted to Hex, padded to 11 chars)
    const tsHex = Date.now().toString(16).toUpperCase().padStart(11, "0");

    // 3. Item Hash (First 8 characters of SHA1 hash of the itemCode)
    const itemHash = createHash("sha1")
      .update(itemCode)
      .digest("hex")
      .substring(0, 8)
      .toUpperCase();

    // 4. Packet No (Converted to Hex, padded to 4 chars)
    const pktHex = (packetNo & 0xffff).toString(16).toUpperCase().padStart(4, "0");

    // Combine them (1 + 11 + 8 + 4 = 24 chars)
    const epc = `${prefix}${tsHex}${itemHash}${pktHex}`;

    return epc.substring(0, 24); // Strictly ensure 24 chars
  },

  /** Generates a human-readable barcode string for a packet. */
  generateBarcode: (rrNo: string, lineNo: string, packetNo: number): string => {
    const suffix = Date.now().toString().slice(-6);
    return `SITS-${rrNo}-${lineNo}-P${packetNo}-${suffix}`;
  },
};
