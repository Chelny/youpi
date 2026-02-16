"use client";

import { ChangeEvent, ReactNode, useEffect } from "react";
import { useState } from "react";
import clsx from "clsx/lite";
import { TiTick } from "react-icons/ti";

type CheckboxProps = {
  id: string
  label: ReactNode
  defaultChecked?: boolean
  required?: boolean
  disabled?: boolean
  dataTestId?: string
  errorMessage?: string
  isNoBottomSpace?: boolean
  onChange?: (_: ChangeEvent<HTMLInputElement>) => void
};

export default function Checkbox({
  id,
  label,
  defaultChecked = false,
  required = false,
  disabled = false,
  dataTestId = undefined,
  errorMessage = "",
  isNoBottomSpace = false,
  onChange,
}: CheckboxProps): ReactNode {
  const [checked, setChecked] = useState<boolean>(defaultChecked);

  useEffect(() => {
    setChecked(defaultChecked);
  }, [defaultChecked]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setChecked(event.target.checked);
    onChange?.(event);
  };

  return (
    <div className={clsx("w-full", isNoBottomSpace ? "mb-0" : "mb-4")}>
      <div className="relative flex jusitfy-center items-center gap-2">
        <input
          type="checkbox"
          id={id}
          className={clsx(
            "peer appearance-none shrink-0 w-5 h-5 border-2 border-t-gray-600 border-e-gray-400 border-b-gray-400 border-s-gray-600 rounded-xs mt-1 bg-white",
            "hover:cursor-pointer",
            "disabled:bg-gray-200/50 disabled:cursor-not-allowed",
            "dark:border-t-dark-input-border-top dark:border-e-dark-input-border-end dark:border-b-dark-input-border-bottom dark:border-s-dark-input-border-start dark:bg-dark-input-background",
            "dark:disabled:bg-dark-input-disabled-background",
          )}
          name={id}
          checked={checked}
          required={required}
          disabled={disabled}
          aria-labelledby={`${id}Label`}
          data-testid={dataTestId}
          onChange={handleChange}
        />
        <TiTick
          className={clsx(
            "absolute hidden w-5 h-5 mt-1 text-gray-600 pointer-events-none",
            "peer-checked:block peer-disabled:text-gray-400",
            "rtl:-scale-x-100",
            "dark:text-gray-200 dark:peer-disabled:text-gray-400",
          )}
        />
        <label
          id={`${id}Label`}
          htmlFor={id}
          className={clsx(
            "mt-1",
            "peer-enabled:cursor-pointer peer-disabled:text-black/50 peer-disabled:cursor-not-allowed",
            "dark:peer-disabled:text-white/50",
          )}
        >
          {label}
        </label>
      </div>
      {errorMessage && (
        <span id={`${id}ErrorMessage`} className={clsx("text-red-600", "dark:text-red-400")}>
          {errorMessage}
        </span>
      )}
    </div>
  );
}
