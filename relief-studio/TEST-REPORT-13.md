# Relief Studio 13 – Testbericht, 2. November 2026

## Durchgeführte Vorabprüfungen
Sieben gezielte JavaScript-Laufzeittests mit echtem Loader und simulierten Webantworten bestanden: automatische Gebäudeaufteilung, Relationsaufteilung, Cache-Wiederaufnahme, HTTP-429-Sperre, hartes Zeitlimit, Ausweichserver sowie Hash/Delta-Prüfung.

## Zusätzlich eingecheckte Tests
`tests/v13.test.mjs`, `tests/v13_gate.test.mjs`; Versionsprüfung des v12-Gates an die neue veröffentlichte Einstiegsversion angepasst.

## Einschränkungen
Die vollständige Node-Gesamtsuite und ein vollständiger Live-3D-Abruf aller externen Daten wurden in dieser Umgebung nicht ausgeführt. Echte Gebäudequalität und physischer 3D-Probedruck wurden nicht neu abgenommen.

## Live-Browser-Regressionsprüfung
Nach dem ersten Deployment zeigte der Browser einen Gate-Fehler: Die statische verschlüsselte Vorschau enthält keine Serverdatei `server.mjs`. Der Versions-13-Updater überspringt deshalb ausschließlich die serverseitige Teiländerung, wenn diese optionale Datei nicht im verschlüsselten Browserpaket enthalten ist. Browserdateien bleiben zwingend und prüfsummengeschützt.
