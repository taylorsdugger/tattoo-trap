"use client";

import { useEffect, useState } from "react";

/* True only when the page is being served from localhost. The hard-delete curation route depends
   on SUPABASE_SERVICE_ROLE_KEY, which only lives in apps/web/.env.local — so deletion is a
   localhost-only capability. Gate the delete button on this; the deployed site uses Hide instead.

   Returns false on the server and the first client render (hostname isn't known until mount), then
   flips after mount — fine for admin-only curation controls that aren't part of the initial paint. */
export function useIsLocalhost(): boolean {
  const [isLocal, setIsLocal] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    setIsLocal(host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]");
  }, []);
  return isLocal;
}
