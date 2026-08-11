import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

function join(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button
      className={join("ui-button", "ui-button-" + variant, className)}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={join("ui-card", className)} {...props} />;
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "java" | "bedrock" | "source" | "warning" | "success";
  className?: string;
}) {
  return (
    <span className={join("ui-badge", "ui-badge-" + tone, className)}>
      {children}
    </span>
  );
}

export function EditionBadge({ edition }: { edition: "java" | "bedrock" }) {
  return (
    <Badge tone={edition}>{edition === "java" ? "Java" : "Bedrock"}</Badge>
  );
}

export function VersionBadge({ version }: { version: string }) {
  return <Badge>{version}</Badge>;
}

export function SourceBadge({
  label,
  isDemo,
}: {
  label: string;
  isDemo: boolean;
}) {
  return (
    <Badge tone={isDemo ? "warning" : "source"}>
      {isDemo ? "DEMO · " : "SOURCE · "}
      {label}
    </Badge>
  );
}

export function StatePanel({
  state,
  title,
  children,
}: {
  state: "loading" | "empty" | "error" | "stale" | "unsafe";
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={"state-panel state-" + state} role="status">
      <strong>{title}</strong>
      <div>{children}</div>
    </section>
  );
}
