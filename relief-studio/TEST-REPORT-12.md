# Relief Studio 12 – Prüfprotokoll

Stand: 1. November 2026. Neue Funktion: dreiteiliges Querformat-Poster.

## Ausgeführt

- 103 Node-Prüfungen bestanden, darunter 18 neue Triptychon-Prüfungen: Layoutgrenzen, 800 Layoutkombinationen, Quellenimport, echte Maße, verschiedene Formate, Cropping und PDF-Rotation, Seitenwahl, Größenlimits, beschädigte und verschlüsselte Quellen, gespeicherte Kombis sowie Ausschluss von Dokument-JavaScript/Linkaktionen aus der Druckseite.
- 34 gezielte Browserprüfungen bestanden: kleiner Startlink, beide Erstellungswege, drei unabhängige Städte, Original-PDF-Vorschau, Projekt-Roundtrip, Regler, Fehlerbehandlung und sichtbare Navigation bei 1366×768 bis 3840×2160; Mobilbreiten 320/390/700. 160 schnelle Regleränderungen; keine unbehandelten JavaScript-Fehler.
- 10 lokale Server-Sicherheitsprüfungen bestanden (Anmeldung, Zugriffskontrolle, ungültige Anfragen und Ratenlimit).
- 46 bestehende Workflow-Browserprüfungen bestanden (Poster, 3D, Export, Import, Fehler und Mobilansichten).
- Unabhängige PyMuPDF-Prüfung: 10 Druckformate einschließlich A4–A0, 80×60 cm und 120×40 cm; eine Seite je Kombination; exakte Papiermaße; Text extrahierbar; Vektorkombis ohne eingebettete Bilder. Vier PDF-Rotationen mit versetzter CropBox pixelweise gegen die gerenderte Quelle verglichen. Zwei vom Nutzer zuvor bereitgestellte Foz-PDFs wurden lokal als echte Importfälle verwendet; nicht im Repository veröffentlicht.
- Lasttest: drei getrennte Node-Prozesse gleichzeitig. Je drei Motive mit 25.000 synthetischen Gebäuden; je drei Exporte (80×60 cm, 100×70 cm, A0): neun PDFs, jeweils ca. 2,00 MB. Keine unzulässige Rasterung oder stille Qualitätsreduktion. Einzelne Kompositionsläufe ca. 0,8–1,5 Sekunden in dieser Umgebung, keine allgemeine Geschwindigkeitsgarantie.

Rohberichte: `reports/v12/`. Die Vorschau-Screenshots mit Teststadt-Namen zeigen synthetische Geometrie, keine vermessenen Stadtmodelle.

## Grenzen

Kein physischer Probedruck; keine PDF/X-/CMYK-Zertifizierung. Die Erzeugung neuer Stadtgeometrie verwendet weiterhin den v11-Netzwerkcode und öffentliche Anbieter. Der neue Workflow wurde mit kontrollierten Kartenantworten getestet, nicht mit einem Lasttest auf öffentlichen OSM-Servern. Bilder/Scans bleiben Bilder/Scans. Geschützte PDFs werden abgewiesen; Annotationen und Formular-Widgets sollten vor dem Import in der Quellanwendung als Druckinhalt exportiert werden.
