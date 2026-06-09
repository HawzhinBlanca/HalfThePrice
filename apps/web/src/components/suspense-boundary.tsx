import { Suspense, type ReactNode } from "react";

interface SuspenseBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

export function SuspenseBoundary({ fallback, children }: SuspenseBoundaryProps) {
  return (
    <Suspense fallback={fallback}>{children}</Suspense>
  );
}
