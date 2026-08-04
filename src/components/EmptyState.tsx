import type { ReactNode } from "react";
import { Card } from "@/components/Card";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card className="p-10 text-center">
      {icon && (
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-canopy-50 text-3xl">
          {icon}
        </div>
      )}
      <h2 className="mt-4 font-display text-2xl font-semibold text-ink">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">{body}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </Card>
  );
}
