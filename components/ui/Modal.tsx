"use client";

import { FormEvent, PropsWithChildren, ReactNode, Ref, useEffect, useRef } from "react";
import { forwardRef } from "react";
import { useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import Button from "@/components/ui/Button";
import { useModal } from "@/context/ModalContext";

type ModalProps = PropsWithChildren<{
  title: string
  customDialogSize?: string
  confirmText?: string
  cancelText?: string
  isConfirmButtonDisabled?: boolean
  dataTestId?: string
  onConfirm?: (event: FormEvent<HTMLFormElement>) => void
  onCancel?: () => void
  onClose?: () => void
}>;

const Modal = forwardRef(function Modal(
  {
    children,
    title,
    customDialogSize,
    cancelText,
    confirmText,
    isConfirmButtonDisabled = false,
    dataTestId = undefined,
    onConfirm,
    onCancel,
    onClose,
  }: ModalProps,
  ref: Ref<HTMLDialogElement>,
): ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { t } = useLingui();
  const { closeModal, setModalPortalTarget } = useModal();

  const handleConfirm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onConfirm?.(event);
  };

  const handleCancel = (): void => {
    onCancel?.();
  };

  const handleClose = (): void => {
    dialogRef.current?.close();
    onClose?.();
  };

  useEffect(() => {
    if (ref && typeof ref === "object") {
      ref.current = dialogRef.current;
    } else if (typeof ref === "function") {
      ref(dialogRef.current);
    }
  }, [ref]);

  useEffect(() => {
    const dialog: HTMLDialogElement | null = dialogRef.current;
    if (!dialog) return;

    setModalPortalTarget(dialog);

    dialog.showModal();

    const handleDialogClose = (): void => {
      setModalPortalTarget(null);
      closeModal();
      onClose?.();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        dialog.close();
      }
    };

    dialog.addEventListener("close", handleDialogClose);
    dialog.addEventListener("keydown", handleKeyDown);

    return () => {
      dialog.removeEventListener("close", handleDialogClose);
      dialog.removeEventListener("keydown", handleKeyDown);
      setModalPortalTarget(null);
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={clsx(
        "flex place-self-center border-t-4 border-t-gray-200 border-r-4 border-e-gray-400 border-b-4 border-b-gray-400 border-l-4 border-s-gray-200 rounded-xs ring-1 ring-black shadow-lg bg-gray-200 overflow-visible",
        "dark:border-t-dark-modal-border-top dark:border-e-dark-modal-border-end dark:border-b-dark-modal-border-bottom dark:border-s-dark-modal-border-start dark:bg-dark-modal-background",
        customDialogSize ? customDialogSize : "w-full max-w-md",
      )}
      data-testid={`dialog_${dataTestId}`}
    >
      <form className="flex-1 grid grid-rows-[max-content_1fr_max-content]" noValidate onSubmit={handleConfirm}>
        <div className={clsx("flex justify-between items-center gap-2 p-2 bg-gray-300 truncate", "dark:bg-slate-700")}>
          <h3 className={clsx("flex-1 text-base font-medium truncate", "dark:text-dark-modal-heading-text")}>
            {title}
          </h3>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-500"
            title={t({ message: "Close" })}
            aria-label={t({ message: "Close" })}
            onClick={handleClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={clsx("flex-1 overflow-y-auto px-2 py-4", "dark:text-dark-modal-body-text")}>{children}</div>

        <div
          className={clsx(
            "flex justify-end gap-2 p-2 border-t border-gray-300",
            "dark:border-t-dark-modal-border dark:border-dark-modal-border",
          )}
        >
          {onConfirm && (
            <Button type="submit" className="w-fit" disabled={isConfirmButtonDisabled}>
              {confirmText ?? t({ message: "Confirm" })}
            </Button>
          )}
          <Button type="button" className="w-fit" onClick={handleCancel}>
            {cancelText ?? t({ message: "Cancel" })}
          </Button>
        </div>
      </form>
    </dialog>
  );
});

export default Modal;
