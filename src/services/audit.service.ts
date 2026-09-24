import { auditRepository, type AuditQuery } from "../repositories/audit.repository.js";

export const auditService = {
  /**
   * Returns a paginated list of audit logs. Authorization (admin.access)
   * is enforced at the route layer.
   */
  list: async (query: AuditQuery = {}) => {
    return auditRepository.list(query);
  },
};
