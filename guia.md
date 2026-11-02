# planner · Qué puedes rellenar y dónde

Un listado para ir planificándote poco a poco. Cada punto dice **dónde** se rellena en la web y **en qué fichero** queda (todo está en tu carpeta de datos, por ejemplo `D:\GoogleDrive\Vida-Diego\PLANNER`). Lo marcado con ✍ solo se puede poner a mano en el fichero (con el Bloc de notas, Obsidian…): la web lo lee y lo enseña, pero no tiene formulario para ello.

Hazlo en este orden la primera vez. Después, el día a día es la parte 4.

---

## 1 · Una vez, al empezar (10 minutos)

- [ ] **Ajustes** · Gestión ▾ → Ajustes → `ajustes.md`
  - Capacidad del día (qué parte del día llenas como mucho; el resto es margen). Por defecto 70 %.
  - Tareas máximas en Hoy (por defecto 5).
  - Horas visibles del calendario (por ejemplo, de 7 a 24).
  - Hora del cierre del día (a partir de ahí, nada de trabajo: lo que pase de ahí sale con ☾).
  - La semana empieza en lunes o en domingo.
  - Máximo de estudio intenso en un día (aviso de foco).
  - Tus mejores horas para estudiar (mañanas, tardes, noches o sin preferencia).
  - Margen al proponer y copia de seguridad (diaria, al cerrar semana o git).
- [ ] **Tipos de bloque** · Gestión ▾ → Tipos → `tipos.md`
  - Vienen trabajo, estudio, proyectos, entreno y personal. Puedes cambiar el color, añadir los tuyos (salud, familia, lectura…) y quitar los que no uses (no se puede quitar uno que esté en uso).
  - Banderas: «trabajo» (cuenta para la hora de desconexión) y «estudio» (subtipos, foco y simulacros).
- [ ] **Tema** · Gestión ▾ → Tema (claro, oscuro, papel, universo, halloween, alto contraste, automático…)
  - ✍ Tema propio: crea `tema.md` con `- base: nordico-oscuro` y los colores que quieras cambiar (`- acento: #E07A3F`, `- fondo: #1E2328`…) y elige «Personalizado».

## 2 · Tu semana tipo (lo que se repite cada semana)

- [ ] **Plantilla de semana** · Gestión ▾ → Plantilla de semana → `plantilla.md`
  - Título, tipo, **días** (puedes marcar varios: L, J y V a la vez), hora de inicio y duración → «Añadir a la plantilla».
  - Ejemplos: trabajo L–V de 9:00 a 17:30, gimnasio L/X/V a las 18:00, inglés M y J.
  - Solo afecta a las **semanas que aún no existen**: la semana en la que estás ya está creada (ahí, añádelos a mano, punto 3).
  - Para cambiar una entrada: quítala (×) y vuelve a añadirla.
  - Atajo: en el editor de un bloque, la casilla «↻ en la plantilla» añade ese bloque (solo ese día) a la plantilla.

## 3 · Lo que quieres conseguir

- [ ] **Estudio** (certificaciones, cursos, idiomas) · cajón derecho → Metas → «+ añadir» → `estudio.md`
  - En la web: nombre, horas a la semana y fecha del examen (opcional).
  - ✍ En `estudio.md`, debajo de su `## Nombre`, puedes añadir:
    - `- total: 55` → horas totales que te hacen falta (para ver si llegas al examen en Progreso).
    - `- inicio: 2026-09-14` → cuándo empezaste.
    - `- previo: 2` → horas que ya llevabas antes de usar el planner.
    - `- simulacros: 61 @2026-10-05, 66 @2026-10-19` → notas de exámenes de prueba (también se apuntan solos al marcar «Hecho» en un bloque de simulacro).
- [ ] **Proyectos** (personales, de trabajo) · cajón → Metas → «+ añadir» → `proyectos.md`
  - En la web: nombre y **siguiente paso** (lo próximo concreto que harás). El siguiente paso se cambia en línea pulsándolo.
  - Pausar un proyecto: al cerrar la semana (punto 5), o ✍ `- estado: pausado`.
- [ ] **Las 3 de la semana** (lo que hará que la semana merezca la pena) · Semana → fila «Las 3» → `semanas/AAAA-Www.md`
  - Como mucho 3. Escribe en «＋ añadir…» y Enter. Se editan pulsando el texto; vaciarlo las quita. La casilla las marca como hechas.
  - Si el texto nombra un tema de estudio o un proyecto («Simulacro MLA-C01 ≥ 70 %»), se enlaza solo y sus bloques salen con ★.
  - El «si → entonces» (plan B: «si el jueves llego tarde → lo hago el sábado») se pone al cerrar la semana anterior (paso 4) o ✍ `| si: … | entonces: …`.

## 4 · El día a día

- [ ] **Bloques en la semana** · Semana → `semanas/AAAA-Www.md`
  - **Crear:** doble clic en un hueco del día (sale un bloque de 1 h y su editor).
  - **Editor** (clic en un bloque): título, tipo, cómo vas a estudiar (aprender · ⟲ repasar · ◎ simulacro, solo en estudio), día, hora, duración, **primer paso** (qué abres y qué haces primero) y «↻ en la plantilla».
  - **Mover:** arrástralo a otro día u hora (se ajusta a la media hora). **Duración:** estira el borde de abajo.
  - Varios días a la vez: no se puede desde la semana (uno por día); para lo que se repite, usa la plantilla (punto 2). ✍ O añade líneas en `## Bloques`: `- L 18:00-19:00 | estudio | Inglés`.
  - **Proponer semana:** coloca solo las horas de estudio y proyectos que faltan, sin solapes. Las sugerencias salen con borde punteado: ábrelas y «Aceptar», o arrástralas.
- [ ] **Al terminar un bloque** · clic en el bloque
  - **Hecho ✓** y cuánto duró de verdad (menos · lo previsto · +30 min · +1 h). Si es un simulacro, también la nota. Con esto el planner aprende cuánto tardas de verdad.
  - **A medias** (solo en estudio y proyectos; el título tiene que empezar por el nombre del tema, «Curso · lab 3»): dónde lo dejaste. La próxima vez que abras un bloque de ese tema te lo recuerda.
- [ ] **Tareas** · barra de arriba «＋ apunta algo» → `tareas.md`
  - Escribe y Enter. Entiende, en cualquier orden:
    - `#trabajo` → tipo (vale el principio del nombre: `#estu`)
    - `hoy` · `mañana` · `lunes`…`domingo` (o `lun`…`dom`) · `15/11` → fecha
    - `!` → prioridad · `45m`, `2h`, `1h30` → duración · `algún día` → a «Algún día»
  - Mientras escribes, los chips te enseñan qué ha entendido y a qué lista va.
  - Ojo: un día de la semana dentro del texto se toma como fecha («Ir al mar» → «Ir al», el martes).
  - Tres listas: **Hoy** (con un máximo; si está lleno, lo nuevo va a Más adelante), **Más adelante** (por grupos: vencidas, con fecha, sin fecha) y **Algún día**.
  - En la vista Hoy: casilla para marcar, ↑ / ↓ para subir a Hoy o bajar, ✎ para editar (texto, tipo, lista, fecha, duración, prioridad) o eliminar.
- [ ] **Cierre del día** (al final del día) · Hoy → «Cierre del día» → `diario/AAAA-MM-DD.md`
  1. Lo que avanzaste (sale solo de lo marcado).
  2. Lo que no hiciste: «mañana» o «más adelante».
  3. Ánimo del 1 al 5 y una línea para tu diario.
  4. **Mañana empiezo por…** (sale prellenado del primer paso de tu primer bloque de mañana).
  - «Cerrar el día ✓». Se puede editar después.
- [ ] **Ideas sueltas (inbox)** · ✍ `inbox.md`
  - Una línea por idea (`- mirar el curso de evaluación de agentes`). Útil para apuntar desde el móvil si tu carpeta está en Google Drive. Se ordenan al cerrar la semana (convertir en tareas o archivar).

## 5 · Una vez por semana (domingo, 15 minutos)

- [ ] **Cerrar semana** · Gestión ▾ → Cerrar semana N (o el botón de la banda) → escribe en `semanas/` y mueve lo que decidas
  1. **Resumen** y dos lecciones: qué funcionó y qué cambias (salen luego en Progreso).
  2. **Pendientes:** decide qué hacer con cada cosa (bloques no hechos, horas de estudio que faltaron, tareas vencidas, proyectos parados, notas del inbox). Lo que no decidas se queda como está.
  3. **Proyectos:** el siguiente paso de cada uno. Repasa «Algún día».
  4. **Semana nueva:** Las 3 (con su si → entonces) y las horas de estudio de esa semana. Al terminar, propone los bloques.
- [ ] **Semanas** · Gestión ▾ → Semanas: ver cualquiera, reabrir una cerrada o planificar con tiempo una futura.
- [ ] ✍ Notas de la semana: sección `## Notas` al final de `semanas/AAAA-Www.md` (salen en un recuadro en la semana).

## 6 · Solo para mirar (no hace falta rellenar nada)

- **Progreso:** certificaciones (llevas / te faltan, ritmo hasta el examen), plan frente a real, lo que tardas de verdad, constancia, ánimo y lecciones. Se llena solo con lo de arriba.
- **Cajón:** Hoy (lo de ahora), Metas (horas de estudio de la semana) y Diario (últimos 7 días).

## 7 · Mejor no tocar

- `.copias/` → tus copias de seguridad (para recuperar algo, cópialo de ahí con el planner parado).
- `archivo/` → tareas hechas antiguas; las usa Progreso. Se llena solo.
- Las **semanas cerradas** son de solo lectura en la web; si necesitas cambiar algo, «Reabrir».
- Si editas a mano, respeta el formato de las líneas (`- L 18:00-19:00 | tipo | Título`). Lo que el planner no entiende no se borra: se conserva tal cual y te avisa («línea no reconocida»).
- ¿Dudas con tus ficheros? `pnpm qa:validar -- --datos <tu carpeta>` los revisa sin tocarlos.
