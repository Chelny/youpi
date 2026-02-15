"use client";

import {
  Children,
  CSSProperties,
  KeyboardEvent,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { createPortal } from "react-dom";
import { PiCaretDownDuotone, PiCaretDownFill } from "react-icons/pi";
import { useModal } from "@/context/ModalContext";
import { useKeyboardActions } from "@/hooks/useKeyboardActions";

type SelectProps = PropsWithChildren<{
  id: string
  label?: string
  className?: string
  placeholder?: string
  defaultValue?: string
  required?: boolean
  disabled?: boolean
  dataTestId?: string
  description?: string
  errorMessage?: string
  isNoBottomSpace?: boolean
  onChange?: (value: string) => void
}>;

export default function Select({
  children,
  id,
  label,
  className = "",
  placeholder = "",
  defaultValue = "",
  required = false,
  disabled = false,
  dataTestId = undefined,
  description = "",
  errorMessage = "",
  isNoBottomSpace = false,
  onChange,
}: SelectProps): ReactNode {
  const [selectedValue, setSelectedValue] = useState<string>(defaultValue);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const selectBoxRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const options = Children.toArray(children) as ReactElement<SelectOptionProps>[];
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const { modalPortalTarget } = useModal();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  const computeDropdownStyle = (): CSSProperties => {
    if (!selectBoxRef.current) return {};

    const rect: DOMRect = selectBoxRef.current.getBoundingClientRect();
    const margin: number = 4;
    const maxHeight: number = 240;
    const viewportBottomSpace: number = window.innerHeight - rect.bottom;
    const viewportTopSpace: number = rect.top;
    const isOpenUp: boolean = viewportBottomSpace < maxHeight && viewportTopSpace > viewportBottomSpace;

    return {
      position: "fixed",
      ...(isOpenUp ? { bottom: window.innerHeight - rect.top + margin } : { top: rect.bottom + margin }),
      left: rect.left,
      zIndex: 60, // Must be higher than modals (--z-index-modal)
      minWidth: rect.width, // Prevents shrink on first paint
      width: rect.width,
      maxWidth: rect.width,
      overflowY: "auto",
    };
  };

  const handleSelectChange = (value: string): void => {
    setSelectedValue(value);
    onChange?.(value);
    setIsDropdownOpen(false);
  };

  const handleToggleVisibility = useKeyboardActions({
    onEnter: () => setIsDropdownOpen(!isDropdownOpen),
    onSpace: () => setIsDropdownOpen(!isDropdownOpen),
    isDisabled: disabled,
  });

  const getFocusableElements = (): HTMLElement[] => {
    const selectors: string = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex=\"-1\"])",
    ].join(",");

    return Array.from(document.querySelectorAll<HTMLElement>(selectors)).filter((element: HTMLElement) => {
      // Skip hidden
      const style: CSSStyleDeclaration = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      // Skip if disabled via aria
      if (element.getAttribute("aria-disabled") === "true") return false;
      return true;
    });
  };

  const focusAfterTrigger = (direction: "next" | "prev"): void => {
    const trigger: HTMLDivElement | null = selectBoxRef.current;
    if (!trigger) return;

    const focusables: HTMLElement[] = getFocusableElements();

    // If trigger isn't in the list, fallback: focus body
    const triggerIndex: number = focusables.indexOf(trigger);

    // If not found, try to focus next/prev from current focus
    const baseIndex: number =
      triggerIndex >= 0 ? triggerIndex : focusables.indexOf(document.activeElement as HTMLElement);

    const targetIndex: number = direction === "next" ? baseIndex + 1 : baseIndex - 1;
    const target: HTMLElement = focusables[targetIndex];

    if (target) target.focus();
  };

  useLayoutEffect(() => {
    if (!isDropdownOpen) return;
    setDropdownStyle(computeDropdownStyle());
  }, [isDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target: Node = event.target as Node;
      if (selectBoxRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsDropdownOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const target: HTMLElement = modalPortalTarget ?? document.body;
    setPortalTarget(target);
  }, [modalPortalTarget]);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const onReposition = (): void => setDropdownStyle(computeDropdownStyle());

    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);

    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;

    const selectedIndex: number = Math.max(
      0,
      options.findIndex((option: ReactElement<SelectOptionProps>) => option.props.value === selectedValue),
    );

    requestAnimationFrame(() => {
      optionRefs.current[selectedIndex]?.focus();
    });
  }, [isDropdownOpen, options, selectedValue]);

  useEffect(() => {
    setSelectedValue(defaultValue);
  }, [defaultValue]);

  return (
    <div className={clsx("flex flex-col", isNoBottomSpace ? "mb-0" : "mb-4")}>
      {label && (
        <label id={`${id}Label`} htmlFor={id} className="mb-1 font-medium">
          {label}{" "}
          {!required && (
            <span className={clsx("text-neutral-500", "dark:text-dark-text-muted")}>
              (<Trans>optional</Trans>)
            </span>
          )}
        </label>
      )}
      <div
        ref={selectBoxRef}
        id={id}
        className={clsx(
          "flex justify-between items-center h-8 px-1 py-4 overflow-hidden border-2 border-t-gray-200 border-e-gray-400 border-b-gray-400 border-s-gray-200 rounded-xs ring-1 ring-black bg-gray-300 text-black line-clamp-1",
          "hover:cursor-pointer",
          disabled && "bg-gray-200 opacity-50 cursor-not-allowed",
          "dark:border-t-dark-button-border-top dark:border-e-dark-button-border-end dark:border-b-dark-button-border-bottom dark:border-s-dark-button-border-start dark:bg-dark-button-background dark:text-dark-button-text",
          className,
        )}
        role="combobox"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-controls={`${id}Dropdown`}
        aria-expanded={isDropdownOpen}
        aria-labelledby={`${id}Label`}
        aria-describedby={description ? `${id}Description` : undefined}
        aria-required={required}
        aria-disabled={disabled}
        aria-invalid={errorMessage ? "true" : "false"}
        aria-errormessage={errorMessage ? `${id}ErrorMessage` : undefined}
        data-testid={dataTestId}
        onClick={() => {
          if (disabled) return;
          selectBoxRef.current?.focus();
          setIsDropdownOpen((prev: boolean) => {
            const next: boolean = !prev;
            if (next) {
              // Compute immediately so first render has correct width
              setDropdownStyle(computeDropdownStyle());
            }
            return next;
          });
        }}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === "Tab" && isDropdownOpen) {
            event.preventDefault();
            const selectedIndex: number = Math.max(
              0,
              options.findIndex((option: ReactElement<SelectOptionProps>) => option.props.value === selectedValue),
            );
            optionRefs.current[selectedIndex]?.focus();
            return;
          }

          handleToggleVisibility(event);
        }}
      >
        <span className="sr-only">{placeholder}</span>
        <span>
          {
            options.find((option: ReactElement<SelectOptionProps>) => option.props.value === selectedValue)?.props
              .children
          }
        </span>
        {disabled ? <PiCaretDownDuotone /> : <PiCaretDownFill className="ms-2" />}
      </div>
      {isDropdownOpen &&
        portalTarget &&
        createPortal(
          <div
            ref={dropdownRef}
            id={`${id}Dropdown`}
            className={clsx(
              "py-1 overflow-y-auto max-h-60 border border-gray-300 shadow-lg rounded-sm bg-white",
              "dark:border-dark-card-border dark:bg-dark-card-background",
            )}
            style={dropdownStyle}
            role="listbox"
            aria-activedescendant={selectedValue ? `${id}-${selectedValue}` : undefined}
          >
            {options.map((option: ReactElement<SelectOptionProps>, index: number) => (
              <div
                key={option.props.value}
                ref={(element: HTMLDivElement | null) => {
                  optionRefs.current[index] = element;
                }}
                id={`${id}-${option.props.value}`}
                className={clsx(
                  "block w-full px-2 py-2 text-start cursor-pointer",
                  "hover:bg-gray-200 dark:hover:bg-slate-600",
                  option.props.value === selectedValue && "bg-blue-100 dark:bg-blue-900",
                )}
                role="option"
                tabIndex={isDropdownOpen ? 0 : -1}
                aria-selected={option.props.value === selectedValue}
                aria-disabled={disabled}
                onClick={() => !disabled && handleSelectChange(option.props.value)}
                onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                  if (event.key === "Tab") {
                    const isFirst: boolean = index === 0;
                    const isLast: boolean = index === options.length - 1;

                    if ((event.shiftKey && isFirst) || (!event.shiftKey && isLast)) {
                      event.preventDefault();
                      setIsDropdownOpen(false);
                      requestAnimationFrame(() => {
                        focusAfterTrigger(event.shiftKey ? "prev" : "next");
                      });
                    }

                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setIsDropdownOpen(false);
                    requestAnimationFrame(() => selectBoxRef.current?.focus());
                    return;
                  }

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    !disabled && handleSelectChange(option.props.value);
                  }
                }}
              >
                {option.props.children}
              </div>
            ))}
          </div>,
          portalTarget,
        )}
      {description && (
        <p id={`${id}Description`} className={clsx("text-neutral-500", "dark:text-dark-text-muted")}>
          {description}
        </p>
      )}
      {errorMessage && (
        <span id={`${id}ErrorMessage`} className={clsx("text-red-600", "dark:text-red-400")}>
          {errorMessage}
        </span>
      )}

      {/* Hidden input for form submission */}
      <input type="hidden" name={id} value={selectedValue} />
    </div>
  );
}

type SelectOptionProps = PropsWithChildren<{
  value: string
}>;

const Option = ({}: SelectOptionProps): ReactNode => null;

Select.Option = Option;
