' Target of the "Diwan Offers Studio" desktop and Start menu shortcuts. Runs open-studio.ps1 with no
' window: it starts the Studio if needed and opens it in the browser.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & here & "\open-studio.ps1""", 0, False
