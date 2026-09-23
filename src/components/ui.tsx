"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "brand";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-xl transition-all duration-150 select-none cursor-pointer",
        "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.985]",
        size === "sm" && "h-8 px-3 text-xs tracking-tight",
        size === "md" && "h-9.5 px-4 text-[13.5px] tracking-tight",
        size === "lg" && "h-11 px-5.5 text-sm tracking-tight font-semibold",
        size === "icon" && "h-9 w-9 rounded-lg",
        variant === "primary" &&
          "bg-ink text-bg hover:opacity-90 shadow-xs border border-ink/20",
        variant === "secondary" &&
          "bg-surface-2 text-ink hover:bg-surface-3 border border-line shadow-2xs",
        variant === "outline" &&
          "border border-line-strong text-ink hover:bg-surface-2 bg-transparent",
        variant === "ghost" && "text-ink-2 hover:text-ink hover:bg-surface-2/80",
        variant === "danger" &&
          "bg-danger/10 text-danger hover:bg-danger/18 border border-danger/25",
        variant === "brand" &&
          "bg-gradient-to-b from-accent to-accent-strong text-white border border-accent-strong/40 shadow-xs hover:brightness-105",
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      aria-hidden
    />
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children?: ReactNode;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={cn("card", className)}>{children}</Tag>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4.5 pb-1">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon ? <span className="mt-0.5 text-accent">{icon}</span> : null}
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-semibold tracking-tight truncate text-ink">{title}</h3>
          {subtitle ? (
            <p className="text-xs text-ink-3 mt-0.5 line-clamp-1">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------- Badge */

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warning" | "danger" | "success" | "info";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider leading-4 border",
        tone === "neutral" && "bg-surface-2/80 text-ink-2 border-line",
        tone === "accent" && "bg-accent/10 text-accent border-accent/25",
        tone === "warning" && "bg-warning/10 text-warning border-warning/25",
        tone === "danger" && "bg-danger/10 text-danger border-danger/25",
        tone === "success" && "bg-success/10 text-success border-success/25",
        tone === "info" && "bg-sky/10 text-sky border-sky/25",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- Input */

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9.5 w-full rounded-xl border border-line bg-surface px-3 text-sm placeholder:text-ink-3",
        "transition-all duration-150 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-3 min-h-20 resize-y",
        "transition-all duration-150 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-9.5 w-full appearance-none rounded-xl border border-line bg-surface px-3 pr-8 text-sm text-ink bg-no-repeat",
        "transition-all duration-150 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20",
        className
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239aa4b2' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 10px center",
      }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-ink-3">{hint}</span> : null}
    </label>
  );
}

/* ------------------------------------------------------------------- Modal */

let openModalCount = 0;

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;

    openModalCount++;
    document.body.style.overflow = "hidden";

    // Auto-focus first input or the dialog itself
    const timer = setTimeout(() => {
      if (ref.current) {
        const focusable = ref.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length > 1) {
          // Skip the close button if there's a form input
          const firstInput = ref.current.querySelector<HTMLElement>("input, select, textarea");
          if (firstInput) firstInput.focus();
          else focusable[0].focus();
        } else if (focusable.length > 0) {
          focusable[0].focus();
        }
      }
    }, 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" && ref.current) {
        const focusable = Array.from(
          ref.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      openModalCount = Math.max(0, openModalCount - 1);
      if (openModalCount === 0) {
        document.body.style.overflow = "";
      }
      if (previousFocus.current && typeof previousFocus.current.focus === "function") {
        previousFocus.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center p-4 sm:p-6 bg-black/45 backdrop-blur-xs animate-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      onMouseDown={(e) => e.target === ref.current?.parentElement && onClose()}
    >
      <div
        ref={ref}
        className={cn(
          "card w-full overflow-hidden shadow-pop animate-scale-in max-h-[88vh] flex flex-col",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        {title ? (
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 id={titleId} className="text-sm font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- EmptyState */

export function EmptyState({
  emoji,
  title,
  description,
  action,
}: {
  emoji: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-2xl">
        {emoji}
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-[13px] text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

/* -------------------------------------------------------------------- Tabs */

const TabsCtx = createContext<{ value: string; setValue: (v: string) => void } | null>(null);

export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  children,
  className,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const value = controlled ?? internal;
  const setValue = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };
  return (
    <TabsCtx.Provider value={{ value, setValue }}>
      <div className={className}>{children}</div>
    </TabsCtx.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl bg-surface-2 border border-line p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsCtx)!;
  const active = ctx.value === value;
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all",
        active
          ? "bg-surface text-ink shadow-sm border border-line"
          : "text-ink-3 hover:text-ink-2"
      )}
    >
      {children}
    </button>
  );
}

export function TabsPanel({ value, children, forceMount }: { value: string; children: ReactNode; forceMount?: boolean }) {
  const ctx = useContext(TabsCtx)!;
  if (ctx.value !== value && !forceMount) return null;
  return (
    <div role="tabpanel" hidden={ctx.value !== value} className={ctx.value !== value ? "hidden" : undefined}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- AnimatedNumber */

export function AnimatedNumber({
  value,
  format = (v) => Math.round(v).toLocaleString(),
  duration = 900,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const from = prev.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (value - from) * eased;
      setDisplay(v);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else prev.current = value;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, duration]);
  return (
    <span className={cn("tabular", className)}>{format(display)}</span>
  );
}

/* --------------------------------------------------------------- Switch */

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  const id = useId();
  return (
    <span className="inline-flex items-center gap-2">
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full border transition-colors",
          checked ? "bg-accent border-accent" : "bg-surface-3 border-line"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-4"
          )}
        />
      </button>
      {label ? (
        <label htmlFor={id} className="cursor-pointer text-[13px] text-ink-2 select-none">
          {label}
        </label>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------- Toast */

export type Toast = {
  id: string;
  message: string;
  type?: "success" | "error" | "info";
  action?: { label: string; onClick: () => void };
};

type ToastContextValue = {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let globalToast: ((toast: Omit<Toast, "id">) => string) | null = null;

export const toast = {
  success: (message: string, action?: { label: string; onClick: () => void }) => {
    return globalToast ? globalToast({ message, type: "success", action }) : "";
  },
  error: (message: string, action?: { label: string; onClick: () => void }) => {
    return globalToast ? globalToast({ message, type: "error", action }) : "";
  },
  info: (message: string, action?: { label: string; onClick: () => void }) => {
    return globalToast ? globalToast({ message, type: "info", action }) : "";
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const showToast = (toast: Omit<Toast, "id">): string => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4500);
    return id;
  };

  useEffect(() => {
    globalToast = showToast;
    return () => {
      globalToast = null;
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-5 right-5 z-[200] flex max-w-sm flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-pop animate-scale-in",
              t.type === "success" && "border-success/30 bg-surface text-ink",
              t.type === "error" && "border-danger/30 bg-surface text-danger",
              (!t.type || t.type === "info") && "border-line bg-surface text-ink"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0 text-base">
                {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
              </span>
              <p className="truncate text-[13px] font-medium">{t.message}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {t.action ? (
                <button
                  onClick={() => {
                    t.action!.onClick();
                    dismissToast(t.id);
                  }}
                  className="rounded-md bg-surface-2 px-2 py-1 text-xs font-semibold text-accent hover:bg-surface-3 transition-colors cursor-pointer"
                >
                  {t.action.label}
                </button>
              ) : null}
              <button
                onClick={() => dismissToast(t.id)}
                className="rounded-md p-1 text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { toast, showToast: () => "", dismissToast: () => {} };
  return ctx;
}
