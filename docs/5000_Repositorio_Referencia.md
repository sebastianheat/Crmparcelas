# 5000 — Repositorio de Referencia e Inteligencia Competitiva

> **Anexo del spec principal (5000_Spec).** Material de campo levantado de la operación real de **Inmobiliaria Toscana** (HEAT/GHL, 5 capturas) y de 7 sitios del rubro. Sirve a Claude Code para replicar el funnel de forma nativa y al módulo de contenido (M6) como base de plantillas.
> **Fecha:** jun 2026 · **Owner:** Sebastián / HEAT IA

---

## A. Inteligencia del funnel real (HEAT/GHL — Toscana)

> Esto es oro: es el embudo que hoy funciona en producción. 5000 debe replicarlo nativo (sin depender de GHL).

### A.1 Pipeline principal "Ventas" — 13 etapas

Orden, con volumen real al momento de la captura (5.928 leads totales):

1. **Entrada** — 812 leads
2. **No contesta I** — 1.138
3. **No Contesta II** — 224
4. **No Contesta III** — 51
5. **Hablando con la IA** — 215
6. **En conversación** — 1.524
7. **Re-Insistencia** — 1.139
8. **Reunión** — 31
9. **Reservas** — 18
10. **Visitas Agendada** — 147
11. **Visita Cancelada** — 26
12. **Visita Concretada** — 14
13. **Promesando** — 5

Observaciones de diseño:
- El **agente IA tiene etapa propia** ("Hablando con la IA"), separada de "En conversación" (humano).
- La máquina de re-enganche es explícita: **No contesta I → II → III → Re-Insistencia**. Aquí se concentra el grueso del volumen — es el corazón operativo.
- El pipeline se **segmenta por proyecto/ubicación** vía pestañas: CASABLANCA, CURICO, CURACAVI, + "5 Más". 5000 debe permitir vistas de pipeline filtradas por proyecto.
- Cada tarjeta lleva **Valor del cliente** (el precio de la parcela: CL$114.000.000, CL$54.990.000, CL$26.990.000, CL$24.990.000 según proyecto) y **Fuente** (Facebook / Redes Sociales) + **tags de proyecto/campaña** (LINDEROS, CURACAVI, CURICO, CODEGUA, FILO CYBER…).

### A.2 Pipeline secundario "CallCenter" — 6 etapas

354 leads. Etapas: **Lead Asignados (221) → reinsistir (37) → envió Info (18) → Agendado (16) → No Interesado (16) → Descartado (46)**.

- Atribución a **nivel de creativo**: las fuentes son del tipo *Video Codegua, Video Marchigüe, Gráfica BLACK 3, Imagen Curicó, Video BLACK 1, Imagen Codegua, Video 1, Campañas Optify, Importados Anet*. → Cada lead sabe **qué pieza creativa** lo trajo. 5000 debe capturar `creativo` además de `campaña` y `fuente`.

### A.3 Modelo de calificación del lead (MetaForm)

Campos que llegan desde el formulario de Meta (vistos en la conversación real):

- **¿Estás bancarizado? (cuenta corriente / tarjetas de crédito):** Sí/No → capacidad de financiamiento.
- **Te interesa comprar:** plazo (ej. "Dentro de 3 meses").
- **¿Cuánto ahorro dispones?:** rango (ej. "Desde $10MM").
- **Buscas tu propiedad para:** Vivir / Invertir.
- Estándar: nombre, apellido, teléfono, email, whatsapp_number, source_url, inbox_url.

→ Estos 4 campos de calificación deben ser **nativos del formulario de captura de 5000** y alimentar el scoring/ruteo del lead y el speech del agente IA.

### A.4 Modelo de contacto (panel de detalle)

Campos del contacto: **Nombre, Apellidos, RUT, Teléfono, Correo (con verificación), Campaña, Ahorros, Proximidad, Destino, Renta.**
Tags automáticos por canal: **lead, lead-redes, lead-chat, lead-whatsapp.**
El contacto tiene **Propietario** (ejecutivo asignado) y **Seguidores**.
Al entrar un lead se **crea automáticamente la oportunidad** en "Ventas - Entrada".

### A.5 Arquitectura de automatizaciones (carpetas)

Organizadas por ciclo de vida: **01-INICIO, 02-OPORTUNIDAD, 03-PIPELINE, 04-JSARMIENTO, 05-CALENDARIO**, + **Automatización Avanzada**, **Calidad de LEAD | CAPI** (devuelve calidad de lead a Meta vía Conversions API), **Clientes Potenciales | MetaForm – Landing** (entradas).

→ 5000 debe traer estos **workflows pre-armados de fábrica** (plantillas), no que cada inmobiliaria los construya: bienvenida/INICIO, creación de oportunidad, gestión de pipeline, recordatorios de calendario, y feedback de calidad de lead a Meta (CAPI).

### A.6 Dashboard de prospección (KPIs reales)

Tablero "Prospección" con: **Leads Totales** (1.37K/30d), **Costo Promedio por lead** (~CL$6.530, con variación % vs período anterior), **Leads Ayer / Hoy**, **Inversión Ayer / Hoy / Total** (CL$7.21M/30d), **Prospectos por día** (barras) e **Inversión por día** (línea).

→ Este es el set exacto de KPIs del módulo **M7 (Ads)** de 5000. El **CPL** es la métrica estrella del parcelero.

### A.7 Qué debe replicar 5000 nativo

- Doble pipeline (Ventas + CallCenter) con etapas configurables y la **secuencia de re-insistencia** pre-armada.
- Etapa dedicada al **agente IA** dentro del pipeline.
- **Captura del creativo** (no solo campaña) para atribución fina.
- 4 preguntas de calificación nativas (bancarizado, plazo, ahorro, destino).
- Creación automática de oportunidad + tagging por canal.
- Workflows de fábrica (los 8 de arriba) + **CAPI** a Meta.
- Dashboard con CPL como KPI central.

---

## B. Teardown de competidores

### B.1 Moby Suite (`mobysuite.com/cl`)

Suite inmobiliaria modular, **enfocada en departamentos/edificios** (pre-venta → venta → post-venta de proyectos en altura). +10 años, +100 inmobiliarias, +380 proyectos, +150k cotizaciones/mes. Oficinas en Chile, México, Perú.

Módulos (cobro por "módulos satélite"):
- **Gestión Comercial** (CRM núcleo, reportes consolidados, autoadministrable, en AWS).
- **Pre-Venta:** Cotizador Web, Centralizador de Portales, MobyMeet (videollamada), Widget de Oportunidades, **Plano Dinámico**, **Asistente con IA**, Formulario Leads WhatsApp.
- **Venta:** Reserva Web (1 clic), App Móvil Gerencial, App Móvil Clientes, Sala de Ventas Virtual, **Recaudación Electrónica Centralizada**.
- **Post-Venta:** apps de recepción, entrega, calidad, post-venta cliente web.
- **Integraciones:** Fintoc, Transbank, WhatsApp, TikTok, HubSpot, Facebook, Instagram, **Defontana**, Softland, **GoFirmex (firma electrónica)**, SAP, Acepta, portales (TocToc, Zoom Inmobiliario, GoPlaceIt).

**Lo que confirma para nosotros:**
- Ya validan **Fintoc** (conciliación/recaudación) y **firma electrónica (GoFirmex)** → ambos van en 5000 (M2/M3).
- Tienen Plano Dinámico y Asistente IA → no es diferenciador inventarlos, sí ejecutarlos mejor para parcelas.

**Gaps que explotamos:** sin **prefacturación de venta exenta** (comprobante de dinero → factura exenta); orientado a altura, no a la rotación rápida de parcelas; **cobro por proyecto** (inviable con 10-12 proyectos); sin generación de contenido IA; sin agente IA de ventas saliente al estilo parcelero; sin trazabilidad legal específica (SAG, promesa/resciliación, F2890).

### B.2 CRM Lotes (`crmlotes.com`) — México (Cancún)

El análogo más directo: **ERP/CRM vertical para "desarrolladores de lotes y fraccionamientos"**. ~45 empresas. Setup en 24h, sin tarjeta, demo por WhatsApp.

Funcionalidades: **Mapas Interactivos** (inventario en tiempo real, verde=disponible / rojo=vendido, **compartible por URL**, sin app), **Cotizador Inteligente**, **Contratos Automáticos** (pre-llenados, "dile adiós a Word"), **Recordatorios de Cobranza** (antes/después de fechas de pago), **Portal Web para Clientes** (historial de pagos), control de accesos por colaborador, importación desde Excel/CSV.

Posicionamiento contra: "Excel interminable", "info desactualizada", "cotizaciones lentas", "inventario desactualizado".

**Lo que tomamos:** el **mapa interactivo compartible por URL** (encaja con tu idea de KMZ/Google Maps en M1), el cotizador, contratos automáticos (M2), recordatorios de cobranza (clave para **crédito directo**), portal de cliente con historial de pagos.

**Gaps que explotamos:** es mexicano (fraccionamientos, no marco chileno: sin SAG/DL3516/F2890); sin prefacturación exenta chilena; sin agente IA de ventas; sin generación de contenido; sin embudo de marketing/Ads integrado.

### B.3 Comparativa rápida (qué nos diferencia)

| Capacidad | Moby Suite | CRM Lotes | **5000** |
|---|---|---|---|
| Nicho | Edificios/deptos | Lotes (México) | **Parcelas Chile (DL3516)** |
| Cobro | Por proyecto | Por empresa | **Por empresa** |
| Prefacturación venta exenta | ✕ | ✕ | **✓ (núcleo)** |
| Conciliación bancaria | ✓ (Fintoc) | parcial (cobranza) | **✓ (Fintoc)** |
| Mapa interactivo de stock | ✓ (plano dinámico) | ✓ (URL) | **✓ (KMZ/Maps)** |
| Contratos/escrituras auto | parcial | ✓ contratos | **✓ promesa/escritura/resciliación** |
| Agente IA ventas WhatsApp | asistente | ✕ | **✓ (Claude)** |
| Generación contenido IA | ✕ | ✕ | **✓ (M6)** |
| Marketing/Ads + CAPI | portales | ✕ | **✓ (M7)** |
| Marketplace de corredores | ✕ | ✕ | **✓ (Fase 4)** |

---

## C. Repositorio publicitario (alimenta M6 y §7.2 del spec)

Análisis de 4 inmobiliarias (megaparcelas/Grupo Raíz, surprofundo, ichicureo, hacienda), el cliente (itoscana) y el portal (compratuparcela).

### C.1 Patrones transversales (lo que repiten TODOS)

- **CTA primario = WhatsApp** ("Agenda tu visita", "Conversemos") con link `wa.me`. La visita a terreno es el objetivo de conversión.
- **Formulario de cotización corto**: Nombre, Teléfono, Email, Proyecto de interés, "¿Cómo nos encontraste?".
- **Tour Virtual / 360°** como sección destacada (megaparcelas, hacienda).
- **Video en el home** (megaparcelas, surprofundo testimonios).
- **Página "Cómo Comprar" + "Formas de Pago" + FAQ** (educación del comprador).
- **Página "Vendemos tu campo / Véndenos tu predio"** (sourcing de campos a dueños) — todas la tienen.
- **Sección "Proyectos Vendidos / 100% Vendido"** como prueba social de escasez/éxito.
- **Tracking pesado:** Facebook Pixel + GTM + (a veces) PixelYourSite, TikTok. Canales: IG, FB, YouTube, TikTok.
- **Asesores con foto y perfil** (confianza); algunos certificados ("Curso Profesional de Venta de Parcelas", Parcelas Academy / Felipe Barros).

### C.2 Headlines y ganchos observados

- "**INVIERTE EN TUS SUEÑOS**" / "Cotiza aquí la parcela de tus sueños" (aparece casi idéntico en Chicureo y Hacienda → headline cuasi-genérico del rubro).
- "Parcelas desde $XX.XXX.XXX" (precio-ancla en el hero; ej. desde $17.990.000, desde $14.990.000, desde UF 3.490).
- "**¡PIE JUSTO! Desde $3.000.000**", "Sin Pie y con crédito directo", "Arriendo garantizado", "Compra con facilidades de pago".
- "Única **En Verde**", "**Entrega Inmediata**", "**Escriturable**", "Etapa 1" (badges de estado del proyecto).
- "Seguridad legal / Compra sin sorpresas / rol propio" (reductores de riesgo).
- **Urgencia por evento**: "Evento online – 18 de Junio – 20:00 hrs – RESERVA TU CUPO" (surprofundo).
- Foco patrimonial: "plusvalía", "consolidación patrimonial", "alta rentabilidad", "invierte con confianza".

### C.3 Convención de nombres de proyecto (para el generador)

Fórmula casi universal: **[Geo-prefijo] + de + [Lugar]**. Prefijos observados:
*Valle de…, Viñas de…, Bosques de…, Lomas de…, Altos de…, Brisas de…, Vista…, Remanso…, Ribera…, Entre Valles…, Hacienda…, Raíces…, Oasis…, Portal de…*

→ El generador de proyectos de 5000 puede sugerir nombres con esta gramática.

### C.4 Estructura de sitio tipo (para el auto-generador de landings, M6)

`Home (hero con precio-ancla + form) → Proyectos (por zona/región, con badge de estado) → Detalle de proyecto (ubicación comuna/provincia/región, "Desde $precio", totales/libres, galería, tour 360, mapa) → Cómo Comprar → Formas de Pago → FAQ → Nuestros Asesores → Tour Virtual → Blog (SEO educativo) → Contacto (WhatsApp) → Vendemos tu campo`.

### C.5 Modelo de datos de proyecto (confirmado por los sitios)

Por proyecto: nombre, sub-marca, **ubicación (comuna, provincia, región)**, **precio "Desde" (CLP o UF)**, **unidades totales y libres**, **estado/badge** (En Verde / Etapa N / Entrega Inmediata / Escriturable / 100% Vendido / Próximo Lanzamiento / NUEVO), galería, video, tour 360, mapa, formas de pago (contado / crédito directo / pie), atributos (acceso, factibilidad, entorno).

### C.6 Canales y tracking a soportar nativo

Facebook/Instagram (Pixel + CAPI), Google (GTM, Ads), TikTok, YouTube. WhatsApp como canal de conversión. → Coincide con M7.

### C.7 Fichas por empresa

- **Grupo Raíz / Megaparcelas** (`megaparcelas.cl`, WordPress): proyectos Raíces Constitución, Raíces Cordillera, Bosques de Cauquenes, Slade, Oasis. Tour Virtual, video home, oficina en Litueche. Departamentos internos: Escrituras/Legal, Post-Venta Escritura, Reclamos, "Vendenos tu predio". FB Pixel + GTM + PixelYourSite.
- **Sur Profundo** (`surprofundo.com`, Elementor): terrenos **y** edificios; segmentado por región (V, X, XI, XIV). Ganchos: ¡Pie Justo!, sin pie, crédito directo, arriendo garantizado, evento online con cupo. 3 pilares: **Seguridad Legal / Experiencia / Educación**. Video testimonios + blog SEO. IG/FB/TikTok/YouTube.
- **Inmobiliaria Chicureo** (`ichicureo.cl`, WordPress): "INVIERTE EN TUS SUEÑOS" + form. 4 años, 462 familias. Proyectos: Lomas de la Estrella, Los Nogales de San Esteban II, Brisas del Olivar, Fundo El Olivar. Páginas Cómo Comprar y Vendemos tu Campo.
- **Hacienda Inmobiliaria** (`haciendainmobiliaria.cl`, WordPress): mayor portafolio (~17 proyectos por **zona** Norte/Central/Sur), todos "Hacienda [Lugar]". Hero "Parcelas desde $17.990.000". Proceso de Compra (Cómo Comprar, Formas de Pago, T&C, FAQ), Asesores, Tour Virtual, Blog.
- **Inmobiliaria Toscana** (`itoscana.cl`, el cliente HEAT): "Invertimos, desarrollamos y comercializamos… foco en plusvalía". Proyectos vigentes con datos completos (Viñas de Linderos UF 3.490 · 63/42; Valle Codegua $14.990.000 · 41/8 · Entrega Inmediata; Valle Curicó $26.990.000 · 59/18 · En Verde Escriturable; Valle Curacaví $54.990.000 · 10/7). Muchos "100% Vendido". Ubicaciones = las del pipeline (Codegua, Curicó, Marchigüe, Curacaví, Casablanca). Asesores certificados por Parcelas Academy.

---

## D. Hallazgos estratégicos

### D.1 La Capa B ya tiene un competidor incipiente

**`compratuparcela.cl`** no es un anunciante: es un **marketplace nacional de parcelas** con secciones *Parcelas, Inmobiliarias, Cómo funciona, Publicar propiedad, **Planes para inmobiliarias**, **Planes para brokers***. Es decir, **ya está construyendo justo la "Capa B" (el RE/MAX de parcelas)** que planteamos para Fase 4. Implicancia: la ventana del marketplace no está abierta para siempre. Conviene (a) vigilarlo de cerca, y (b) que nuestra ventaja sea el **SaaS operativo (Capa A)** que ellos no tienen — quien controla el RP de las inmobiliarias controla el inventario, y el marketplace se vuelve consecuencia natural, no un portal de listings más.

### D.2 Existe formación de mercado

**Parcelas Academy** (relator Felipe Barros) ya certifica vendedores de parcelas; Toscana lo usa. Refuerza la oportunidad del módulo **M10 (capacitación)** y de tu activo HEAT MASTERY: hay demanda validada de formación en venta de parcelas.

### D.3 Implicancias para el roadmap

- El **mapa interactivo de stock compartible por URL** (de CRM Lotes) sube de prioridad: ponerlo ya en Fase 1/2, no en la 4. Es barato, vistoso y es CTA de venta.
- **Crédito directo + cobranza** (recordatorios de pago) es un módulo que CRM Lotes prioriza y los sitios chilenos promocionan ("sin pie / crédito directo"). Sumarlo a M3 (cobranza) además de la prefacturación.
- **Firma electrónica** (GoFirmex o equivalente) para promesas/escrituras → integrar en M2.
- Las **4 preguntas de calificación** y la **secuencia de re-insistencia** de Toscana son el estándar de facto: vienen de fábrica en 5000.
