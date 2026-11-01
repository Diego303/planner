# Arrancar planner con Windows

`planner-inicio.vbs` arranca el servidor dentro de WSL **sin abrir ninguna ventana**:

```vb
sh.Run "wsl.exe -e bash -lc ""planner --silencioso""", 0, False
```

## Instalación

1. Instala planner en WSL (una vez): `pnpm install && pnpm link --global` en la carpeta del repo. Comprueba que `planner status` funciona en una terminal nueva.
2. Pulsa `Win + R`, escribe `shell:startup` y pulsa Enter: se abre la carpeta *Inicio* de tu usuario.
3. Copia ahí `planner-inicio.vbs` (desde el Explorador: `\\wsl.localhost\<tu-distro>\…\planner\scripts\windows\`).
4. La próxima vez que inicies sesión, planner estará en `http://localhost:4321/`. Si lo instalaste como app (Edge/Chrome → ⋯ → Aplicaciones → *Instalar planner*), ábrela desde el menú Inicio.

## Notas

- `bash -lc` usa un *login shell* para que `pnpm`, `nvm` o `fnm` estén en el `PATH`. Si usas otra shell (zsh, fish), cambia `bash` por la tuya.
- El servidor corre en primer plano dentro de `wsl.exe`; por eso WSL no lo para. Para pararlo: `planner stop` en una terminal de WSL.
- Si la carpeta de datos no es la de por defecto (`/mnt/d/planner`), añade `--datos /ruta` dentro de las comillas o define `PLANNER_DATOS` en tu `~/.profile`.
- La app instalada va ligada al puerto: si 4321 está ocupado, planner usa el siguiente y lo avisa; libera el 4321 para que la app vuelva a abrir.
