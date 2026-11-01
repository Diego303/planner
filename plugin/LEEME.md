# Plugin de Claude Code para planner (opcional)

planner funciona sin IA. Este plugin añade cuatro comandos de Claude Code que trabajan sobre tu carpeta de Markdown:

| Comando | Qué hace |
|---|---|
| `/planner:ordenar` | Inbox → tareas (vista previa y confirmación) |
| `/planner:repaso [semanas]` | Repaso de 4–8 semanas → nota en `## Notas` de la semana en curso |
| `/planner:plan-estudio <nombre> <examen> [temario]` | Temario + fecha → tema en `estudio.md` |
| `/planner:dividir <tarea>` | Tarea grande → pasos de menos de 2 h |

Todos: enseñan una vista previa, piden confirmación, hacen una copia en `.copias/AAAA-MM-DD-plugin-HHMMSS/` antes de escribir, editan solo las líneas necesarias y **nunca tocan semanas cerradas ni el diario**.

## Instalación

```bash
claude --plugin-dir /ruta/al/repo/planner/plugin
```

o añádelo desde un *marketplace* local con `/plugin`. La carpeta de datos se toma de `$PLANNER_DATOS`, de la instancia de planner en marcha o, por defecto, de `/mnt/d/planner`; también se puede pasar como argumento.

`scripts/planner.mjs` (sin dependencias) localiza la carpeta, hace la copia y lista las semanas con su estado:

```bash
node plugin/scripts/planner.mjs carpeta
node plugin/scripts/planner.mjs semanas
node plugin/scripts/planner.mjs copia
```
