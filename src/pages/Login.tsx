import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import PasswordField from "@/components/dashboard/PasswordField";

export default function Login() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const bgRef = useRef<HTMLDivElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Fondo animado a pantalla completa: Vanta DOTS (three.js se carga bajo demanda)
  useEffect(() => {
    let effect: { destroy: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const THREE = await import("three");
        // Vanta (DOTS/NET) lee window.THREE al importarse el módulo:
        // hay que exponerlo como global ANTES de cargar vanta.
        (window as unknown as { THREE: unknown }).THREE = THREE;
        const mod: any = await import("vanta/dist/vanta.dots.min");
        const VantaDots: any = mod.default ?? mod;
        if (cancelled || !bgRef.current) return;
        effect = VantaDots({
          el: bgRef.current,
          THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200,
          minWidth: 200,
          scale: 1.0,
          scaleMobile: 1.0,
          color: 0x93c5fd, // puntos y líneas azul claro
          backgroundColor: 0x0d1b3d, // azul profundo (mitad izquierda)
          size: 1.6,
          spacing: 22,
          showLines: true,
        });
      } catch (err) {
        console.error("Vanta DOTS no cargó (el login sigue funcionando):", err);
      }
    })();
    return () => {
      cancelled = true;
      effect?.destroy?.();
    };
  }, []);

  const loginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/", { replace: true });
    },
    onError: (err) => setError(err.message),
  });

  useEffect(() => {
    if (!isLoading && user) navigate("/", { replace: true });
  }, [isLoading, user, navigate]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email: email.trim(), password });
  }

  return (
    <div className="tsen theme-talos">
      <div className="login-wrap">
        {/* Fondo: Vanta DOTS a pantalla completa */}
        <div ref={bgRef} style={{ position: "absolute", inset: 0, zIndex: 0 }} />

        <div className="login-split">
          {/* ─── Marca (izquierda) ─── */}
          <div className="login-brand">
            <img
              src="/iconos/002_logo_bordado_blanco_texto.png"
              alt="Talos Sentinel"
              style={{
                width: 340,
                maxWidth: "88%",
                height: "auto",
                objectFit: "contain",
              }}
            />
            <div className="login-glass">
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>
                El mejor empleado de tu negocio nunca duerme: con IA, atiende,
                vende y agenda por WhatsApp —{" "}
                <strong style={{ color: "#fff" }}>24/7</strong>
              </p>
            </div>
            <div
              style={{
                display: "flex",
                gap: 30,
                alignItems: "center",
                justifyContent: "center",
                background: "#ffffff",
                borderRadius: 20,
                padding: "18px 32px",
                boxShadow: "0 10px 30px rgba(0,0,0,.25)",
              }}
            >
              {[
                { img: "/iconos/0001_Atiende.gif", label: "Atiende" },
                { img: "/iconos/0002_vende.gif", label: "Vende" },
                { img: "/iconos/0003_camion.gif", label: "Entrega" },
              ].map((f) => (
                <div
                  key={f.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <img
                    src={f.img}
                    alt={f.label}
                    style={{ width: 58, height: 58, objectFit: "contain" }}
                  />
                  <span
                    style={{ fontSize: 14, fontWeight: 700, color: "#1e3a8a" }}
                  >
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Formulario (derecha) ─── */}
          <div className="login-form-side">
            <div className="login-card">
              <form onSubmit={submit} style={{ textAlign: "left", marginTop: 8 }}>
                <div className="field">
                  <label>Correo electrónico</label>
                  <input
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tunegocio@correo.com"
                    required
                  />
                </div>
                <div className="field">
                  <label>Contraseña</label>
                  <PasswordField
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                {error && (
                  <p style={{ color: "#e11d48", fontSize: 13, margin: "0 0 10px" }}>
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn"
                  style={{ width: "100%", padding: 12, fontSize: 15 }}
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Ingresando…" : "Iniciar sesión"}
                </button>
              </form>

              <p style={{ marginTop: 18, marginBottom: 0, fontSize: 12 }}>
                ¿Olvidaste tu contraseña? Pídele al administrador que la
                restablezca verificando tu correo asociado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
