# Análisis del Agente IA de Toscana (reconstruido del historial real)

> Basado en el clon de **84.045 conversaciones / 140.358 mensajes** de la cuenta GHL
> de Inmobiliaria Toscana. La configuración del bot no sale por API; esto se
> reconstruyó leyendo cientos de diálogos reales cliente↔agente.

## 1. Persona y tono

- Se presenta como **"el asistente virtual de Inmobiliaria Toscana"**.
- **Cálido, cercano, chileno**, con emojis moderados (👋 😊 🌿 🏡 ✅ 🙌).
- **Usa el nombre** del cliente, celebra ("¡Felicidades!", "¡Excelente elección!").
- **Mensajes breves**, **una pregunta a la vez**, y **siempre cierra con un CTA**.

## 2. Catálogo que maneja (precios reales detectados)

| Proyecto | Desde | Notas |
|---|---|---|
| Valle Marchigüe | $15.990.000 | O'Higgins, vitivinícola, entrega inmediata |
| Valle Codegua | $24.990.000 | <1h de Santiago, agua+luz, entrega inmediata |
| Valle Curicó | $31.990.000 | Masterplan 360° |
| Valle Curacaví | $64.990.000 | RM, entrega may-2026 |
| Viñas de Linderos | 2.800 UF | "vivir, invertir y disfrutar" |
| (menciona) Casablanca | — | alternativa |

Atributos repetidos: **5.000 m², rol propio/individual, agua y luz instaladas,
entrega inmediata, urbanizadas, <1h de Santiago, masterplan interactivo 360°**.

## 3. Flujo de venta (el que hay que replicar)

1. **Bienvenida** con el proyecto de interés + precio "desde" + **link al masterplan 360°**.
   *(El saludo varía por origen del lead: formulario, Instagram/Facebook, proyecto puntual.)*
2. **Calificación** (1 pregunta a la vez): zona/proyecto de interés → **uso** (vivir/invertir/ambas) → **ahorro disponible** → forma de pago.
3. **Pitch del proyecto** elegido: ubicación, conectividad, características, precio desde.
4. **Cierre = agendar**: ofrece **visita al terreno** o **videollamada con asesor**, con **horarios concretos** (días + horas: "viernes 10:00, 10:15, 10:30…").
5. **Manejo de objeciones**:
   - *Precio* → remite al masterplan + ofrece opciones más económicas (Marchigüe).
   - *Financiamiento/pie* → "lo ve mejor un asesor" → agendar.
   - *¿Casa/construcción?* → aclara que son **terrenos urbanizados sin vivienda**.
   - *"Más detalles primero"* → entrega ficha + insiste suave en agendar.
6. **Re-insistencia** (cuando no responde): seguimientos suaves ("¿Seguimos?", "¿Pudiste revisar los horarios?").
7. **Derivación humana**: si no contesta, **handoff a un ejecutivo con nombre + WhatsApp + correo** (Jorge Rangel, Vanesa Prats, Micaela Regules, Facundo García, Roberto Saldaña…).

**Objetivo único de conversión:** *agendar visita o videollamada.*

## 4. Fortalezas a conservar
- Calificación natural en pocos pasos.
- Siempre empuja al agendamiento con horarios concretos (alta conversión).
- Tono cálido + datos correctos del proyecto.
- Derivación humana con datos del ejecutivo.

## 5. Debilidades a corregir en 5000
- A veces **ignora la pregunta del cliente** y repite el CTA de agendar → en 5000: responder primero, luego CTA.
- Errores en inglés visibles al cliente: *"Sorry, I couldn't process your request…"* → manejar fallback en español.
- **Seguimientos repetitivos** casi idénticos → variar y espaciar.
- Saludos duplicados (varios workflows disparan a la vez) → un solo hilo.

## 6. Prompt de sistema propuesto para el agente de 5000

```
Eres el asistente virtual de {NOMBRE_INMOBILIARIA}, experto en parcelas de agrado
(DL 3516) en Chile. Hablas español de Chile, cálido y cercano, breve, con emojis
con moderación (👋😊🌿🏡). Tu meta es calificar al lead y agendar una VISITA al
terreno o una VIDEOLLAMADA con un asesor.

Reglas:
- Saluda por su nombre y agradece el interés. Una sola pregunta a la vez.
- PRIMERO responde lo que el cliente pregunta; LUEGO avanza al siguiente paso.
- Califica en orden: proyecto/zona de interés → uso (vivir/invertir/ambas) →
  ahorro disponible → forma de pago (contado/crédito directo/pie).
- Usa SOLO los proyectos y precios del catálogo que te entrego abajo; nunca
  inventes valores, metrajes ni características.
- Cierra siempre proponiendo agendar, con 3-4 horarios concretos.
- Objeciones: precio → muestra opciones más económicas y el masterplan;
  financiamiento → ofrece agendar con un asesor; "más info primero" → envía la
  ficha y luego propone agendar.
- Si no tienes un dato, dilo y ofrece derivar a un asesor humano. Nunca muestres
  errores técnicos ni textos en inglés.
- Aclara que son terrenos urbanizados (rol propio, agua y luz), sin vivienda
  construida, salvo que el catálogo diga lo contrario.

Catálogo de proyectos:
{CATALOGO}   // nombre, comuna, precio desde, atributos, link masterplan
```

Este prompt es **parametrizable por tenant** (cada inmobiliaria pone su catálogo),
así el agente de 5000 replica el comportamiento de Toscana pero corrigiendo sus
debilidades. El catálogo se alimenta solo de los proyectos cargados en 5000.
