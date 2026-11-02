# planner · Plan de desarrollo

> Organizador personal **local, minimalista y sin IA en el día a día**. Una web en `localhost` servida por un servidor Node mínimo que lee y escribe **ficheros Markdown** en una carpeta tuya. Calendario semanal por horas totalmente editable, vista Hoy, metas de estudio y proyectos, cierre del día y de la semana, y una pestaña de Progreso. Claude Code es **opcional** (plugin de la última fase).

Referencia visual obligatoria: [`docs/maquetas/planner-nordico.html`](maquetas/planner-nordico.html). Ábrela en el navegador: es interactiva y define el aspecto, los textos y los flujos. Si este plan y la maqueta discrepan en algo **visual**, manda la maqueta; si discrepan en **comportamiento o datos**, manda este plan.

---

## 0. Principios

1. **Local y tuyo.** Todo vive en una carpeta de Markdown legible y editable a mano (por defecto `D:\planner` → `/mnt/d/planner` en WSL). Nada sale de tu máquina: sin red, sin telemetría, sin cuentas.
2. **Markdown es la fuente de verdad.** Cualquier caché (`.cache/`) es derivada y se puede borrar.
3. **Sin IA para usarlo.** Captura, propuesta de semana, cierres y métricas son código determinista.
4. **Cero dependencias de runtime.** Node ≥ 20 con módulos nativos (`node:http`, `node:fs`, `node:path`, `node:test`). Frontend en JS vanilla con módulos ES, sin framework y sin paso de build.
5. **Nunca romper ni perder datos.** Escritura atómica, copias automáticas, deshacer de 10 s, las líneas que no se entienden se conservan tal cual.
6. **Minimalismo.** Cada pantalla responde una pregunta: *Semana* → «¿cómo es mi semana?», *Hoy* → «¿qué hago ahora?», *Progreso* → «¿voy bien?». Todo lo nuevo es opcional y de un clic.
7. **Temas visuales.** Varios estilos completos (claro, oscuro, papel, universo violeta, Halloween…) que se cambian al momento. Todos los colores salen de variables CSS: ningún color fijo en componentes.
8. **Flujo de trabajo:** `pnpm`, rama `develop`, **un commit por fase** (conventional commits en español), nunca tocar `main` ni hacer push.

---

## 1. Arquitectura

```
navegador (localhost:4321)                  servidor Node (127.0.0.1)                carpeta de datos
┌──────────────────────────┐   GET/POST    ┌──────────────────────────┐   fs        ┌──────────────────────┐
│ web/ (HTML+CSS+JS ES)    │ ────────────▶ │ src/server  (http, api)  │ ──────────▶ │ semanas/2026-W45.md  │
│ importa src/core/*.js    │ ◀──────────── │ src/core    (parse, ops) │ ◀────────── │ tareas.md, …         │
│ sondeo /api/version 2 s  │               │ src/store   (atómico)    │             │ .copias/  .cache/    │
└──────────────────────────┘               └──────────────────────────┘             └──────────────────────┘
```

- **`src/core/` es isomórfico**: funciones puras sin E/S que usan tanto el servidor como el navegador (el servidor sirve `src/core/` como estáticos en `/core/`). Así parseo, operaciones, propuesta y métricas existen una sola vez.
- **Cambios = operaciones.** El navegador envía operaciones (`{op:'bloque.mover', …}`); el servidor las aplica sobre el modelo parseado con funciones de `core/ops.js`, serializa y escribe de forma atómica. Devuelve la nueva versión.
- **Sincronización por sondeo.** El navegador consulta `GET /api/version` cada 2 s (hash de mtimes + tamaños). Si cambió (otra pestaña o edición a mano), recarga el estado. Se usa sondeo y no `fs.watch` porque en `/mnt/d` desde WSL los eventos no son fiables.
- **Concurrencia optimista.** Cada operación lleva la `version` del fichero que modifica; si no coincide, el servidor responde `409` y el navegador recarga y avisa («Cambiaste el fichero fuera del planner, recargado»).

### Estructura del repo

```
planner/
├── package.json            # "type":"module", bin: planner, engines node>=20, sin dependencies
├── bin/planner.js          # CLI: start | stop | status | --datos | --puerto | --silencioso | --ejemplo
├── src/
│   ├── core/               # puro e isomórfico
│   │   ├── fechas.js       # semanas ISO, días, horas "HH:MM" ⇄ número
│   │   ├── formato/        # parse + serialize por fichero (semana, tareas, estudio, proyectos,
│   │   │                   #   plantilla, tipos, ajustes, diario)
│   │   ├── modelo.js       # tipos y validación
│   │   ├── ops.js          # operaciones puras (modelo, op) → {modelo, inversa}
│   │   ├── captura.js      # parser de «apunta algo»
│   │   ├── carriles.js     # solapes → carriles
│   │   ├── capacidad.js    # ocupación por día, aviso de foco
│   │   ├── factor.js       # lo que tardas de verdad
│   │   ├── proponer.js     # propuesta de semana determinista
│   │   ├── semanas.js      # estados, plantilla, transición, cierre
│   │   ├── progreso.js     # métricas de la pestaña Progreso
│   │   └── color.js        # mezcla de colores, color de bloque por tema, contraste WCAG
│   ├── server/
│   │   ├── http.js         # servidor, estáticos, seguridad
│   │   ├── api.js          # rutas /api/*
│   │   ├── store.js        # lectura/escritura atómica, versiones, conflictos
│   │   ├── copias.js       # copias rotativas y git local opcional
│   │   └── deshacer.js     # pila de inversas (10 s visibles, 20 en memoria)
│   └── cli/                # pid, puerto libre, abrir navegador (wslview / explorer.exe)
├── web/
│   ├── index.html  styles.css  app.js  manifest.webmanifest  icon.svg
│   ├── temas/              # un CSS de variables por tema: nordico-claro.css, nordico-oscuro.css, papel.css,
│   │                       #   universo.css, halloween.css, alto-contraste.css
│   ├── vistas/semana.js  hoy.js  progreso.js
│   ├── gestion/semanas.js  cerrar-semana.js  plantilla.js  tipos.js  ajustes.js
│   └── ui/popover.js  modal.js  toast.js  cajon.js  graficos.js (sparkline, bullet)
├── ejemplo/                # datos inventados para desarrollo y demo (NUNCA datos reales)
├── scripts/windows/        # planner-inicio.vbs + instrucciones
├── plugin/                 # F11 opcional: plugin de Claude Code
├── test/                   # node:test
└── docs/  PLAN.md  maquetas/planner-nordico.html
```

---

## 2. Carpeta de datos y formatos

Carpeta por defecto: `/mnt/d/planner` (configurable con `--datos` o en `ajustes.md`). Si no existe, el onboarding ofrece crearla.

```
planner/
├── ajustes.md   tipos.md   plantilla.md
├── tareas.md    estudio.md   proyectos.md   inbox.md
├── semanas/2026-W45.md
├── diario/2026-11-02.md
├── archivo/tareas-2026-11.md
├── .copias/     .cache/
```

### Reglas comunes de formato
- UTF-8, saltos `\n`, una entidad por línea.
- Campos de línea separados por ` | `. El primer o los primeros campos son posicionales; el resto son `clave: valor` o banderas sueltas.
- Horas `HH:MM-HH:MM` (también se acepta `–`). Días `L M X J V S D`. Fechas `AAAA-MM-DD`.
- **Línea no reconocida → se conserva exactamente** en su sitio al reescribir y se muestra en la UI con «⚠ línea no reconocida» y el texto original. Nunca se borra.
- El serializador produce un formato canónico estable: **parse → serialize → parse da el mismo modelo**, y serializar dos veces da los mismos bytes (los tests lo comprueban).

### `ajustes.md`
```markdown
# Ajustes
- capacidad: 70            # % máximo del día ocupado (50–100)
- tareas_hoy: 5
- horas: 7-24              # horas visibles
- cierre: 22:30            # fin de jornada y hora del cierre del día
- inicio_semana: lunes
- foco_max: 3              # h de estudio intenso al día antes de avisar
- mejores_horas: sin preferencia   # mañanas | tardes | noches
- margen: auto             # auto (usa el factor real) | fijo (solo capacidad)
- copias: diaria           # diaria | al cerrar semana | git
- puerto: 4321
- tema: nordico-claro      # nordico-claro | nordico-oscuro | automatico | papel | universo | halloween | alto-contraste | personalizado
- tema_temporada: no       # sí → Halloween del 25 al 31 de octubre y vuelve solo a tu tema
```

### `tipos.md`
```markdown
# Tipos de bloque
- trabajo | #3D5A80 | trabajo      # bandera «trabajo»: cuenta para la hora de desconexión
- estudio | #5B4E8C | estudio      # bandera «estudio»: subtipos, foco, simulacros
- proyectos | #2F6B4F
- entreno | #A04E33
- personal | #86651F
```
Paleta de 10 colores de la maqueta (`PAL`). Un tipo en uso no se borra sin más: al quitarlo se elige a qué tipo pasan sus bloques, plantilla y tareas. Se puede renombrar (cambia en todas partes).

### `plantilla.md`
```markdown
# Plantilla de semana
- L,M,X,J,V 09:00-17:30 | trabajo | Trabajo
- L,X,V 18:00-19:30 | entreno | Gimnasio
- S 10:30-12:00 | entreno | Gimnasio
- D 17:00-17:30 | personal | Cerrar semana
```

### `semanas/AAAA-Www.md`
```markdown
# Semana 45 · 2026-11-02 → 2026-11-08
estado: en curso          # en curso | sin cerrar | cerrada | reabierta (las futuras: planificada | solo plantilla)

## Las 3
- [ ] Entregar el lab de RAG | rel: Curso | si: el jueves llego tarde | entonces: lo hago el sábado a las 10
- [x] Simulacro MLA-C01 ≥ 70 % | rel: MLA-C01
- [ ] Cerrar la demo del agente | rel: agente soporte

## Bloques
- L 09:00-17:30 | trabajo | Trabajo | plantilla
- L 20:00-21:30 | estudio | AI-102 · visión | tipo: aprender | hecho: +30m
- M 19:30-21:00 | estudio | Curso · lab RAG | tipo: aprender | paso: abrir el notebook rag-eval y lanzar la celda 14
- J 20:00-21:00 | estudio | MLA-C01 · simulacro | tipo: simulacro | hecho: 0 | nota: 71
- D 10:00-11:30 | estudio | Curso · repasar | tipo: repasar | sugerido

## Cierre
- estudio: 9/8 h · proyectos: 3/4 h · tareas: 18 · ánimo: 3,6
- funcionó: Estudiar antes de cenar rinde más que después.
- cambio: Nada de simulacros los jueves.
```
- **Tema** de un bloque = texto antes del primer ` · ` del título (`Curso · lab RAG` → `Curso`). Así se enlazan bloques con `estudio.md` y `proyectos.md`.
- `hecho: <delta>` con delta ∈ `-30m | 0 | +30m | +1h`. Sin `hecho` = no hecho.
- `plantilla` = vino de la plantilla (editarlo aquí solo afecta a esta semana).
- `sugerido` = sugerencia de «Proponer» aún no aceptada (se muestra con borde discontinuo; al cerrar la semana se descartan las no aceptadas).
- `★` no se guarda: se calcula (`rel` de Las 3 coincide con el tema).

### `tareas.md`
```markdown
## Hoy
- [ ] Revisar PR del pipeline de evaluación | trabajo | prioridad
- [x] Leer: chunking y reranking | estudio
## Más adelante
- [ ] Preparar demo del agente de soporte | trabajo | fecha: 2026-11-03
- [ ] Simulacro MLA-C01 | estudio | fecha: 2026-11-05 | dur: 1h30
## Algún día
- [ ] Aprender Rust | estudio
```
- Grupos de «Más adelante» calculados: Vencidas (fecha < hoy), Con fecha, Sin fecha. Algún día es su propia sección.
- `★` en tareas: calculado si el texto contiene el `rel` de alguna de Las 3, o marcado a mano con la bandera `las3`.
- Las tareas hechas se mueven a `archivo/tareas-AAAA-MM.md` al cerrar el día siguiente. Las de «Más adelante» sin fecha con más de 30 días se proponen para archivar en el cierre de semana (nunca automático).

### `estudio.md`
```markdown
## AI-102
- horas_semana: 5
- examen: 2026-12-12
- inicio: 2026-09-14
- total: 40             # horas objetivo totales
- previo: 10            # horas hechas antes de usar el planner (opcional)
- simulacros: 61 @2026-10-10, 66 @2026-10-24, 72 @2026-11-05
- dejado: celda 14: falta comparar el reranking con y sin filtro
```

### `proyectos.md`
```markdown
## huddle
- siguiente: pestaña Mañana
- estado: activo        # activo | pausado
- actualizado: 2026-11-01
- dejado: …
```
«Parado» = `actualizado` hace más de 10 días (se avisa en lateral y en el cierre de semana).

### `diario/AAAA-MM-DD.md`
```markdown
- ánimo: 4
- línea: Día tranquilo, buen ritmo de estudio.
- avanzado: AI-102 · visión; Leer: chunking y reranking
- mañana: Curso: abrir el notebook rag-eval y lanzar la celda 14
```

### `inbox.md`
Texto libre. El planner no lo interpreta (lo usa el plugin opcional `/planner:ordenar`). En la UI se muestra «INBOX: n notas» si no está vacío. *Tras el uso:* «💡 es una idea» en la captura añade una línea, y la tarjeta «Ideas» de Hoy las lista con «→ tarea» (a Más adelante) y «×».

---

## 3. Vistas y comportamiento (ver maqueta)

### Barra superior
Logo · selector **Semana / Hoy / Progreso** · **«apunta algo…»** centrado · **Gestión ▾** (punto naranja si hay una semana pasada sin cerrar).

### Semana
- Cabecera: rango («2 – 8 nov»), «semana 45», estado en pastilla, ‹ hoy ›, **Proponer semana**. A la derecha, «más adelante · n», «n sugerencias», «⚠ n solapes».
- Banda de estado (cerrada / sin cerrar / reabierta / futura) con su acción (Reabrir / Cerrar ahora).
- **Las 3** como pastillas marcables y editables en línea; «si→» abre su plan B (si … → entonces …). «Quitar sugerencias» borra lo propuesto no aceptado.
- Rejilla 7 días × horas visibles (`PX` = 23 px/h). Bajo cada día, línea de **ocupación** (verde ≤ capacidad, ámbar ≤ capacidad + 15, rojo más) y aviso «x h estudio» si supera `foco_max`.
- Bloques: color del tipo al 11 % de fondo con texto del color. Marcas: `↻` plantilla, `★` avanza las 3, `◎` simulacro, `⟲` repaso, `☾` trabajo después de `cierre` (rayado gris), `⚠` solape (anillo rojo), discontinuo = sugerido, tachado = hecho.
- Interacción: doble clic en hueco → bloque de 1 h y editor; arrastrar → mover (ajuste a 30 min y a día); borde inferior → duración; clic → editor. Semanas cerradas: solo lectura.
- **Editor de bloque (popover):** título, tipo (o «＋ nuevo»), subtipo de estudio (aprender / ⟲ repasar / ◎ simulacro), día u «otra fecha…» (otra semana), de qué hora a qué hora (aviso si cae fuera de las horas visibles, con «Ver de X a Y»), **primer paso** (opcional), ↻ en plantilla, «Duplicar en otros días…» y, si ya está hecho, «Cuánto duró de verdad» para corregirlo. Aviso arriba si hay `dejado` para ese tema. Botones: Guardar, **Hecho ✓**, **A medias**, Eliminar (con deshacer).
  - **Hecho ✓** → paso 2: «¿Cuánto duró de verdad?» (menos / lo previsto / +30 min / +1 h o más); si es simulacro, campo nota %. Un clic guarda y borra el `dejado` del tema.
  - **A medias** → «¿Dónde lo dejaste?» → guarda `dejado` en estudio.md/proyectos.md.

### Hoy
- Columna 1: horario del día (desde los bloques del día) con «ahora», Las 3 con su «si → entonces» e **Ideas** (las notas de `inbox.md`, con «→ tarea» y «×»).
- Columna 2: **Tareas de hoy** (máx. `tareas_hoy`, contador n/5, «↓ luego»), **Más adelante** con recordatorio de Las 3 arriba y grupos, «↑ hoy» que con Hoy lleno sube igualmente avisando (*cambiado tras el uso*: antes se deshabilitaba), y **Cierre del día**:
  1. *Hoy avanzaste en* (bloques y tareas hechos, automático).
  2. *Lo que no hiciste* → mañana / más adelante.
  3. *¿Cómo ha ido?* 1–5 + una línea.
  4. ***Mañana empiezo por…*** — prellenado con el `paso` del primer bloque no laboral de mañana (o su título, o la primera tarea abierta). **Siempre es lo último** (efecto de escribir lo pendiente antes de dormir).
  Al cerrar: escribe `diario/AAAA-MM-DD.md` y muestra «☾ a partir de ahora, nada de trabajo».
- Cajón derecho: Metas y Diario (sin la pestaña Hoy para no duplicar).

### Cajón derecho (vistas Semana y Hoy)
Pestañas **Hoy · Metas · Diario**.
- *Hoy*: ahora / después, tareas, «Abrir Hoy →».
- *Metas*: frase de **constancia** (días con estudio esta semana · semanas con estudio de las anteriores; nunca rachas). Estudio por certificación: barra planificado/hecho, **«llevas X h» mientras < 50 % del objetivo semanal y «te faltan Y h» desde el 50 %**, fecha, «faltan n h por planificar», últimos 3 simulacros y aviso «◎ sin simulacro hace n semanas» (≥ 2). Proyectos con siguiente paso editable en línea y «parado». ✎ en cada estudio (nombre, horas, examen, total, añadir simulacro) y proyecto (nombre, siguiente paso, pausar y reactivar), con un solo «deshacer».
- *Diario*: ánimo de 7 días + últimas líneas; pulsar un día abre su ánimo, línea y «mañana» para escribirlos o corregirlos.

### Progreso (sin cajón, ancho completo)
1. **Certificaciones y curso**: por cada una, *bullet graph* (relleno = horas acumuladas, zona clara + marca = donde deberías ir hoy), texto llevas/te faltan y «+n h sobre lo previsto / n h por detrás»; barras de horas de 8 semanas; sparkline de simulacros con línea del 70 % (o aviso si no hay).
2. **Plan frente a real** de la última semana cerrada por tipo (contorno = plan, relleno = hecho) y tarjetas **«Lo que tardas de verdad»** (×factor y nº de bloques) con la frase «Si planificas 1,5 h de estudio, Proponer reserva 2 h».
3. **Constancia**: rejilla del curso (16 semanas; intensidad por horas; actual con contorno; futuras discontinuas) y barras de estudio total por semana (8) con línea de meta.
4. **Ánimo y horas**: dos sparklines de 8 semanas y la frase comparativa («semanas con ≥ mediana h: ánimo x · con menos: y») con la nota «es una correlación, no una causa».
5. **Lecciones** de cada cierre (✓ funcionó · → cambio).
Reglas visuales: sin tartas ni velocímetros; color solo para tipos y un ámbar de aviso.

### Gestión ▾
- **Semanas**: lista de −4…+5 semanas con estado (✓ cerrada, ! sin cerrar, ● en curso, ◐ planificada, ↻ solo plantilla, ○ sin planificar) y acciones ver / reabrir / cerrar / planificar; «Ir a la semana del…» cualquier fecha.
- **Cerrar semana N** (asistente de 4 pasos, nada se arrastra en silencio):
  1. *Resumen*: horas por tipo vs plan, tareas, ánimo, Las 3; tarjeta de **lo que tardas de verdad**; **dos lecciones** (qué funcionó · qué cambio).
  2. *Pendientes*: cada bloque no hecho, horas de estudio que faltaron, tarea vencida, proyecto parado, INBOX → decisión por fila con botones.
  3. *Proyectos y algún día*: siguiente paso de cada proyecto; repaso de Algún día.
  4. *Nueva semana*: Las 3 de N+1 con «si … → entonces …» opcional; horas de estudio por certificación con aviso de ritmo hasta el examen. Botón **Cerrar y planificar la semana N+1** → escribe `## Cierre`, `estado: cerrada`, descarta sugerencias no aceptadas, crea N+1 desde plantilla si no existe y ejecuta Proponer.
- **Plantilla de semana**: lista + alta (título, tipo, días, hora, duración, subtipo si es de estudio, primer paso) + quitar (con deshacer). Las semanas nuevas se crean con ella; al añadir o quitar una entrada, por defecto también cambia la semana actual (desde hoy) y las futuras ya creadas (añade aunque se solape; quita solo los bloques que siguen tal cual). En la semana, «↻ Aplicar plantilla» añade lo que falte. Cada entrada se puede editar (días, horas, título, tipo); el cambio llega a esas semanas donde el bloque sigue tal cual (mismo día, horas, título, tipo, subtipo y primer paso) y lo cambiado a mano se respeta. Horas libres («de … a …») en la plantilla y en el editor de bloque, sin duraciones fijas. Las semanas pasadas y cerradas no cambian nunca.
- **Tipos de bloque**: color (paleta), alta, renombrar (pulsando el nombre; cambia en semanas, plantilla y tareas), banderas «cuenta como ☾ trabajo / 📚 estudio» y quitar (si está en uso, se elige a qué tipo pasan sus usos).
- **Ajustes**: todos los de `ajustes.md`, aplicados al momento (horas visibles de 0 a 24; cierre a cualquier hora, escrita como «22:30»).
- **Atajos de teclado**: la lista (también con `?`).
- Pie: «Guardado en ~/planner · copia diaria».

### Temas visuales
Seis temas completos más «automático» (sigue claro/oscuro del sistema) y uno personalizado. **La maqueta muestra solo Nórdico claro**: el resto se construye con los tokens de esta tabla manteniendo exactamente la misma estructura, tamaños y tipografía (salvo Papel, con serifa).

**Tokens** (variables CSS en `:root[data-tema="…"]`): `--fondo`, `--superficie` (tarjetas), `--superficie-2` (chips, pistas de barras), `--texto`, `--texto-2`, `--texto-3`, `--borde`, `--acento` (botón principal, selección), `--acento-texto`, `--aviso`, `--aviso-fondo`, `--ok`, `--ok-fondo`, `--peligro`, `--sombra`, `--radio`, `--fuente`, `--fondo-deco` (decoración opcional).

| Tema | fondo | superficie | superficie-2 | texto / 2 / 3 | borde | acento / texto | aviso · ok · peligro | Notas |
|---|---|---|---|---|---|---|---|---|
| **Nórdico claro** (por defecto) | `#F6F6F3` | `#FFFFFF` | `#F3F3EF` | `#1E2320` `#6B706B` `#A3A8A2` | `#EEEEEA` | `#1E2320` / `#FFFFFF` | `#A9681E` · `#2F6B4F` · `#C2493A` | Es la maqueta |
| **Nórdico oscuro** | `#141716` | `#1C201E` | `#252A27` | `#E8EBE7` `#A4ABA4` `#6E756F` | `#2A302C` | `#E8EBE7` / `#141716` | `#E0A25A` · `#7FC29B` · `#E07A6B` | Sombras casi nulas; bordes en su lugar |
| **Papel** | `#EFE9DE` | `#FBF8F1` | `#F3EDE1` | `#2B2620` `#7A6F5F` `#A69B88` | `#E7DFD0` | `#2B2620` / `#FBF8F1` | `#9A5B1E` · `#4C7A5E` · `#9A3B2E` | `--fuente`: Iowan Old Style / Palatino / Georgia; radios 6 |
| **Universo** (violeta oscuro) | `#0E0A1F` | `#171130` | `#211A42` | `#ECE8FF` `#A9A1D6` `#6F68A0` | `#2A2250` | `#B69CFF` / `#0E0A1F` | `#FFC27A` · `#7EE0B5` · `#FF8A8A` | `--fondo-deco`: campo de estrellas estático con `radial-gradient` (puntos de 1 px, opacidad ≤ 0,5) y un halo violeta suave arriba; tarjetas con borde `#2A2250` |
| **Halloween** | `#141010` | `#1E1715` | `#2A201C` | `#F3E9DF` `#BFA894` `#7E6A5C` | `#33261F` | `#FF7A1A` / `#141010` | `#FFB347` · `#9CCB6B` · `#FF5A4E` | Decoración sutil y desactivable: murciélago pequeño junto al logo y telaraña de trazo fino en una esquina del calendario (SVG inline, opacidad 0,15). Nada animado |
| **Alto contraste** | `#000000` | `#0A0A0A` | `#1A1A1A` | `#FFFFFF` `#E0E0E0` `#BDBDBD` | `#FFFFFF` | `#FFE500` / `#000000` | `#FFB000` · `#00E08A` · `#FF5C5C` | Bordes de 1,5 px, sin transparencias en bloques |

**Colores de los tipos de bloque en cada tema** (`core/color.js`): el color guardado en `tipos.md` es la base.
- Temas claros: fondo del bloque = color al 11 %, texto = color base.
- Temas oscuros: fondo = color al 22 % sobre `--superficie`, texto = color base mezclado un 45 % con blanco.
- Alto contraste: fondo = color al 35 %, texto `#FFFFFF`.
- Todos los pares texto/fondo resultantes deben cumplir **WCAG AA (≥ 4,5:1)** para texto de bloque; `color.js` ajusta la mezcla hasta cumplirlo, y un test recorre todos los temas × la paleta `PAL`.

**Selector de tema**: en Gestión ▾ → **Tema** (y también en Ajustes), una cuadrícula de miniaturas (fondo, tarjeta y tres bloques de muestra en cada tema) con el nombre debajo. Aplica al instante y guarda `tema:` en `ajustes.md`. Opción «Decoración del tema» (sí/no) para Universo y Halloween.

**Sin parpadeo**: el servidor inyecta `data-tema="…"` en el `<html>` al servir `index.html`, así la primera pintura ya sale con el tema correcto. Con `automatico`, `prefers-color-scheme` elige Nórdico claro u oscuro y reacciona si cambia el sistema.

**Tema personalizado**: `tema.md` opcional en la carpeta de datos con líneas `- fondo: #…`, `- acento: #…`, etc. (cualquier token de la tabla). Parte de un tema base (`- base: nordico-oscuro`) y solo sobrescribe lo indicado. Si un par no llega a AA, la UI avisa en Ajustes («El texto sobre tu fondo tiene poco contraste») pero lo respeta.

**Gráficos de Progreso** usan solo tokens (`--texto-3` para líneas de referencia, color del tipo para series), así funcionan en todos los temas.

### Captura «apunta algo» (sin IA)
Parser de reglas fijas con vista previa en chips antes de Enter:
- `#área` (prefijo de un tipo existente: `#pers` → personal) · `hoy | mañana | lun…dom | dd/mm` · `!` prioridad · `45m | 2h | 1h30` duración · `algún día`.
- Destino: *Algún día* si lo pone; *Hoy* si fecha = hoy o (sin fecha y sin área) y hay hueco; si no, *Más adelante*. Al guardar muestra «guardado en X ✓».
- El texto que queda (sin los tokens) es el título. Si queda vacío, no guarda.

---

## 4. Algoritmos (core, puros y con tests)

### 4.1 Carriles y solapes (`carriles.js`)
Agrupa bloques de un día por intersección transitiva; dentro de cada grupo asigna carril mínimo libre; `n` = carriles del grupo; `solapa` si `n > 1`. Los sugeridos no cuentan como solape.

### 4.2 Capacidad y foco (`capacidad.js`)
`ocupación(d) = Σ duración de bloques no sugeridos del día / (horas visibles)`. Colores según `capacidad`. `estudio(d) = Σ duración de bloques de tipo estudio`; aviso si `> foco_max`.

### 4.3 Lo que tardas de verdad (`factor.js`)
- Muestras: bloques con `hecho` de las últimas 8 semanas. `ratio = (dur + delta) / dur` (delta: −0,5 / 0 / +0,5 / +1 h).
- `factor(tipo)` = media de ratios; si hay < 5 muestras → 1,0. Acotar a [0,7 · 2,0]. Redondear a 0,1 para mostrar.

### 4.4 Proponer semana (`proponer.js`, determinista)
Entrada: semana, estudio, proyectos, Las 3, ajustes, factores. Salida: lista de bloques `sugerido`.
1. Quitar las sugerencias anteriores no aceptadas.
2. **Necesidades**:
   - Estudio: `resto = horas_semana − horas planificadas del tema`. Trocear en piezas de 1,5 h (la última de 1–1,5 h; nunca < 1 h). Subtipo: si el tema lleva ≥ 2 semanas sin simulacro y no hay uno planificado, la primera pieza es `simulacro`; las demás alternan `aprender` / `repasar`.
   - Proyectos activos sin bloque esta semana: una pieza de 1,5 h titulada `nombre · siguiente paso`.
3. **Orden**: primero lo que avanza Las 3 (`rel`), luego estudio con examen más cercano, luego proyectos.
4. **Duración reservada** `L = min(2,5, redondeo_30min(pieza × factor(tipo)))` si `margen: auto`; si no, `L = pieza`.
5. **Candidatos**: inicios cada 30 min dentro de horas visibles, con `inicio + L ≤ cierre`, sin solapar (con colchón de 15 min) ningún bloque existente.
6. **Restricciones duras**: ocupación del día ≤ capacidad + 10 %; estudio del día ≤ `foco_max`; **nunca el mismo tema dos veces el mismo día**; no tocar semanas cerradas ni días pasados.
7. **Puntuación** (menor es mejor): días con menos horas de ese tema primero (reparte), preferencia por `mejores_horas` (mañanas < 13 h, tardes 13–19, noches ≥ 19), evitar justo después de un bloque de trabajo de > 4 h (−15 min de margen), desempate por día y hora.
8. Toast: «n sugerencias · ★ primero lo que avanza las 3 · margen ×f en estudio · nunca el mismo tema dos veces en un día» con deshacer. Lo que no cabe se lista: «no caben 2 h de MLA-C01 → baja horas o sube capacidad».

### 4.5 Semanas (`semanas.js`)
- Semana ISO (lunes; `inicio_semana` solo cambia la visualización si se implementa domingo). Soportar semana 53.
- **Estados**: `en curso` (la actual); pasadas: `sin cerrar` | `cerrada` | `reabierta`; futuras: `sin planificar` (no existe fichero), `solo plantilla` (solo bloques `plantilla`), `planificada`.
- **Crear desde plantilla** al abrir por primera vez la semana actual o una futura. Las pasadas sin fichero se muestran vacías y en solo lectura («sin datos»).
- **Cerrar**: escribe `## Cierre` (resumen + lecciones), `estado: cerrada`, aplica las decisiones del paso 2 como operaciones, borra `sugerido`. **Reabrir** cambia a `reabierta` sin tocar otras semanas. Volver a cerrar regenera el resumen y solo añade sugerencias para lo que falte.

### 4.6 Progreso (`progreso.js`)
- `acumulado(tema) = previo + Σ horas hechas (bloques del tema con hecho) en todas las semanas`.
- `esperado(tema, hoy) = total × clamp((hoy − inicio) / (examen − inicio), 0, 1)`.
- Encuadre: `acumulado / total < 0,5` → «llevas», si no «te faltan» (igual en el semanal del cajón).
- Horas por semana (8), simulacros (serie), constancia (semanas con ≥ 1 bloque de estudio hecho; días con estudio esta semana), plan vs real por tipo (última cerrada), ánimo semanal (media de diario) y comparación con la **mediana** de horas de estudio.

---

## 5. Servidor, API y seguridad

- `127.0.0.1` únicamente. Comprobar cabecera `Host` (`localhost` / `127.0.0.1` + puerto) y `Origin` en peticiones con cuerpo (defensa contra *DNS rebinding*). Sin CORS. Límite de cuerpo 256 KB. Nada de rutas fuera de la carpeta de datos (`path.resolve` + comprobación de prefijo).
- Rutas:
  - `GET /` estáticos de `web/`, `GET /core/*` módulos de `src/core/`.
  - `GET /api/estado?semana=2026-W45` → modelo completo necesario para pintar (ajustes, tipos, plantilla, semana pedida + adyacentes, tareas, estudio, proyectos, diario 7–56 días, métricas de progreso) y `version` por fichero.
  - `GET /api/version` → hash global (sondeo).
  - `POST /api/op` → `{op, args, version}` → aplica, escribe, devuelve `{version, inversaId}`; `409` si la versión no coincide; `422` si la operación no es válida.
  - `POST /api/deshacer` → `{inversaId}`.
  - `GET /api/semanas?desde&hasta` → lista con estados.
- **Escritura atómica**: escribir `fichero.tmp` → `fsync` → `rename`. Una cola por fichero.
- **Copias**: antes de la primera escritura del día, copia la carpeta (sin `.copias`) a `.copias/AAAA-MM-DD/`; rota 14. Modo `git`: `git init` local en la carpeta de datos y un commit por cierre de día (nunca remoto).
- **Deshacer**: cada op devuelve su inversa; el toast la ofrece 10 s; el servidor guarda las últimas 20.
- **Errores visibles**: si el servidor no responde, banda «Servidor parado · solo lectura» y reintento cada 5 s.

## 6. CLI y arranque

- `planner` (= `planner start`): resuelve carpeta de datos, elige puerto (4321 o el siguiente libre), escribe PID en `~/.planner/pid`, abre el navegador con `wslview` o `explorer.exe` (vía `wslpath -w` si hace falta). Si ya está en marcha, solo abre la pestaña.
- `planner stop`, `planner status`, `--datos <ruta>`, `--puerto <n>`, `--silencioso` (no abre navegador), `--ejemplo` (copia `ejemplo/` a un directorio temporal y lo usa).
- Instalación: `pnpm install && pnpm link --global`.
- **App con ventana propia**: `manifest.webmanifest` (`display: standalone`, nombre, colores, `icon.svg` + PNG 192/512) para «Instalar planner» desde Edge/Chrome. `localhost` cuenta como origen seguro. Añadir un service worker mínimo solo si el navegador lo exige para instalar.
- **Arranque con Windows**: `scripts/windows/planner-inicio.vbs` ejecuta `wsl.exe -e bash -lc "planner --silencioso"` sin ventana; instrucciones para copiarlo a `shell:startup`.
- Scripts pnpm: `dev` (servidor con `--ejemplo` y recarga), `start`, `test` (`node --test`), `check` (lint ligero con `node --check` de todos los ficheros).

---

## 7. Casos límite (deben tener test o comprobación manual)

1. Bloques solapados: se permiten; carriles + ⚠; Proponer nunca solapa.
2. Más de `tareas_hoy` tareas: lo nuevo va a Más adelante con aviso; «↑ hoy» o «hoy» en la captura lo ponen igualmente, avisando.
3. Tareas vencidas → grupo Vencidas arriba en rojo.
4. Edición a mano mientras la web está abierta: sondeo recarga; si había una op en vuelo → `409` → recarga + toast.
5. Líneas mal escritas: se conservan y se marcan; ningún fichero se reescribe perdiendo texto.
6. Semana cerrada por error: Reabrir; la semana siguiente no cambia.
7. Navegar a semanas futuras: se crean desde plantilla solo al abrirlas; se pueden planificar.
8. Semanas pasadas sin fichero: vacías y solo lectura.
9. Cambiar la plantilla: no toca semanas existentes.
10. Borrar un tipo en uso: bloqueado con explicación.
11. Bloque que cruza la hora visible máxima: se recorta al pintar, no al guardar.
12. Semana ISO 53 y cambio de año (2026-W53 → 2027-W01).
13. Puerto ocupado → siguiente libre. Dos instancias → la segunda abre la pestaña de la primera.
14. Carpeta de datos inexistente o vacía → onboarding.
15. Fichero muy grande o binario en la carpeta → ignorado con aviso.
16. Sin muestras de factor → ×1,0 y texto «aún no hay datos».
17. Estudio sin `examen` o sin `total` → Progreso muestra solo horas semanales.
18. Cambio de tema con popovers o modales abiertos: se repintan sin cerrarse. Tema desconocido en `ajustes.md` → Nórdico claro y aviso.
19. Tema personalizado con contraste insuficiente: se aplica, con aviso en Ajustes.

## 8. Onboarding (inicio vacío)

Guía de 3 pasos que se oculta al completarse (como en la maqueta anterior): 1) semana tipo (plantillas rápidas: «trabajo L–V 9–17:30», «gimnasio L/X/V», vacía) → `plantilla.md`; 2) estudio y proyectos con «+ añadir»; 3) «Proponer mi primera semana». Crea `ajustes.md` y `tipos.md` por defecto.

---

## 9. Fases (un commit por fase en `develop`)

Cada fase termina con: tests en verde (`pnpm test`), `pnpm check` limpio, comprobación manual de su lista, **un único commit** con el mensaje indicado y un informe breve. Después, **parar y esperar OK** antes de la siguiente.

| Fase | Contenido | Hecho cuando… | Commit |
|---|---|---|---|
| **F0** | Leer este plan y la maqueta entera. Proponer estructura final, dudas y riesgos. Crear esqueleto (`package.json` con `pnpm`, carpetas, `README`, scripts vacíos, test de humo). **Parar antes de commitear y esperar OK.** | El usuario da el OK | `chore: esqueleto inicial del planner` |
| **F1** | `src/core/fechas.js` y `formato/*` (parse + serialize de todos los ficheros), `modelo.js`, carpeta `ejemplo/` con datos inventados. | Round-trip estable para todos los ficheros; líneas desconocidas preservadas; semana 53 | `feat(core): formatos markdown y modelo` |
| **F2** | Servidor (`http`, `api`, `store`, `copias`, `deshacer`), `ops.js` básicas, CLI completa, seguridad. | `planner --ejemplo` sirve una página «hola» con el estado JSON; 409 y deshacer probados | `feat(server): servidor local, api y cli` |
| **F3** | Shell web (barra, selector, cajón, toasts, modal, popover, estilos nórdicos de la maqueta **ya con tokens CSS**: ningún color fijo fuera de `web/temas/`) + vista **Semana** completa (rejilla, carriles, capacidad, foco, marcas, crear/mover/estirar, editor con primer paso y subtipos, Las 3 en pastillas). | Se ve igual que la maqueta y las ops persisten en Markdown | `feat(web): vista semana y editor de bloques` |
| **F4** | **Captura** + vista **Hoy** + tareas (límite, grupos, ↑/↓) + **Cierre del día** (4 pasos, diario, «mañana empiezo por») + cajón Hoy/Diario. | Flujo diario completo sin tocar ficheros a mano | `feat(web): captura, hoy y cierre del día` |
| **F5** | Cajón **Metas** (constancia, llevas/te faltan, simulacros, proyectos) + **Gestión**: Semanas (navegación y estados), Plantilla, Tipos, Ajustes. | Semanas futuras se crean desde plantilla; ajustes cambian la UI al momento | `feat(web): metas y gestión` |
| **F6** | **Hecho** (duración real + nota) y **A medias** (dejado), `factor.js`, `proponer.js` completo con todas las reglas. | Tests deterministas de Proponer (≥ 10 escenarios); el factor se ve en Ajustes | `feat(core): proponer semana y lo que tardas de verdad` |
| **F7** | **Cerrar semana** (4 pasos, decisiones como ops, lecciones, Las 3 con si→entonces), reabrir, archivo de tareas. | Cerrar → reabrir → cerrar no duplica ni pierde nada | `feat(web): cierre y reapertura de semana` |
| **F8** | Pestaña **Progreso** (`progreso.js` + `ui/graficos.js`: bullet graph, barras, sparklines, rejilla). | Métricas con tests sobre `ejemplo/`; aspecto igual a la maqueta | `feat(web): pestaña progreso` |
| **F9** | **Temas**: `web/temas/*.css` con los 6 temas + automático + personalizado (`tema.md`), `core/color.js` (bloques por tema y contraste AA), selector con miniaturas en Gestión y Ajustes, decoración opcional de Universo y Halloween, `tema_temporada`, inyección de `data-tema` sin parpadeo. | Todas las vistas, modales y gráficos se ven bien en cada tema; test de contraste AA en verde | `feat(web): temas visuales` |
| **F10** | Onboarding vacío, PWA (manifest + icono), `scripts/windows/`, README de instalación y uso, pulido (teclado: Esc cierra, foco visible, contraste). **Solo aquí**, y con permiso explícito, apuntar a la carpeta real `D:\planner`. | Instalable como app; arranca con Windows; checklist de casos límite completo | `feat: onboarding, app instalable y arranque` |
| **F11** *(opcional)* | Plugin de Claude Code en `plugin/`: `/planner:ordenar` (inbox → tareas, con vista previa y confirmación), `/planner:repaso` (análisis de 4–8 semanas → nota en la semana), `/planner:plan-estudio` (temario + fecha → `estudio.md`), `/planner:dividir` (tarea grande → pasos < 2 h). Nunca tocan semanas cerradas ni el diario; copia en `.copias/` antes de escribir. | Comandos probados sobre `ejemplo/` | `feat(plugin): comandos opcionales de claude code` |

---

## 10. Fuera de alcance (decidido)
Importar/exportar ICS · notificaciones del navegador · ~~atajos de teclado para capturar~~ (añadidos tras el uso: `n`, `1` `2` `3`, `←` `→`, `h`, `?`) · cuentas, sincronización o nube · temporizador Pomodoro · rachas, puntos o medallas · matriz de Eisenhower · registro de tiempo minuto a minuto · IA en el uso diario.

## 11. Por qué cada pieza (resumen de la investigación)
| Pieza | Base |
|---|---|
| Bloques con cuándo/dónde/qué + primer paso | Intenciones de implementación (Gollwitzer & Sheeran 2006, d ≈ 0,65) |
| Hecho + nota de simulacro | Registrar el progreso, y el resultado además de la conducta (Harkin et al. 2016) |
| Cierre del día terminando en «mañana empiezo por» | Planes que liberan la mente (Masicampo & Baumeister 2011); lista antes de dormir (Scullin et al. 2018) |
| A medias / dónde lo dejé | *Ready-to-resume plan* contra el residuo atencional (Leroy & Glomb) |
| Lo que tardas de verdad | Feedback de duraciones reales mejora la estimación (Roy, Mitten & Christenfeld 2008) |
| Dos lecciones semanales | Reflexión escrita breve (Di Stefano, Gino, Pisano & Staats) |
| Subtipos de estudio y reparto | Práctica distribuida y exámenes de práctica (Dunlosky et al. 2013) |
| Llevas / te faltan | *Stuck in the middle* (Bonezzi, Brendl & De Angelis 2011) |
| ★ Las 3 delante | Efecto de mera urgencia (Zhu, Yang & Hsee 2018) |
| Constancia sin rachas | Un día perdido no afecta al hábito (Lally et al. 2010); efecto «total, ya da igual» |
| Hora de desconexión | Desconexión psicológica y recuperación (Sonnentag & Fritz) |
| Capacidad 70 % | Falacia de planificación (Buehler et al. 1994) |
| Gráficos de Progreso | Dashboards de un vistazo, bullet graphs y sparklines (Few) |
