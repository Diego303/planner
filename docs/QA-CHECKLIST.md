# planner · Lista manual en Windows

Lo que las pruebas automáticas no pueden hacer por ti: tu Windows, tu navegador, tus editores y un reinicio de verdad. Unos 20 minutos. Hazla con **una copia** de tus datos (o con `--ejemplo`) la primera vez.

Marca cada punto; si alguno falla, apunta qué viste (y la hora) y mira la terminal donde corre `planner`.

## Instalar y arrancar

1. [ ] En una terminal de WSL nueva, `planner --version` dice `0.1.0` y `planner status` dice «planner parado».
2. [ ] `planner` abre el navegador de Windows en `http://localhost:4321` en menos de 2 s, con tu semana actual.
3. [ ] Un segundo `planner` en otra terminal no arranca otro: solo abre otra pestaña («ya está en marcha»).
4. [ ] En Edge o Chrome, menú ⋯ → *Aplicaciones* → *Instalar planner*: se abre en su propia ventana, con el icono y el color de barra del tema.
5. [ ] La app instalada aparece en el menú Inicio y se puede anclar a la barra de tareas.

## Arranque con Windows

6. [ ] Copia `scripts\windows\planner-inicio.vbs` a `shell:startup` (Win + R → `shell:startup`).
7. [ ] **Reinicia el PC.** Al entrar, sin abrir ninguna terminal, abre la app instalada (o `http://localhost:4321`): el planner responde (el `.vbs` solo arranca el servidor; la primera vez que arranca WSL puede tardar unos segundos más).
8. [ ] No se ve ninguna ventana negra de consola, ni al arrancar ni después.
9. [ ] En WSL, `planner status` dice «en marcha» con tu carpeta de datos.

## Tus ficheros, a mano

10. [ ] Con la web abierta, edita `D:\planner\tareas.md` con el **Bloc de notas**: añade `- [ ] prueba del bloc de notas` en `## Hoy` y guarda. En ≤ 3 s aparece en Hoy.
11. [ ] Abre el mismo fichero en el Bloc de notas otra vez: los acentos y la «ñ» se ven bien y no hay caracteres raros al principio.
12. [ ] Haz un cambio en el planner (marca esa tarea) y reabre el fichero: tu línea está y sigue como la escribiste.
13. [ ] Abre `D:\planner` como bóveda de **Obsidian**. Edita la semana actual en Obsidian (añade un bloque `- S 10:00-11:00 | personal | prueba obsidian`): aparece en la Semana en ≤ 3 s.
14. [ ] Con el fichero abierto en Obsidian, mueve un bloque en el planner: Obsidian muestra el cambio y no pide «sobrescribir».
15. [ ] Escribe en Obsidian y guarda justo mientras guardas algo en el planner: o se ven los dos cambios, o el planner avisa «Cambiaste el fichero fuera del planner, recargado». Nunca desaparece lo de Obsidian.

## Tema y aspecto

16. [ ] Gestión ▾ → Tema: cambia a **Nórdico oscuro**, **Papel**, **Universo** y **Alto contraste**. Se aplica al momento y al recargar (F5) no se ve un destello del tema anterior.
17. [ ] Con **Automático**, cambia Windows entre modo claro y oscuro (Configuración → Personalización → Colores): el planner sigue al sistema sin recargar.
18. [ ] Zoom del navegador al 125 % y al 200 % (Ctrl + +): nada se corta ni se solapa; el editor de un bloque del domingo cabe en la pantalla.

## Editar sin bloqueos

22. [ ] Gestión ▾ → Tipos: pulsa el nombre de un tipo, cámbialo y Enter. Tus bloques, la plantilla y las tareas de ese tipo cambian también (y el color se mantiene).
23. [ ] Tipos → «quitar» uno que usas: pregunta a qué tipo pasar sus bloques; «Cancelar» no toca nada.
24. [ ] Metas → ✎ en un estudio: cambia horas y nombre, y añade un simulacro. Un solo «deshacer» lo devuelve todo.
25. [ ] Clic en un bloque → Cuándo → «otra fecha…»: elige un día de la semana que viene. El bloque desaparece de esta y aparece en esa.
26. [ ] En el editor, pon un bloque a las 6:00 (si ves de 7 a 24): avisa y «Ver de 6 a 24» amplía el calendario.
27. [ ] Editor → «Duplicar en otros días…»: márcalos y «Duplicar». El aviso dice cuántos y si alguno se solapa.
28. [ ] Hoy lleno: ↑ en una de Más adelante la sube igualmente (avisando); «deshacer» la baja.
29. [ ] «Apunta algo» → «💡 es una idea»: sale en Hoy, en «Ideas»; «→ tarea» la pasa a Más adelante.
30. [ ] Diario (cajón): pulsa un día de esta semana, cambia el ánimo y guarda.
31. [ ] Teclado: `?` enseña los atajos; `←` `→` cambian de semana; `n` va a «apunta algo»; escribiendo en un campo no hacen nada.

## Guardado

32. [ ] Junto a Semana · Hoy · Progreso pone **● Guardado**. Al apuntar una tarea pasa un momento a **○ Guardando…** y vuelve a **● Guardado**; entonces la tarea ya está en `tareas.md`.
33. [ ] Pasa el ratón por «Guardado»: dice tu carpeta de datos y la hora del último cambio.
34. [ ] Para el planner (`planner stop`) con la pestaña abierta: en ≤ 5 s pone **Sin conexión · no se guarda** en rojo; al arrancarlo vuelve a **● Guardado**.

## Copias y cierre

35. [ ] Tras el primer cambio del día, existe `D:\planner\.copias\AAAA-MM-DD\` con tus ficheros (aunque tarde un poco en terminar).
36. [ ] Ctrl + C en la terminal (o `planner stop`) mientras guardas algo: al volver a arrancar, el cambio está entero o no está; nunca a medias.
37. [ ] Con el planner parado y la pestaña abierta, sale la banda «Servidor parado · solo lectura»; al arrancarlo de nuevo desaparece sola en ≤ 5 s.

## Si algo falla

- Mira la terminal donde corre `planner` (los errores internos se escriben ahí, nunca en la web).
- `pnpm qa:validar -- --datos /mnt/d/planner` revisa tus ficheros **sin tocarlos** (trabaja sobre una copia temporal).
- Tus datos de ayer están en `D:\planner\.copias\`.
