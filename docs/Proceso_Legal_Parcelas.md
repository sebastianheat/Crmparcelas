# Proceso legal de una parcelación en Chile — base de conocimiento

> Documento construido a partir del estudio de documentos reales del owner
> (campo **San Clemente** / Agrícola La Cruz, y otros: Colina, San Javier, Curacaví,
> Linares, Teno). Sirve para construir M1 (carga y **extracción con IA** de los
> documentos de adquisición) y M2 (**generación automática de la promesa**).
> Idioma: español (Chile). Moneda: CLP/UF. Venta de terreno **exenta de IVA**.

## 1. Mapa del proceso (cadena legal completa)

```
1. ADQUISICIÓN DEL CAMPO
   Dueño original (ej. Agrícola La Cruz Ltda) ──compraventa──▶ Sociedad inmobiliaria
   → Escritura pública (Notaría, Repertorio N°, fecha)
   → Inscripción en el Conservador de Bienes Raíces (CBR): Fojas / N° / Año
   → Rol de Avalúo SII del predio madre
   → Derechos de aprovechamiento de aguas (inscritos aparte, Fs/N°/Año RP Aguas)

2. SUBDIVISIÓN (DL 3516)
   Proyecto de subdivisión ──aprueba──▶ SAG  → Certificado SAG N°XXXX/AÑO
   → Genera: (a) Certificado SAG, (b) Certificado de Asignación de Roles (SII),
     (c) Plano de subdivisión.  Los tres se ARCHIVAN al final del Registro de
     Propiedad del CBR bajo números correlativos (ej. 1773, 1774, 1775).
   → El predio madre se subdivide en N lotes (parcelas ≥ 5.000 m²).

3. COMERCIALIZACIÓN (lo que opera el CRM)
   a) RESERVA  → hoja de reserva, monto, comprobante de pago. (Ver §4)
   b) PROMESA DE COMPRAVENTA  → sociedad promete vender el Lote N al cliente. (Ver §5)
      - Precio en UF/CLP; pie/cuotas/saldo; **vale vista en custodia notarial**.
      - Plazo (90/180 días); condición (que la sociedad adquiera el inmueble).
   c) (Opcional) CESIÓN de la posición de promitente comprador a un tercero.
   d) ESCRITURA DE COMPRAVENTA definitiva  → Notaría, **Repertorio/código**.
      - Pie ya pagado + contado + saldo; hipoteca a favor del vendedor por el saldo.
      - IVA: terreno EXENTO; sólo construcciones afectas (DL 825 art. 17).
   e) INSCRIPCIÓN en el CBR a nombre del comprador (Fs/N°/Año).
   f) ENTREGA / postventa.
```

**Gatillo de la venta (para facturar exento, M3):** la **escritura firmada** con su
**código/repertorio**, seguida de la **inscripción CBR**. El dinero entra antes
(reserva + promesa) como **comprobante de dinero / prefactura**, no como factura.

## 2. Estructura societaria observada (caso real)

- **Dueño original:** Agrícola La Cruz Limitada (RUT 77.110.454-1), reps. Francisco
  Tupper Benavente y Francisco Espina Pérez.
- **Inmobiliaria adquirente / promitente vendedora:** Sociedad de Inversiones San
  Alberto SpA (RUT 77.890.952-9), rep. **Erwin Rohrstock Fuentes** (CI 16.606.399-K).
- **Otra sociedad del grupo:** **Metacon SpA** (RUT 78.066.995-0), mismo rep. — es la
  cuenta receptora de las transferencias de pago de clientes (Banco Santander
  Cta. Cte. 97248699). Giro: marketing.
- Owner del CRM: Sebastián Yáñez Quezada (aparece como comprador/vendedor en la
  cadena Colina: Inversiones Libertador → Diego → Sebastián → Metacon).

> Implicancia: el **tenant** (inmobiliaria) puede tener **varias sociedades** (la que
> aparece como vendedora en cada promesa/escritura varía). El modelo debe permitir
> registrar **N sociedades vendedoras por tenant** (razón social, RUT, representante,
> personería: notaría + repertorio + fecha, domicilio).

## 3. Documentos de adquisición (carpeta por proyecto) y datos a extraer

La inmobiliaria sube la **carpeta de adquisición** del campo. Claude (API) lee cada
documento y extrae los campos. Tipos detectados y sus datos clave:

### 3.1 Compraventa del campo (escritura) / Inscripción CBR
Ej.: *CV Inv. San Alberto–Agrícola La Cruz 12-2025*; *Copia Inscripción vigente Fs 502v N°512 2026*.
- Vendedor y comprador (razón social, RUT, representante, CI).
- **Predio madre:** denominación (Resto Lote A, Hijuela Dos, Fundo La Cruz), ubicación
  (subdelegación Queri, comuna San Clemente, provincia Talca, región Maule).
- **Plano archivado N°** (ej. 2323) y CBR/año (Talca 2020).
- **Superficie** (ej. 54,50 ha).
- **Deslindes** Norte / Sur / Oriente / Poniente (texto íntegro, con roles vecinos).
- **Inscripción de dominio:** Fojas / Número / Año / CBR (ej. Fs 10306 N°9553 RP Talca 2020;
  reinscrito Fs 502v N°512 RP San Clemente 2026).
- **Rol de Avalúo SII** del predio (ej. 455-82, 455-83).
- Precio del campo (ej. $865.000.000), escritura Repertorio N° + fecha + Notaría.
- Gravámenes: hipotecas, prohibiciones, embargos, servidumbres (cada uno con Fs/N°/Año).

### 3.2 Certificado SAG de subdivisión
Ej.: *Certificado N°1510/2023* (Hijuela Uno → 38 lotes), *N°1511/2023* (Hijuela Dos → 79 lotes).
- N° de certificado / año, fecha de aprobación (27-abr-2023).
- N° de lotes generados.
- N° de archivo en CBR del certificado, de la asignación de roles y del plano.

### 3.3 Certificado de Asignación de Roles (SII) + Plano de subdivisión
- Rol (prerrol) asignado a cada lote.
- Plano: N° archivo CBR, superficie por lote, deslindes por lote, manzanas/lotes.

### 3.4 Derechos de aprovechamiento de aguas
- Acciones/regadores (ej. 2 del Canal Maule Maitenes, 15 l/s c/u), Fs/N°/Año RP Aguas.

### 3.5 Estudio de títulos
- Cadena de inscripciones históricas (Fs/N°/Año desde 1980), gravámenes, factibilidad legal.

## 4. Hoja de Reserva (origen de la promesa) — campos

De la hoja manuscrita (Mundo Parcelas) + práctica:
- Cliente: **Nombres, Apellidos, RUT, Dirección, Profesión u oficio, Estado civil,
  Email, Teléfono(s), Nacionalidad**.
- Operación: **Proyecto, Parcela N°, Monto de reserva, Forma de pago reserva**
  (transferencia/efectivo/cheque), **Valor total de la parcela**, **Fecha firma promesa**.
- **Forma de pago de la parcela** (opcional en la reserva, "lo más difícil"): pie,
  fecha pie, N° cuotas, valor cuota, saldo, crédito directo/sin pie, notas.
- Firmas: vendedor (ejecutivo) y cliente. Adjunto: **comprobante de depósito/transferencia**.

→ Ya implementado en el CRM: `clients` (datos legales) + evento de reserva con
`payload.formaPago` + comprobante validado por finanzas → PDF. Falta enganchar la promesa.

## 5. Promesa de compraventa (matriz) — cláusulas y variables

Estructura observada (matriz San Alberto + ejemplo "Lote 14 Álvaro Salas"). Las
**variables `{{...}}`** son los marcadores que el generador rellena:

- **Comparecencia**
  - Promitente vendedora: `{{sociedad.razonSocial}}`, `{{sociedad.rut}}`, rep.
    `{{sociedad.repNombre}}` (`{{sociedad.repCI}}`, nacionalidad, estado civil, profesión),
    domicilio `{{sociedad.domicilio}}`.
  - Promitente comprador: `{{cliente.nombre}}`, `{{cliente.nacionalidad}}`,
    `{{cliente.estadoCivil}}`, `{{cliente.profesion}}`, `{{cliente.rut}}`,
    `{{cliente.domicilio}}`.
- **PRIMERO – Inmueble (predio madre):** denominación, ubicación, plano archivado
  `{{predio.planoArchivoN}}` CBR/año, superficie `{{predio.superficie}}`, deslindes
  `{{predio.deslindes.norte/sur/oriente/poniente}}`, inscripción `{{predio.fojas}}`/
  `{{predio.numero}}`/`{{predio.anio}}` CBR `{{predio.cbr}}`, rol `{{predio.rolSii}}`.
- **SEGUNDO – Subdivisión:** N° lotes `{{subdivision.nLotes}}`, plano SAG fecha
  `{{subdivision.fechaSag}}`, Certificado `{{subdivision.certSagN}}`/año, archivos CBR
  `{{subdivision.archivoCertSag}}` / `{{subdivision.archivoRoles}}` / `{{subdivision.archivoPlano}}`.
- **(TERCERO)** Constancia de que la sociedad está en proceso de compra del predio (si aplica).
- **CUARTO – Objeto:** promete vender **la Parcela o Lote N° `{{parcela.numero}}`**,
  superficie aprox. `{{parcela.superficieM2}}` m².
- **QUINTO – Precio y forma de pago:** `{{precio.total}}` (CLP/UF); modalidad:
  contado / vale vista / pie `{{pago.pie}}` + cuotas `{{pago.nCuotas}}` × `{{pago.valorCuota}}`
  + saldo `{{pago.saldo}}` a la escritura; datos del **vale vista** (N°, banco, fecha, monto).
- **SEXTO – Estado del inmueble:** ad-corpus, libre de gravámenes; **prohibición de
  cambiar destino** (arts. 55 y 56 LGUC).
- **SÉPTIMO – Plazo/condición:** `{{promesa.plazoDias}}` días; condición suspensiva
  (que la sociedad adquiera el predio).
- **OCTAVO – Multa:** `{{promesa.multaUf}}` UF; retención del abono si incumple el comprador.
- **NOVENO – Entrega:** tras inscripción CBR a nombre del comprador.
- **DÉCIMO – Cesión:** la vendedora puede ceder; el comprador puede ceder con aceptación.
- **DÉCIMO CUARTO – Notificaciones:** correos de ambas partes.
- **DÉCIMO SEXTO – Instrucciones notariales del vale vista:** mandato al Notario
  `{{notaria}}` para custodiar y liberar el vale vista contra inscripción; resciliación
  si no se firma en plazo.
- **PERSONERÍA:** escritura `{{sociedad.personeriaFecha}}`, Notaría, Repertorio
  `{{sociedad.personeriaRepertorio}}`.

> **Clave del armado automático:** la mayor parte de la promesa (cláusulas PRIMERO,
> SEGUNDO, PERSONERÍA, deslindes, plano, rol, fojas) **proviene de los documentos de
> adquisición del proyecto** (§3), NO del cliente. Sólo comparecencia del comprador,
> objeto (lote), precio y forma de pago vienen de la **reserva** (§4). Por eso: cargar
> bien la adquisición una vez → todas las promesas del proyecto se generan casi solas.

## 6. Vale vista e instrucciones notariales

- El pago fuerte se hace con **vale vista endosable**, que queda **en custodia del
  Notario** con **instrucciones**: se libera al vendedor sólo cuando se acredita la
  **inscripción a nombre del comprador**, libre de gravámenes; si no se firma en plazo,
  se restituye al tomador (con resciliación de la promesa).
- Modelo de referencia: *MODELO_INSTRUCCIONES NOTARIALES - BANCO SECURITY.doc*.
- → El CRM debe registrar por parcela: vale vista (N°, banco, monto, fecha, tomador),
  fecha de retiro/depósito e instrucción asociada (ya previsto como evento `vale_vista`).

## 7. Implicancias para el producto (qué construir)

1. **M1 – Documentos de adquisición por proyecto:** repositorio (Vercel Blob) con tipos
   {compraventa, inscripción CBR, certificado SAG, asignación roles, plano, aguas,
   estudio títulos}. Subida + visor.
2. **Extracción con Claude (API):** al subir, Claude lee el PDF/imagen y propone los
   campos de §3 (predio, plano, deslindes, fojas/n°/año, rol, subdivisión, sociedad).
   El abogado revisa/edita → quedan como **datos del proyecto** (matriz de datos).
3. **Sociedades vendedoras por tenant** (§2): tabla nueva (razón social, RUT, rep,
   personería, domicilio) referenciable desde proyecto/promesa.
4. **Generador de promesa (M2):** matriz `.docx`/HTML con los `{{marcadores}}` de §5;
   se rellena con (proyecto + sociedad + parcela + cliente + forma de pago de la reserva)
   → PDF/Word. Flujo: Ventas genera → check abogado → firma electrónica (FirmaVirtual/
   Clave Única, Ley 19.799) → notaría.
5. **Datos del lote** que faltan en stock: superficie m², **rol/prerrol por lote**,
   deslindes por lote, N° de lote del plano.
6. **Gatillo de venta exenta (M3):** escritura + repertorio + inscripción CBR.

## 8. Estado de la lectura (Drive)

Leídos íntegros (texto): compraventa+hipoteca Metacon→Vargas (Colina), cesión de
promesa, **matriz Promesa San Alberto**, **promesa Lote 14 (llena)**, anexo promesa
Medina→Yáñez, **inscripción CBR Fs 502v N°512 2026** (San Clemente). Identificados (no
OCR por ser escaneo/*plano*): promesas firmadas San Javier/San Clemente, planos SAG
(N°1775), certificados SAG/roles, escrituras varias, comprobantes de pago a Metacon.
Los escaneos se procesan en runtime con la **API de Anthropic** (visión) usando la key
del tenant; aquí el lector de Drive sólo extrae texto de PDFs digitales y Office.
</content>
