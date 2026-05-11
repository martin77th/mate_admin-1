'use client';
import { ReactNode, useEffect } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ open, title, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const maxWidthMap = { sm: '360px', md: '520px', lg: '720px' };

  return (
    <div className="mm-modal-backdrop" onClick={onClose}>
      <div
        className="mm-modal"
        style={{ maxWidth: maxWidthMap[size] }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mm-modal-header">
          <h5 className="mm-modal-title">{title}</h5>
          <button className="mm-modal-close" onClick={onClose}>
            <i className="bi bi-x" />
          </button>
        </div>
        <div className="mm-modal-body">{children}</div>
        {footer && <div className="mm-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open, title, message, confirmLabel = '확인', cancelLabel = '취소', danger = false,
  onConfirm, onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button className="mm-btn mm-btn-secondary mm-btn-sm" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`mm-btn ${danger ? 'mm-btn-danger' : 'mm-btn-primary'} mm-btn-sm`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: 'var(--mm-text-secondary)', fontSize: 14 }}>{message}</p>
    </Modal>
  );
}
