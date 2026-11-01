---
description: Repaso de las últimas 4–8 semanas de planner y una nota breve en la semana actual
argument-hint: "[semanas: 4-8] [carpeta de datos]"
allowed-tools: Read, Edit, Bash(node:*)
---

Haz un repaso de las últimas semanas del planner y deja una nota corta en la semana en curso.

1. Carpeta y fecha: `node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" carpeta` (si `$ARGUMENTS` trae una ruta, pásala) y `… hoy`. Número de semanas: el que diga `$ARGUMENTS` (4–8, por defecto 6).
2. Lista las semanas y su estado: `node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" semanas <carpeta>`.
3. Lee esas semanas (`semanas/AAAA-Www.md`), `estudio.md`, `proyectos.md` y, si existen, los `diario/AAAA-MM-DD.md` de esas fechas (solo lectura).
4. Analiza, con números de los ficheros (sin inventar):
   - horas planificadas frente a hechas por tipo (`hecho:` = diferencia sobre la duración: `0`, `+30m`, `-30m`, `+1h`);
   - qué temas avanzan y cuáles se quedan atrás frente a `horas_semana`;
   - patrones (días o franjas en las que se marca «Hecho» más o menos), simulacros (`nota:`) y ánimo del diario;
   - las lecciones (`- funcionó:` / `- cambio:` del `## Cierre`) que se repiten.
   Recuerda que una correlación no es una causa.
5. Enseña el repaso en el chat (máximo 10 líneas) y propone **una nota de 1–3 líneas** accionables para esta semana. **Pide confirmación** antes de escribir.
6. Con el «sí»: copia (`node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" copia <carpeta>`) y añade la nota con `Edit` en la semana en curso, en la sección `## Notas` (créala antes de `## Cierre`, o al final si no hay cierre), como líneas `- repaso: …`.
   - Si la semana en curso está **cerrada**, usa la siguiente (si existe y no está cerrada). Nunca escribas en una semana cerrada.

Reglas: no toques `diario/`, ni bloques, ni Las 3, ni el cierre; no reescribas ficheros enteros; conserva lo que no entiendas.
