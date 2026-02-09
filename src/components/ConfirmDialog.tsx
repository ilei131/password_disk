import React from 'react';
import useI18n from '../i18n';
import './ConfirmDialog.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  okLabel?: string;
  cancelLabel?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  okLabel,
  cancelLabel
}) => {
  const { t } = useI18n();
  
  if (!isOpen) return null;

  return (
    <div className="confirm-dialog-overlay">
      <div className="confirm-dialog">
        <div className="confirm-dialog-header">
          <h3>{title}</h3>
        </div>
        <div className="confirm-dialog-content">
          <p>{message}</p>
        </div>
        <div className="confirm-dialog-actions">
          <button className="confirm-dialog-button confirm-dialog-button-cancel" onClick={onCancel}>
            {cancelLabel || t('app.cancel')}
          </button>
          <button className="confirm-dialog-button confirm-dialog-button-ok" onClick={onConfirm}>
            {okLabel || t('app.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
