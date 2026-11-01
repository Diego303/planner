---
description: Divide una tarea grande de tareas.md en pasos de menos de 2 h (vista previa y confirmación)
argument-hint: "<texto de la tarea (o parte)> [carpeta de datos]"
allowed-tools: Read, Edit, Bash(node:*)
---

Divide una tarea grande en pasos concretos de menos de 2 horas.

1. Carpeta y fecha: `node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" carpeta` y `… hoy`.
2. Lee `tareas.md` y busca la tarea que encaje con `$ARGUMENTS`. Si hay varias, pregunta cuál. Si no la encuentras, dilo y para.
3. Propón entre 2 y 7 pasos: cada uno empieza por un verbo, es comprobable y dura menos de 2 h (`dur:` en `30m`, `45m`, `1h`, `1h30`). El primero tiene que poder empezarse hoy en 10 minutos.
4. Enseña la **vista previa** (tarea original → pasos con su duración) y **pide confirmación**.
5. Con el «sí»: copia (`node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" copia <carpeta>`) y, con `Edit`, sustituye la línea de la tarea por los pasos, en la misma sección y posición, conservando tipo, prioridad y fecha de la original:

```
- [ ] <paso> | <tipo> | dur: 1h | creada: <hoy>
```

   Si la tarea estaba en `## Hoy` y los pasos no caben en el límite (`tareas_hoy` de `ajustes.md`), deja el primero en Hoy y el resto al final de `## Más adelante`.

Reglas: no toques `semanas/` ni `diario/`; no reescribas el fichero entero; el texto no puede llevar `|`.
