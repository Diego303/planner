# planner · Informe de QA

Plan en [`QA-PLAN.md`](QA-PLAN.md). Este informe se actualiza al cerrar cada fase.

## Resumen

| | Valor | Objetivo |
|---|---|---|
| Tests (`pnpm test`) | **183 / 183 en verde** (también con `TZ=UTC`, `Europe/Madrid`, `America/Los_Angeles`) | todo en verde |
| Cobertura `src/core` | **99,2 %** líneas · 95,1 % ramas | ≥ 95 % líneas |
| Cobertura `src/server` | **97,3 %** líneas · 90,9 % ramas (CLI: `sistema.js` 97 %, `bin/planner.js` 88 %) | ≥ 85 % líneas |
| e2e (`pnpm test:e2e`) | **50 / 50 en verde** (con la sesión de 3 min); también con los datos en /mnt/d | todo en verde, sin intermitentes |
| Visual (`pnpm test:visual`) | **171 / 171 en verde**, tres veces seguidas (144 capturas + diseño adaptable + temas) | sin regresiones |
| `pnpm test:todo` | **en verde tres veces seguidas** (5,5 min cada una: check, 183 + 200 SIGKILL, 50 e2e, 171 visuales) | 3 seguidas |
| Bugs | **34 arreglados**, cada uno con su test (6 críticos de pérdida de datos) | |
| Fases | Q0 ✓ · Q1 ✓ · Q2 ✓ · Q3 ✓ · Q4 ✓ · Q5 ✓ · Q6 ✓ · Q7 ✓ · Q8 (falta tu permiso para tus datos) | Q0–Q8 |

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
| R4 | **Crítico** | Si un `rename` fallaba a mitad de una operación de varios ficheros, los anteriores se quedaban escritos; y si el proceso moría entre dos, al archivar se podía quedar la tarea fuera de `tareas.md` y aún no en el archivo | Cerrar el día con una tarea hecha ayer y matar el proceso (o que Windows bloquee el fichero) entre los dos `rename` | Se renombraba en el orden de la operación, sin vuelta atrás | Primero los ficheros que ganan contenido (lo movido queda repetido, nunca perdido) y, si uno falla, se devuelven los anteriores a como estaban · `f74eb75` | `test/renombrado.test.js`, `test/sigkill.test.js` |
| B13 | **Crítico** | Lo que Obsidian o el Bloc de notas guardaban justo entre la última comprobación y el `rename` se pisaba sin aviso (en /mnt/d el hueco son milisegundos) | Guardar un fichero con un editor mientras el planner escribe ese mismo fichero | Un `await` entre comprobar y renombrar | Enlace duro a lo que hay y `rename` en la misma vuelta, sin nada en medio; si lo enlazado no es lo comprobado, se devuelve y 409. Los ficheros nuevos, con `link()` (falla si otro lo creó) · `65b9056` | `test/edicion-externa.test.js`, `test/concurrencia.test.js` |
| B14 | Alto | Una copia diaria que fallaba a mitad (disco lleno) se quedaba incompleta y se daba por la copia del día | Llenar el disco durante la primera escritura del día | Se copiaba directamente en `.copias/AAAA-MM-DD` | Copia en una carpeta temporal y `rename` al final; los restos se borran al rotar · `11392a0` | `test/copias.test.js` |
| R5 | Alto | Si la copia de seguridad fallaba, solo se veía en la terminal | Igual que B14 | `catch` que solo escribía en la consola | Se guarda igual, pero la respuesta lleva el aviso y la banda de avisos lo enseña hasta que una copia sale bien · `ebb866c` | `test/copias.test.js` |
| B9 | Alto | `POST /api/op` aceptaba las primitivas internas: una sola petición podía borrar `tareas.md` o meter líneas con saltos dentro | `{"op":"fichero.borrar","args":{"ruta":"tareas.md"}}` | `existeOp` incluía las primitivas | Solo las usan las inversas que guarda el servidor · `1ab4091` | `test/api-hostil.test.js` |
| B15 | Alto | `planner stop` mandaba SIGTERM al PID del fichero aunque fuera otro programa (PID reutilizado tras un cierre brusco) | Matar el planner con `kill -9`, que el sistema reutilice el PID y ejecutar `planner stop` | No comprobaba que el proceso fuera un planner | Solo para lo que responde como este planner; un PID ajeno se toma por huérfano y uno colgado se deja con la orden para pararlo · `3dab52d` | `test/cli-entorno.test.js` |
| B10 | Medio | Deshacer un cambio desde el servidor devolvía la línea en forma canónica: se perdían los comentarios alineados y los espacios escritos a mano | Cambiar `foco_max` en Ajustes y deshacer: `- foco_max: 3              # …` pasa a `- foco_max: 3  # …` | El servidor relee el fichero y la inversa solo llevaba los campos | La inversa lleva también el texto original · `6a18f7d` | `test/deshacer-bytes.test.js` |
| B12 · R10 | Medio | Un fichero sin permiso de lectura (o una carpeta con su nombre) tumbaba `/api/estado` con un 500 que llevaba la ruta absoluta; los 500 devolvían el mensaje interno | `chmod 000 tareas.md` | Errores de lectura sin traducir | Se ignora con un aviso claro («sin permiso para leerlo», «es una carpeta») y el resto funciona; los 500 ya no llevan detalles · `43c0fa3` | `test/http-hostil.test.js` |
| R7 | Medio (seguridad, mitigado por la CSP) | El nombre del tema iba sin escapar en el SVG de Progreso | Tema `AI-102" onload="…` en `estudio.md` | `raw()` con texto del usuario | Escapado · `05432cd` | `test/web-escape.test.js` |
| R8 | Medio (seguridad, mitigado por la CSP) | Una comilla en `tema.md` cerraba el atributo `style` de la miniatura | `- fuente: "Inter" onmouseover="…"` | `raw()` con valores de `tema.md` | Escapado; la rejilla pasa a `web/ui/miniaturas.js`, que se prueba en Node · `2358570` | `test/web-escape.test.js` |
| B8 | Bajo | Argumentos con forma inesperada (`null`, números, `__proto__`) daban un 500 en `dia.cerrar`, `semana.cerrar` y `datos.inicializar` | `{"op":"dia.cerrar","args":{"aplazar":null}}` | Listas del cliente sin validar | 422 con un mensaje claro · `a8b1b9e` | `test/api-hostil.test.js` (fuzzer, 2.000 peticiones) |
| B11 | Bajo | Un cuerpo JSON que no era un objeto (`null`) daba un 500 | `POST /api/op` con `null` | Sin comprobar el tipo | 400 · `18897e8` | `test/http-hostil.test.js` |
| R9 | Bajo | Con más de 256 KB el cliente veía «conexión cortada» en vez del 413 | Cuerpo de 300 KB | `req.destroy()` antes de responder | Se descarta el resto y se responde 413 · `82856e3` | `test/http-hostil.test.js` |
| B16 | Bajo | Con `wslview` instalado pero roto no se abría el navegador y la CLI no lo decía | wslu sin navegador configurado | Bastaba con que arrancara | Se mira cómo sale (salvo `explorer.exe`, que sale con 1 aunque abra) y se prueba el siguiente · `fd81b5a` | `test/cli-entorno.test.js` |
| B18 | **Crítico** | Parar el planner (Ctrl+C, `planner stop`) con una escritura en marcha cortaba la operación: `cerrar()` cerraba las conexiones y el CLI salía enseguida | Ctrl+C justo al cerrar el día (varios ficheros) | `closeAllConnections` sin esperar a las peticiones | Deja de aceptar peticiones (503), espera a las que están en marcha (hasta 5 s) y cierra · `cf11e61` | `test/parada.test.js` |
| B19 | Alto | Lo escrito en un formulario se borraba al repintar: un error de validación, la respuesta de otra operación o un cambio de fuera traído por el sondeo | Escribir un proyecto en Metas mientras se guarda otra cosa, o pulsar Añadir sin el siguiente paso | Repintar sustituía el HTML con los campos vacíos (también en los modales) | `pintar()` y los modales conservan lo escrito (mismo id y mismo valor de partida) y el foco · `886cc37`, `605d4a8` | `test/e2e/cajon.spec.js`, `test/e2e/gestion.spec.js` |
| B20 | Alto (regresión de esta QA) | El menú Gestión ▾ no se abría: «TEMAS is not defined» | Pulsar Gestión ▾ | Import quitado al sacar la rejilla de miniaturas (`2358570`) | Import repuesto · `9173db6` | `test/e2e/gestion.spec.js` |
| B17 | Medio (accesibilidad) | `aria-pressed`, `aria-checked` y `aria-selected` salían vacíos al pintar: el lector de pantalla no sabía qué vista, tipo, pestaña, ánimo o tema estaba elegido | Cualquier vista con un lector de pantalla | La plantilla `html` convierte los booleanos en «» | «true»/«false» explícitos · `26006f3` | `test/web-escape.test.js`, `test/e2e/semana.spec.js` |
| B22 | Medio (accesibilidad) | Con el teclado no se veía el foco en Las 3 ni en los campos | Tab por la Semana o por el cierre del día | `outline: none` y un borde apenas distinto | Anillo con el acento del tema · `90a6587` | `test/e2e/teclado.spec.js` |
| B21 | Bajo (accesibilidad) | Al cerrar un modal abierto desde Gestión, el foco se perdía | Gestión ▾ → Ajustes → Esc | El foco volvía a la entrada del menú, que ya no existe | Vuelve a «Gestión ▾» · `f8e2094` | `test/e2e/teclado.spec.js` |
| B24 | Bajo | Con zoom al 200 % en 1024 o 1280 px, la página de Progreso se desplazaba en horizontal | Ctrl + + hasta 200 % en Progreso | Sparkline de 300 px fijos con la etiqueta fuera del gráfico | Los gráficos encogen con su columna y la etiqueta va dentro · `c68b92b` | `test/visual/adaptable.spec.js` |
| B23 | Bajo | En «Plan frente a real», con la letra ancha de Papel o del tema personalizado, «proyectos» saltaba debajo de su punto | Tema Papel → Progreso | Columna de 78 px | 96 px, sin saltos y con puntos suspensivos para nombres largos · `ef2492b` | `test/visual/adaptable.spec.js` |
| B25 | Alto | Con tres años de datos en /mnt/d, la primera escritura del día congelaba el planner 47,7 s (copia síncrona de toda la carpeta): ni el sondeo respondía | Primer cambio del día con años de datos | `cpSync` en el hilo del servidor | La copia va en segundo plano desde el arranque; lo que se escribe mientras tanto se copia antes en su versión vieja (sigue siendo la foto del día) · `64e2695` | `test/copias.test.js` |
| B27 | Alto | Con el disco lento, lo escrito en Las 3 se perdía y un bloque arrastrado no se guardaba si la respuesta del cambio anterior llegaba en ese momento | Marcar un objetivo y, enseguida, editar otro o arrastrar dos bloques seguidos con los datos en /mnt/d | El repintado sustituía el texto que se editaba o el bloque agarrado | El repintado de esa zona se aplaza hasta que termina la interacción · `64efa9e` | `test/e2e/disco-lento.spec.js` |
| B30 | Medio | Tras un aviso de recarga (409), repetir el cambio enseguida volvía a dar 409 y se perdía otra vez | Editar a la vez en Obsidian y en el planner con el disco lento | La recarga iba fuera de la cola de operaciones | La recarga va dentro de la cola · `eebb9d8` | `test/e2e/disco-lento.spec.js` |
| B26 | Medio (rendimiento) | Con tres años de datos en /mnt/d: 380 ms cada estado y 600 ms cada operación (307 y 476 `stat`) | Cualquier uso con años de semanas | Se comprobaban todas las semanas y 56 días de diario en cada petición | Lo lejano (fuera de lo que vigila el sondeo) vale 60 s de la caché, la versión reutiliza lo recién comprobado, `normalizar()` memoriza y la caché se llena al arrancar: 160 ms y 300 ms (en ext4, 20 ms) · `88725c4` | `test/rendimiento.test.js` |
| B29 | Bajo | Pasar semanas deprisa con el disco lento devolvía la vista a una semana anterior | Siete «›» seguidos desde la 45 acababan en la 51 | Se aplicaba cada respuesta al llegar, aunque fuera de una carga vieja | Solo vale la última carga pedida · `67e4a80` | `test/e2e/disco-lento.spec.js` |

## Decisiones dudosas (para que decidas)

Las D1–D10 de [`QA-PLAN.md`](QA-PLAN.md) §7 se mantienen como están (aprobadas con «ok a todo»). Las nuevas, sin tocar hasta que decidas:

| Id | Qué hace hoy | Por qué es dudoso | Opciones |
|---|---|---|---|
| D12 | Un fichero de datos que es un enlace simbólico se lee a través del enlace, pero al guardar el enlace se sustituye por un fichero normal: el fichero de fuera ya no recibe cambios (no se escribe nunca fuera de la carpeta) | Quien enlace `tareas.md` a otra carpeta (Dropbox, otro vault) deja de sincronizarlo sin aviso | (a) dejarlo; (b) avisar en la banda («tareas.md es un enlace: al guardar se convertirá en fichero»); (c) escribir a través del enlace (sale de la carpeta) |
| D13 | Si la carpeta de datos desaparece con el planner en marcha (disco D sin montar en WSL), la web enseña la bienvenida para crearla | Si se acepta, se crea `/mnt/d/planner` vacía dentro de Linux; al montar D: queda tapada y lo escrito ahí no se ve | (a) dejarlo; (b) si la carpeta existía al arrancar, decir «La carpeta ha desaparecido: ¿está el disco conectado?» sin ofrecer crearla; (c) no ofrecer crearla si su carpeta padre está vacía |
| D14 | La ★ «avanza las 3» sale en todos los bloques del tema relacionado (con «Entregar el lab de RAG · rel: Curso», en «Curso · lab RAG» y en «Curso · módulo 6») | En la maqueta solo la lleva el simulacro de MLA-C01; con un tema de muchos bloques, la ★ deja de destacar | (a) dejarlo (todo lo que avanza el tema cuenta); (b) solo si el título del bloque coincide con el del objetivo; (c) solo en el primer bloque de la semana de ese tema |
| D11 | En captura rápida, un día de la semana dentro del título se toma como fecha: «Martes de carnaval» → tarea «de carnaval» para el próximo martes; «Ir al mar» → «Ir al» para el martes (`mar` es la abreviatura) | El plan (§4.2) dice que los días de la semana se reconocen, sin distinguir si son palabra suelta al principio o al final | (a) dejarlo; (b) reconocer solo la abreviatura al final o con `@`/`el` delante; (c) solo con un prefijo explícito (`@mar`) |

## Riesgos restantes

- **Muerte entre dos `rename`:** cada fichero sigue siendo atómico y lo movido queda repetido, nunca perdido (R4); 200 SIGKILL sin ficheros a medias ni tareas perdidas.
- **Hueco entre `link` y `rename`:** de microsegundos y sin JavaScript en medio. Si el sistema de ficheros no tiene enlaces duros (en drvfs sí hay), queda la comprobación anterior.
- **Copia diaria en segundo plano:** si paras el planner antes de que termine (5 s de espera al parar), esa copia se rehace al volver a arrancar, ya con lo cambiado ese día dentro.
- **Semanas lejanas y diario viejo editados a mano:** el planner tarda hasta 60 s en verlos (el sondeo ya no los vigilaba, R13). Escribir siempre comprueba el disco, así que no se pisa nada.
- **Sin `fsync` del directorio tras el `rename` (R15):** solo afecta a un corte de luz en ext4; en drvfs no aplica. Aceptado.
- **`SIGINT` asíncrono y PID sin atomicidad (R17):** no se ha podido reproducir un fallo (doble Ctrl+C y `cerrar` repetido funcionan). Aceptado.
- **El sondeo solo mira las semanas cercanas (R13):** decisión de rendimiento; las escrituras siguen protegidas porque se relee el disco.

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

### Q3 · Servidor, API, CLI y seguridad
- **Fuzzer de la API:** 2.000 operaciones con argumentos hostiles (tipos cambiados, `null`, `__proto__`, listas con basura): solo errores 4xx claros y los ficheros siempre se releen igual.
- **HTTP:** JSON malformado o que no es un objeto, cuerpos de 257 KB a 2 MB, métodos que no tocan (405 con `Allow`), consultas raras, 500 sin detalles internos.
- **Concurrencia:** 50 operaciones a la vez sin perder ninguna, dos pestañas con la misma versión (una guarda y la otra recibe 409), 60 ediciones de fuera durante las escrituras sin perder ninguna, y deshacer en orden y fuera de orden.
- **Muerte del proceso:** SIGKILL en un momento al azar mientras se crean, marcan y archivan tareas (40 en `pnpm test`, 200 en `test:todo`): ningún fichero a medias, ninguna tarea confirmada perdida y temporales limpios al arrancar.
- **Disco:** solo lectura, sin espacio, sin permiso de lectura, carpeta borrada o movida en marcha, binarios y enormes, `rename` que falla o se cuelga, restaurar desde `.copias/`, enlaces simbólicos, copia diaria a medias.
- **Seguridad:** Host (incluidos `localhost.evil.com`, IPv6, sin puerto), Origin (`null`, otro puerto, https), sin cabeceras CORS, 20 rutas de escape (`%2e%2e`, `..%5c`, nulos, doble codificación, absolutas), no responde por la IP de la red local, primitivas internas cerradas y escape en SVG y `style`.
- **CLI:** PID huérfano, roto o reutilizado, planner colgado, rutas con espacios, tildes y paréntesis, y la cadena de apertura del navegador con programas falsos.
- Bugs: R4, B8–B16, R5, R7–R10 y R14. Decisiones dudosas nuevas: D12 y D13.

### Q4 · End-to-end (Playwright, Chromium)
- 42 tests en 9 ficheros (`test/e2e/`). Cada uno arranca su servidor con una copia nueva de `ejemplo/` (o una carpeta vacía o inexistente), falla con cualquier error de consola, excepción o `alert`, y comprueba el Markdown guardado, no solo el DOM. La hora del navegador va fija (lunes 2 de noviembre, 10:00).
- **Semana:** crear con doble clic, arrastrar (ajuste a 30 min, soltar fuera), estirar (mínimo 30 min, hasta la última hora), editar todos los campos, Hecho con cada duración y nota de simulacro, A medias y su aviso, eliminar y deshacer dentro y fuera de los 10 s, solapes y marcas ↻ ★ ◎ ⟲ ☾, ocupación en sus 3 colores y foco, Las 3, Proponer y aceptar, y navegar por semanas cerradas (solo lectura de verdad), futuras y el cambio de año (W53 → W01).
- **Hoy, cajón, Gestión y Progreso:** todo lo de la lista del plan, con los números de Metas y Progreso comparados con `core/progreso.js`.
- **Sincronización:** edición a mano visible en ≤ 3 s, conflicto con una operación en vuelo (409, sin pisar nada), servidor parado (banda de solo lectura, todo bloqueado) y recuperación sin perder nada.
- **Teclado y accesibilidad:** Esc por capas, Tab por todos los controles con foco visible y nombre accesible, y sin trampas.
- **XSS:** `<img src=x onerror=alert(1)>` en bloques, tipos, Las 3 («si → entonces»), tareas, proyectos, estudio, «dejado», diario, inbox y lecciones: texto en todas las vistas, el cajón y los modales (también en los 4 pasos del cierre).
- **Onboarding:** carpeta vacía e inexistente → 3 pasos → primera semana propuesta; la guía no vuelve al recargar.
- En WSL, Chromium necesita `libnss3`: una vez, `sudo pnpm exec playwright install-deps chromium`.
- Bugs: B17–B22.

### Q5 · Visual, temas y diseño adaptable
- **Capturas de referencia** (`test/visual/capturas/`, 8,5 MB): 16 pantallas (Semana, Hoy, Progreso, editor, Hecho, Metas, Diario, menú y los modales Semanas, Cerrar semana pasos 1, 2 y 4, Plantilla, Tipos, Ajustes y Tema) en los 6 temas, en automático claro y oscuro y en el personalizado: 144. Revisadas en hojas de contactos por pantalla. Las vistas son de página completa; lo demás, solo el elemento (para no pesar el doble). Si un cambio visual es intencionado: `pnpm test:visual --update-snapshots` y revisar.
- **Diseño adaptable:** 1024, 1280, 1440 y 1920 px al 80, 100, 125 y 200 % (zoom Z en W px = ventana W/Z con densidad Z): sin scroll horizontal, sin solapes en las cabeceras, popovers del editor (a izquierda, derecha y abajo) y modales enteros a la vista.
- **Sin parpadeo:** con `app.js` retenido, la primera pintura ya lleva el tema y el fondo definitivos en los 7 temas (también el personalizado).
- **Decoración** de Universo (fondo) y Halloween (murciélago y telaraña): se activa y se desactiva al momento. **Halloween de temporada** con la fecha simulada: del 25 al 31 de octubre se ve sin cambiar el tema elegido; fuera, el elegido.
- **Comparación con la maqueta nórdica** (`docs/maquetas/planner-nordico.html`): mismos textos, espaciados y microcopias en Semana y cajón. Diferencias: la ★ en todos los bloques del tema (D14); la maqueta va centrada a unos 1.100 px y la app ocupa todo el ancho. Igual que en la maqueta, un bloque de 30 min mide unos 10 px y su texto sale cortado (23 px por hora).
- En el Linux de los tests falta el glifo «＋» del campo de captura (sale «▯»); en Windows se ve bien. Las capturas de referencia son de este entorno: si se regeneran en otra máquina, cambiarán las fuentes.
- Bugs: B23, B24. Decisión dudosa nueva: D14.

### Q6 · Rendimiento y uso prolongado
Datos: `test/rendimiento/generar.js` crea tres años realistas (157 semanas, 5.000 tareas archivadas en 37 meses, 1.000 días de diario, 1.194 ficheros, 5,1 MB), sin ninguna línea no reconocida.

| Medida | Objetivo | ext4 | /mnt/d (drvfs) |
|---|---|---|---|
| Arranque (`planner` hasta la URL) | < 1 s | 0,15 s | código enlazado en /mnt/d: 1,1–1,3 s · instalado desde `.tgz`: 0,22 s |
| `GET /api/estado` (en caliente) | < 150 ms | 20 ms (antes 77) | 155–165 ms (antes 380) |
| Primera carga de la página | | caché ya llena al arrancar | ~200 ms (antes 800) |
| Una operación | | 75 ms | 230–330 ms (antes 600) |
| Primera escritura del día | | 90 ms | 0,3–0,7 s (antes **47,7 s**, B25) |
| Sondeo (`/api/version`) | | 6 ms | 40–60 ms |
| Pintar Semana / Hoy / Progreso | < 50 / – / < 200 ms | 7 / 10 / 11 ms (mediana) | igual (es el navegador) |

- En /mnt/d el suelo es la latencia de cada llamada al sistema (~4 ms): 39 `stat` y 5 `readdir` por estado. Ampliar el pool de hilos de libuv no mejora.
- El arranque > 1 s solo pasa con el código enlazado al repo en /mnt/d (cargar ~40 módulos desde drvfs): instrucciones.md (paso 2.5) explica cómo instalarlo desde un paquete. `package.json` ya tiene `files` (antes, el paquete metía `test/` con 8,5 MB de capturas).
- El sondeo cada 2 s solo pide `/api/version`: en 9 s, ninguna escritura en disco y ninguna recarga.
- **Sesión de 30 min** (`PLANNER_SESION_MIN=30`): acciones al azar que no hacen crecer los datos (marcar y desmarcar, navegar semanas, abrir modales y el editor, pestañas, escribir en la captura) con el sondeo activo, tres años de datos y el servidor en su propio proceso. Memoria tras forzar el GC, por minuto:

  | | minuto 1 | minuto 15 | minuto 30 |
  |---|---|---|---|
  | Servidor (heap) | 12,4 MB | 12,8 MB | 13,0 MB (se aplana) |
  | Pestaña (heap JS) | 3,5 MB | 4,4 MB | 4,7 MB (+0,3 MB en el último cuarto de hora) |
  | Nodos del DOM | 2.481 | 2.301 | 2.383 |
  | Listeners | 54 | 54 | 54 |
  | Timers vivos | 1 | 1 | 1 |

  Sin fugas. Una primera versión que creaba tareas sin parar sí crecía, pero por los datos (unas 300 tareas nuevas); la del servidor medía también la memoria de Playwright (64 MB). `test:todo` pasa una sesión de 3 min.
- Bugs: B25, B26 (y R6, R12).

### Q7 · Entorno real (WSL, Windows y app instalada)
- `pnpm add -g /mnt/d/GitHub/planner` (pnpm 12.6) deja un **enlace** al repo: funciona desde cualquier carpeta, pero arranca en ~1,2 s. `pnpm pack` + `pnpm add -g` del `.tgz` copia el código a ext4: 0,22 s con los datos en /mnt/d y `--ejemplo` funciona.
- **Toda la suite e2e con los datos en /mnt/d** (con 3 servidores a la vez): destapó B27, B29 y B30, que con ext4 no salían. Ahora pasa también ahí.
- **Instalable:** Chrome no da ningún error de instalabilidad (`Page.getInstallabilityErrors`), el manifest es correcto y los iconos de 192 y 512 cargan como PNG (`test/e2e/instalable.spec.js`).
- **`.vbs` de arranque:** sintaxis válida con `cscript` (con una copia que solo enseña el comando), ventana oculta (`Run …, 0, False`), CRLF; `bash -lic` encuentra `planner` con el `PNPM_HOME` de tu `.bashrc`.
- Lista manual para tu Windows: [`QA-CHECKLIST.md`](QA-CHECKLIST.md) (21 puntos: instalar como app, reiniciar, Bloc de notas, Obsidian, temas, zoom, copias y parada a mitad de guardar).

### Q8 · Validación de tus datos
- `pnpm qa:validar -- --datos <ruta>`: copia la carpeta a un temporal, la parsea entera, comprueba la ida y vuelta byte a byte y lista líneas no reconocidas (con el motivo), ficheros ignorados, solapes, temas huérfanos, tipos sin uso y tipos sin definir. Comprueba al final que la carpeta original no ha cambiado (`test/qa-validar.test.js` lo verifica byte a byte y por fecha de modificación). Salida 0, 1 (avisos) o 2 (ida y vuelta no exacta).
- Sobre `ejemplo/`: ida y vuelta exacta en 50 ficheros, 1 línea sin casilla (a propósito) y un solape cada domingo pasado («Cerrar semana» 17:00 dentro del bloque de proyectos de 16:00 a 17:30). Es un detalle de los datos de ejemplo, no del planner.
- **Pendiente: ejecutarlo sobre `/mnt/d/planner` cuando me des permiso.**
