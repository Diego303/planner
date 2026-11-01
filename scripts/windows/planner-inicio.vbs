Set sh = CreateObject("WScript.Shell")
' Arranca planner en WSL sin ventana. bash -lic carga ~/.bashrc (pnpm, nvm, PLANNER_DATOS).
sh.Run "wsl.exe -e bash -lic ""planner --silencioso""", 0, False
