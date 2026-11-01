---
description: Ordena las notas de inbox.md en tareas de tareas.md (vista previa y confirmación antes de escribir)
argument-hint: "[carpeta de datos]"
allowed-tools: Read, Edit, Bash(node:*)
---

Convierte las notas de `inbox.md` de la carpeta de planner en tareas de `tareas.md`.

1. Localiza la carpeta: `node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" carpeta $ARGUMENTS` y la fecha: `node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" hoy`.
2. Lee `inbox.md`, `tareas.md` y `tipos.md` de esa carpeta. En `inbox.md`, cada línea no vacía que no sea un título (`#`) es una nota.
3. Para cada nota propone **una** tarea: texto corto y concreto (empieza por un verbo), sección (`Hoy`, `Más adelante` o `Algún día`; por defecto `Más adelante`), tipo (solo nombres que existan en `tipos.md`, o ninguno) y, si la nota lo dice, `fecha:` y `dur:`. Si una nota no es una tarea (una idea suelta, un enlace), propón dejarla en el inbox.
4. Enseña una **vista previa** en tabla (nota → tarea · sección · tipo · fecha) y **pide confirmación**. Sin un «sí» explícito, no escribas nada. Acepta correcciones y vuelve a enseñar la tabla.
5. Antes de escribir, haz la copia: `node "${CLAUDE_PLUGIN_ROOT}/scripts/planner.mjs" copia <carpeta>`.
6. Escribe con `Edit` (nunca reescribas un fichero entero):
   - Cada tarea al final de su sección de `tareas.md` (crea la sección si falta, con `## Hoy`, `## Más adelante` o `## Algún día`).
   - Quita de `inbox.md` solo las notas convertidas; deja el resto exactamente como estaba.
7. Resume qué ha cambiado y dónde está la copia.

Gramática de una tarea (una línea, campos separados por ` | `):

```
- [ ] texto [| tipo] [| prioridad] [| fecha: AAAA-MM-DD] [| dur: 45m|2h|1h30] [| creada: AAAA-MM-DD]
```

Añade siempre `creada: <hoy>`. El texto no puede llevar `|`. Respeta Hoy: como mucho `tareas_hoy` tareas abiertas (mira `ajustes.md`, por defecto 5); si no caben, a `Más adelante`.

Reglas: no toques `semanas/` ni `diario/`; conserva cualquier línea que no entiendas; no inventes tipos.
