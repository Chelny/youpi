"use client";

import type { Toast, ToastPosition } from "@/context/ToastContext";

type ToastContainerProps = {
  toasts: Toast[]
};

const positions: ToastPosition[] = ["top-start", "top-end", "bottom-start", "bottom-end"];

export const ToastContainer = ({ toasts }: ToastContainerProps) => {
  return (
    <>
      {positions.map((position: ToastPosition) => {
        const positionToasts: Toast[] = toasts.filter((toast: Toast) => {
          if (!toast.position && position === "top-end") return true;
          return toast.position === position;
        });
        if (positionToasts.length === 0) return null;

        const containerStyle: string = getContainerStyle(position);

        return (
          <div key={position} className={containerStyle}>
            {positionToasts.map((toast: Toast) => (
              <div key={toast.id} className="w-96 px-4 py-2 mb-2 rounded shadow-md bg-black text-white">
                {toast.message}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
};

const getContainerStyle = (position: ToastPosition) => {
  const base: string = "fixed z-toast p-4";

  switch (position) {
    case "top-start":
      return `${base} top-0 start-0`;
    case "top-end":
      return `${base} top-0 end-0`;
    case "bottom-start":
      return `${base} bottom-0 start-0`;
    case "bottom-end":
      return `${base} bottom-0 end-0`;
    default:
      return `${base} top-0 end-0`;
  }
};
