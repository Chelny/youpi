"use client";

import { KeyboardEventHandler, MouseEventHandler, PropsWithChildren, ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx/lite";

type AnchorProps = PropsWithChildren<{
  href: string
  target?: string
  className?: string
  dataTestId?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>
}>;

export default function Anchor({
  children,
  href,
  target = "_self",
  className = "",
  dataTestId = undefined,
  onClick,
  onKeyDown,
}: AnchorProps): ReactNode {
  return (
    <Link
      className={clsx("youpi-link", className)}
      href={href}
      target={target}
      rel="noopener noreferrer"
      data-testid={dataTestId}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </Link>
  );
}
