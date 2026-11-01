---
description: Crea un plan de estudio (temario + fecha de examen) en estudio.md, con horas por semana realistas
argument-hint: "<nombre> <AAAA-MM-DD del examen> [temario o fichero con el temario]"
allowed-tools: Read, Edit, Write, Bash(node:*)
---

Convierte un temario y una fecha de examen en un tema de `estudio.md` que planner pueda usar (Metas, Proponer y Progreso).

1. Carpeta y fecha: `node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" carpeta` y `… hoy`.
2. De `$ARGUMENTS` saca el nombre (corto, sin `·` ni `|`: será el «tema» que empieza los títulos de bloque, p. ej. `AI-102`), la fecha del examen y el temario (texto o un fichero que te indiquen; si falta, pídelo).
3. Lee `estudio.md` y `ajustes.md` (`foco_max`, `capacidad`). Si ya existe un tema con ese nombre, propón actualizarlo en lugar de duplicarlo.
4. Calcula: horas totales razonables para el temario (`total`), semanas hasta el examen y `horas_semana` = total / semanas con un 15 % de margen, redondeado a 0,5. Avisa si supera lo que cabe con `foco_max` y la capacidad.
5. Enseña una **vista previa** de la sección y de un reparto por semanas del temario. **Pide confirmación**.
6. Con el «sí»: copia (`node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" copia <carpeta>`) y añade (o actualiza) con `Edit` la sección al final de `estudio.md`:

```
## <nombre>
- horas_semana: <n>
- examen: AAAA-MM-DD
- inicio: <hoy>
- total: <n>
```

   El reparto semana a semana del temario va aparte, en `temarios/<nombre>.md` (planner no lo lee: es para ti).

Reglas: solo esas claves en `estudio.md` (`horas_semana`, `examen`, `inicio`, `total`, `previo`, `simulacros`, `dejado`), números con coma decimal; no toques `semanas/` ni `diario/`.
