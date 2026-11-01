# planner · Informe de QA

Plan en [`QA-PLAN.md`](QA-PLAN.md). Este informe se actualiza al cerrar cada fase.

## Resumen

| | Valor | Objetivo |
|---|---|---|
| Tests (`pnpm test`) | **141 / 141 en verde** (también con `TZ=UTC`, `Europe/Madrid`, `America/Los_Angeles`) | todo en verde |
| Cobertura `src/core` | **99,2 %** líneas · 94,3 % ramas | ≥ 95 % líneas |
| Cobertura `src/server` | **95,8 %** líneas · 85,2 % ramas | ≥ 85 % líneas |
| Fases | Q0 ✓ · Q1 ✓ · Q2 ✓ | Q0–Q8 |

## Bugs

Gravedad: **crítico** = pérdida o corrupción de datos, o seguridad · alto · medio · bajo. Cada uno con un test que fallaba antes del arreglo.

| Id | Gravedad | Qué pasaba | Cómo se reproduce | Causa | Arreglo · commit | Test |
|---|---|---|---|---|---|---|
| R1 | **Crítico** | Al fallar la escritura de un fichero a mitad de una operación, los anteriores ya estaban escritos. Al archivar tareas, `tareas.md` perdía las tareas y el archivo mensual no las recibía | Cerrar el día con una tarea hecha ayer y el disco lleno al escribir `archivo/tareas-AAAA-MM.md` | `api.ejecutar` escribía fichero a fichero | Escritura en dos fases: todos los temporales con fsync y luego todos los `rename`; si falla uno, nada cambia. Errores claros (507 sin espacio) y sin rutas absolutas · `524f4d4` | `test/escritura-transaccional.test.js` |
| R2 | **Crítico** | Una edición externa (Obsidian, Bloc de notas) entre la lectura y la escritura se pisaba sin aviso | Editar `tareas.md` mientras el planner hace la copia diaria y guarda | La versión se comparaba con la del navegador, no con el disco justo antes de escribir | Con los temporales escritos se relee cada fichero; si cambió, 409 y nada se escribe · `5e14ba7` | `test/edicion-externa.test.js` |
| R3 | **Crítico** (poco probable) | Una edición con el mismo tamaño y la misma fecha de modificación no se veía y la siguiente operación la pisaba | Cambiar una letra y restaurar el `mtime` | Caché por `mtime` + tamaño | Firma con `mtime`, `ctime`, tamaño e inodo (el `ctime` no se puede restaurar) · `37475b2` | `test/cache.test.js` |
| B4 | Alto | En `## Estudio` de la semana, un tema con « # » o «:» en el nombre dejaba la línea sin reconocer y Proponer perdía esas horas | `- AI-102 # parte 2: 6 h` · `- Curso: IA: 6 h` | Comentario con un espacio y corte en el primer «:» | Comentario con dos espacios, como en todo texto libre; el último «:» separa · `5c1003e` | `test/formato-hostil.test.js` |
| B5 | Medio | Con CRLF y LF mezclados, al guardar cambiaban bytes de líneas no tocadas | Fichero editado con el Bloc de notas y otro editor | Un único fin de línea por documento | Cada línea guarda el suyo · `34dd280` | `test/formato-hostil.test.js`, propiedades |
| B6 | Alto | Un tipo llamado `Curso: IA`, `prioridad` o `las3` se guardaba, pero al releer la tarea o el bloque el tipo se perdía o se tomaba como otro campo | Crear el tipo «Curso: IA» en Gestión y asignarlo a una tarea | Nombres que chocan con la sintaxis `clave: valor` del formato | Se rechazan con un mensaje claro al crear el tipo, la tarea o el bloque · `316cddb` | `test/ops.test.js`, `test/modelo-ops.test.js` |
| B7 | Bajo | En captura rápida, `29/02` en un año no bisiesto se quedaba en el título y `1h30m` no se entendía como duración | «Revisar 29/02» escrito en 2027 · «Leer 1h30m» | `dd/mm` solo miraba este año y el siguiente; la regex de duración no aceptaba «m» tras las horas | El próximo 29 de febrero válido; `1h30m` = 90 min · `9b3d818`, `3b524c8` | `test/captura.test.js`, `test/logica.test.js` |

## Decisiones dudosas (para que decidas)

Las D1–D10 de [`QA-PLAN.md`](QA-PLAN.md) §7 se mantienen como están (aprobadas con «ok a todo»).

| Id | Qué hace hoy | Por qué es dudoso | Opciones |
|---|---|---|---|
| D11 | En captura rápida, un día de la semana dentro del título se toma como fecha: «Martes de carnaval» → tarea «de carnaval» para el próximo martes; «Ir al mar» → «Ir al» para el martes (`mar` es la abreviatura) | El plan (§4.2) dice que los días de la semana se reconocen, sin distinguir si son palabra suelta al principio o al final | (a) dejarlo; (b) reconocer solo la abreviatura al final o con `@`/`el` delante; (c) solo con un prefijo explícito (`@mar`) |

## Riesgos restantes

- **Varios ficheros a la vez:** si el proceso muere justo entre dos `rename` de la misma operación, puede quedar a medias (cada fichero sigue siendo atómico). La ventana es de microsegundos; se mide en Q3.
- **Hueco entre comprobar y renombrar:** sigue existiendo, pero es de microsegundos (antes eran segundos).

## Fases

### Q0 · Inventario y plan
Mapa de funcionalidades, matriz, riesgos y revisión estática en `QA-PLAN.md`. Línea base: 92 tests, `src/core` 98,7 %, `src/server` 94,6 %.

### Q1 · Formatos
- 500 modelos aleatorios por fichero (10 formatos + archivo): ida y vuelta e idempotencia byte a byte.
- 500 textos arbitrarios por fichero (líneas válidas, mutadas y basura; CRLF, LF y mezcla; BOM; sin salto final): se conservan byte a byte y lo no reconocido queda en su sitio.
- Casos hostiles explícitos: Bloc de notas, vacíos, secciones duplicadas, desconocidas o reordenadas, títulos con `| · # ! : [ ]`, comillas, emojis, RTL, HTML y más de 2.000 caracteres, horas, días, fechas y colores inválidos, claves en mayúsculas, valores vacíos y coma decimal.
- Fechas idénticas en 5 zonas horarias (cambios de hora de marzo y octubre, 29 de febrero, 2026-W53, inicio en domingo); toda la suite pasa con `pnpm test:zonas`.
- Bugs: B4, B5 (y R1–R3 antes de empezar).

### Q2 · Lógica del núcleo
- **Modelo de operaciones:** 1.000 secuencias aleatorias de 10–40 operaciones (todas las de `ops.js`, con argumentos válidos e inválidos). Tras cada una: la inversa devuelve el mundo byte a byte, un fallo no toca nada (comprobado por referencia), los ficheros siguen releyéndose igual y los ids son coherentes.
- **Proponer:** 400 semanas aleatorias (horarios, capacidad, foco, cierre, temas con y sin examen, simulacros, bloques de plantilla, semana actual, futura y pasada). Siempre: dentro de horas y antes del cierre, sin choques (colchón incluido), un tema por día, capacidad + 10 %, foco máximo, nunca en el pasado, piezas de 1–1,5 h, orden ★ → examen → proyectos, simulacro a las 2 semanas y cuentas exactas de lo que no cabe. Determinista. Semana cerrada o pasada → error; deshacer lo quita todo.
- **Tablas de casos:** factor de estimación (umbral de 5 muestras, límites), captura rápida (63 entradas), Hoy lleno, carriles solapados, capacidad en sus límites, estados de semana, plantilla, progreso en 49/50/51 % y tema personalizado inválido.
- Bugs: B6, B7. Decisión dudosa nueva: D11.
