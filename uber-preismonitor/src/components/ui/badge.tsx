import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap", {
  variants: {
    variant: {
      default: "border-border bg-panel-2 text-zinc-300",
      up: "border-green-500/30 bg-green-500/10 text-up",
      down: "border-red-500/30 bg-red-500/10 text-down",
      demo: "border-amber-500/40 bg-amber-500/15 text-demo",
      live: "border-blue-500/30 bg-blue-500/10 text-blue-300",
      muted: "border-transparent bg-zinc-800/60 text-zinc-400",
      warn: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      error: "border-red-500/30 bg-red-500/10 text-red-300",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />;
}
