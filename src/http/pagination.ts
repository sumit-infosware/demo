export interface PaginationQuery {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

export function buildPagination(
  pageRaw: unknown,
  limitRaw: unknown,
  maxLimit = 100,
): PaginationQuery {
  const page = Math.max(1, Number(pageRaw) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(limitRaw) || 20));
  return { page, limit };
}

export function buildPaginated<T>(items: T[], total: number, query: PaginationQuery): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages },
  };
}
