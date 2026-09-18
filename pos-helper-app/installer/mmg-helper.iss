; MMG POS Helper installer (Inno Setup 6)
; Build:  pos-helper-app\build-installer.ps1   ->  installer\Output\MMG-Helper-Setup.exe
;
; Interactive:  MMG-Helper-Setup.exe
; Silent:       MMG-Helper-Setup.exe /VERYSILENT /MIN="123-456789-0" /SN="S/N0000012345" /PTU="PTU-000000000001" /PRINTER=192.168.1.50 /COM=COM3
; Branch defaults: put branch-defaults.ini next to the installer to prefill shared fields:
;     [defaults]
;     printer_ip=192.168.1.50
;     display_port=COM3
; Precedence for each field: command-line switch > branch-defaults.ini > built-in default.
; On upgrade, an existing config.json is kept and the settings page is skipped.

#define AppName "MMG POS Helper"
#define AppExe "mmg-helper.exe"

[Setup]
AppId={{6E1F3B52-7C0A-4D3E-9B8A-2F5D1C4A9E70}
AppName={#AppName}
AppVersion=1.0.0
AppPublisher=Medical Mission Group Multipurpose Cooperative-Albay
; All-users install: one shared config and journal per workstation, whoever logs in.
PrivilegesRequired=admin
DefaultDirName=C:\MMG-POS
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputBaseFilename=MMG-Helper-Setup
Compression=lzma2
SolidCompression=yes
UninstallDisplayIcon={app}\{#AppExe}
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern

[Dirs]
; Cashiers are standard users: they must be able to write ejournal.txt and config.json.
Name: "{app}"; Permissions: users-modify

[Files]
Source: "..\helper\dist\{#AppExe}"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\config.json.example"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Common startup: the helper starts for every user that logs in.
Name: "{commonstartup}\{#AppName}"; Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; Flags: runminimized

[Run]
Filename: "{app}\{#AppExe}"; WorkingDir: "{app}"; Description: "Start {#AppName} now"; Flags: nowait postinstall skipifsilent runminimized

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM {#AppExe}"; Flags: runhidden; RunOnceId: "KillHelper"

[Code]
var
  CfgPage: TInputQueryWizardPage;

function ConfigPath: String;
begin
  Result := ExpandConstant('{app}\config.json');
end;

{ Value of a "Key": "value" pair in a small flat JSON file; '' if absent. }
function JsonValue(const Json, Key: String): String;
var
  P: Integer;
  Rest: String;
begin
  Result := '';
  P := Pos('"' + Key + '"', Json);
  if P = 0 then Exit;
  Rest := Copy(Json, P + Length(Key) + 2, Length(Json));
  P := Pos(':', Rest);
  if P = 0 then Exit;
  Rest := Copy(Rest, P + 1, Length(Rest));
  P := Pos('"', Rest);
  if P = 0 then Exit;
  Rest := Copy(Rest, P + 1, Length(Rest));
  P := Pos('"', Rest);
  if P = 0 then Exit;
  Result := Copy(Rest, 1, P - 1);
end;

{ BIR credential from an earlier install's terminal.json (old install.bat or the Python variant),
  used to prefill the wizard so upgrading doesn't mean retyping them. '---' counts as unset. }
function OldCredential(const Key: String): String;
var
  Raw: AnsiString;
  Files: array of String;
  I: Integer;
begin
  Result := '';
  SetArrayLength(Files, 2);
  Files[0] := 'C:\MMG-POS\terminal.json';
  Files[1] := 'C:\MMG-POS\helper\terminal.json';
  for I := 0 to 1 do
    if FileExists(Files[I]) and LoadStringFromFile(Files[I], Raw) then
    begin
      Result := JsonValue(String(Raw), Key);
      if Result <> '' then Break;
    end;
  if Result = '---' then Result := '';
end;

{ command-line switch > branch-defaults.ini > old terminal.json > built-in default }
function Pick(const Switch, IniKey, Fallback: String): String;
begin
  Result := ExpandConstant('{param:' + Switch + '|}');
  if Result = '' then
    Result := GetIniString('defaults', IniKey, '', ExpandConstant('{src}\branch-defaults.ini'));
  if Result = '' then
    Result := Fallback;
end;

function IsValidPrinter(const S: String): Boolean;
var
  I: Integer;
  C: Char;
begin
  Result := S <> '';
  for I := 1 to Length(S) do
  begin
    C := S[I];
    if not (((C >= '0') and (C <= '9')) or ((C >= 'A') and (C <= 'Z')) or
            ((C >= 'a') and (C <= 'z')) or (C = '.') or (C = '-')) then
      Result := False;
  end;
end;

function IsValidCom(const S: String): Boolean;
var
  U: String;
  I: Integer;
begin
  U := Uppercase(S);
  Result := (Length(U) > 3) and (Copy(U, 1, 3) = 'COM');
  for I := 4 to Length(U) do
    if not ((U[I] >= '0') and (U[I] <= '9')) then
      Result := False;
end;

{ Values go into JSON by hand, so reject characters that would break it. }
function IsSafeText(const S: String): Boolean;
begin
  Result := (Pos('"', S) = 0) and (Pos('\', S) = 0);
end;

procedure InitializeWizard;
begin
  CfgPage := CreateInputQueryPage(wpWelcome, 'Workstation settings',
    'BIR terminal credentials and hardware for this cashier PC',
    'Leave the BIR fields blank to set them later in C:\MMG-POS\config.json (receipts will show --- until set).');
  CfgPage.Add('Machine Identification Number (MIN):', False);
  CfgPage.Add('Serial Number (SN):', False);
  CfgPage.Add('Permit to Use No (PTU No):', False);
  CfgPage.Add('Receipt printer IP address:', False);
  CfgPage.Add('Customer display COM port:', False);
  CfgPage.Values[0] := Pick('MIN', 'MIN', OldCredential('MIN'));
  CfgPage.Values[1] := Pick('SN', 'SN', OldCredential('SN'));
  CfgPage.Values[2] := Pick('PTU', 'PTU_NO', OldCredential('PTU_NO'));
  CfgPage.Values[3] := Pick('PRINTER', 'printer_ip', '192.168.192.168');
  CfgPage.Values[4] := Pick('COM', 'display_port', 'COM3');
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  { Upgrade: keep the existing config.json untouched. }
  Result := (PageID = CfgPage.ID) and FileExists(ConfigPath);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  I: Integer;
begin
  Result := True;
  if CurPageID <> CfgPage.ID then Exit;

  for I := 0 to 4 do
    if not IsSafeText(CfgPage.Values[I]) then
    begin
      MsgBox('Quotes and backslashes are not allowed in these fields.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
  if not IsValidPrinter(CfgPage.Values[3]) then
  begin
    MsgBox('Enter a valid printer IP address or hostname, e.g. 192.168.192.168.', mbError, MB_OK);
    Result := False;
  end
  else if not IsValidCom(CfgPage.Values[4]) then
  begin
    MsgBox('Enter the display port as COM followed by a number, e.g. COM3.', mbError, MB_OK);
    Result := False;
  end;
end;

function OrDash(const S: String): String;
begin
  Result := Trim(S);
  if Result = '' then Result := '---';
end;

{ The old install.bat put a per-user "MMG POS Helper.lnk" in each user's Startup folder.
  Left in place, the old helper and the new one would both launch at login. }
procedure RemoveOldStartupShortcuts;
var
  FindRec: TFindRec;
  UsersDir, Lnk: String;
begin
  UsersDir := ExpandConstant('{sd}\Users\');
  if FindFirst(UsersDir + '*', FindRec) then
  try
    repeat
      if ((FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0) and
         (FindRec.Name <> '.') and (FindRec.Name <> '..') then
      begin
        Lnk := UsersDir + FindRec.Name +
               '\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\MMG POS Helper.lnk';
        if FileExists(Lnk) then
          DeleteFile(Lnk);
      end;
    until not FindNext(FindRec);
  finally
    FindClose(FindRec);
  end;
end;

{ install-helper.ps1 (the old Python variant) ran "python app.py" from C:\MMG-POS\helper and kept
  terminal.json there. Stop it, keep its BIR credentials, then remove the old source files.
  Only Python processes whose command line contains MMG-POS and app.py are touched, so a
  developer's own checkout is left alone. Results go to the setup log (run with /LOG=file). }
procedure RemoveOldPythonHelper;
var
  R: Integer;
  Pids, Tmp, OldDir: String;
  Raw: AnsiString;
begin
  Tmp := ExpandConstant('{tmp}\oldhelper.txt');
  DeleteFile(Tmp);
  Exec('powershell.exe',
    '-NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | ' +
    'Where-Object { $_.Name -match ''^pythonw?\.exe$'' -and $_.CommandLine -like ''*MMG-POS*app.py*'' } | ' +
    'ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $_.ProcessId } | ' +
    'Set-Content -Path ''' + Tmp + '''"',
    '', SW_HIDE, ewWaitUntilTerminated, R);
  if FileExists(Tmp) and LoadStringFromFile(Tmp, Raw) then
  begin
    Pids := Trim(String(Raw));
    StringChangeEx(Pids, #13#10, ', ', True);
    Log('Old Python helper was running and was stopped (PID ' + Pids + ')');
  end
  else
    Log('No old Python helper running');

  OldDir := ExpandConstant('{app}\helper');
  if FileExists(OldDir + '\app.py') then
  begin
    { Its terminal.json was already read to prefill the wizard (see OldCredential). }
    if DelTree(OldDir, True, True, True) then
      Log('Removed old Python helper folder ' + OldDir)
    else
      Log('Could not fully remove old Python helper folder ' + OldDir);
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  R: Integer;
begin
  { Free the exe so it can be replaced on upgrade. }
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM {#AppExe}', '', SW_HIDE, ewWaitUntilTerminated, R);
  RemoveOldPythonHelper;
  RemoveOldStartupShortcuts;
  Result := '';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  J: String;
begin
  if (CurStep = ssPostInstall) and not FileExists(ConfigPath) then
  begin
    J := '{' + #13#10 +
         '  "MIN": "' + OrDash(CfgPage.Values[0]) + '",' + #13#10 +
         '  "SN": "' + OrDash(CfgPage.Values[1]) + '",' + #13#10 +
         '  "PTU_NO": "' + OrDash(CfgPage.Values[2]) + '",' + #13#10 +
         '  "printer_ip": "' + Trim(CfgPage.Values[3]) + '",' + #13#10 +
         '  "display_port": "' + Uppercase(Trim(CfgPage.Values[4])) + '",' + #13#10 +
         '  "display_baudrate": 9600,' + #13#10 +
         '  "ws_port": 9999' + #13#10 +
         '}' + #13#10;
    if not SaveStringToFile(ConfigPath, J, False) then
      MsgBox('Could not write ' + ConfigPath + '. Copy config.json.example there and edit it.', mbError, MB_OK);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  { The e-journal is a BIR record: keep it and the config unless the user explicitly says otherwise. }
  if CurUninstallStep = usPostUninstall then
    if (not UninstallSilent) and
       (MsgBox('Also delete the e-journal and config.json in ' + ExpandConstant('{app}') + '?' + #13#10 +
               'Choose No to keep them (recommended).', mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES) then
    begin
      DeleteFile(ExpandConstant('{app}\ejournal.txt'));
      DeleteFile(ExpandConstant('{app}\config.json'));
      DeleteFile(ExpandConstant('{app}\terminal.json'));
      RemoveDir(ExpandConstant('{app}'));
    end;
end;
