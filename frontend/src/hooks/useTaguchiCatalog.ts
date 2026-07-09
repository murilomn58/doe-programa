/** Domain hook: Taguchi orthogonal-array catalog (server state via TanStack Query). */

import { useQuery } from "@tanstack/react-query";

import { fetchTaguchiCatalog } from "@/api/designs";
import type { TaguchiCatalog } from "@/domain/design";

export const TAGUCHI_CATALOG_KEY = ["taguchi-catalog"] as const;

export function useTaguchiCatalog() {
  return useQuery<TaguchiCatalog>({
    queryKey: TAGUCHI_CATALOG_KEY,
    queryFn: fetchTaguchiCatalog,
    // O catálogo é estático (arranjos ortogonais do pyDOE3); nunca fica stale.
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
