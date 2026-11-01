Set sh = CreateObject("WScript.Shell")
' Arranca planner en WSL sin ventana (bash -lc carga el perfil: pnpm/nvm en el PATH).
sh.Run "wsl.exe -e bash -lc ""planner --silencioso""", 0, False
