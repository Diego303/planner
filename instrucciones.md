# planner · instrucciones de 0 a 100

Guía práctica para instalarlo, abrirlo cada día, saber dónde están tus datos y empezar un planner limpio en otra carpeta. Todo se hace en **WSL** (la terminal de Ubuntu dentro de Windows) salvo lo que se indica.

---

## 1. Lo que necesitas (una vez)

Abre una terminal de WSL y comprueba:

```bash
node --version    # tiene que ser v20 o mayor
pnpm --version    # cualquier versión reciente (el repo pide la 12.6)
git --version     # solo para la copia «git local» (opcional)
```

- **Si no tienes Node ≥ 20**, instálalo con [nvm](https://github.com/nvm-sh/nvm): `nvm install --lts`.
- **Si no tienes pnpm**: `corepack enable pnpm` (viene con Node) o `curl -fsSL https://get.pnpm.io/install.sh | sh -`.

planner no tiene dependencias: no descarga nada más.

## 2. Instalarlo (una vez)

El repo está en `D:\GitHub\planner`, que en WSL es `/mnt/d/GitHub/planner`. Haz estos pasos en orden, en la terminal de WSL.

### Paso 2.1 · Preparar el proyecto

```bash
cd /mnt/d/GitHub/planner
pnpm install
```

No descarga paquetes (planner no tiene dependencias): solo prepara el proyecto.

### Paso 2.2 · Configurar la carpeta global de pnpm

```bash
pnpm setup
```

Crea la carpeta donde pnpm guarda los comandos globales y la apunta en `~/.bashrc`.

> **Si termina con `Error: × create the pnpm alias scripts ╰─▶ Text file busy (os error 26)`**: no pasa nada grave. pnpm se ha instalado, pero falló justo al final (intentó sobrescribir su propio ejecutable mientras lo estaba usando) y **no llegó a escribir su configuración en `~/.bashrc`**. No vuelvas a ejecutar `pnpm setup` (daría el mismo error); haz el paso 2.3.

### Paso 2.3 · Solo si `pnpm setup` dio el error: añadir la configuración a mano

Pega estas dos líneas tal cual (cada una añade una línea al final de `~/.bashrc`):

```bash
echo 'export PNPM_HOME="$HOME/.local/share/pnpm"' >> ~/.bashrc
echo 'export PATH="$PNPM_HOME/bin:$PATH"' >> ~/.bashrc
```

Comprueba que se han añadido:

```bash
tail -2 ~/.bashrc
```

Tienen que salir exactamente estas dos líneas:

```
export PNPM_HOME="$HOME/.local/share/pnpm"
export PATH="$PNPM_HOME/bin:$PATH"
```

Si salen repetidas (por haberlas pegado dos veces), no pasa nada malo.

> **Si al pegar algo la terminal se queda con `>` y te pide escribir más**, es que el bloque se pegó a medias o con espacios delante. Pulsa **`Ctrl + C`** para cancelar (no se escribe nada) y vuelve a pegar las dos líneas `echo` de arriba, que no dependen de los espacios.

### Paso 2.4 · Cerrar la terminal y abrir una nueva

Así se carga la configuración. Comprueba que está bien:

```bash
echo $PNPM_HOME
```

Tiene que salir `/home/<tu-usuario>/.local/share/pnpm` (por ejemplo `/home/diego/.local/share/pnpm`). Si sale una línea vacía, repite el paso 2.3.

### Paso 2.5 · Instalar el comando `planner`

```bash
pnpm add -g /mnt/d/GitHub/planner
planner --version
```

Tiene que salir `0.1.0`. El comando queda **enlazado al repo**: si actualizas el repo (`git pull`), `planner` usa la versión nueva sin reinstalar.

> **¿Quieres que arranque más rápido?** Enlazado al repo, el código se carga desde `/mnt/d` y arrancar tarda alrededor de 1 s (Windows hace lento leer muchos ficheros pequeños desde WSL). Si lo instalas desde un paquete, el código se copia dentro de Linux y arranca en unos 0,2 s, aunque tus datos sigan en `/mnt/d`:
>
> ```bash
> cd /mnt/d/GitHub/planner
> pnpm pack --pack-destination ~        # crea ~/planner-0.1.0.tgz
> pnpm add -g ~/planner-0.1.0.tgz
> ```
>
> La contrapartida: después de un `git pull` hay que repetir esos dos comandos para usar la versión nueva.

> **¿`planner: command not found`?** Abre una terminal nueva y repite el paso 2.4. Si `echo $PNPM_HOME` sale vacío, falta el paso 2.3. Como alternativa sin pnpm global, un alias: `echo 'alias planner="node /mnt/d/GitHub/planner/bin/planner.js"' >> ~/.bashrc` (y terminal nueva).

### Paso 2.6 · Comprobarlo con datos de ejemplo

```bash
planner --ejemplo --hoy 2026-11-02
```

Se abre el navegador en `http://localhost:4321` con datos inventados en una carpeta temporal (tus datos no se tocan). Para pararlo: **`Ctrl + C`**. Si todo se ve bien, ya está instalado: sigue en el punto 4 para usarlo con tus datos.

## 3. Probarlo sin tocar nada tuyo

```bash
planner --ejemplo                     # copia temporal de ejemplo/ con datos inventados
planner --ejemplo --hoy 2026-11-02    # el mismo escenario que la maqueta
```

Se borra solo al parar (`Ctrl+C`). Es el sitio para trastear sin miedo.

## 4. Arrancarlo y abrir la web

```bash
planner
```

- Arranca el servidor en **http://localhost:4321/** y abre el navegador de Windows. Si no se abre solo, abre esa dirección en Edge o Chrome.
- La terminal se queda ocupada mientras planner está en marcha (ahí salen los avisos). **`Ctrl+C`** lo para.
- Desde otra terminal: `planner status` (¿está en marcha?, puerto, carpeta) y `planner stop` (pararlo).
- Si ya estaba en marcha, `planner` no arranca otro: abre la pestaña del que hay.
- Si el puerto 4321 está ocupado por otra cosa, usa el siguiente libre (4322…) y lo dice en la terminal.

Solo escucha en tu propio ordenador (`127.0.0.1`): nadie de la red puede verlo. No usa internet.

### Como app con su propia ventana (recomendado)

1. Con planner abierto en **Edge**: menú **⋯ → Aplicaciones → Instalar este sitio como una aplicación**. En **Chrome**: el icono de instalar de la barra de direcciones, o en el menú **⋮** la opción «Instalar planner» / «Instalar página como aplicación» (el nombre cambia según la versión).
2. Aparece «planner» en el menú Inicio; puedes anclarlo a la barra de tareas.
3. La app solo es una ventana para `http://localhost:4321/`: **el servidor tiene que estar en marcha** (punto 5). Si la abres y sale «no se puede acceder», arráncalo.

### Que arranque solo al encender Windows

1. Pulsa `Win + R`, escribe `shell:startup` y Enter.
2. Copia ahí `scripts\windows\planner-inicio.vbs` (desde el Explorador: `D:\GitHub\planner\scripts\windows\`).
3. En el próximo inicio de sesión, planner arranca sin ventanas y la app instalada abre directamente.

El `.vbs` ejecuta `wsl.exe -e bash -lic "planner --silencioso"`. Más detalles en [`scripts/windows/LEEME.md`](scripts/windows/LEEME.md).

## 5. El día a día

> ¿Dónde se mete cada cosa? Listado completo, para seguirlo paso a paso: [`guia.md`](guia.md).

| Dónde | Qué haces |
|---|---|
| **Semana** | Doble clic en un hueco = bloque de 1 h. Arrastra para mover, estira el borde inferior, clic para editar (horas libres, «de 8:30 a 18:00», sin límite de duración). **Hecho ✓** pregunta cuánto duró; **A medias** guarda dónde lo dejaste. **Proponer semana** reparte tus horas de estudio y proyectos; **↻ Aplicar plantilla** añade lo que le falte de tu plantilla (avisa si algo se solapa). Escribe **Las 3** arriba: la etiqueta dice si son de esta semana o de otra. |
| **Hoy** | Tus tareas (✎ en cada una para editar, mover o borrar), lo de más adelante y, al final del día, **Cerrar el día** (termina con «mañana empiezo por…»). |
| **Apunta algo** (barra de arriba) | Escribe qué es y Enter. Al pulsar la barra salen botones para el **tipo**, **cuándo** (hoy, mañana, otro día, más adelante, algún día) e **importante**; con **/** eliges el tipo con el teclado. Al guardar, **✎ editar** abre la tarea para la duración, la fecha exacta, etc. Si te los sabes, también valen `#área`, `mañana`/`lun…dom`/`dd/mm`, `!`, `45m`/`2h`/`1h30`, `algún día`. |
| **Metas** (cajón derecho) | Horas de estudio de la semana, simulacros y el siguiente paso de cada proyecto. |
| **Progreso** | Cómo vas con cada certificación, lo que tardas de verdad, constancia, ánimo y lecciones. |
| **Gestión ▾** | Semanas, **Cerrar semana** (el domingo o el lunes, 4 pasos), Plantilla (cada entrada se puede **editar**; los cambios llegan también a las semanas ya creadas), Tipos, Tema y Ajustes. |

Cada cambio se puede **deshacer** durante 10 s desde el aviso de abajo. `Esc` cierra lo que esté abierto.

## 6. Dónde están tus datos

Por defecto en **`D:\planner`** (en WSL, `/mnt/d/planner`). Es una carpeta normal de ficheros Markdown: ábrela desde el Explorador, haz copias, súbela a tu nube o edítala con cualquier editor.

```
D:\planner\
├── ajustes.md          capacidad, horas visibles, hora de cierre, tema…
├── tipos.md            tipos de bloque y sus colores (trabajo, estudio…)
├── plantilla.md        lo que se repite cada semana
├── tareas.md           Hoy · Más adelante · Algún día
├── estudio.md          certificaciones y cursos (horas/semana, examen, simulacros)
├── proyectos.md        proyectos y su siguiente paso
├── inbox.md            notas sueltas (las ordena el plugin opcional)
├── tema.md             (opcional) tu tema personalizado
├── semanas\2026-W45.md una por semana: Las 3, bloques y cierre
├── diario\2026-11-02.md uno por día cerrado: ánimo, una línea, «mañana empiezo por»
├── archivo\            tareas hechas de cada mes
└── .copias\            copias automáticas (una por día, se guardan 14)
```

- Puedes **editar a mano** con planner abierto: lo detecta en 2 s y recarga. Si una línea no la entiende, la conserva tal cual y la marca con «⚠ línea no reconocida».
- **Copias**: antes del primer cambio de cada día se copia toda la carpeta a `.copias\AAAA-MM-DD\`. En Ajustes puedes cambiarlo a «al cerrar semana» o a «git local» (un commit por cierre de día, nunca se sube a ningún sitio).
- **Restaurar una copia**: `planner stop`, copia los ficheros que quieras desde `.copias\AAAA-MM-DD\` a la carpeta, y vuelve a arrancar.
- La gramática exacta de cada fichero está en [`docs/DISENO.md`](docs/DISENO.md).

La primera vez que arrancas con una carpeta que no existe (o vacía), planner muestra una guía de 3 pasos: tu semana tipo, tus estudios y proyectos, y «Proponer mi primera semana». Crea la carpeta al guardar el primer paso.

## 7. Cambiar la carpeta de datos

La ruta de Windows `X:\algo\otra` se escribe en WSL como `/mnt/x/algo/otra` (en minúsculas la letra). Por ejemplo `C:\Users\diego\Documents\planner` → `/mnt/c/Users/diego/Documents/planner`.

Primero para el que esté en marcha (no se puede tener uno con una carpeta y otro con otra):

```bash
planner stop
```

Luego elige una de estas tres formas:

| Para… | Haz |
|---|---|
| **Una vez** | `planner --datos /mnt/d/otra-carpeta` |
| **Siempre** (terminal y arranque con Windows) | Añade `export PLANNER_DATOS=/mnt/d/otra-carpeta` al final de `~/.bashrc`, abre una terminal nueva y arranca con `planner` |
| **Solo el arranque con Windows** | Edita el `.vbs` de `shell:startup`: `"planner --silencioso --datos /mnt/d/otra-carpeta"` |

`planner status` te dice siempre qué carpeta está usando. El pie del menú **Gestión ▾** también la muestra («Guardado en …»).

La app instalada no cambia: sigue abriendo `http://localhost:4321/` y enseña lo que sirva el planner que esté en marcha.

### Paso a paso: «siempre en esta carpeta»

Ejemplo con `D:\GoogleDrive\Vida-Diego\PLANNER` (en WSL, `/mnt/d/GoogleDrive/Vida-Diego/PLANNER`):

1. Para el planner si está en marcha: `planner stop`.
2. Copia esta línea tal cual (una sola línea; las comillas hacen falta si la ruta tiene espacios):

   ```bash
   echo 'export PLANNER_DATOS="/mnt/d/GoogleDrive/Vida-Diego/PLANNER"' >> ~/.bashrc
   ```

3. Cierra la terminal, abre una nueva y comprueba: `echo $PLANNER_DATOS` tiene que enseñar la ruta.
4. Arranca con `planner`. Si la carpeta no existe o está vacía, sale la guía de inicio y la crea al guardar el primer paso. `planner status` confirma la carpeta.
5. El arranque con Windows (`planner-inicio.vbs`) no hay que tocarlo: carga tu `~/.bashrc` y usa la misma carpeta.

Para volver a la de siempre, borra esa línea del final de `~/.bashrc` (con `nano ~/.bashrc`) y abre una terminal nueva.

### En una carpeta sincronizada (Google Drive, OneDrive, Dropbox)

Funciona: son ficheros Markdown normales. Ten en cuenta:

- **Copias:** `.copias/` guarda hasta 14 copias diarias dentro de la carpeta y el servicio las subirá todas. Si no quieres, en **Gestión → Ajustes → Copia de seguridad** elige «al cerrar semana» (el servicio ya guarda su propio historial de versiones).
- **Temporales:** al guardar, el planner escribe un instante `.fichero.md.tmp-…` y lo renombra. Si el servicio llega a subir alguno, es inofensivo; el planner los borra al arrancar.
- **Un solo ordenador a la vez:** si editas desde dos PCs a la vez, el servicio crea copias en conflicto («tareas (1).md») y el planner solo lee el fichero original. Si te pasa, junta a mano lo que haga falta.
- **Bloqueos:** si el servicio tiene un fichero bloqueado mientras lo sube, el planner reintenta; si aun así no puede, te lo dice («no se ha guardado nada») y no se pierde nada.
- **Ficheros solo en la nube** (modo «transmitir» de Google Drive, «Archivos a petición» de OneDrive): el primer arranque va más lento mientras se descargan. Marca la carpeta como «disponible sin conexión» o usa el modo «duplicar».
- Para revisar tus ficheros sin tocarlos (sobre una copia temporal): `cd /mnt/d/GitHub/planner && pnpm qa:validar -- --datos "/mnt/d/GoogleDrive/Vida-Diego/PLANNER"`.

## 8. Empezar un planner limpio

### Opción A: carpeta nueva, la antigua intacta (recomendada)

```bash
planner stop
planner --datos /mnt/d/planner-2027      # una carpeta que no existe o está vacía
```

Sale la guía de 3 pasos y crea `ajustes.md`, `tipos.md` y `plantilla.md` por defecto. La carpeta antigua sigue ahí: para volver a ella, `planner stop` y `planner --datos /mnt/d/planner`. Si quieres que la nueva sea la de siempre, pon su ruta en `PLANNER_DATOS` (punto 7).

### Opción B: misma ruta, renombrando la antigua

```bash
planner stop
mv /mnt/d/planner /mnt/d/planner-antiguo   # o renómbrala desde el Explorador
planner                                    # D:\planner ya no existe → guía de inicio
```

### Opción C: limpio pero con tu configuración

Crea la carpeta nueva y copia solo lo que quieres conservar **antes** de arrancar:

```bash
planner stop
mkdir -p /mnt/d/planner-2027
cp /mnt/d/planner/{ajustes,tipos,plantilla}.md /mnt/d/planner-2027/
# opcional: también estudio.md y proyectos.md
planner --datos /mnt/d/planner-2027
```

Empiezas con tus ajustes, colores y semana tipo, pero sin semanas, tareas ni diario.

## 9. Personalizar

- **Gestión → Ajustes**: capacidad del día, tareas máximas en Hoy, horas visibles, hora de cierre, si la semana empieza en lunes o domingo, foco máximo de estudio, tus mejores horas, margen de «Proponer», copias y tema.
- **Gestión → Tipos**: colores y banderas «trabajo» (cuenta para la hora de desconexión ☾) y «estudio» (subtipos, foco y simulacros).
- **Gestión → Tema**: Nórdico claro u oscuro, Automático (sigue a Windows), Papel, Universo, Halloween, Alto contraste o Personalizado (crea `tema.md`; ejemplo en el [README](README.md#tema-personalizado)).
- **Puerto**: `--puerto 5000` una vez, o `puerto:` en Ajustes para siempre (se aplica al arrancar). Si cambias el puerto, vuelve a instalar la app desde la dirección nueva.

## 10. Actualizar

```bash
planner stop
cd /mnt/d/GitHub/planner
git pull
pnpm install
planner
```

Tus datos no se tocan: viven fuera del repo.

## 11. Si algo falla

| Síntoma | Solución |
|---|---|
| `pnpm setup` → `Text file busy (os error 26)` | No repitas `pnpm setup`: haz los pasos 2.3 a 2.5 |
| Al pegar algo, la terminal se queda con `>` pidiendo más | `Ctrl + C` y pega las dos líneas `echo` del paso 2.3 |
| `planner: command not found` | Terminal nueva y `echo $PNPM_HOME` (paso 2.4); si sale vacío, paso 2.3; luego paso 2.5. O usa el alias del paso 2.5 |
| «Ya hay un planner en marcha con otra carpeta» | `planner stop` y vuelve a arrancar con la carpeta que quieras |
| No se abre el navegador | Abre `http://localhost:4321/` a mano. (Con `sudo apt install wslu` se usa `wslview`) |
| La app instalada dice que no puede acceder | El servidor no está en marcha: `planner` o el arranque con Windows |
| Banda «Servidor parado · solo lectura» | Se cayó el servidor o lo paraste; reintenta solo cada 5 s en cuanto vuelva |
| «Cambiaste el fichero fuera del planner, recargado» | Editaste un fichero mientras guardabas algo: planner recargó lo que hay en disco. No se pierde nada |
| «⚠ línea no reconocida» | Una línea escrita a mano no sigue el formato. Despliega el aviso para verla y corrígela en el fichero |
| «… ignorado: muy grande / parece binario» | Hay un fichero de más de 1 MB o no es texto en la carpeta: muévelo fuera |
| El arranque con Windows no hace nada | Prueba en una terminal `bash -lic "planner --silencioso"`. Si falla, revisa el punto 2 |
| La fecha de «hoy» no cuadra | planner usa la fecha del navegador (Windows). Revisa la zona horaria de Windows |

## 12. Desinstalar

```bash
planner stop
pnpm remove -g planner
```

Borra `planner-inicio.vbs` de `shell:startup` y desinstala la app desde Edge/Chrome (o desde Configuración → Aplicaciones). **Tus datos se quedan** en `D:\planner` hasta que los borres tú.

---

¿Quieres usar Claude Code con tus datos? Es opcional: mira [`plugin/LEEME.md`](plugin/LEEME.md).
