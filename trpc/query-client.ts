import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query"

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Safe defaults for health/identity data: no shared caching, short staleTime
        staleTime: 30 * 1000,
        retry: 1,
      },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      mutations: {
        retry: false, // Never auto-retry non-idempotent mutations blindly
      },
    },
  })
}
