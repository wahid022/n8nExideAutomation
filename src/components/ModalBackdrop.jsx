export default function ModalBackdrop({ onClose, children }) {
  return (
    <div
      className="sales-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}
