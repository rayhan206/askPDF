import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SessionProfile } from "./api";

interface SessionContextValue {
  profile: SessionProfile | null;
  loading: boolean;
  refresh: () => Promise<SessionProfile | null>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.profile,
    retry: false,
  });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => queryClient.setQueryData(["session"], null),
  });
  const value = useMemo<SessionContextValue>(
    () => ({
      profile: profileQuery.data ?? null,
      loading: profileQuery.isLoading,
      refresh: async () => {
        const result = await profileQuery.refetch();
        return result.data ?? null;
      },
      signOut: async () => logout.mutateAsync(),
    }),
    [logout, profileQuery],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
