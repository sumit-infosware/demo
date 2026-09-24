/**
 * IFS configuration and communication constants.
 *
 * Single source for IFS polling/repoll defaults — poll-config.service's
 * DEFAULT_POLLING_CONFIG references these values.
 */
import { IFS_LINE_STATUS } from "../enums/ifs-qc-status.enum.js";

export const IFS_CONSTANTS = {
  SOCKET_NAMESPACE: "/ifs",
  DEFAULT_CONFIG_KEY: "default",
  DEFAULT_STATE_KEY: "polling",
  DEFAULT_FETCH_READY_QC_STATUS: IFS_LINE_STATUS.INSPECTED,
  DEFAULT_NORMAL_INTERVAL_MS: 300000,
  DEFAULT_REPOLL_INTERVAL_MS: 300000,
  DEFAULT_STOP_THRESHOLD: 5,
  DEFAULT_BATCH_SIZE: 25,
} as const;
