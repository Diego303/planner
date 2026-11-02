# planner · Diseño técnico (F0)

Complementa a [`PLAN.md`](PLAN.md). Aquí está lo que el plan deja abierto: estructura final, gramática exacta de cada fichero, catálogo de operaciones con sus inversas, riesgos y decisiones tomadas por defecto.

---

## 1. Estructura final

La del plan, con estos añadidos (todos justificados por separar responsabilidades, no por ampliar alcance):

```
planner/
├── bin/planner.js              # CLI (start | stop | status | flags)
├── src/
│   ├── core/                   # puro e isomórfico (lo sirve el servidor en /core/)
│   │   ├── fechas.js           # semanas ISO, días, horas ⇄ minutos, textos de fecha
│   │   ├── formato/
│   │   │   ├── comun.js        # líneas, campos, comentarios, conservación del texto original
│   │   │   ├── index.js        # ruta → formato (parse/serialize); incluye inbox.md
│   │   │   ├── semana.js       # semanas/AAAA-Www.md
│   │   │   ├── tareas.js       # tareas.md y archivo/tareas-AAAA-MM.md (misma gramática de tarea)
│   │   │   ├── tipos.js        # tipos.md y plantilla.md
│   │   │   └── listas.js       # `- clave: valor`: ajustes, estudio, proyectos, diario y tema
│   │   ├── modelo.js           # constantes, valores por defecto, accesores y validación
│   │   ├── ops.js              # operaciones puras con inversa
│   │   ├── captura.js  carriles.js  capacidad.js  factor.js  proponer.js
│   │   ├── semanas.js  progreso.js  color.js
│   ├── server/
│   │   ├── http.js             # servidor, estáticos, cabeceras de seguridad
│   │   ├── api.js              # rutas /api/*
│   │   ├── store.js            # lectura con caché por mtime, escritura atómica, versiones
│   │   ├── estado.js           # compone la respuesta de /api/estado (semanas, métricas)
│   │   ├── copias.js           # copias rotativas y git local opcional
│   │   ├── deshacer.js         # últimas 20 inversas
│   │   └── index.js            # composición: servidor + tema inicial + métricas del dominio
│   └── cli/
│       ├── args.js             # lectura de argumentos y ayuda
│       └── sistema.js          # PID, puerto libre, abrir navegador (wslview / explorer.exe), copia de ejemplo/
├── web/
│   ├── index.html  styles.css  app.js  manifest.webmanifest  icon.svg  icon-192.png  icon-512.png
│   ├── estado.js  api.js       # almacén del cliente (ops optimistas, sondeo) y fetch
│   ├── temas/                  # un CSS de tokens por tema
│   ├── vistas/                 # semana.js  editor-bloque.js  hoy.js  progreso.js
│   ├── gestion/                # semanas.js  cerrar-semana.js  plantilla.js  tipos.js  ajustes.js  tema.js  onboarding.js
│   └── ui/                     # dom.js  popover.js  modal.js  toast.js  cajon.js  graficos.js  captura.js
├── ejemplo/                    # datos inventados (nunca reales)
├── scripts/                    # check.js, iconos.js, windows/
├── plugin/                     # F11 (opcional)
├── test/                       # node:test, un fichero por módulo
└── docs/                       # PLAN.md, DISENO.md, maquetas/
```

- `web/estado.js` y `web/api.js` sacan de `app.js` el almacén y la red para que `app.js` solo orqueste.
- `web/vistas/editor-bloque.js` separa el popover del bloque (es la pieza más grande de la vista Semana).
- `server/estado.js` compone el estado completo y las métricas; `api.js` se queda en rutas.
- Los formatos que comparten gramática comparten módulo (`listas.js`, `tareas.js` con el archivo, `tipos.js` con la plantilla) en vez de un fichero por formato: menos código repetido y una sola forma de leer `- clave: valor`.

## 2. Scripts de `package.json`

| Script | Comando | Para qué |
|---|---|---|
| `start` | `node bin/planner.js` | Arranca con la carpeta configurada |
| `dev` | `node --watch-path=src --watch-path=bin bin/planner.js --ejemplo --silencioso` | Copia `ejemplo/` a un temporal, reinicia al cambiar el servidor; `web/` se sirve sin caché |
| `test` | `node --test test/*.test.js` | Todos los tests (`node:test`) |
| `check` | `node scripts/check.js` | `node --check` de todo, core puro, sin colores fijos fuera de `web/temas/`, sin dependencias |

Sin dependencias de runtime ni de desarrollo.

---

## 3. Gramática de los ficheros

### 3.1 Reglas comunes

- UTF-8. Se conserva lo que traiga el fichero: BOM, `\r\n` y si termina o no en salto de línea. Los ficheros nuevos usan `\n` y terminan en salto.
- **Una línea = un elemento.** Cada línea se clasifica en: título `# …`, sección `## …`, vacía, elemento reconocido o **no reconocida**.
- **Conservación literal.** Cada línea reconocida guarda su texto original. Al escribir, si el elemento no ha cambiado se escribe tal cual (respeta alineaciones, `–`, orden de campos, comentarios); si ha cambiado, se escribe en forma canónica. Las líneas no reconocidas se escriben siempre tal cual y la UI las marca con «⚠ línea no reconocida».
- Elemento de lista: `- ` (también `* `) al principio de línea, sin sangría. Casilla: `[ ]`, `[x]` o `[X]`.
- Campos separados por `|` (espacios alrededor opcionales; la forma canónica es ` | `). Los primeros son posicionales; el resto, `clave: valor` o banderas. Las claves y banderas desconocidas se conservan, en su orden, al final.
- Comentario final: dos o más espacios (o un tabulador) + `# ` + texto. Se conserva. En valores tipados (números, fechas, opciones) basta un espacio.
- Hora `H:MM` o `HH:MM` entre `00:00` y `24:00`. Rango `HH:MM-HH:MM` (o con `–`), fin > inicio. Internamente, minutos desde las 00:00.
- Días `L M X J V S D` (también en minúscula). Fechas `AAAA-MM-DD` válidas.
- Números: `4,5` o `4.5` al leer; se escriben con coma. Duración: `45m`, `2h`, `1h30`. Diferencia (`hecho:`): `0`, `+30m`, `-30m`, `+1h`, `+1h30`.
- Texto que viene de la UI se limpia antes de escribir: sin saltos de línea, sin `|` (pasa a `/`) y sin espacios dobles. Así nunca crea campos ni comentarios por accidente.
- Clave repetida en el mismo bloque: vale la primera; las siguientes quedan como no reconocidas.

### 3.2 `ajustes.md`

```
# Ajustes                              ← opcional
- clave: valor                         ← una por línea
```

| Clave | Valores | Defecto |
|---|---|---|
| `capacidad` | entero 50–100 (%) | 70 |
| `tareas_hoy` | entero 1–20 | 5 |
| `horas` | `H-H`, 0 ≤ desde < hasta ≤ 24 | `7-24` |
| `cierre` | `HH:MM` | `22:30` |
| `inicio_semana` | `lunes` · `domingo` (solo la vista: con domingo se ve el domingo anterior, que vive en la semana ISO anterior) | `lunes` |
| `foco_max` | número de horas > 0 | 3 |
| `mejores_horas` | `sin preferencia` · `mañanas` · `tardes` · `noches` | `sin preferencia` |
| `margen` | `auto` · `fijo` | `auto` |
| `copias` | `diaria` · `al cerrar semana` · `git` | `diaria` |
| `puerto` | entero 1024–65535 | 4321 |
| `tema` | `nordico-claro` · `nordico-oscuro` · `automatico` · `papel` · `universo` · `halloween` · `alto-contraste` · `personalizado` | `nordico-claro` |
| `tema_temporada` | `sí` · `no` | `no` |
| `decoracion` | `sí` · `no` (decoración de Universo y Halloween) | `sí` |

Válidas: `- capacidad: 70`, `- horas: 7-24   # visibles`, `- tema: papel`.
No reconocidas: `- capacidad: mucho` (valor inválido), `- color: azul` (clave desconocida), `capacidad: 70` (sin guion).

### 3.3 `tipos.md`

```
# Tipos de bloque
- nombre | #RRGGBB [| trabajo] [| estudio]
```
`trabajo`: cuenta para la hora de desconexión (☾). `estudio`: subtipos, foco y simulacros. Nombres únicos sin distinguir mayúsculas.
Válidas: `- entreno | #A04E33`, `- estudio | #5B4E8C | estudio`.
No reconocidas: `- ocio | azul`, `- ocio`, `- | #A04E33`.

### 3.4 `plantilla.md`

```
# Plantilla de semana
- DIAS HH:MM-HH:MM | tipo | título [| tipo: aprender|repasar|simulacro] [| paso: …]
DIAS = día(,día)*            p. ej. L,M,X,J,V
```
Válidas: `- L,X,V 18:00-19:30 | entreno | Gimnasio`, `- S 10:30–12:00 | entreno | Gimnasio`.
No reconocidas: `- L-V 09:00-17:30 | trabajo | Trabajo` (rango de días), `- L 18:00 | entreno | Gimnasio` (sin fin), `- L 20:00-19:00 | x | y` (fin ≤ inicio).

### 3.5 `semanas/AAAA-Www.md` (semana ISO; existe `2026-W53`)

```
# Semana 45 · 2026-11-02 → 2026-11-08
estado: en curso | sin cerrar | cerrada | reabierta | planificada | solo plantilla

## Las 3
- [ ] texto [| rel: tema] [| si: obstáculo] [| entonces: acción]

## Bloques
- D HH:MM-HH:MM | tipo | título [| tipo: aprender|repasar|simulacro] [| paso: …] [| hecho: Δ] [| nota: 0–100] [| plantilla] [| sugerido]

## Estudio                ← opcional: horas de ESTA semana cuando difieren de estudio.md
- AI-102: 6 h

## Notas                  ← opcional: texto libre (lo escribe /planner:repaso); se enseña bajo la semana
- repaso: …

## Cierre
- estudio: 9/8 h · proyectos: 3/4 h · tareas: 18 · ánimo: 3,6     ← resumen (el que contenga « · »)
- funcionó: …
- cambio: …
```
- Orden canónico de campos de bloque: `tipo:`, `paso:`, `hecho:`, `nota:`, `plantilla`, `sugerido`, desconocidos.
- **Tema** del bloque = texto antes del primer ` · ` del título. `★` no se guarda.
- `estado:` solo manda para `cerrada` y `reabierta`; el resto se calcula con la fecha (§4.5 del plan).
- La sección `## Estudio` la escribe el paso 4 de «Cerrar semana» (horas por certificación de la semana nueva) y la usa Proponer. `## Notas` (texto libre) la usa el plugin opcional. Son las dos únicas ampliaciones del formato y son opcionales.

Válidas: `- L 09:00-17:30 | trabajo | Trabajo | plantilla`, `- J 20:00-21:00 | estudio | MLA-C01 · simulacro | tipo: simulacro | hecho: 0 | nota: 71`, `- [x] Simulacro ≥ 70 % | rel: MLA-C01`.
No reconocidas: `- Lunes 09:00-10:00 | x | y`, `- L 09:00-10:00 | trabajo` (sin título), `- L 22:00-01:00 | x | y` (cruza medianoche), `- [-] texto`.

### 3.6 `tareas.md` y `archivo/tareas-AAAA-MM.md`

```
## Hoy
- [ ] texto [| tipo] [| prioridad] [| las3] [| fecha: AAAA-MM-DD] [| dur: 1h30] [| creada: AAAA-MM-DD] [| hecha: AAAA-MM-DD]
## Más adelante
## Algún día
```
- Secciones sin distinguir mayúsculas ni tildes (`## Mas adelante` vale). Las tareas fuera de una sección conocida no se reconocen.
- El segundo campo es el tipo si no es `clave: valor` ni una bandera conocida (`prioridad`, `las3`).
- `hecha:` la pone el planner al marcar (sirve para «hoy avanzaste en» y para archivar al día siguiente). `creada:` la pone la captura (sirve para proponer archivar lo que lleva > 30 días sin fecha).
- El archivo mensual tiene `# Archivo de tareas · AAAA-MM` y tareas con la misma gramática.

Válidas: `- [ ] Revisar PR | trabajo | prioridad`, `- [x] Leer | estudio | hecha: 2026-11-02`, `- [ ] Renovar DNI | personal | fecha: 2026-10-30`.
No reconocidas: `- Revisar PR` (sin casilla), `- [ ] Algo | fecha: 30/10` (fecha inválida).

### 3.7 `estudio.md` y `proyectos.md`

```
## AI-102                                   ## huddle
- horas_semana: 5                           - siguiente: pestaña Mañana
- examen: 2026-12-12                        - estado: activo | pausado
- inicio: 2026-09-14                        - actualizado: 2026-11-01
- total: 40                                 - dejado: …
- previo: 10
- simulacros: 61 @2026-10-10, 66 @2026-10-24
- dejado: celda 14: falta comparar el reranking
```
Cada `## …` abre un tema/proyecto. Claves desconocidas, valores inválidos o líneas antes del primer `##` (salvo el título `#`) no se reconocen.

### 3.8 `diario/AAAA-MM-DD.md`

```
- ánimo: 1–5
- línea: texto
- avanzado: a; b; c
- mañana: texto
```
Se aceptan las claves sin tilde (`animo`, `linea`, `manana`); se escriben con tilde.

### 3.9 `inbox.md` y `tema.md`

- `inbox.md`: texto libre, nunca se marca nada. «n notas» = líneas no vacías que no son títulos. Desde la web: «💡 es una idea» añade `- texto`; «→ tarea» la quita de aquí y la pone en Más adelante.
- `tema.md`: `- base: nordico-oscuro` y `- <token>: valor` (`fondo`, `superficie`, `superficie-2`, `texto`, `texto-2`, `texto-3`, `borde`, `acento`, `acento-texto`, `aviso`, `aviso-fondo`, `ok`, `ok-fondo`, `peligro`, `sombra`, `radio`, `fuente`, `fondo-deco`). Valores sin `; { } < >`.

---

## 4. Operaciones (`core/ops.js`)

Todas son puras: `aplicar(mundo, op, ctx) → { mundo, inversa, tocados, resultado }`. `mundo.ficheros` es un mapa `ruta → documento | null`. `ctx = { hoy, ahora, factores, usoTipos }` (nunca leen el reloj). Los elementos se identifican por **índice de línea** dentro de su fichero; la versión del fichero garantiza que el índice es el bueno.

### 4.1 Primitivas (todas exactas: aplicar + inversa devuelve los mismos bytes)

| Primitiva | Inversa |
|---|---|
| `lineas.insertar {ruta, indice, lineas}` | `lineas.quitar {ruta, indice, n}` |
| `lineas.quitar {ruta, indice, n}` | `lineas.insertar` con las líneas quitadas (con su texto original) |
| `linea.cambiar {ruta, indice, cambios}` | `linea.cambiar` con los valores anteriores |
| `fichero.crear {ruta, doc}` | `fichero.borrar {ruta}` |
| `fichero.borrar {ruta}` | `fichero.crear` con el documento anterior |
| `lote {ops}` | `lote` con las inversas en orden inverso |

### 4.2 Operaciones de dominio (se compilan a primitivas; su inversa es un `lote`)

| Operación | Ficheros | Qué hace |
|---|---|---|
| `semana.crear {semana}` | semana, plantilla | Crea la semana desde la plantilla (solo actual o futura) |
| `bloque.crear {semana, bloque}` | semana | Añade al final de `## Bloques` (crea la sección si falta) |
| `bloque.editar {semana, id, cambios}` | semana (+ plantilla si se marca ↻) | Mover, estirar, aceptar sugerencia, título, tipo, subtipo, paso |
| `bloque.eliminar {semana, id}` | semana | Quita la línea |
| `bloque.duplicar {semana, id, dias}` | semana | Copia el bloque en otros días de la misma semana (idempotente; cuenta los solapes) |
| `bloque.mover {semana, id, destino, cambios}` | dos semanas | Lleva un bloque a otra semana (vista que empieza en domingo, «otra fecha…» del editor) |
| `bloque.hecho {semana, id, delta, nota?, cambios?}` | semana, estudio, proyectos | Marca hecho, guarda nota del simulacro, borra el `dejado` del tema, actualiza el proyecto |
| `bloque.desmarcar {semana, id}` | semana | Quita `hecho` y `nota` |
| `bloque.aMedias {semana, id, dejado, cambios?}` | estudio o proyectos | Guarda dónde lo dejaste |
| `las3.crear / editar / eliminar` | semana | Las 3 en línea (también el plan B `si` / `entonces`) |
| `las3.pasar {desde, a}` | dos semanas | Lleva Las 3 de una semana a otra |
| `semana.aplicarPlantilla {semana}` | semana | Añade lo que le falte de la plantilla (desde hoy en la actual) |
| `semana.quitarSugerencias {semana}` | semana | Borra las sugerencias no aceptadas |
| `semana.proponer {semana, horas?}` | semana | Borra sugerencias no aceptadas y añade las nuevas |
| `semana.reabrir {semana}` | semana | `estado: reabierta` |
| `semana.cerrar {semana, lecciones, decisiones, siguiente}` | semana N y N+1, tareas, estudio, proyectos, inbox, archivo | Cierre en 4 pasos |
| `tarea.crear / editar / marcar / mover / eliminar` | tareas | Captura, casilla, ↑ hoy / ↓ luego (`exceder: true` sube a Hoy aunque esté lleno) |
| `inbox.crear {texto} / eliminar / aTarea` | inbox, tareas | Ideas: apuntar, borrar o pasar a tarea (Más adelante) |
| `diario.editar {fecha, animo?, linea?, manana?}` | diario | Corrige un día pasado o de hoy; solo cambia lo que se manda |
| `dia.cerrar {fecha, animo, linea, manana, aplazar}` | diario, tareas, archivo | Cierre del día y archivo de tareas hechas antes de hoy |
| `estudio.crear / cambiar / eliminar` | estudio | Metas de estudio |
| `estudio.renombrar / proyecto.renombrar {id, nombre}` | estudio o proyectos, todas las semanas | Cambia el nombre y el prefijo «Nombre · …» de sus bloques, el `rel` de Las 3 y los objetivos |
| `proyecto.crear / cambiar / eliminar` | proyectos | Siguiente paso, pausar y reactivar |
| `plantilla.crear / editar / eliminar {…, aplicar?}` | plantilla (+ semanas actual y futuras con `aplicar`) | Gestión → Plantilla; respeta lo cambiado a mano |
| `tipo.crear / color / banderas` | tipos | Banderas trabajo/estudio |
| `tipo.renombrar {nombre, nuevo}` | tipos, todas las semanas, plantilla, tareas | Cambia el nombre en todas partes |
| `tipo.eliminar {nombre, pasarA?}` | tipos (+ semanas, plantilla, tareas con `pasarA`) | Sin `pasarA`, bloqueado si está en uso |
| `ajustes.cambiar {clave, valor}` | ajustes | Cualquier ajuste |
| `datos.inicializar {plantilla?}` | ajustes, tipos, plantilla | Onboarding |

Un test recorre todas las operaciones con datos de ejemplo y comprueba que `inversa(op(m)) = m` byte a byte.

---

## 5. Riesgos técnicos y mitigación

| Riesgo | Mitigación |
|---|---|
| **Sondeo en `/mnt/d`** (9P: cada `stat` cuesta ~1 ms) | Solo se hace `stat` de los ficheros que el cliente tiene cargados y de los directorios; el sondeo se pausa con la pestaña oculta. Lecturas con caché por `mtime + tamaño`. |
| **Escritura atómica en drvfs** (antivirus, indexador, OneDrive bloquean el `rename`) | `tmp → fsync → rename` con 3 reintentos ante `EBUSY/EPERM`; temporales con nombre `.<fichero>.tmp-*` que se limpian al arrancar. |
| **Zona horaria WSL ≠ Windows** | El navegador manda su `hoy`/`ahora` en cada petición; el servidor solo usa su reloj para las copias. |
| **Abrir el navegador desde WSL** | `wslview` → `explorer.exe` → `xdg-open`; si todo falla, se imprime la URL. |
| **localhost Windows → WSL** | Verificado: Chrome de Windows llega a `127.0.0.1` de WSL (red NAT con *localhost forwarding*). |
| **Instalación como app** | Manifest con iconos 192/512 PNG; Chrome/Edge actuales no exigen service worker. La app queda ligada al puerto: si 4321 está ocupado por otra cosa, se avisa. |
| **Arranque con Windows** | `wsl.exe -e bash -lc "planner --silencioso"` (shell de login para que `pnpm`/`nvm` estén en el PATH); el servidor corre en primer plano para que WSL no lo mate. |
| **Semana ISO 53 / cambio de año** | Identificador por año ISO (`2026-W53` = 28 dic – 3 ene); aritmética en UTC; tests de 2026-W53 → 2027-W01 y 2020/2026/2032. |
| **Contraste en temas oscuros** | `core/color.js` ajusta el texto del bloque hasta ≥ 4,5:1; un test recorre todos los temas × la paleta. |
| **Ediciones a mano con CRLF/BOM** | Se conservan; nunca se reescribe un fichero entero por normalizar. |
| **Dos instancias / pnpm dev con la real abierta** | `--ejemplo` no usa el fichero PID y nunca se engancha a la instancia real. |
| **Ficheros enormes o binarios** | > 1 MB o con bytes nulos: ignorados con aviso. |

## 6. Decisiones tomadas por defecto (preguntas de F0)

El usuario pidió avanzar sin paradas; estas son las preguntas que habría hecho y lo que se ha decidido:

1. **¿Playwright para un test de humo del navegador?** No se añade ninguna devDependency. Los tests son `node:test`; la comprobación visual se hace a mano (o con Chrome *headless* fuera del repo).
2. **Límite de `tareas_hoy`:** cuenta solo las tareas **abiertas** de Hoy (marcar una libera hueco).
3. **Horas por certificación del paso 4 de «Cerrar semana»:** se guardan en `## Estudio` de la semana nueva (sin tocar `horas_semana` de `estudio.md`).
4. **Proponer con «sin preferencia»:** prefiere de 9:00 al cierre para no proponer madrugones; «evitar justo después de trabajo > 4 h» = penaliza empezar en los 30 min siguientes.
5. **`--hoy AAAA-MM-DD`** (solo desarrollo): simula la fecha para probar semana 53, cierres o la maqueta (`--hoy 2026-11-02`).
6. **Carpeta real `/mnt/d/planner`:** no se toca en ninguna fase sin permiso explícito.

## 7. Temas (F9)

- Un CSS de tokens por tema en `web/temas/`; se cargan todos y el cambio es solo `data-tema` en `<html>` (instantáneo, sin recargar). El servidor lo inyecta al servir `index.html`, así la primera pintura ya sale con el tema (incluido el de temporada y el personalizado).
- Tokens añadidos a los del plan, necesarios para no tener colores fijos en los componentes: `--modo` (claro | oscuro | contraste, lo usa `core/color.js`), `--velo` (fondo de los modales), `--sombra-alta` (popovers y modales), `--enlace` («+ añadir») y `--borde-ancho` (1,5 px en alto contraste). Los demás matices (`--mut`, `--linea`…) se derivan con `color-mix()` en `styles.css`.
- Las miniaturas usan `data-tema-muestra="…"` (los selectores de cada tema también lo aceptan) y colorean sus bloques con `core/color.js`.
- `test/temas.test.js` lee los CSS y comprueba AA (≥ 4,5:1) del texto de bloque en todos los temas × la paleta, además de texto/fondo y acento.

## 8. Casos límite (§7 del plan) y cómo se cubren

| # | Caso | Cobertura |
|---|---|---|
| 1 | Bloques solapados: carriles + ⚠; Proponer nunca solapa | `semana-core.test.js` (carriles), `proponer.test.js` (invariantes de cada escenario) |
| 2 | Más de `tareas_hoy`: lo nuevo a Más adelante con aviso; «↑ hoy» y «hoy» en la captura lo ponen igualmente (`exceder`) | `ops.test.js` (Hoy lleno), `flexible.test.js` (`exceder`), `captura.test.js` (destino); e2e `hoy.spec`, `flexible.spec` |
| 3 | Tareas vencidas arriba en rojo | Vista Hoy (grupo «Vencidas» primero), revisado en captura de pantalla |
| 4 | Edición a mano con la web abierta; op en vuelo → 409 | `server.test.js` (409); sondeo cada 2 s por mtime/tamaño |
| 5 | Líneas mal escritas se conservan y se marcan | `formato.test.js` (todos los formatos); UI «⚠ línea no reconocida» |
| 6 | Semana cerrada por error: reabrir no cambia la siguiente | `cierre.test.js` |
| 7 | Semanas futuras se crean desde plantilla al abrirlas | `ops.test.js`; UI Gestión → Semanas → planificar |
| 8 | Semanas pasadas sin fichero: vacías y solo lectura | `semana-core.test.js` (estado «sin datos»), `ops.test.js` (rechazo) |
| 9 | Cambiar la plantilla no toca semanas existentes | `ops.test.js` (solo toca plantilla.md) |
| 10 | Borrar un tipo en uso: sin `pasarA`, bloqueado con explicación; la UI pregunta a qué tipo pasar sus usos | `ops.test.js`, `server.test.js` (422 «en uso»), `flexible.test.js` (`pasarA`), e2e `flexible.spec` |
| 11 | Bloque que cruza la hora visible máxima: se recorta al pintar | `capacidad.js` (`minutosVisibles`), `semana.js` (recorte al pintar, el fichero no cambia) |
| 12 | Semana ISO 53 y cambio de año | `fechas.test.js`, `proponer.test.js` (escenario 12), `semana-core.test.js` |
| 13 | Puerto ocupado → siguiente libre; segunda instancia → abre la primera | `cli.test.js` |
| 14 | Carpeta inexistente o vacía → onboarding | `cli.test.js` (`datos.vacia`), `ops.test.js` (`datos.inicializar`); probado en navegador |
| 15 | Fichero enorme o binario → ignorado con aviso | `server.test.js` |
| 16 | Sin muestras de factor → ×1,0 y «aún no hay datos» | `proponer.test.js` (factor), UI de Ajustes, Progreso y toast de «Hecho» |
| 17 | Estudio sin examen o sin total → solo horas semanales | `progreso.test.js` (`soloSemanal`) |
| 18 | Cambio de tema con popovers/modales abiertos; tema desconocido → nórdico claro + aviso | Tokens CSS (repintado sin cerrar), `temas.test.js` (aviso) |
| 19 | Tema personalizado con poco contraste: se aplica con aviso | Ajustes/Tema calculan el contraste del tema aplicado; `server.test.js` (inyección) |
