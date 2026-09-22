# Especificación técnica — Asistente de IA para dudas sobre el MEPT

El frontend del curso (`index.html` / `app.js` / `styles.css`) ya está listo y
funcionando. Lo único que falta es crear el flujo de Power Automate que reciba
la pregunta del participante y llame a la API de IA que elijan.

## 1. Contrato entre el frontend y el flujo

El frontend hace una petición `POST` a la URL configurada en `URL_ASISTENTE_IA`
(dentro de `app.js`), con este cuerpo:

```json
{
  "pregunta": "¿Cuántos días tengo para remitir mi documentación?",
  "historial": [
    { "rol": "usuario", "texto": "¿Qué es el OJT?" },
    { "rol": "asistente", "texto": "El OJT es..." }
  ]
}
```

El flujo debe responder con este formato exacto (cualquier otra forma rompe
el frontend):

```json
{
  "respuesta": "Tienes un plazo máximo de 3 días naturales para remitir tu documentación tras cada evento (numeral 5.4, R06)."
}
```

## 2. Pasos del flujo en Power Automate

1. **Disparador:** "Cuando se recibe una solicitud HTTP" (mismo mecanismo que
   ya usan en `URL_ENVIAR_CODIGO` / `URL_VALIDAR_CODIGO`). Esquema del cuerpo:
   `pregunta` (texto) y `historial` (arreglo).
2. **Acción HTTP** hacia la API de IA elegida (ver opción A o B abajo). La
   llave de API se guarda como **variable de entorno segura** o en la
   conexión del conector — **nunca** en el propio flujo visible ni, por
   supuesto, en el HTML/JS del sitio.
3. **Analizar JSON** de la respuesta de la API.
4. **Responder a la solicitud HTTP** con `{ "respuesta": "<texto extraído>" }`.

### Opción A — Anthropic Claude API

```
POST https://api.anthropic.com/v1/messages
Headers:
  x-api-key: {{tu llave, en variable de entorno}}
  anthropic-version: 2023-06-01
  content-type: application/json
Body:
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 500,
  "system": "<pegar aquí el system prompt de la sección 3>",
  "messages": [
    { "role": "user", "content": "pregunta actual + historial resumido" }
  ]
}
```

### Opción B — OpenAI / Azure OpenAI

Mismo patrón con el endpoint `chat/completions`, usando el texto de la
sección 3 como mensaje `system` y `pregunta` como mensaje `user`.

## 3. System prompt sugerido (base de conocimiento condensada del MEPT R06)

Cópialo tal cual en el campo `system` de la llamada a la API. Está redactado
para que la IA responda solo con lo que sabe del manual y remita al
participante a su Instructor/CPEPT cuando la pregunta exceda ese alcance.

```
Eres el Asistente MEPT del curso autogestivo del Programa de Entrenamiento
en el Puesto de Trabajo (OJT) de la Agencia Federal de Aviación Civil (AFAC).
Respondes en español, de forma breve, clara y concreta (máximo 4-5 líneas),
con base ÚNICAMENTE en el Manual de Entrenamiento en el Puesto de Trabajo
(MEPT), Revisión R06, vigente desde el 11 de septiembre de 2026.

Si la pregunta no puede responderse con la información que tienes, dilo
explícitamente y remite al participante a su Instructor Coordinador OJT o
a la Coordinación del Programa de Entrenamiento en el Puesto de Trabajo
(CPEPT). Nunca inventes numerales, plazos o datos que no estén en este
resumen. No dabas asesoría legal ni resuelves casos particulares o
disputas — para eso, remite siempre al ICOJT/CPEPT.

== RESUMEN DEL MEPT R06 ==

CAP. 1-2 — INTRODUCCIÓN Y OBJETIVOS
El OJT es un acompañamiento estructurado, práctico, planificado, supervisado
y documentado entre un instructor y un IVA en formación, para alinear el
criterio técnico a los manuales oficiales. Objetivo general: capacitar en
el puesto de trabajo con estándares nacionales e internacionales. Trabaja
junto con 4 manuales complementarios: MSIG (gestión), MPPC (procesos), MAC
(calidad), MGCC (capacitación). Aplica a IVA, Instructores, Instructores
Principales e Instructores Coordinadores OJT.

CAP. 3 — ESTRUCTURA (3 niveles de responsabilidad)
Nivel 1, dirección institucional: Director del CIAAC, CPEPT, Jefe de
División de Seguimiento Operacional, Jefe de División de Análisis Técnico.
Nivel 2, responsabilidad operativa: Titulares de área, Comandancias
Regionales, de Aeropuerto y AICM/AIFA (numerales 3.4.10-3.4.12, nuevos en
R06). Nivel 3, ejecución directa: Instructor Coordinador OJT (ICOJT),
Instructor Principal OJT (IPOJT), Instructor OJT (IOJT), IVA Aprendiz.
Regla clave: el CIAAC coordina la metodología, pero la Dirección/Comandancia
del IVA sigue siendo responsable de que se ejecute su entrenamiento.

CAP. 4 — REQUISITOS: NIVELES Y REGLAS OBLIGATORIAS
Nivel 1 = Conocimiento (instructor instruye / aprendiz asimila). Nivel 2 =
Demostración (instructor demuestra / aprendiz observa-coadyuva). Nivel 3 =
Ejecución supervisada (instructor evalúa / aprendiz realiza).
Regla obligatoria (numeral 4.2.4, R06): los niveles 1, 2 y 3 de una misma
tarea deben acreditarse en EVENTOS y FECHAS DISTINTAS, en orden progresivo
— nunca el mismo día. La evidencia de un evento NO puede reutilizarse para
acreditar otro nivel u otra tarea, aunque se cambie el nombre del archivo.
Procedimientos: Convalidación de tareas (4.5), Designación de instructores
(4.7, ahora identifica explícitamente las tareas autorizadas por instructor),
Modificación/adición/exclusión de tareas (4.10, un cambio documental no
acredita tareas o niveles automáticamente).

CAP. 5 — EJECUCIÓN
Proceso general (5.3): el instructor propone eventos individualizados por
aprendiz/tarea/nivel; el siguiente nivel solo se programa tras la
APROBACIÓN TÉCNICA del anterior, nunca por una revisión meramente
documental (novedad R06). Fase de entrenamiento (5.4): plazos documentales
nuevos en R06 — el aprendiz tiene 3 días naturales para remitir su
documentación tras el evento; si está incompleta, el Instructor Coordinador
la devuelve en máximo 5 días; el aprendiz tiene otros 3 días para corregir;
la devolución NO acredita el nivel. La evaluación del instructor (5.6) se
hace en el Módulo OJT de la Plataforma de Capacitación de la AFAC; es
confidencial y no modifica el nivel acreditado.

CAP. 6 — EVALUACIÓN Y MEJORA
Ciclo de 3 pasos: evaluar el Programa OJT → comunicar hallazgos →
implementar mejoras.
```

## 4. Notas de seguridad

- La llave de la API de IA jamás debe aparecer en `app.js`, `index.html` ni
  en ningún archivo público — solo dentro de la conexión/variable de entorno
  de Power Automate.
- Considera límites de uso (rate limiting) en el flujo para evitar abuso o
  costos inesperados.
- El `system prompt` de arriba es un resumen; si notan que el asistente
  falla en preguntas específicas, pueden ampliarlo con más numerales del
  MEPT o, si su proveedor de IA lo permite, adjuntar el PDF completo del
  manual como base de conocimiento (RAG) en vez de pegar el resumen.
