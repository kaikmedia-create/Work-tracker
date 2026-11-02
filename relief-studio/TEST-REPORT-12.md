# Relief Studio 12 – Architektur und Druckgeometrie

Stand: 2. November 2026. Die Zahlen gelten für die in dieser Version ausgeführten Prüfungen.

## Änderungen und Datenbasis

Die bisherige Höhenraster-Darstellung wurde für Gebäude durch polygonale Grundrisse, senkrechte Wände und aus vorhandenen Tags abgeleitete Dachflächen ersetzt. Das Gelände verwendet weiterhin die bestehenden Terrain Tiles; es wurden weder höhere Vermessungsauflösung noch neue echte Gebäudedaten erfunden.

Unterstützt werden Flach-, Sattel-, Walm-, Pyramiden-, Pult-, Kegel- und Kuppeldächer. Kegel/Kuppel erscheinen nur bei entsprechender Dachangabe. Gebäudehöhen einschließlich Dach werden nicht doppelt addiert. Fehlende Höhen, aus Geschosszahlen abgeleitete Höhen, ergänzte Dachhöhen und nicht unterstützte Dachformen werden gekennzeichnet. Hauptgebäude und Gebäudeteile bleiben getrennt erfasst; Teile verdrängen nur die eigene Grundfläche.

## Reproduzierbare Prüfungen

- 20 Architekturtests: sieben Dachformen, Innenhöfe, dünner Turm, überlappende Gebäude, Kirche mit Turmteil, Kartenrand, Dachrichtung, unbekannte Dachform, Gesamthöhe, Parser für Teile und Mauern, fehlende Geometrie, punktförmiger Gebäudekontakt, Migration alter Überhöhungen und ältere Projektdateien mit 503 Gebäuden.
- 15 Browserprüfungen mit dem tatsächlichen Blob-Worker und STL-/3MF-Downloads: Architekturvorschau, vereinfachte Bedienung, Datenqualitätsanzeige, drei Desktopgrößen und Einzeldateiversion. Keine unbehandelten JavaScript-Fehler.
- Deterministischer Lasttest ohne öffentliche Datendienste: 250, 1.000 und 3.500 gedrehte synthetische Gebäude auf geneigtem Gelände. Jeweils keine fehlerhaften Kanten. Messwerte in `reports/v12/stress.json`; Hardware-/Browserabhängigkeit beachten.
- Insgesamt 105 Node-Tests bestanden, einschließlich der 20 neuen Architekturtests und bestehender Netz-/Cache-, Küsten-, Poster- und Projektprüfungen.
- 46 bestehende Browser-Workflowprüfungen bestanden, einschließlich neun tatsächlicher PDF-/PNG-/JPEG-Downloads unter 8 MB, Projektimport/-export und 3D.
- 10 lokale Server-Sicherheitsprüfungen bestanden.
- Unabhängige Prüfung mit trimesh: vier tatsächlich im Browser exportierte STL-/3MF-Dateien sind geschlossen, konsistent orientiert, besitzen positives Volumen und jeweils genau eine zusammenhängende Komponente. 3MF-Archive ohne CRC-Fehler.
- Der getestete v12-Webstarter entschlüsselt den bisherigen v10-Stand, wendet die verifizierten v11-/v12-Deltas an und stimmt bei allen acht geprüften öffentlichen Quelldateien bytegenau mit dem getesteten Code überein. Dieses rekonstruierte Webpaket wurde ebenfalls im echten Browser mit dem Architektur-Worker ausgeführt.

`npm test`, `node tests/architecture_stress.mjs`, `python tests/architecture_browser.py` und `python tests/workflow_browser.py` führen die jeweiligen Tests erneut aus. Browserprüfungen benötigen Playwright und Chromium.

## Technische Druckgrenzen

Die Oberfläche ist eine 2,5D-Volumenvereinigung: Innenhöfe bleiben offen, aber positive min_height-Bereiche werden zum Gelände abgestützt. Einzelne rein punktförmige Gebäudekontakte erhalten automatisch eine 0,004 mm breite Verbindung, um nicht-manifold Nähte zu vermeiden. Solche Kontaktkorrekturen liegen unter üblicher Druckdetailauflösung und werden gezählt. Keine globale Verbreiterung von Wahrzeichen. Der Export lehnt Geometrie mit verbleibenden offenen oder nicht-manifold Kanten ab.

## Nicht nachgewiesen

Die Architekturbeispiele und Lasttests sind ausdrücklich synthetisch, nicht die Burg Windeck. Ein kompletter Live-Abruf von Windeck und ein Vergleich mit einer vermessenen Architekturquelle konnten nicht durchgeführt werden. Keine Zusicherung einer originalgetreuen Burg-, Kirchenfassaden- oder Dachrekonstruktion ohne entsprechende Quellgeometrie. Kein physischer Probedruck. Die Screenshots zeigen die tatsächlich ausgeführte Anwendung, nicht KI-generierte Modellbilder.

## Veröffentlichung

In diesem Durchlauf nicht auf GitHub veröffentlicht. Die verfügbare GitHub-Anbindung bietet Leseaktionen, keine Commit-/Push-Aktion. Der verbundene Desktop-Zugang hat kein angeschlossenes Gerät. Die bestehende Live-Seite bleibt unverändert. Das separat bereitgestellte GitHub-Update enthält ausschließlich Dateien unter `relief-studio/`; andere Work-tracker-Dateien werden nicht geändert.
