# Kartenausschnitt am Handy – 4. November 2026

Der Fix betrifft nur die optional geladenen Handy-Module. Im direkten Chromium-Vergleich bei 390 × 667 CSS-Pixeln begann die Karte bei y=81 statt y=242. Am Desktop waren die verglichenen Ansichten mit Maus (1.440 und 390 CSS-Pixel Breite) vor und nach der Änderung pixelgleich.

Die Zweifingergeste veränderte vorher unbeabsichtigt den gewählten Kartenbereich, ohne zu zoomen. Geprüft wurden Zoom und Verschiebung mit zwei Fingern ohne Änderung der Auswahlgrenzen, Verschieben und Größenänderung mit einem Finger sowie Wiederherstellung der Auswahl beim Abbrechen. Der direkte Erstellen-Knopf und anschließend der Export wurden mit kontrollierten Geodaten getestet. Die 3D-Datenaufbereitung bleibt unverändert.

Zwei unveränderte gespeicherte Weinheim-Projekte wurden in der Chromium-Handyemulation geöffnet und über den STL-Knopf exportiert. Die erzeugten Binärdateien: 89.261.384 und 115.224.984 Bytes, jeweils mit zur Dreieckszahl passender Länge. Keine Projektdateien hochgeladen. Kein Test auf einem physischen Handy.

Browserregression: `source/tests/phone_crop_flow.py`. Zusätzlicher echter Datei-/Downloadtest: `source/tests/phone_webkit_download.py`. Der erste WebKit-Tipp auf den PDF-Knopf wurde von einem Hinweis des überlappenden Schritt-Fußbereichs abgefangen. Im korrigierten Handy-Editor befinden sich die Panels und die Schrittnavigation im normalen Dokumentfluss desselben Scrollbereichs.
