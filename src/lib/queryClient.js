import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20_000,          // data is "fresh" for 20 seconds
      gcTime: 5 * 60 * 1000,     // keep unused cache for 5 minutes
      refetchOnWindowFocus: true, // refetch when user returns to tab
      retry: 1,
    },
  },
});
