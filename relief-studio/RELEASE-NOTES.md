# Release 8 — 30.10.2026

- Kritischen Küstenfehler bei kleinen Ausschnitten behoben: gemeinsame planar-topologische Verarbeitung statt einzelner Eckschlüsse; OSM-Regel Land links / Meer rechts.
- Land-Sicherheitscheck: verdächtige Meeresflächen über vielen Gebäuden werden nicht gezeichnet, stattdessen verständliche Warnmeldung.
- Foz-Regression für 3,65 × 3,42 km und 8 × 7 km; Alt-Caches mit `map:v8:` sicher umgangen, Export alter Küstenprojektdateien erklärt/blockiert.
- Buttons auf großen und flachen Desktop-Fenstern vollständig sichtbar: Browserhöhe wird dynamisch in Header, Arbeitsfläche und Navigationsleiste aufgeteilt; Eingabebereich scrollt separat.
- Testbasis: die zwei vom Nutzer bereitgestellten Foz-PDFs (kleiner Ausschnitt nahezu vollständig blau, großer Ausschnitt plausibel); synthetische Koordinaten für reproduzierbaren Funktionstest. Realer Live-Overpass-Abruf und physischer Druck sind nicht Bestandteil der bestandenen Tests.

## Relief Studio 7 — Poster-Preview-Bugfix (25.10.2026)

- Behoben: weißer Überstand am Posterrand, besonders bei 60 × 80 cm. Ursache war ein festes DIN-A4-Seitenverhältnis im CSS, obwohl das Canvas korrekt 3:4 gerendert wurde.
- Papiervorschau und Canvas erhalten jetzt identische Breite, Höhe und Seitenverhältnis aus dem gewählten Druckformat. Keine zusätzliche weiße Fläche; Canvas ist exakt auf das Poster begrenzt.
- Getestet: 8 Formate × 6 Viewports und Hoch-/Querformat (54 Ausrichtungskontrollen); 38 Logiktests.
- Das Export-Rendering selbst war davon nicht betroffen; es wurde zusätzlich erneut überprüft.
- GitHub-Pages-PIN ist nach wie vor nur eine statische Vorschau-Sperre, keine sichere Zugangskontrolle.

# Relief Studio 6 · 2026-10-25

- Browseransicht für Desktop bis 3200×1800 ohne vertikales/waagerechtes Dokument-Scrolling; separate Einstellungsleiste.
- Papierformat, Maße, Rand und relative Kartenfläche direkt in Text & Layout bearbeiten.
- Quellenzeile nur für rein persönliche Entwürfe ausblendbar, mit Hinweis auf Namensnennungspflicht bei öffentlicher Nutzung.
- 60×80 cm mit 7087×9449 px @300dpi für JPEG/PNG getestet; PDF mit exaktem Papiermaß und Vektordaten.
- Export bleibt auf 8.000.000 Byte pro Poster begrenzt. Bei komplexen Rasterkarten kann die Auflösung mit Warnung reduziert werden.
- Einfache AES-GCM-Version-6-Veröffentlichung statt verschachtelter Update-Patches. GitHub Pages bleibt kein echter Zugangsschutz.
- Ergebnisse: 36/36 Logiktests, 46/46 bestehende Browser-Regressionen, 21/21 v6-Desktop- und Druckdateiprüfungen; Browser-Smoke-Test des verschlüsselten v6-Gates gesondert.