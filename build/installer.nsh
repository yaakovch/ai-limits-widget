!macro customUnInstall
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--updated" $R1
  ${IfNot} ${Errors}
    Goto keepUserData
  ${EndIf}

  IfFileExists "$INSTDIR\AI Limits Widget.exe" 0 +2
    ExecWait '"$INSTDIR\AI Limits Widget.exe" --uninstall-cleanup'

  ${If} ${Silent}
    Goto keepUserData
  ${EndIf}

  MessageBox MB_YESNO|MB_DEFBUTTON2 "Remove AI Limits Widget settings, caches, backups, and logs?" IDNO keepUserData
    RMDir /r "$APPDATA\AI Limits Widget"
  keepUserData:
!macroend
