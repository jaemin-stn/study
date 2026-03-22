import { useStore } from '../store/useStore';

const DIALOG_STYLES = `
.unsaved-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  animation: fadeIn 0.2s ease-out;
}

.unsaved-dialog {
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  width: 400px;
  max-width: 90%;
  overflow: hidden;
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.unsaved-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-weak);
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  gap: 10px;
}

.unsaved-dialog-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.unsaved-dialog-body {
  padding: 24px 20px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.unsaved-dialog-footer {
  padding: 16px 20px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-weak);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleIn {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.btn-discard {
  background: var(--severity-critical-bg);
  border-color: var(--severity-critical);
  color: var(--severity-critical-text);
}
.btn-discard:hover {
  background: var(--severity-critical);
  color: white;
}
`;

export const UnsavedChangesDialog = () => {
  const isOpen = useStore((s) => s.showUnsavedDialog);
  const saveChanges = useStore((s) => s.saveChanges);
  const discardChanges = useStore((s) => s.discardChanges);
  const cancelConfirmation = useStore((s) => s.cancelConfirmation);

  if (!isOpen) return null;

  return (
    <div className="unsaved-dialog-overlay" onClick={cancelConfirmation}>
      <style>{DIALOG_STYLES}</style>
      <div className="unsaved-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="unsaved-dialog-header">
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div className="unsaved-dialog-title">저장되지 않은 변경사항</div>
        </div>
        <div className="unsaved-dialog-body">
          편집 모드에서 변경된 내용이 있습니다. 변경사항을 저장하시겠습니까?
          저장하지 않으면 모든 변경사항이 취소됩니다.
        </div>
        <div className="unsaved-dialog-footer">
          <button 
            className="grafana-btn grafana-btn-secondary" 
            onClick={cancelConfirmation}
          >
            취소
          </button>
          <button 
            className="grafana-btn btn-discard" 
            onClick={discardChanges}
          >
            저장 안 함
          </button>
          <button 
            className="grafana-btn grafana-btn-primary" 
            onClick={saveChanges}
            style={{ minWidth: '80px' }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
