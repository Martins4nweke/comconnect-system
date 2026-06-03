"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
  busy,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-[2rem] border-2 border-[#171717] bg-white p-6 shadow-[8px_8px_0_#171717]">
        <h2 className="text-xl font-black text-[#171717]">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-[#FF5C1A] px-4 py-2 text-sm font-black text-black disabled:opacity-60"
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
