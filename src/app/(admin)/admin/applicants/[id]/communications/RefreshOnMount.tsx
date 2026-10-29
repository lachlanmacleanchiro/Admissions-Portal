"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The page marks messages read while rendering, after the layout has already
// counted them; one refresh brings the layout's unread badge up to date.
export function RefreshOnMount({ when }: { when: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (when) router.refresh();
    // Only on mount: the refresh itself re-renders with `when` false.
  }, []);
  return null;
}
