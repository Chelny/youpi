import { ComponentProps, ComponentPropsWithoutRef, forwardRef, ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { clsx } from "clsx/lite";
import Anchor from "@/components/ui/Anchor";

const Breadcrumb = forwardRef<
  HTMLElement,
  ComponentPropsWithoutRef<"nav"> & {
    separator?: ReactNode
  }
>(({ ...props }, ref) => {
  const { t } = useLingui();

  return <nav ref={ref} aria-label={t({ message: "breadcrumb" })} {...props} />;
});
Breadcrumb.displayName = "Breadcrumb";

const BreadcrumbList = forwardRef<HTMLOListElement, ComponentPropsWithoutRef<"ol">>(({ className, ...props }, ref) => (
  <ol ref={ref} className={clsx("flex flex-wrap items-center gap-1.5 break-words sm:gap-2.5", className)} {...props} />
));
BreadcrumbList.displayName = "BreadcrumbList";

const BreadcrumbItem = forwardRef<HTMLLIElement, ComponentPropsWithoutRef<"li">>(({ className, ...props }, ref) => (
  <li ref={ref} className={clsx("inline-flex items-center gap-1.5", className)} {...props} />
));
BreadcrumbItem.displayName = "BreadcrumbItem";

const BreadcrumbLink = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean
  }
>(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? "span" : Anchor;

  return <Comp ref={ref} className={className} href={props.href as string} {...props} />;
});
BreadcrumbLink.displayName = "BreadcrumbLink";

const BreadcrumbPage = forwardRef<HTMLSpanElement, ComponentPropsWithoutRef<"span">>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={clsx("font-medium", className)}
    role="link"
    aria-current="page"
    aria-disabled="true"
    {...props}
  />
));
BreadcrumbPage.displayName = "BreadcrumbPage";

const BreadcrumbSeparator = ({ children, className, ...props }: ComponentProps<"li">) => (
  <li
    className={clsx("[&>svg]:size-3.5", "rtl:-scale-x-100", className)}
    role="presentation"
    aria-hidden="true"
    {...props}
  >
    {children ?? <span className="text-gray-400 rtl:rotate-180">/</span>}
  </li>
);
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

const BreadcrumbEllipsis = ({ className, ...props }: ComponentProps<"span">) => {
  return (
    <span
      className={clsx("flex justify-center items-center", className)}
      role="presentation"
      aria-hidden="true"
      {...props}
    >
      <span className="text-gray-400">...</span>
      <span className="sr-only">
        <Trans>More</Trans>
      </span>
    </span>
  );
};
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis";

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
