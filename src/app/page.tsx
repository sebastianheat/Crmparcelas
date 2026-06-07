import Link from "next/link";
import { auth } from "@/auth";
import { Reveal } from "@/components/marketing/reveal";
import {
  BrowserFrame,
  DashboardMockup,
  FinanceMockup,
  KanbanMockup,
  PromesaMockup,
  WhatsappMockup,
} from "@/components/marketing/mockups";

export const metadata = {
  title: "5000 — El sistema operativo de la empresa parceladora",
  description:
    "CRM vertical para vender parcelas en Chile (DL 3516): embudo de ventas, agente IA de WhatsApp, promesas legales con IA, prefacturación, cobranza y trazabilidad total. 5000.cl · by HEAT.",
};

const MODULES = [
  ["◔", "CRM y embudo", "Leads de todos tus canales en un pipeline, con asignación y conversión."],
  ["◍", "Agente IA WhatsApp", "Responde y califica leads 24/7, y los carga solo al embudo."],
  ["⚖", "Promesas con IA", "Genera la promesa desde tu matriz legal en PDF y Word, con firma electrónica."],
  ["₿", "Prefacturación", "Comprobantes y factura exenta (DL 3516) con interfaz a tu proveedor DTE."],
  ["◷", "Cobranza", "Crédito directo: pie, cuotas, vencimientos y recaudación al día."],
  ["％", "Comisiones", "Cálculo automático por vendedor sobre los cobros reales."],
  ["▤", "Trazabilidad", "Historial inmutable por parcela: reserva → escritura → entrega."],
  ["⚖", "Causas legales", "Querellas y denuncias por proyecto, con riesgo y perjuicio."],
];

const FAQ: [string, string][] = [
  ["¿Sirve para parcelas DL 3516?", "Sí. 5000 es vertical para parcelas de agrado: venta exenta de IVA, subdivisión SAG, inscripción en el CBR y todo el flujo legal del rubro."],
  ["¿Puedo migrar mis planillas?", "Sí. Cargas tus proyectos y stock, y la IA extrae los datos legales desde tus documentos del Conservador para autocompletar."],
  ["¿Es multiempresa?", "Sí. Es multi-tenant con aislamiento total de datos entre inmobiliarias y roles por área (comercial, legal, finanzas)."],
  ["¿Incluye factura electrónica?", "Sí, mediante una interfaz a tu proveedor DTE (OpenFactura, LibreDTE, SimpleAPI u otro)."],
  ["¿El agente de WhatsApp es oficial?", "Sí, se conecta vía Cloud API (Meta o 360dialog). Nada de QR no oficial que arriesgue tu número."],
];

export default async function HomePage() {
  const session = await auth();
  const ctaHref = session ? "/app" : "/login";
  const ctaLabel = session ? "Ir al panel" : "Iniciar sesión";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-brand-600">5000</span>
            <span className="text-xs text-slate-400">by HEAT</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#modulos" className="hover:text-slate-900">Módulos</a>
            <a href="#producto" className="hover:text-slate-900">Producto</a>
            <a href="#como" className="hover:text-slate-900">Cómo funciona</a>
            <a href="#planes" className="hover:text-slate-900">Planes</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href={ctaHref} className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:block">
              {ctaLabel}
            </Link>
            <a href="#contacto" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
              Solicitar demo
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* fondo: gradiente + grilla catastral + blobs */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50/80 via-white to-white" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "linear-gradient(#16643f1a 1px, transparent 1px), linear-gradient(90deg, #16643f1a 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent)",
          }}
        />
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl animate-blob" />
        <div className="pointer-events-none absolute -right-20 top-32 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl animate-blob" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              CRM vertical · Parcelas de agrado · DL 3516
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              El sistema operativo de la empresa{" "}
              <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
                parceladora
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              Vende, ordena y escritura tus parcelas en una sola plataforma:
              embudo de ventas, agente IA de WhatsApp, promesas legales,
              prefacturación, cobranza y trazabilidad total de cada lote.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#contacto" className="rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">
                Solicitar demo gratis
              </a>
              <Link href={ctaHref} className="rounded-xl border border-slate-300 px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                {ctaLabel}
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Sin tarjeta · Implementación guiada · Hecho en Chile 🇨🇱
            </p>
          </div>

          {/* mockup flotante */}
          <div className="relative animate-fade-up [animation-delay:150ms]">
            <div className="animate-floaty">
              <BrowserFrame>
                <div className="h-[380px]">
                  <DashboardMockup />
                </div>
              </BrowserFrame>
            </div>
            {/* tarjeta flotante WhatsApp */}
            <div className="absolute -bottom-6 -left-6 hidden w-52 rounded-xl border border-slate-100 bg-white p-3 shadow-xl animate-floaty-slow sm:block">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">◍</span>
                <div>
                  <p className="text-[11px] font-semibold text-slate-800">Nuevo lead · WhatsApp</p>
                  <p className="text-[10px] text-slate-400">Atendido por IA · hace 2s</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust marquee ── */}
      <section className="border-y border-slate-100 bg-white py-6">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          Pensado para inmobiliarias, loteadoras y corredoras de Chile
        </p>
        <div className="relative overflow-hidden">
          <div className="flex w-max animate-marquee gap-10 px-4 text-sm font-semibold text-slate-300">
            {[..."⬢ Inversiones · ⬢ Mundo SpA · ⬢ Agro Sur · ⬢ Parcela Chile · ⬢ Valle Verde · ⬢ Sociedad Austral · ".repeat(2).split("·")].map((x, i) => (
              <span key={i} className="whitespace-nowrap">{x}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="bg-brand-700">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 sm:grid-cols-4">
          {[
            ["5.000 m²", "Mínimo por parcela"],
            ["100%", "Trazabilidad por lote"],
            ["24/7", "Agente IA respondiendo"],
            ["DL 3516", "Venta exenta de IVA"],
          ].map(([k, v], i) => (
            <Reveal key={v} delay={i * 80}>
              <p className="text-3xl font-bold text-white sm:text-4xl">{k}</p>
              <p className="mt-1 text-sm text-brand-100/80">{v}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Producto: features alternadas ── */}
      <section id="producto" className="mx-auto max-w-6xl space-y-24 px-6 py-24">
        <FeatureRow
          eyebrow="CRM y embudo"
          title="De lead a reserva, sin perder a nadie"
          desc="Captura interesados de WhatsApp, web y portales, asígnalos a tus vendedores y muévelos por el pipeline. Métricas de conversión y pipeline en tiempo real."
          bullets={["Tablero por etapa", "Asignación a vendedores", "Conversión a cliente en un clic"]}
          mock={<KanbanMockup />}
        />
        <FeatureRow
          reverse
          eyebrow="Agente IA de WhatsApp"
          title="Atiende y califica leads mientras duermes"
          desc="Un asistente con IA responde a tus clientes en WhatsApp, los califica con tu catálogo de proyectos y crea el lead en el CRM automáticamente. Canal oficial Cloud API."
          bullets={["Respuestas con IA (Claude)", "Crea el lead solo", "Conversación guardada en la ficha"]}
          mock={<WhatsappMockup />}
        />
        <FeatureRow
          eyebrow="Gestión legal con IA"
          title="Promesas impecables en minutos, no días"
          desc="Define tu matriz legal y la IA la completa con los datos de la parcela y el cliente, sin tocar tus cláusulas. Exporta PDF y Word, y envía a firma electrónica."
          bullets={["Tu matriz, corregida por IA", "PDF y Word", "Firma electrónica + causas legales"]}
          mock={<PromesaMockup />}
        />
        <FeatureRow
          reverse
          eyebrow="Finanzas y cobranza"
          title="Crédito directo bajo control"
          desc="Comprobantes de dinero, factura exenta, planes de pago con cuotas y vencimientos, y comisiones automáticas por vendedor sobre los cobros reales."
          bullets={["Plan de pagos a crédito directo", "Recaudado / por cobrar / vencido", "Comisiones automáticas"]}
          mock={<FinanceMockup />}
        />
      </section>

      {/* ── Módulos grid ── */}
      <section id="modulos" className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Una plataforma, toda tu operación
            </h2>
            <p className="mt-3 max-w-2xl text-slate-600">
              Módulos integrados que reemplazan tus planillas y documentos sueltos.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MODULES.map(([icon, title, desc], i) => (
              <Reveal key={title} delay={(i % 4) * 70}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-900/5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-xl text-brand-600">
                    {icon}
                  </div>
                  <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo (video-style) ── */}
      <section id="como" className="mx-auto max-w-6xl px-6 py-24">
        <Reveal className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Míralo en acción
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Del primer contacto a la escritura, todo conectado en un solo lugar.
          </p>
        </Reveal>
        <Reveal delay={120} className="relative mx-auto mt-12 max-w-4xl">
          <BrowserFrame url="app.5000.cl/dashboard">
            <div className="relative h-[440px]">
              <DashboardMockup />
              {/* overlay play */}
              <a
                href="#contacto"
                className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition hover:bg-slate-900/5"
              >
                <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-xl">
                  <span className="absolute inset-0 rounded-full bg-brand-600 animate-pulse-ring" />
                  <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-current">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </a>
            </div>
          </BrowserFrame>
        </Reveal>

        {/* pasos */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {[
            ["1", "Carga proyectos y stock", "Sube parcelas y datos legales; la IA extrae lo del Conservador."],
            ["2", "Vende con orden", "Embudo, reserva validada por finanzas y promesa en un clic."],
            ["3", "Cobra y escritura", "Plan de pagos, factura exenta y trazabilidad hasta la entrega."],
          ].map(([n, t, d], i) => (
            <Reveal key={n} delay={i * 100}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{n}</div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{t}</h3>
              <p className="mt-2 text-sm text-slate-600">{d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Planes ── */}
      <section id="planes" className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Planes a tu medida</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              Según el tamaño de tu operación. Conversemos y armamos el tuyo.
            </p>
          </Reveal>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {[
              ["Starter", "Para empezar a ordenar", ["1 proyecto", "CRM y embudo", "Promesas con IA", "Hasta 3 usuarios"], false],
              ["Pro", "Para vender más rápido", ["Proyectos ilimitados", "Agente IA WhatsApp", "Cobranza y comisiones", "Usuarios ilimitados"], true],
              ["Enterprise", "Para grupos y holdings", ["Multi-sociedad", "Factura electrónica", "Soporte dedicado", "Onboarding a medida"], false],
            ].map(([name, sub, feats, featured]) => (
              <Reveal key={name as string}>
                <div className={`flex h-full flex-col rounded-2xl border p-7 ${featured ? "border-brand-600 bg-white shadow-xl ring-1 ring-brand-600" : "border-slate-200 bg-white"}`}>
                  {featured ? (
                    <span className="mb-2 w-fit rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">Más elegido</span>
                  ) : null}
                  <h3 className="text-lg font-bold text-slate-900">{name as string}</h3>
                  <p className="mt-1 text-sm text-slate-500">{sub as string}</p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
                    {(feats as string[]).map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <span className="text-brand-600">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <a href="#contacto" className={`mt-6 rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${featured ? "bg-brand-600 text-white hover:bg-brand-700" : "border border-slate-300 text-slate-700 hover:bg-slate-50"}`}>
                    Cotizar
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mx-auto max-w-3xl px-6 py-24">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Preguntas frecuentes</h2>
        </Reveal>
        <div className="mt-8 divide-y divide-slate-200">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-slate-800">
                {q}
                <span className="text-brand-600 transition group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section id="contacto" className="bg-slate-900">
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <Reveal>
            <h2 className="text-4xl font-bold tracking-tight text-white">
              Ordena tu empresa parceladora hoy
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-slate-300">
              Agenda una demo y te mostramos cómo 5000 conecta tus ventas, legal
              y finanzas en una sola plataforma.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a href="mailto:contacto@5000.cl?subject=Quiero%20una%20demo%20de%205000" className="rounded-xl bg-brand-600 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700">
                Solicitar demo
              </a>
              <Link href={ctaHref} className="rounded-xl border border-slate-600 px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
                {ctaLabel}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-950">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">5000</span>
              <span className="text-xs text-slate-500">by HEAT</span>
            </div>
            <p className="mt-3 max-w-xs text-sm text-slate-400">
              El sistema operativo de la empresa parceladora en Chile.
            </p>
          </div>
          <FooterCol title="Producto" links={["Módulos", "Cómo funciona", "Planes"]} />
          <FooterCol title="Empresa" links={["Sobre 5000", "Contacto", "Privacidad"]} />
          <div>
            <p className="text-sm font-semibold text-white">Contacto</p>
            <a href="mailto:contacto@5000.cl" className="mt-3 block text-sm text-slate-400 hover:text-white">
              contacto@5000.cl
            </a>
            <Link href={ctaHref} className="mt-2 block text-sm text-slate-400 hover:text-white">
              Iniciar sesión
            </Link>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row">
            <p>© {new Date().getFullYear()} 5000 · by HEAT. Todos los derechos reservados.</p>
            <p>Hecho en Chile 🇨🇱</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureRow({
  eyebrow,
  title,
  desc,
  bullets,
  mock,
  reverse,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  bullets: string[];
  mock: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      <Reveal className={reverse ? "lg:order-2" : ""}>
        <span className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          {eyebrow}
        </span>
        <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h3>
        <p className="mt-4 text-slate-600">{desc}</p>
        <ul className="mt-5 space-y-2 text-sm text-slate-700">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-xs text-brand-700">✓</span>
              {b}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={120} className={reverse ? "lg:order-1" : ""}>
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-xl shadow-brand-900/5">
          {mock}
        </div>
      </Reveal>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-400">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="hover:text-white">{l}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
