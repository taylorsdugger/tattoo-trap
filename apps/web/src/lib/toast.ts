"use client";

import { useSyncExternalStore } from "react";

/* Tiny toast store, same useSyncExternalStore pattern as favorites.ts — callable from anywhere
   (`toast("Done.")`) without threading a context through every button. The <Toaster /> mounted in
   the root layout subscribes and renders. Replaces blocking window.alert for admin actions so the
   UI stays responsive and non-jarring. */

export type ToastKind = "success" | "error" | "info";
export type Toast = { id: number; message: string; kind: ToastKind };

let toasts: readonly Toast[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function emit() {
  for (const listener of listeners) listener();
}

/** Show a toast. Auto-dismisses after `ms` (pass 0 to keep it until clicked). Returns its id. */
export function toast(message: string, kind: ToastKind = "info", ms = 4500): number {
  const id = nextId++;
  toasts = [...toasts, { id, message, kind }];
  emit();
  if (ms > 0) setTimeout(() => dismissToast(id), ms);
  return id;
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  );
}
