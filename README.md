# planner

Organizador personal local y minimalista: calendario semanal por horas, vista Hoy, metas de estudio y proyectos, cierres del día y de la semana, y una pestaña de progreso. Varios temas: claro, oscuro, papel, universo violeta, Halloween y alto contraste. Todo se guarda en ficheros Markdown en tu carpeta. Sin IA para usarlo, sin nube y sin dependencias.

> Estado: en desarrollo. Especificación en [`docs/PLAN.md`](docs/PLAN.md) · diseño técnico en [`docs/DISENO.md`](docs/DISENO.md) · maqueta en [`docs/maquetas/planner-nordico.html`](docs/maquetas/planner-nordico.html).

## Desarrollo
```bash
pnpm install
pnpm dev     # servidor con una copia temporal de ejemplo/
pnpm test    # node --test
pnpm check   # sintaxis, core puro, sin colores fijos, sin dependencias
```
Requisitos: Node ≥ 20 y pnpm. Rama de trabajo: `develop`, un commit por fase.

## Tus datos
Carpeta de Markdown legible y editable a mano (`semanas/`, `tareas.md`, `estudio.md`, `proyectos.md`, `diario/`…). El repo nunca contiene datos reales; solo `ejemplo/` con datos inventados.
