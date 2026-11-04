import ModalBackdrop from "./ModalBackdrop";

export default function FormModal({ title, subtitle, onClose, children, labelledBy }) {
  const id = labelledBy || "form-modal-title";
  return (
    <ModalBackdrop onClose={onClose}>
      <section className="sales-modal" role="dialog" aria-modal="true" aria-labelledby={id}>
        <header>
          <div>
            <h2 id={id}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="sales-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        {children}
      </section>
    </ModalBackdrop>
  );
}
