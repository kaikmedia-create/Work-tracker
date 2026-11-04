# Mobile Bedienung in Relief Studio 28

Am Handy zwischen **Bearbeiten** und **Vorschau** wechseln. **Projekt** enthält Neu, Öffnen, Speichern und Exportieren. Die Modellberechnung und die Dateiformate bleiben wie am Desktop. Keine separate URL und kein manueller Umschalter erforderlich.

## Geprüft am 4. November 2026

- Der getestete Anwendungscode stammt aus Commit `10c6ab778e02047a5b4f43ddc49f79e54eaff714`. Die bestehenden 344 automatischen Tests bestanden ohne Fehler oder übersprungene Tests.
- Pixelvergleich in Chromium für PIN-Seite, Moduswahl und Ortseditor gegen `b655d7433405fa51edd776d6a502ad82bc525ccb`: alle sechs Bildpaare identisch (1440 × 900 und 390 × 844 mit Maus). Auf beiden Desktop-Profilen wurden keine zusätzlichen Mobil-JS- oder CSS-Dateien angefragt.
- Lokale Chromium-Touchprofile: 320 × 568, 390 × 844, 412 × 915, 844 × 390. Kein horizontaler Seitenüberlauf auf Startseite, im Ortseditor oder in der Kartenvorschau. Abbrechen, Fehlermeldung und JSON-Diagnose, Zwei-Finger-Zoom, Öffnen, Speichern und Moduswechsel geprüft. Ortssuche mit kontrollierter Anbieterantwort, nicht als Live-Abruf.
- Zwei private, unveränderte Weinheim-Projekte über Dateiauswahl und STL-Knopf geprüft: 2,258 × 2,117 km, Binär-STL 89.261.384 Byte; 3,2 × 3,0 km, Binär-STL 115.224.984 Byte. Dateigröße gegen Dreieckszahl geprüft. Private Projekte und Exporte wurden nicht ins Repository übernommen.
- Chromium, echter PIN-Einstieg, Dateidialog und Downloads: [Laufprotokoll](https://github.com/kaikmedia-create/Work-tracker/actions/runs/41867963815). Der Chromium-Teil bestand; der WebKit-Teil dieses Tests mit abgefangenen Netzwerkzugriffen und speicherbasiertem Dateiinhalt erreichte kein fertiges Modell.
- Separater WebKit-Test mit normalem Dateizugriff und echten Dateien: [Laufprotokoll](https://github.com/kaikmedia-create/Work-tracker/actions/runs/41868926040). STL (66.959.984 Byte) und PDF (20.660 Byte) über die beiden regulären Downloadknöpfe geprüft. Reproduzierbar mit `source/tests/phone_webkit_download.py`.

Die Mobilprüfungen liefen mit emulierten Touch-Displays, nicht auf physischen Smartphones. Sie bestätigen keine bestimmte Geschwindigkeit oder Speicherreserve eines einzelnen Handys.
