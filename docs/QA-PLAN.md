# planner · Plan de pruebas (Q0)

Objetivo: demostrar con pruebas que planner hace lo que dicen [`PLAN.md`](PLAN.md) y la maqueta, y que **nunca pierde ni corrompe datos**. Reglas: solo copias en `os.tmpdir()`; `/mnt/d/planner` no se toca (Q8 solo con permiso y en solo lectura); git solo en `develop`; un commit `fix(...)` por bug con su test que falla antes y pasa después; cero dependencias de runtime (devDependency permitida: `@playwright/test`).

---

## 1. Línea de partida

`node --test --experimental-test-coverage test/*.test.js` (Node 24.21, 2026-11-01):

| | Tests | Líneas | Ramas | Funciones |
|---|---|---|---|---|
| Total | **92 / 92 en verde** (6,2 s) | | | |
| `src/core` | | **98,7 %** (2860/2897) | 88,3 % | 95,0 % |
| `src/server` | | **94,6 %** (576/609) | 85,7 % | 90,7 % |
| `src/cli` | | 87,2 % | 89,8 % | 84,2 % |
| `bin/planner.js` | | 83,5 % (solo lo que corre en el proceso de test) | 29,6 % | 85,7 % |
| `web/` | | sin medir (corre en el navegador) | | |

Ficheros más flojos: `src/cli/sistema.js` 80,6 % (abrir navegador, PID), `src/server/api.js` 86,9 % (`/api/cierre`, errores), `src/server/store.js` 90,1 % (reintentos de `rename`, borrado, temporales), `src/core/formato/tareas.js` 90,3 % (archivo mensual), `src/core/ops.js` ramas 82 %, `src/core/color.js` ramas 78 %.

Lo que ya existe: ida y vuelta de todos los ficheros de `ejemplo/` y de casos a mano (`formato`), inversa exacta de cada operación básica (`ops`), 12 escenarios de Proponer, cerrar → reabrir → cerrar, métricas sobre `ejemplo/`, contraste AA tema × paleta, servidor (409, deshacer, Host, Origin, 415, 413, traversal, binarios), CLI (start/status/stop, segunda instancia, `--ejemplo`) y plugin. **No hay** pruebas de propiedades con generadores, ni e2e de la web, ni de concurrencia, de muerte del proceso, de disco lleno o de rendimiento.

---

## 2. Mapa de funcionalidades

### 2.1 Pantallas y controles

| Funcionalidad | Código | Plan |
|---|---|---|
| Barra: selector de vista, captura, Gestión ▾ con punto naranja | `web/app.js` (`pintarBarra`, `menuGestion`), `web/ui/captura.js` | §3 Barra superior |
| Banda «Servidor parado · solo lectura» y avisos | `web/app.js` (`pintarBanda`), `web/estado.js` (`iniciarSondeo`) | §5 Errores visibles |
| Semana: cabecera, ‹ hoy ›, estado, banda de estado y su acción | `web/vistas/semana.js` (`cabecera`, `banda`) | §3 Semana |
| Las 3 en pastillas (marcar, editar en línea, añadir, vaciar = quitar) | `semana.js` (`las3`, `guardarLas3`) | §3 Semana |
| Rejilla: carriles, ocupación (3 colores), foco, marcas ↻ ★ ◎ ⟲ ☾ ⚠, sugeridos, hechos | `semana.js` (`cabeceraDias`, `bloqueHtml`, `rejilla`), `core/carriles.js`, `core/capacidad.js`, `core/color.js` | §3, §4.1, §4.2 |
| Crear (doble clic), mover/estirar (arrastre), abrir editor (clic/Enter), solo lectura | `semana.js` (`crearEnHueco`, `empezarArrastre`) | §3 Interacción |
| Semana desde el domingo (columna de la semana anterior) | `core/fechas.js` (`columnasSemana`), `semana.js` (`modeloSemana`), op `bloque.mover` | `inicio_semana` |
| Editor de bloque: título, tipo, subtipo, cuándo, primer paso, ↻, Guardar/Aceptar/Eliminar | `web/vistas/editor-bloque.js` | §3 Editor |
| Hecho ✓ (duración real, nota), A medias (dejado), Desmarcar, aviso «lo dejaste en» | `web/vistas/hecho.js`, `editor-bloque.js` (`dejadoDe`) | §3 Editor |
| Proponer semana y su aviso | `hecho.js` (`acciones.proponer`), `core/proponer.js` | §4.4 |
| Hoy: horario con «ahora», Las 3 con si→entonces | `web/vistas/hoy.js` (`horario`, `las3Hoy`) | §3 Hoy |
| Tareas de hoy (límite, ↓ luego, ✎ editar/borrar), Más adelante por grupos (↑ hoy), recordatorio de Las 3, ★ | `hoy.js` (`tareasHoy`, `masAdelante`, `formularioTarea`) | §3 Hoy, §2 tareas.md |
| Cierre del día (4 pasos, «mañana empiezo por» prellenado, editar) | `hoy.js` (`cierreDelDia`, `sugerenciaManana`, `cerrarDia`) | §3 Hoy |
| Captura «apunta algo»: chips, destino, «guardado en…» | `web/ui/captura.js`, `core/captura.js` | §3 Captura |
| Cajón Hoy / Metas / Diario | `web/ui/cajon.js`, `vistas/cajon-hoy.js`, `cajon-metas.js`, `cajon-diario.js` | §3 Cajón |
| Progreso: certificaciones, plan vs real, factor, constancia, ánimo, lecciones | `web/vistas/progreso.js`, `web/ui/graficos.js`, `core/progreso.js` | §3 Progreso, §4.6 |
| Gestión → Semanas | `web/gestion/semanas.js` | §3 Gestión |
| Gestión → Cerrar semana (4 pasos) | `web/gestion/cerrar-semana.js`, `core/semanas.js` (`prepararCierre`), op `semana.cerrar` | §3 Gestión, §4.5 |
| Gestión → Plantilla, Tipos (color, banderas, alta, quitar), Ajustes, Tema | `web/gestion/plantilla.js`, `tipos.js`, `ajustes.js`, `tema.js` | §3 Gestión, Temas |
| Onboarding (3 pasos) | `web/gestion/onboarding.js`, op `datos.inicializar` | §8 |
| Toast con deshacer 10 s, modal, popover, Esc | `web/ui/toast.js`, `modal.js`, `popover.js`, `app.js` (Esc) | §5 Deshacer |
| Temas, decoración, temporada, personalizado, sin parpadeo | `web/temas/*.css`, `core/temas.js`, `app.js` (`aplicarTema`), `server/index.js` (`temaInicial`) | Temas visuales |
| PWA | `web/manifest.webmanifest`, `icon.svg`, `icon-*.png` | §6 |

### 2.2 Operaciones de `src/core/ops.js`

| Operación (línea) | Plan | Inversa |
|---|---|---|
| `lineas.insertar` 118, `lineas.quitar` 119, `linea.cambiar` 120, `fichero.crear` 121, `fichero.borrar` 122, `lote` 123 | §1 Cambios = operaciones | primitivas exactas (DISENO §4.1) |
| `semana.crear` 208 · `semana.reabrir` 534 · `semana.proponer` 306 · `semana.cerrar` 442 | §4.4, §4.5 | lote |
| `bloque.crear` 231 · `editar` 239 · `mover` 255 · `eliminar` 267 · `hecho` 316 · `desmarcar` 344 · `aMedias` 358 | §3 Semana, Editor | lote |
| `las3.crear` 273 · `editar` 281 · `eliminar` 291 | §3 Las 3 | lote |
| `tipo.crear` 556 · `color` 572 · `banderas` 581 · `eliminar` 599 | §3 Tipos, §7.10 | lote |
| `plantilla.crear` 609 · `eliminar` 617 | §3 Plantilla, §7.9 | lote |
| `ajustes.cambiar` 624 | §3 Ajustes | lote |
| `tarea.crear` 663 · `editar` 672 · `marcar` 677 · `mover` 684 · `eliminar` 696 | §3 Hoy, §7.2 | lote |
| `dia.cerrar` 732 | §3 Cierre del día, §2 archivo | lote |
| `estudio.crear` 818 · `cambiar` 824 · `eliminar` 825 · `proyecto.crear` 827 · `cambiar` 830 · `eliminar` 834 | §3 Metas | lote |
| `datos.inicializar` 845 | §8 | lote |

### 2.3 API (`src/server/api.js`) y servidor (`http.js`)

| Ruta (línea) | Plan §5 |
|---|---|
| `GET /api/salud` 87 | (CLI: detectar instancia) |
| `GET /api/version` 88 | sondeo 2 s |
| `GET /api/estado` 89 | modelo para pintar + versiones |
| `GET /api/semanas` 90 | lista con estados |
| `GET /api/cierre` 98 | datos del asistente de cierre |
| `POST /api/op` 116 | 200 / 409 / 422 |
| `POST /api/deshacer` 122 | inversa por id (410 si caducó) |
| Estáticos `/`, `/core/*`; Host/Origin/415/413; CSP | `http.js` (`manejar`, `estatico`, `leerCuerpo`) |
| Escritura atómica, caché, versiones, sondeo | `store.js` |
| Copias diaria / al cerrar semana / git | `copias.js` |
| Pila de 20 inversas | `deshacer.js` |

### 2.4 CLI (`bin/planner.js`, `src/cli/args.js`, `src/cli/sistema.js`)

`start` (por defecto), `stop`, `status`, `--datos`, `--puerto` (0 = el sistema elige), `--silencioso`, `--ejemplo`, `--hoy`, `--version`, `--ayuda`; PID en `$PLANNER_HOME/pid` o `~/.planner/pid`; puerto libre +20; segunda instancia abre la primera; navegador: `wslview` → `explorer.exe` → `cmd.exe /c start` → mensaje con la URL. Plan §6.

### 2.5 Ficheros Markdown (gramática en [`DISENO.md`](DISENO.md) §3)

| Fichero | Parser | Plan |
|---|---|---|
| `ajustes.md`, `estudio.md`, `proyectos.md`, `diario/*.md`, `tema.md` | `core/formato/listas.js` | §2 |
| `tipos.md`, `plantilla.md` | `core/formato/tipos.js` | §2 |
| `semanas/AAAA-Www.md` | `core/formato/semana.js` | §2 |
| `tareas.md`, `archivo/tareas-AAAA-MM.md` | `core/formato/tareas.js` | §2 |
| `inbox.md`, `archivo/inbox-AAAA-MM.md` | `core/formato/index.js` | §2 |
| Común (BOM, CRLF, comentarios, campos, texto original) | `core/formato/comun.js` | §2 Reglas comunes |

### 2.6 Ajustes (`core/formato/listas.js` → `AJUSTES_DEFECTO`)

| Clave | Validación | Dónde se usa |
|---|---|---|
| `capacidad` 50–100 | entero | ocupación (`capacidad.js`), Proponer, leyenda |
| `tareas_hoy` 1–20 | entero | `hoyLleno` (ops), captura, Hoy |
| `horas` `H-H` | desde < hasta ≤ 24 | rejilla, ocupación, Proponer, editor |
| `cierre` `HH:MM` | hora | ☾, Proponer (tope), cierre del día |
| `inicio_semana` lunes/domingo | opción | columnas de la Semana y del editor |
| `foco_max` 0,5–24 h | número | aviso de foco, Proponer |
| `mejores_horas` | opción | Proponer (preferencia) |
| `margen` auto/fijo | opción | Proponer (factor) |
| `copias` diaria/al cerrar semana/git | opción | `copias.js` vía `api.js` |
| `puerto` 1024–65535 | entero | CLI al arrancar |
| `tema`, `tema_temporada`, `decoracion` | opción / sí-no | `core/temas.js`, `app.js`, `server/index.js` |

---

## 3. Matriz funcionalidad × tipo de prueba

U = unitaria · P = propiedades (PRNG con semilla, ≥ 500 casos) · M = basada en modelo (secuencias de ops) · A = API/servidor · E = e2e Playwright · V = visual · R = rendimiento · Ma = manual (`QA-CHECKLIST.md`). ✓ = ya existe; ◻ = se añade (fase).

| Funcionalidad | U | P | M | A | E | V | R | Ma |
|---|---|---|---|---|---|---|---|---|
| Formatos (10 ficheros), texto original, hostiles, CRLF/BOM | ✓ | ◻ Q1 | | | | | | Bloc de notas, Obsidian |
| Fechas, ISO 53, cambios de hora, 3 zonas horarias | ✓ | ◻ Q1 | | | | | | |
| Operaciones e inversas, invariantes, ops inválidas | ✓ | ◻ Q2 | ◻ Q2 (≥ 1.000) | ✓ | ◻ Q4 | | | |
| Proponer (9 reglas, determinismo, no caben, deshacer) | ✓ | ◻ Q2 | ◻ Q2 | | ◻ Q4 | | ◻ Q6 | |
| Factor real | ✓ | ◻ Q2 | | | | | | |
| Captura (≥ 60 casos) | ✓ | ◻ Q2 | | | ◻ Q4 | | | |
| Carriles, capacidad, foco | ✓ | ◻ Q2 | | | ◻ Q4 | ◻ Q5 | | |
| Semanas: estados, cerrar/reabrir, plantilla, solo lectura | ✓ | | ◻ Q2 | ✓ | ◻ Q4 | | | |
| Progreso (umbrales 49/50/51 %, mediana, vacíos) | ✓ | ◻ Q2 | | | ◻ Q4 | ◻ Q5 | ◻ Q6 | |
| Color y temas (AA, personalizado inválido) | ✓ | ◻ Q2 | | ✓ | ◻ Q4 | ◻ Q5 | | cambiar tema |
| API: rutas, 409/422/410, malformado, >256 KB, métodos | ✓ parcial | | | ◻ Q3 | | | | |
| Concurrencia (50 en paralelo, 2 pestañas, edición externa) | | | | ◻ Q3 | ◻ Q4 | | | |
| Robustez de disco (SIGKILL ×200, ENOSPC, solo lectura, carpeta borrada) | | | | ◻ Q3 | | | | |
| Copias (diaria, rotación 14, restaurar, git sin remoto) | ✓ | | | ◻ Q3 | | | | |
| Seguridad (127.0.0.1, Host, Origin, traversal, symlinks, sin CORS ni trazas, XSS) | ✓ parcial | | | ◻ Q3 | ◻ Q4 (XSS) | | | |
| CLI (start/stop/status, puerto, PID huérfano, rutas con espacios, navegador) | ✓ parcial | | | ◻ Q3 | | | | WSL real |
| Web: Semana, Hoy, Captura, Cajón, Gestión, Progreso, Onboarding | | | | | ◻ Q4 | ◻ Q5 | ◻ Q6 | ◻ Q7 |
| Sincronización (edición a mano, op en vuelo, servidor parado) | | | | ✓ parcial | ◻ Q4 | | | Obsidian |
| Teclado y accesibilidad | | | | | ◻ Q4 | | | |
| Diseño adaptable (4 anchos, 3 zooms), sin parpadeo, temporada | | | | | | ◻ Q5 | | |
| Rendimiento y memoria (3 años de datos, 30 min) | | | | | | | ◻ Q6 | |
| Instalación, app, arranque con Windows, `/mnt/d` | | | | | | | | ◻ Q7 |
| Validación de datos reales (solo lectura) | | | | | | | | ◻ Q8 (con permiso) |

---

## 4. Riesgos ordenados por gravedad

Gravedad según el encargo: **crítico** = pérdida o corrupción de datos, o seguridad; alto; medio; bajo. «Sospechoso» = visto leyendo el código; se demostrará con un test antes de arreglarlo.

| # | Gravedad | Riesgo | Dónde |
|---|---|---|---|
| R1 | **Crítico** | **Escritura multi-fichero no transaccional.** `ejecutar` escribe los ficheros de una operación uno a uno; si falla uno a mitad (ENOSPC, EACCES, carpeta movida), los anteriores ya están en disco y no se guarda la inversa. Caso concreto: archivar tareas (`dia.cerrar`, `semana.cerrar`) escribe `tareas.md` **antes** que `archivo/tareas-AAAA-MM.md` → si falla el segundo, las tareas desaparecen de `tareas.md` y solo quedan en `.copias/`. | `src/server/api.js:61-70`, orden de `tocados` en `ops.js` (`archivarTareas`) |
| R2 | **Crítico** | **Edición externa entre la lectura y la escritura se pisa sin aviso.** La versión se compara con la que manda el cliente, no con el disco justo antes del `rename`. La ventana incluye la copia diaria síncrona (`cpSync` de toda la carpeta: segundos en `/mnt/d`). Un guardado de Obsidian en ese hueco se pierde. | `api.js:33-70`, `store.js:73-92`, `copias.js:14-31` |
| R3 | **Crítico** (probabilidad baja) | **Caché por `mtime` + tamaño.** Una edición externa que deje igual tamaño y `mtime` (resolución gruesa del sistema de ficheros o herramientas que restauran el `mtime`) no se detecta: se usa el documento viejo y la siguiente operación pisa el cambio. | `store.js:47` |
| R4 | Alto | Muerte del proceso (SIGKILL, apagado) durante una operación multi-fichero: cada fichero es atómico, pero el conjunto puede quedar a medias (como R1). | `api.js:68` |
| R5 | Alto | Si la copia de seguridad falla, solo se escribe en la consola del servidor: el usuario no sabe que no tiene copia («errores nunca silenciosos»). | `api.js:67` |
| R6 | Alto | La copia diaria es síncrona: con años de datos en `/mnt/d` bloquea el servidor (sondeo y peticiones colgados) y agranda la ventana de R2. | `copias.js:14-31` |
| R7 | Medio (seguridad, mitigado por CSP) | **Inyección en el SVG de Progreso**: el `aria-label` del sparkline lleva el nombre del tema de `estudio.md` sin escapar dentro de `raw()`. Un nombre con `"` o `<` rompe el marcado (los manejadores inline los bloquea la CSP). | `web/ui/graficos.js:36`, `web/vistas/progreso.js:26-27` |
| R8 | Medio (seguridad, mitigado por CSP) | **Inyección en el atributo `style`** de la miniatura del tema personalizado: los valores de `tema.md` admiten comillas y van con `raw()`. | `web/gestion/tema.js:35`, `src/core/formato/listas.js:136` |
| R9 | Medio | El 413 (> 256 KB) se responde tras `req.destroy()`: el cliente puede ver una conexión cortada en vez del 413. | `src/server/http.js:45` |
| R10 | Medio (seguridad) | Los 500 devuelven `e.message` al navegador (puede llevar rutas absolutas o códigos del sistema). | `http.js:97` |
| R11 | Medio | La web no tiene pruebas automáticas: arrastre, editor, cola de operaciones optimistas y recomposición (`web/estado.js`) pueden regresar sin aviso. | `web/` |
| R12 | Medio | Proponer, cierre de semana y las métricas leen todas las semanas en cada operación: con 3 años en `/mnt/d` puede superar los objetivos de Q6. | `server/estado.js` (`todasLasSemanas`), `contexto` |
| R13 | Bajo | El sondeo solo mira las semanas cercanas (±10): una edición a mano de una semana antigua no recarga la UI (las escrituras siguen protegidas: el servidor relee). | `store.js:124-140` |
| R14 | Bajo | Tests que dependen del reloj real: fallarían si cruzan la medianoche (`fechaDe(new Date())`). | `test/server.test.js:98-99`, `test/plugin.test.js:30` |
| R15 | Bajo | Sin `fsync` del directorio tras el `rename` (durabilidad ante un corte de luz en ext4; en drvfs no aplica). | `store.js:83` |
| R16 | Bajo | Los enlaces simbólicos dentro de la carpeta se siguen al leer: un enlace a un fichero externo se vería en la UI (al escribir se sustituye el enlace, no se escribe fuera). | `store.js:31-36` |
| R17 | Bajo | `pid` escrito sin atomicidad; el manejador de `SIGINT` es `async` sin `catch` (rechazo no capturado al parar si `cerrar` falla). | `src/cli/sistema.js:23`, `bin/planner.js:58-65` |
| R18 | Bajo | Zona horaria: el núcleo usa UTC; solo `fechaDe`/`ahora` usan la hora local (a propósito). Se verifica en Q1 con 3 zonas. | `core/fechas.js:37`, `web/estado.js:26-27` |

## 5. Revisión estática rápida (sospechosos)

| Búsqueda | Resultado |
|---|---|
| `innerHTML` con datos del usuario sin escapar | Todo el HTML pasa por la plantilla `html` (escapa). Excepciones: **R7** (`graficos.js:36`, nombre del tema en `aria-label` dentro de `raw()`) y **R8** (`tema.js:35`, valores de `tema.md` en `style`). El resto de `raw()` lleva colores calculados por `core/color.js`, números o HTML ya escapado. La inyección del tema en `index.html` (`server/index.js:13-16`) solo admite valores validados y la CSS sin `<`. |
| Escrituras no atómicas | Datos: todas por `store.escribirTexto` (tmp → fsync → rename). No atómicas, sin riesgo para los datos: `pid` (`sistema.js:23`), `.gitignore` del modo git (`copias.js:51`), copias (`cpSync`). Atomicidad **entre** ficheros: no hay (**R1**, **R4**). |
| Fechas con zona horaria | `fechaDe(new Date())` en `api.js:23`, `server/index.js:13`, `copias.js:10`, `web/estado.js:26`, `plugin/scripts/planner.mjs:13`; `getHours` en `web/estado.js:27`. Intencionado (día local del usuario). El núcleo calcula en UTC (`fechas.js`). Tests dependientes del reloj: **R14**. |
| `catch` vacíos | Silencian sin informar al usuario: copia fallida (`api.js:67`, solo consola, **R5**); `store.leer(...).catch(() => null)` en la precarga (`api.js:39`: después se vuelve a leer y el error aparece, aceptable); `recomponer` en `web/estado.js:40` (el servidor manda, aceptable). El resto son de limpieza (temporales, PID, detección de WSL) o de validación (`ops.js:628/784`). |
| Promesas sin `await` | Intencionadas (disparar y olvidar): `cargar()` en `web/estado.js:83`, `irASemana` en `gestion/semanas.js:25`. Sin control: `process.on('SIGINT', salir)` con `salir` async (`bin/planner.js:64-65`, **R17**). |
| Además | 413 tras `destroy` (**R9**), `e.message` en 500 (**R10**), caché por `mtime` (**R3**), copia síncrona (**R6**). |

---

## 6. Qué se automatiza y qué no

| Se automatiza | Cómo |
|---|---|
| Q1–Q2 núcleo | `node:test` + generador propio (PRNG `mulberry32` con semilla, se imprime al fallar; `PLANNER_SEMILLA` para repetir). Q1 se ejecuta también con `TZ=UTC`, `Europe/Madrid` y `America/Los_Angeles` y se comparan las salidas. |
| Q3 servidor | Servidores reales en puertos libres con copias en `os.tmpdir()`. SIGKILL: proceso hijo que escribe en bucle y el padre lo mata 200 veces a tiempos aleatorios. ENOSPC/EACCES: `mock.method` sobre `fs/promises` + `module.syncBuiltinESMExports()` (sin tocar el código). IP de la LAN: `os.networkInterfaces()` y conexión que tiene que fallar. |
| Q4 e2e | `@playwright/test` + Chromium; cada test con su servidor y su copia de `ejemplo/`; se comprueba siempre consola limpia y el Markdown final en disco. |
| Q5 visual | Capturas de referencia en `test/visual/` (Playwright `toHaveScreenshot`) para las vistas y modales en los 8 temas, 4 anchos y 3 zooms. |
| Q6 rendimiento | Generador de 3 años de datos (determinista) + mediciones; memoria del servidor con `--expose-gc` y heap snapshots, la de la pestaña con CDP (`HeapProfiler`). |
| Q8 validador | `pnpm qa:validar -- --datos <ruta>`: copia a temporal, parsea, ida y vuelta, informe. Nunca escribe en el original. |

| No se automatiza (o solo en parte) | Por qué |
|---|---|
| Instalar como app, reiniciar Windows, arranque con el `.vbs`, editar con el Bloc de notas y Obsidian | Necesita tu escritorio de Windows: va a `QA-CHECKLIST.md` (Q7). El `.vbs` sí se revisa (sintaxis, ventana oculta). |
| Abrir el navegador de verdad (`wslview`, `explorer.exe`) | Se prueba la cadena de intentos con ejecutables falsos en el `PATH`; abrir una ventana real no es comprobable en CI. |
| Latencia de `/mnt/d` | Medirla exige escribir en `/mnt/d`. Propongo un directorio temporal propio, p. ej. `/mnt/d/GitHub/planner/.tmp-qa/` (ignorado por git) y nunca `/mnt/d/planner` — **necesito tu OK**. |
| Comparación píxel a píxel con la maqueta | La maqueta usa otros datos y otro marco: la comparación es visual y se apuntan las diferencias, no un test automático. |
| Lighthouse | Es otra dependencia; uso la comprobación de instalabilidad de Chromium (`Page.getInstallabilityErrors`). |

Herramienta e2e: Playwright descargará Chromium para Linux. En WSL puede faltar alguna biblioteca del sistema (`playwright install-deps` pide `sudo`). Si pasa, te lo diré y propondré alternativas antes de seguir.

---

## 7. Decisiones dudosas ya conocidas (para que decidas)

| # | Decisión actual | Alternativa |
|---|---|---|
| D1 | `tareas_hoy` cuenta solo las tareas **abiertas** de Hoy | contar también las hechas (maqueta) |
| D2 | Cierre del día: «mañana» deja la tarea en Hoy | moverla a Más adelante con fecha de mañana (maqueta) |
| D3 | Proponer reparte las piezas por rondas; «sin preferencia» prefiere ≥ 9:00; «justo después de trabajo > 4 h» = 30 min; con factor < 1 reserva menos que la pieza (plan literal) | orden estricto por tema; sin preferencia horaria; nunca reservar menos que la pieza (maqueta) |
| D4 | Semana que empieza en domingo: Proponer de la semana N usa el domingo de N, que se ve en la vista siguiente | proponer en el domingo visible (semana anterior) |
| D5 | Formato ampliado con `## Estudio` (horas de la semana nueva) y `## Notas` (plugin) | otro sitio |
| D6 | Cerrar semana: «a la semana nueva» copia el bloque al mismo día y hora (puede solapar); si N+1 ya pasó, usa la actual | dejarlo como sugerencia para que Proponer lo coloque |
| D7 | Un tipo usado en cualquier semana (aunque sea de hace años) no se puede borrar | contar solo semanas no cerradas, plantilla y tareas |
| D8 | Horas «hechas» = duración + diferencia (`hecho: +30m` suma 30 min) | contar la duración planificada |
| D9 | Los modos de copia son excluyentes (git o «al cerrar semana» sin diaria) | diaria siempre + el modo elegido |
| D10 | Se puede cerrar la semana actual el sábado o el domingo desde Gestión | solo semanas pasadas |

---

## 8. Plan por fases y scripts

| Fase | Entregable |
|---|---|
| Antes de Q1 | **R1–R3** (posible pérdida de datos): un test que lo demuestre y su `fix(...)`, por prioridad absoluta |
| Q1 | Propiedades y hostiles de los 10 formatos + fechas en 3 zonas horarias |
| Q2 | Basado en modelo (≥ 1.000 secuencias) + Proponer, factor, captura (≥ 60), carriles, capacidad, semanas, progreso, color |
| Q3 | API, concurrencia, disco, copias, seguridad, CLI |
| Q4 | e2e Playwright |
| Q5 | Visual, temas, anchos y zoom |
| Q6 | Rendimiento y memoria |
| Q7 | Entorno real + `docs/QA-CHECKLIST.md` |
| Q8 | `pnpm qa:validar` (solo con permiso) |

Scripts que se añadirán: `test` (unitarias, propiedades y API, como ahora), `test:e2e`, `test:visual`, `test:todo` (todo en orden). Informe vivo en `docs/QA-INFORME.md`. Criterio de cierre: `pnpm test:todo` en verde tres veces seguidas, sin reintentos.
