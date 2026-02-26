"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react";

const TanstackClientProvider = ({ children } : {
    children: React.ReactNode
}) => {
    const [queryClient] = useState<QueryClient>(() => new QueryClient(
        {
            defaultOptions: {
                queries: {
                    staleTime: 1000 * 60 * 5, // 5 minutes
                },
            },
        }
    ));

    
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

export default TanstackClientProvider