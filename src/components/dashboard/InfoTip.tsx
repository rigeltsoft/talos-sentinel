import { useState } from "react";
import { Info } from "lucide-react";

// Icono "ℹ️" con tooltip: explica para qué sirve un módulo o función.
// Pensado para que cualquier usuario entienda el sistema sin llamar a soporte.
export default function InfoTip({
  text,
  width = 280,
}: {
  text: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        marginLeft: 6,
        verticalAlign: "middle",
      }}
    >
      <span
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label={text}
        title={text}
        style={{
          cursor: "help",
          color: "var(--muted)",
          display: "inline-flex",
          flexShrink: 0,
        }}
      >
        <Info size={15} />
      </span>
      {open && (
        <span
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 6,
            width,
            background: "rgba(17,24,39,.96)",
            color: "#f3f4f6",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            lineHeight: 1.55,
            boxShadow: "0 8px 24px rgba(0,0,0,.35)",
            zIndex: 60,
            fontWeight: 400,
            textAlign: "left",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
