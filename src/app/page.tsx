import Link from "next/link";
import { auth } from "@/auth";

export const metadata = {
  title: "5000 — El sistema operativo de la empresa parceladora",
  description:
    "CRM vertical para vender parcelas en Chile (DL 3516): embudo de ventas, gestión legal con IA, prefacturación, cobranza y trazabilidad total. 5000.cl · by HEAT.",
};

const MODULES = [
  {
    icon: "◔",
    title: "CRM y embudo de ventas",
    desc: "Captura leads de todos tus canales, asígnalos a vendedores y muévelos por el pipeline hasta la reserva. Con seguimiento y tasa de conversión.",
  },
  {
    icon: "⚖",
    title: "Gestión legal con IA",
    desc: "Genera la promesa de compraventa desde tu matriz legal (PDF y Word), corregida por IA, con firma electrónica y control de causas legales.",
  },
  {
    icon: "₿",
    title: "Finanzas y prefacturación",
    desc: "Comprobantes de dinero, factura exenta (DL 3516), cobranza con plan de pagos a crédito directo y comisiones de vendedores automáticas.",
  },
  {
    icon: "▤",
    title: "Trazabilidad de cada parcela",
    desc: "Historial inmutable: reserva → promesa → escritura → inscripción → entrega. Sabes el estado y el dueño de cada lote en todo momento.",
  },
  {
    icon: "◎",
    title: "Vitrina pública por proyecto",
    desc: "Cada proyecto tiene su landing y mapa de stock compartible por link, con copy generado por IA para vender más rápido.",
  },
  {
    icon: "▦",
    title: "Portafolio y riesgo",
    desc: "Dashboard con ingresos, prometido, escriturado y margen por proyecto; estado legal (SAG→CBR) y nivel de riesgo a la vista.",
  },
];

const STEPS: [string, string, string][] = [
  [
    "1",
    "Carga tu proyecto y stock",
    "Sube parcelas, precios y datos legales del predio. La IA extrae los datos desde tus documentos del Conservador.",
  ],
  [
    "2",
    "Vende con orden",
    "Tu equipo trabaja el embudo, reserva con comprobante validado por finanzas y genera la promesa en un clic.",
  ],
  [
    "3",
    "Cobra y escritura",
    "Plan de pagos, cobranza, factura exenta y trazabilidad hasta la inscripción y entrega de la parcela.",
  ],
];

export default async function HomePage() {
  const session = await auth();
  const ctaHref = session ? "/app" : "/login";
  const ctaLabel = session ? "Ir al panel" : "Iniciar sesión";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-600">
              5000
            </span>
            <span className="text-xs text-slate-400">by HEAT</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#modulos" className="hover:text-slate-900">
              Módulos
            </a>
            <a href="#como" className="hover:text-slate-900">
              Cómo funciona
            </a>
            <a href="#para-quien" className="hover:text-slate-900">
              Para quién
            </a>
            <a href="#contacto" className="hover:text-slate-900">
              Contacto
            </a>
          </nav>
          <Link
            href={ctaHref}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {ctaLabel}
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 to-white" />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
            CRM vertical · Parcelas de agrado · DL 3516
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            El sistema operativo de la empresa{" "}
            <span className="text-brand-600">parceladora</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Vende, ordena y escritura tus parcelas en un solo lugar: embudo de
            ventas, promesas legales con IA, prefacturación, cobranza y
            trazabilidad total de cada lote. Hecho para Chile.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#contacto"
              className="rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Solicitar demo
            </a>
            <Link
              href={ctaHref}
              className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              {ctaLabel}
            </Link>
          </div>

          <dl className="mt-16 grid max-w-3xl grid-cols-2 gap-8 sm:grid-cols-4">
            {[
              ["5.000 m²", "Mínimo por parcela de agrado"],
              ["100%", "Trazabilidad por lote"],
              ["IA", "Promesas y contenido"],
              ["DL 3516", "Venta exenta de IVA"],
            ].map(([k, v]) => (
              <div key={v}>
                <dt className="text-2xl font-bold text-slate-900">{k}</dt>
                <dd className="mt-1 text-sm text-slate-500">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Problema → solución */}
      <section className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-600">
                El problema
              </h2>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                Vender parcelas se desordena rápido.
              </p>
              <p className="mt-3 text-slate-600">
                Reservas en planillas, promesas en Word sueltas, cobros sin
                seguimiento, comisiones a mano y cero claridad de qué lote está
                vendido, prometido o escriturado. El riesgo legal y financiero
                crece con cada venta.
              </p>
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-600">
                La solución
              </h2>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                Una sola plataforma, de la captación a la escritura.
              </p>
              <p className="mt-3 text-slate-600">
                5000 conecta ventas, legal y finanzas con un historial inmutable
                por parcela. Multi-tenant, con roles por área y aislamiento total
                de datos entre inmobiliarias.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Módulos */}
      <section id="modulos" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Todo lo que necesita tu operación
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Módulos integrados que reemplazan tus planillas y documentos sueltos.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div
              key={m.title}
              className="rounded-2xl border border-slate-200 p-6 transition-shadow hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-600">
                {m.icon}
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{m.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como" className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Cómo funciona
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map(([n, t, d]) => (
              <div key={n} className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {n}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{t}</h3>
                <p className="mt-2 text-sm text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Para quién */}
      <section id="para-quien" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Para quién es 5000
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            [
              "Inmobiliarias y loteadoras",
              "Que subdividen y venden parcelas de agrado bajo DL 3516.",
            ],
            [
              "Corredoras",
              "Que comercializan proyectos de terceros y necesitan trazabilidad y comisiones claras.",
            ],
            [
              "Equipos de venta",
              "Comercial, legal y finanzas trabajando ordenados, cada uno con su rol.",
            ],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-brand-600 p-6 text-white">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-brand-50/90">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA / contacto */}
      <section id="contacto" className="border-t border-slate-100 bg-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Ordena tu empresa parceladora hoy
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-300">
            Agenda una demo y te mostramos cómo 5000 conecta tus ventas, legal y
            finanzas en una sola plataforma.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:contacto@5000.cl?subject=Quiero%20una%20demo%20de%205000"
              className="rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Solicitar demo
            </a>
            <Link
              href={ctaHref}
              className="rounded-lg border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-slate-800 px-6 py-8 text-sm text-slate-400 sm:flex-row">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-white">5000</span>
            <span className="text-xs">by HEAT</span>
          </div>
          <p>© {new Date().getFullYear()} 5000 · Hecho en Chile 🇨🇱</p>
          <a href="mailto:contacto@5000.cl" className="hover:text-white">
            contacto@5000.cl
          </a>
        </div>
      </footer>
    </div>
  );
}
