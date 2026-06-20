"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";

interface MobileNavToggleProps {
  children: React.ReactNode;
  mainNavLabel: string;
}

export function MobileNavToggle({ children, mainNavLabel }: MobileNavToggleProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop nav — always visible on sm+ */}
      <nav aria-label={mainNavLabel} className="hidden items-center gap-1 sm:flex sm:gap-2">
        {children}
      </nav>

      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 sm:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile nav dropdown */}
      {open && (
        <div
          className="absolute inset-x-0 top-16 z-50 border-b border-zinc-200/60 bg-white/95 p-4 backdrop-blur-xl dark:border-zinc-800/60 dark:bg-zinc-950/95 sm:hidden"
          onClick={() => setOpen(false)}
        >
          <nav aria-label={mainNavLabel} className="flex flex-col gap-2">
            {children}
          </nav>
        </div>
      )}
    </>
  );
}
