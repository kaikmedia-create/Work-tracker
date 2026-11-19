# Relief Studio — reduzierte Oberfläche (28-simple-1)

Stand: 19. November 2026. Ausgangscommit: `2db0fd3f55381a4baf03d0a14e1a5ac63030b17f`.

## Bedienung

Große Vorschau links, kompakte Einstellungen rechts auf Desktop. Ruhigere Farben, kürzere Überschriften und vereinfachter Einstieg für Poster und 3D-Relief. Die beiden Arbeitsabläufe bleiben getrennt.

Projektaktionen sind auf Desktop in einem Menü gebündelt. Auf Telefonen wird das bereits vorhandene Projektmenü weiterverwendet, auch nach einem Layoutwechsel. Die Stadt-Beispielbuttons, der zusätzliche Zeichnen-Shortcut und die externe Google-Maps-Recherche-Verknüpfung sind aus der Oberfläche entfernt. Die Karte lässt sich weiterhin verschieben und an den Ecken skalieren.

Selten benötigte Gelände-, Gebäude-, Wasser-, Marker-, Farb-, Typografie- und Auflösungsoptionen liegen in geschlossenen, beschrifteten Bereichen. Nicht pauschal gelöscht: bestehende Projektwerte bleiben erhalten. Titel, Format, Kartengröße und Weißraum sind weiter direkt zugänglich. Exportformate, Sperrgründe und Quellenhinweise bleiben vorhanden.

**Straßenstärken unverändert:** Hauptstraßen, Verbindungsstraßen, Nebenstraßen sowie Wege/Pfade bleiben außerhalb der aufklappbaren Bereiche. DOM-Knoten, Werte, Min/Max, Schrittweiten und Ereignisbehandlung werden nicht ersetzt. Auch die 3D-Straßenprofil-Einstellungen bleiben direkt zugänglich. Keine Änderungen an Gelände-, Gebäude-, Straßen-, Daten- oder Exportberechnungen.

## Integration

`relief-ux29-base.mjs` ist eine byteidentische Kopie des bisherigen UX29-Moduls (Git-Blob `397e4a061968d5d34f44f074e8258441014e6900`). Der schlanke Wrapper ergänzt eine reversible Darstellungsschicht aus `studio-simple.mjs`. Dieselbe Komposition gilt für die PIN-Vorschau und die lokale Source-Materialisierung. Die Rücknahme entfernt zuerst die neue Schicht, dann UX29; unbekannte Änderungen werden nicht überschrieben. Die Loader-Abfrageversionen sind auf `28-simple-1` erhöht. Verschlüsselung und PIN-Verhalten bleiben unverändert.

## Tatsächlich ausgeführte Prüfungen

- 9 Node-Codeprüfungen bestanden: reversible und idempotente Anwendung, Einzeldatei-Materialisierung, Schutz unbekannter Änderungen, unveränderte andere Quellen und Classic-Script-Syntax.
- 46 Chromium-Prüfungen an einer **isolierten UI-Vertragsfixture** bestanden: Erhalt der Steuerelemente und Werte, Straßenregler und Ereignisse, Projektmenü mit Tastatur/Fokus, optionale Bereiche, Export-Sperren, Lizenzhinweise, Invalid-Feld-Fokus, rechte Seitenleiste, Ein-/Ausklappen, Mobilmenü-Wechsel und kein horizontaler Überlauf bei 390, 768, 1366, 1920 und 2560 Pixeln.
- Desktop- und Mobil-Screenshots dieser Fixture visuell kontrolliert. Ein beim Test gefundener Fokuswechsel-Fehler im Projektmenü wurde behoben und die Prüfungen wiederholt.
- Loader-Syntax geprüft. Die drei geänderten bestehenden Loader/HTML-Dateien wurden vor der reinen Cache-Version-Änderung anhand ihrer Git-Blob-SHAs mit dem Original verglichen.

**Grenze der Prüfung:** Die Browserprüfungen sind Komponentenprüfungen mit nachgebildeter DOM-Struktur und Basis-CSS, kein vollständiger Ende-zu-Ende-Test der verschlüsselten Live-Anwendung. Die vollständige bestehende npm-Testsuite, echte externe Kartenabrufe sowie PDF/STL/3MF-Ausgaben wurden in dieser Sitzung nicht erneut ausgeführt. Ein erfolgreicher Pages-Build ersetzt diese Prüfungen nicht.

Node-Test: `cd relief-studio/source && node --test tests/studio-simple.test.mjs`.
Browser-Test: `python tests/studio-simple.browser.py` (Python Playwright und Chromium erforderlich; `CHROMIUM_PATH` optional). Die Fixture rendert vollständig im Speicher und benötigt kein Netzwerk.
