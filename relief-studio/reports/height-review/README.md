# Tatsächliche Messhöhen vergleichen

Prüfdatum: 6. November 2026. Ausgangsstand: bb602c62c4b48884a66c729e91803e262302f570. Diese Änderung ergänzt die Anzeige und den Vergleich; sie verändert weder den Algorithmus der Gebäudehöhen noch die Dachformen oder die Messdatenabdeckung.

## Warum der Unterschied klein aussehen kann
„Klassische Kanten + Messhöhen“ korrigiert geeignete Gebäudehöhen, nicht die Dachform. Ein Gebäude ohne Dachangaben erhält dadurch keine neue Dacharchitektur. Kleine Höhenänderungen verschwinden außerdem in der Gesamtansicht: 2 m Höhendifferenz auf einem 2 km breiten, 200 mm großen Modell sind 0,2 mm. Ohne nutzbare Messdaten oder bei abgelehnten Höhenkorrekturen bleibt das klassische Modell erhalten.

Die bisherige Zahl „Gebäude ergänzt“ zählte auch akzeptierte Höhenwerte, die den Ausgangswert bestätigten. Jetzt werden tatsächlich geänderte und bestätigte Werte getrennt ausgewiesen. Änderungen unter 0,05 m gelten für diese Anzeige als unverändert; Geometrie und Export werden dafür nicht verändert.

## Neue Bedienung
Nach dem Wechsel auf die Kombination erscheint in der 3D-Vorschau eine Zusammenfassung: Zahl der geänderten Höhen, Median der absoluten Änderung in Millimetern des Druckmodells und Hinweis, dass Dachformen unverändert bleiben. „Unterschied ansehen“ richtet den Blick auf ein betroffenes Gebäude. „Nächstes Gebäude“ wechselt zum nächsten Beispiel. Alte und neue Höhe sowie die Änderung im Druckmodell stehen daneben.

„Vorher“ und „Nachher“ berechnen die beiden echten Modelle aus denselben Kartendaten. Zielpunkt, Winkel und Zoom werden beibehalten; insbesondere wird die vom maximalen Modell-Z abhängige Kameraausrichtung kompensiert. Es gibt keine künstlich verstärkten Höhen und keinen zusätzlichen vollständigen Mesh-Cache. Während der Berechnung steht ausdrücklich, dass noch das vorige Bild sichtbar ist.

Ohne Messdaten lautet der Hinweis „Keine Änderung: keine nutzbaren Messdaten geladen.“ Ein Abruffehler und eine Rücknahme nach der Geometrieprüfung werden getrennt erklärt. Der Diagnose-Download bleibt direkt erreichbar. Die Regeln enthalten keine Ortsnamen. Der Standardmodus bleibt klassisch; dort ist die neue Anzeige zunächst verborgen. Desktopaufbau und mobile Navigation bleiben bestehen.

## Prüfung
393 automatische Tests bestanden: 382 bestehende Prüfungen plus elf neue Fälle für echte Änderungen vs. Bestätigungen, fehlende Abdeckung, Abruffehler, zurückgenommene Korrekturen, Druckmaßstab, geschützte Angaben, Kameraposition und unveränderte Quelldaten.

Sechs vollständige Browserfälle bestanden: Heidelberg und Sfax jeweils in Desktop-Chromium, mobiler Chromium-Emulation und mobiler WebKit-Emulation. Frische Browserkontexte, echte globale Daten- und Geländeabrufe; der optionale Overpass-Dienst wurde bewusst blockiert. Die Webseite wurde über die normale PIN-Oberfläche geöffnet. STL wurde über die tatsächlichen Downloadbuttons exportiert.

In Heidelberg unterschieden sich klassische und hybride STL-Dateien. 418 Gebäudehöhen änderten sich; im geprüften 350-m-Ausschnitt bei 200 mm Druckbreite betrug die typische Änderung 2,63 mm. Das erste fokussierte Beispiel änderte sich von 9 auf 19,9 m. Vorher/Nachher hielt denselben Kamerazielpunkt, Zoom und Blickwinkel. Der erneute klassische bzw. hybride Export war innerhalb jedes Browserlaufs byteidentisch zum jeweils ersten Export.

In Sfax fehlten passende Messoberflächen: Beide Dateien blieben byteidentisch; die neue ausdrückliche Keine-Änderung-Anzeige und ihr Diagnose-Download wurden geprüft. Keine unbehandelten JavaScript-Fehler in diesen sechs Fällen. Die STL-Prüfung dieses Durchlaufs kontrolliert Formatlänge, Dreieckszahl und Dateihashes; eine erneute vollständige Topologieprüfung ist nicht Gegenstand dieses reinen Anzeige-Updates. Keine physischen Smartphone- oder Drucktests.

[Browser- und Regressionstests](https://github.com/kaikmedia-create/Work-tracker/actions/runs/42204225167)

## Reproduktion
`cd relief-studio/source && npm test` rekonstruiert den SHA-256-geprüften Anwendungsstand aus den veröffentlichten Deltas und führt die Tests aus. Der PIN-Loader verwendet dieselben verifizierten App- und HTML-Bytes. `tests/height-review-browser.py <URL> <Ordner> chromium desktop` oder `webkit mobile` wiederholt die Oberflächenprüfung. `tools/install_height_review.py` dokumentiert nur die einmalige Erstellung aus dem Ausgangsstand, nicht den normalen Start.
