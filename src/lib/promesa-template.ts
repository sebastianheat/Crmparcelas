/**
 * Matriz por defecto de la promesa de compraventa de parcela (DL 3516),
 * basada en una promesa real del rubro (Soc. Inversiones San Alberto / cliente).
 * El área legal del tenant puede editarla. Los marcadores {{...}} se rellenan
 * con datos del proyecto/sociedad/parcela/cliente; la IA corrige y completa
 * (sobre todo la forma de pago) sin alterar las cláusulas legales.
 *
 * Variables disponibles (ver docs/Proceso_Legal_Parcelas.md §5):
 *  sociedad.*  cliente.*  predio.*  subdivision.*  parcela.*  precio.*  notaria  proyecto
 */
export const DEFAULT_PROMESA_MATRIZ = `PROMESA DE COMPRAVENTA

{{sociedad.razonSocial}}
A
{{cliente.nombre}}

En {{ciudadFecha}}, comparecen: la {{sociedad.razonSocial}}, persona jurídica del giro de su denominación, rol único tributario N°{{sociedad.rut}}, representada, según se acreditará, por don {{sociedad.repNombre}}, {{sociedad.repNacionalidad}}, {{sociedad.repEstadoCivil}}, {{sociedad.repProfesion}}, cédula de identidad N°{{sociedad.repCI}}, ambos domiciliados para estos efectos en {{sociedad.domicilio}}, en adelante la "promitente vendedora"; y, por la otra parte, don(ña) {{cliente.nombre}}, {{cliente.nacionalidad}}, {{cliente.estadoCivil}}, {{cliente.profesion}}, cédula de identidad {{cliente.rut}}, domiciliado(a) en {{cliente.domicilio}}, en adelante la "parte promitente compradora"; los comparecientes, mayores de edad, exponen que han convenido el siguiente contrato de promesa de compraventa:

PRIMERO: Inmueble. El predio denominado {{predio.denominacion}}, ubicado en la subdelegación de {{predio.subdelegacion}}, comuna de {{predio.comuna}}, provincia de {{predio.provincia}}, que según plano archivado bajo el número {{predio.planoArchivoN}} al final del Registro de Propiedad del Conservador de Bienes Raíces de {{predio.planoCbr}} del año {{predio.planoAnio}}, tiene una superficie de {{predio.superficie}} y deslinda: NORTE, {{predio.deslindeNorte}}; SUR, {{predio.deslindeSur}}; ORIENTE, {{predio.deslindeOriente}}; y PONIENTE, {{predio.deslindePoniente}}. El título de dominio se encuentra inscrito a fojas {{predio.dominioFojas}} número {{predio.dominioNumero}} del Registro de Propiedad del Conservador de Bienes Raíces de {{predio.dominioCbr}} del año {{predio.dominioAnio}}. El inmueble se encuentra enrolado en el Servicio de Impuestos Internos bajo el número {{predio.rolSii}}.

SEGUNDO: Subdivisión. El inmueble fue subdividido, dando origen a {{subdivision.nLotes}} lotes, de acuerdo al plano de subdivisión aprobado por el Servicio Agrícola y Ganadero con fecha {{subdivision.fechaSag}}, según consta del Certificado número {{subdivision.certSagN}}, encontrándose el certificado SAG, el certificado de asignación de roles y el plano de subdivisión archivados bajo los números {{subdivision.archivoCertSag}}, {{subdivision.archivoRoles}} y {{subdivision.archivoPlano}}, al final del Registro de Propiedad del Conservador de Bienes Raíces respectivo.

TERCERO: Objeto. Por el presente instrumento, la promitente vendedora promete vender, ceder y transferir a la parte promitente compradora, quien promete comprar y aceptar para sí, LA PARCELA O LOTE NÚMERO {{parcela.numero}}, que según el plano de subdivisión tiene una superficie aproximada de {{parcela.superficieM2}} metros cuadrados.

CUARTO: Precio. El precio de la compraventa prometida es la suma única y total de {{precio.montoTexto}} ({{precio.monto}}), que la parte promitente compradora pagará de la siguiente forma: {{precio.formaPago}}. El o los pagos se efectuarán mediante vale vista endosable que quedará bajo custodia del Notario, conforme a las instrucciones de la cláusula final.

QUINTO: Estado del inmueble. La parcela se vende como especie o cuerpo cierto, en el estado en que se encuentra, con todos sus usos, derechos y servidumbres, libre de hipotecas, gravámenes y prohibiciones. La parte promitente compradora declara conocer y aceptar la prohibición de cambiar el destino de la parcela conforme a los artículos 55 y 56 de la Ley General de Urbanismo y Construcciones.

SEXTO: Plazo y condición. El contrato prometido se otorgará dentro del plazo máximo de {{promesa.plazoDias}} días corridos a contar de esta fecha, en la notaría de {{notaria}}. Para su celebración, la promitente vendedora deberá tener inscrito a su nombre el inmueble individualizado en la cláusula primera.

SÉPTIMO: Multa. La parte que se negare a otorgar el contrato prometido pagará a la otra, a título de multa, la cantidad equivalente en pesos a {{promesa.multaUf}} Unidades de Fomento, sin perjuicio del derecho a exigir el cumplimiento forzado.

OCTAVO: Entrega. La entrega del inmueble se efectuará una vez otorgada la compraventa definitiva e inscrito el lote a favor de la parte promitente compradora en el Conservador de Bienes Raíces respectivo.

NOVENO: Cesión. La promitente compradora podrá ceder su calidad de tal a un tercero que la promitente vendedora acepte, en cuyo caso el cesionario asumirá todos los derechos y obligaciones de este contrato.

DÉCIMO: Domicilio. Para todos los efectos las partes fijan domicilio en la ciudad de {{ciudad}} y se someten a la competencia de sus Tribunales Ordinarios de Justicia.

UNDÉCIMO: Instrucciones notariales del vale vista. Las partes confieren mandato al Notario para custodiar el vale vista y entregarlo al beneficiario sólo una vez que se acredite la inscripción del inmueble a nombre de la parte compradora, libre de gravámenes; en caso contrario, dentro del plazo pactado, se restituirá al tomador suscribiéndose la respectiva resciliación.

PERSONERÍA. La personería de don {{sociedad.repNombre}} para representar a {{sociedad.razonSocial}} consta en escritura pública de fecha {{sociedad.personeriaFecha}}, otorgada en {{sociedad.personeriaNotaria}}, repertorio N°{{sociedad.personeriaRepertorio}}.

_______________________________
{{sociedad.repNombre}}
p.p. {{sociedad.razonSocial}}

_______________________________
{{cliente.nombre}}
C.I. {{cliente.rut}}`;
