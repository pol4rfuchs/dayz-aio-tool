# v0.5.14 SteamCMD Login Window Quote Fix

Fixes the Windows launcher used by the interactive SteamCMD login helper.

## Problem

`cmd.exe /c start "" "<script>.cmd"` was brittle through the Node -> cmd quoting chain and could open a Windows error dialog such as:

```text
Die Datei "\\" wurde nicht gefunden.
```

The generated login helper script itself was valid, but the outer launcher command could be parsed incorrectly by Windows.

## Fix

The backend now launches the helper via PowerShell `Start-Process` using an encoded command:

- avoids nested `cmd /c start` quoting ambiguity
- starts a visible `cmd.exe /k "<helper>.cmd"` window
- keeps the working directory at the SteamCMD directory
- still does not store, receive, or log the Steam password

## Expected behavior

Clicking **Open SteamCMD login** opens a SteamCMD console where the user enters password and Steam Guard code directly in SteamCMD.
