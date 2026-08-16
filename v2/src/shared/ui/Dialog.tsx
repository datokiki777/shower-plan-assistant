import { useEffect, useRef, type ReactNode } from "react";
import "./Dialog.css";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ open, onClose, title, children, footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog ref={ref} className="ui-dialog" onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="ui-dialog__body">
        <h2 className="ui-dialog__title">{title}</h2>
        <div className="ui-dialog__content">{children}</div>
      </div>
      {footer && <div className="ui-dialog__footer">{footer}</div>}
    </dialog>
  );
}
