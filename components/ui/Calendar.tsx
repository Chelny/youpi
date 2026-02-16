"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { format } from "date-fns";
import {
  PiCaretDoubleLeftDuotone,
  PiCaretDoubleRightDuotone,
  PiCaretLeftDuotone,
  PiCaretRightDuotone,
} from "react-icons/pi";
import Button from "@/components/ui/Button";
import { getDateFnsLocale } from "@/translations/languages";

type CalendarProps = {
  id: string
  label: string
  placeholder?: string
  minDate?: Date
  maxDate?: Date
  defaultValue?: string
  required?: boolean
  disabled?: boolean
  dataTestId?: string
  description?: string
  errorMessage?: string
  onChange?: (date: string) => void
};

export default function Calendar({
  id,
  label,
  placeholder,
  minDate = new Date(new Date().getUTCFullYear() - 100, new Date().getUTCMonth(), new Date().getUTCDate()),
  maxDate = new Date(),
  defaultValue = undefined,
  required = false,
  disabled = false,
  dataTestId = undefined,
  description = "",
  errorMessage = "",
  onChange,
}: CalendarProps): ReactNode {
  const { i18n, t } = useLingui();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultValue ? new Date(defaultValue) : undefined);
  const [browsingDate, setBrowsingDate] = useState<Date>(
    maxDate ? new Date(Math.min(maxDate.getTime(), new Date().getTime())) : new Date(),
  );
  const [daysInMonth, setDaysInMonth] = useState<number[]>([]);
  const [isCalendarVisible, setCalendarVisible] = useState<boolean>(false);
  const [view, setView] = useState<"month" | "year">("month");
  const [currentDecade, setCurrentDecade] = useState<number>(Math.floor(browsingDate.getUTCFullYear() / 10) * 10);
  const calendarRef = useRef<HTMLDivElement>(null);
  const monthNames: string[] = [
    t({ message: "January" }),
    t({ message: "February" }),
    t({ message: "March" }),
    t({ message: "April" }),
    t({ message: "May" }),
    t({ message: "June" }),
    t({ message: "July" }),
    t({ message: "August" }),
    t({ message: "September" }),
    t({ message: "October" }),
    t({ message: "November" }),
    t({ message: "December" }),
  ];
  const fullWeekDays: string[] = [
    t({ message: "Sunday" }),
    t({ message: "Monday" }),
    t({ message: "Tuesday" }),
    t({ message: "Wednesday" }),
    t({ message: "Thursday" }),
    t({ message: "Friday" }),
    t({ message: "Saturday" }),
  ];
  const daysOfWeek: string[] = fullWeekDays.map((day: string) => day.charAt(0).toUpperCase());
  const isPreviousYearDisabled: boolean = browsingDate.getUTCFullYear() <= minDate.getUTCFullYear();
  const isNextYearDisabled: boolean =
    new Date(browsingDate.getUTCFullYear() + 1, browsingDate.getUTCMonth(), browsingDate.getUTCDate()) > maxDate;
  const isPreviousMonthDisabled: boolean =
    browsingDate.getUTCFullYear() === minDate.getUTCFullYear() && browsingDate.getUTCMonth() <= minDate.getUTCMonth();
  const isNextMonthDisabled: boolean =
    browsingDate.getUTCFullYear() === maxDate.getUTCFullYear() && browsingDate.getUTCMonth() >= maxDate.getUTCMonth();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        handleCloseCalendar();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const year: number = browsingDate.getUTCFullYear();
    const month: number = browsingDate.getUTCMonth();
    const daysInMonthCount: number = new Date(year, month + 1, 0).getUTCDate();

    setDaysInMonth(Array.from({ length: daysInMonthCount }, (_, index: number) => index + 1));
  }, [browsingDate]);

  const handleOpenCalendar = (): void => {
    const initialBrowsingDate: Date =
      (defaultValue && new Date(defaultValue).getTime() && new Date(defaultValue)) || new Date(maxDate) || new Date();

    setBrowsingDate(initialBrowsingDate);
    setCalendarVisible(true);
  };

  const handleCloseCalendar = (): void => {
    setView("month");
    setCalendarVisible(false);
  };

  const handleSelectDay = (day: number): void => {
    if (disabled) return;

    const newDate: Date = new Date(browsingDate.getUTCFullYear(), browsingDate.getUTCMonth(), day, 12, 0, 0, 0);

    setSelectedDate(newDate);
    onChange?.(newDate.toISOString().split("T")[0]);
    handleCloseCalendar();
  };

  const handleYearChange = (direction: number): void => {
    const newYear: number = browsingDate.getUTCFullYear() + direction;
    const newBrowsingDate: Date = new Date(
      newYear,
      browsingDate.getUTCMonth(),
      Math.min(
        selectedDate ? selectedDate.getUTCDate() : new Date().getUTCDate(),
        new Date(newYear, browsingDate.getUTCMonth() + 1, 0).getUTCDate(),
      ),
    );

    if (newBrowsingDate >= minDate && newBrowsingDate <= maxDate) {
      setBrowsingDate(newBrowsingDate);
    }
  };

  const handleMonthChange = (direction: number): void => {
    const newMonth: number = browsingDate.getUTCMonth() + direction;
    const newYear: number = browsingDate.getUTCFullYear() + Math.floor(newMonth / 12);
    const adjustedMonth: number = (newMonth + 12) % 12;
    const newBrowsingDate: Date = new Date(newYear, adjustedMonth);

    if (newBrowsingDate >= minDate && newBrowsingDate <= maxDate) {
      setBrowsingDate(newBrowsingDate);
    }
  };

  const renderDayPicker = (): ReactNode => {
    const firstDayOfMonth: number = new Date(browsingDate.getUTCFullYear(), browsingDate.getUTCMonth(), 1).getDay();
    const daysArray: (number | null)[] = new Array(firstDayOfMonth).fill(null).concat(daysInMonth);
    const rows: (number | null)[][] = [];
    const currentYear: number = browsingDate.getUTCFullYear();
    const currentMonth: number = browsingDate.getUTCMonth();
    const isCurrentMonthMinYear: boolean =
      currentYear === minDate.getUTCFullYear() && currentMonth === minDate.getUTCMonth();
    const isCurrentMonthMaxYear: boolean =
      currentYear === maxDate.getUTCFullYear() && currentMonth === maxDate.getUTCMonth();

    for (let i = 0; i < daysArray.length; i += 7) {
      rows.push(daysArray.slice(i, i + 7));
    }

    return (
      <div className="grid grid-rows-6 grid-cols-1 gap-1">
        <div className="grid grid-cols-7 text-center font-semibold" role="grid">
          {daysOfWeek.map((day: string, index: number) => (
            <div key={index} className="p-2" role="columnheader">
              {day}
            </div>
          ))}
        </div>
        {rows.map((week: (number | null)[], weekIndex: number) => (
          <div key={weekIndex} role="row">
            <div className="grid grid-cols-7 gap-1">
              {week.map((day: number | null, dayIndex: number) => {
                const displayDay: number | string = day !== null ? day : "";
                const defaultSelectedDate: Date =
                  (selectedDate && selectedDate.getTime() && selectedDate) || maxDate || new Date();
                const isSelectedDay: boolean =
                  day === defaultSelectedDate?.getUTCDate() &&
                  browsingDate.getUTCMonth() === defaultSelectedDate?.getUTCMonth() &&
                  browsingDate.getUTCFullYear() === defaultSelectedDate?.getUTCFullYear();
                const isDisabledDay: boolean =
                  (isCurrentMonthMinYear && day !== null && day <= maxDate.getUTCDate()) ||
                  (isCurrentMonthMaxYear && day !== null && day > maxDate.getUTCDate());

                return (
                  <button
                    key={dayIndex}
                    type="button"
                    className={clsx(
                      "flex-1 p-2 text-center border border-gray-200 rounded-xs dark:border-neutral-900",
                      !disabled && day !== null && !isDisabledDay && "hover:bg-gray-200 dark:hover:bg-slate-600",
                      day === null && "opacity-50 cursor-default",
                      isSelectedDay && "bg-blue-100 dark:bg-blue-900",
                      isDisabledDay && "opacity-50 hover:cursor-not-allowed",
                    )}
                    disabled={isDisabledDay}
                    role="gridcell"
                    tabIndex={isDisabledDay ? -1 : 0}
                    aria-selected={isSelectedDay}
                    onClick={() => !isDisabledDay && day && handleSelectDay(day)}
                  >
                    {displayDay}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderYearPicker = (): ReactNode => {
    const yearsInDecade: number[] = Array.from({ length: 10 }, (_, index: number) => currentDecade + index);

    return (
      <div>
        <div className="flex justify-evenly gap-2 mt-2">
          <Button
            type="button"
            className="w-full"
            disabled={currentDecade <= minDate.getUTCFullYear()}
            onClick={() => setCurrentDecade(currentDecade - 10)}
          >
            <Trans>Previous Decade</Trans>
          </Button>
          <Button
            type="button"
            className="w-full"
            disabled={currentDecade + 10 > maxDate.getUTCFullYear()}
            onClick={() => setCurrentDecade(currentDecade + 10)}
          >
            <Trans>Next Decade</Trans>
          </Button>
        </div>
        <hr className="my-4" />
        <div className="grid grid-cols-4 gap-2 mt-2">
          {yearsInDecade.map(
            (year: number) =>
              year <= maxDate.getUTCFullYear() && (
                <Button
                  key={year}
                  type="button"
                  className="text-center border border-gray-200 rounded-xs hover:bg-gray-200 dark:hover:bg-gray-600"
                  disabled={year > maxDate.getUTCFullYear() || year < minDate.getUTCFullYear()}
                  onClick={() => {
                    setBrowsingDate(new Date(year, browsingDate.getUTCMonth()));
                    setView("month");
                  }}
                >
                  {year}
                </Button>
              ),
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative mb-4">
      <label id={`${id}Label`} htmlFor={id} className="block mb-2 font-medium">
        {label}{" "}
        {!required && (
          <span className={clsx("text-neutral-500", "dark:text-dark-text-muted")}>
            (<Trans>optional</Trans>)
          </span>
        )}
      </label>
      <Button
        id={id}
        className="w-full"
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={isCalendarVisible}
        aria-label={label}
        aria-describedby={description ? `${id}Description` : undefined}
        dataTestId={dataTestId}
        onClick={handleOpenCalendar}
      >
        {selectedDate && selectedDate.getTime()
          ? format(new Date(selectedDate.getTime() + selectedDate.getTimezoneOffset() * 60000), "PPP", {
              locale: getDateFnsLocale(i18n.locale),
            })
          : (placeholder ?? t({ message: "Select a date" }))}
      </Button>
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
      <input
        type="hidden"
        name={id}
        value={selectedDate ? selectedDate.toISOString().split("T")[0] : ""}
        required={required}
      />

      {isCalendarVisible && (
        <div
          ref={calendarRef}
          className={clsx(
            "absolute start-1/2 z-sticky min-w-96 max-w-max p-4 border border-gray-300 rounded-sm shadow-md bg-white -translate-x-1/2",
            "rtl:translate-x-1/2",
            "dark:border-dark-card-border dark:bg-dark-card-background",
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex justify-center items-center gap-2 mb-4">
            <Button
              type="button"
              disabled={isPreviousYearDisabled}
              aria-label={t({ message: "Previous Year" })}
              onClick={() => handleYearChange(-1)}
            >
              <PiCaretDoubleLeftDuotone
                className={clsx("w-5 h-5", "rtl:-scale-y-100 rtl:-rotate-180")}
                aria-hidden="true"
              />
            </Button>
            <Button
              type="button"
              disabled={isPreviousMonthDisabled}
              aria-label={t({ message: "Previous Month" })}
              onClick={() => handleMonthChange(-1)}
            >
              <PiCaretLeftDuotone className={clsx("w-5 h-5", "rtl:-scale-y-100 rtl:-rotate-180")} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              className="flex-1"
              aria-live="polite"
              onClick={() => setView(view === "month" ? "year" : "month")}
            >
              {view === "month"
                ? `${monthNames[browsingDate.getUTCMonth()]} ${browsingDate.getUTCFullYear()}`
                : t({ message: "Select Year" })}
            </Button>
            <Button
              type="button"
              disabled={isNextMonthDisabled}
              aria-label={t({ message: "Next Month" })}
              onClick={() => handleMonthChange(1)}
            >
              <PiCaretRightDuotone className={clsx("w-5 h-5", "rtl:-scale-y-100 rtl:-rotate-180")} aria-hidden="true" />
            </Button>
            <Button
              type="button"
              disabled={isNextYearDisabled}
              aria-label={t({ message: "Next Year" })}
              onClick={() => handleYearChange(1)}
            >
              <PiCaretDoubleRightDuotone
                className={clsx("w-5 h-5", "rtl:-scale-y-100 rtl:-rotate-180")}
                aria-hidden="true"
              />
            </Button>
          </div>

          {view === "month" ? renderDayPicker() : renderYearPicker()}

          <Button className="mt-4 ms-auto" onClick={handleCloseCalendar}>
            <Trans>Close</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}
