# Relief Studio 13 – Testbericht, 2. November 2026

## Durchgeführte Vorabprüfungen
Sieben gezielte JavaScript-Laufzeittests mit echtem Loader und simulierten Webantworten bestanden: automatische Gebäudeaufteilung, Relationsaufteilung, Cache-Wiederaufnahme, HTTP-429-Sperre, hartes Zeitlimit, Ausweichserver sowie Hash/Delta-Prüfung.

## Zusätzlich eingecheckte Tests
`tests/v13.test.mjs`, `tests/v13_gate.test.mjs`; Versionsprüfung des v12-Gates an die neue veröffentlichte Einstiegsversion angepasst.

## Einschränkungen
Die vollständige Node-Gesamtsuite und ein vollständiger Live-3D-Abruf aller externen Daten wurden in dieser Umgebung nicht ausgeführt. Echte Gebäudequalität und physischer 3D-Probedruck wurden nicht neu abgenommen.
