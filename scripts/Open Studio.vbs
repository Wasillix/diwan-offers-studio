' Target of the "Diwan Offers Studio" desktop and Start menu shortcuts. Runs open-studio.mjs with Node and
' no window: it starts the Studio if needed and opens it in the browser. Shows a message if it can't.
Option Explicit
Dim fso, sh, here, root, node, rc, msg, errFile
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(here)
sh.CurrentDirectory = root

node = sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not fso.FileExists(node) Then node = "node"

On Error Resume Next
rc = sh.Run("""" & node & """ """ & here & "\open-studio.mjs""", 0, True)
If Err.Number <> 0 Then
  sh.Popup "Node.js isn't installed on this PC. Run Install.cmd again.", 120, "Diwan Offers Studio", 16
  WScript.Quit 1
End If
On Error GoTo 0

If rc <> 0 Then
  msg = "The Studio didn't start."
  errFile = root & "\data\launch-error.txt"
  If fso.FileExists(errFile) Then msg = fso.OpenTextFile(errFile, 1, False, -1).ReadAll
  sh.Popup msg, 120, "Diwan Offers Studio", 16
End If
