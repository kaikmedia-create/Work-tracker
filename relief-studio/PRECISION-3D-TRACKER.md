# Präzisions-3D · QA und Ausbaupfad (v28+)

Stand: 15.11.2026. Dieses Dokument grenzt die verifizierbare Änderung vom langfristigen Architekturziel ab.

## In diesem Änderungszweig
- Unberührte OSM-Gebäude behalten ihre Original-ID, erfasste Dachform/-richtung, Gebäude-Teilbeziehungen, nutzerimportierte Referenzdächer und vorhandene Dachpakete.
- Nur von amtlichen/Fach-Flächen tatsächlich beschnittene Restflächen werden schematisch modelliert; dabei werden unverifizierbare Dachannahmen verworfen.
- Die 3D-Modellprüfung weist pro Baukörper die Konstruktionsstufe `exact` (direkte Quelle), `measured` (klassifizierte Messung), `inferred` (Tags/Referenz) oder `fallback` aus. Eine direkte LoD2-Quelle ist dennoch bereits generalisiert. Das ist kein Maß für absolute Vermessungsgenauigkeit.
- Die bestehende 3MF-Metadaten-Datei übernimmt den neuen Gebäude-QA-Nachweis.
- Automatische Tests prüfen erhaltene Gebäude-Teile, Dachrichtungen, beschnittene Restflächen, Quellenklassen sowie bestehende exakte STL-/3MF-Exporte.

## Datenintegrität der mitgelieferten amtlichen Modelle
Der CI-Lauf vom 15.11.2026 zeigte defekte Gzip-Streams der zuvor veröffentlichten LGL-LoD2-Pakete. Für die beiden dokumentierten Ausschnitte wurden die Original-Archive erneut vom LGL geladen und die gültigen, konservativ geprüften CityGML-Körper neu verpackt:
- **Burg Windeck:** 6 validierte Volumenkörper, 0 verworfen.
- **Wachenburg:** 11 validierte Volumenkörper, 2 offene/nichtmannigfaltige Modelle bewusst verworfen.
Die Quelle bleibt LGL Baden-Württemberg (dl-de/by-2-0). Die relevanten Archivprüfsummen stehen in der Modellprovenienz, das Paketverzeichnis nennt das Aktualisierungsdatum. Die frühere Zahl 2/15 beschreibt die alte Veröffentlichung, nicht die neu geprüften Pakete. Ein dedizierter Gzip-/Solid-Test verhindert eine unbemerkte Wiederholung dieses Schadens. Diese Pakete decken weiterhin **nicht** ganz Weinheim ab.

## Weitere behobene Integrationsfehler
- Das original eingefügte Manifold-JS-Modul nutzte bei `blob:`-Imports eine ungültige relative WASM-URL. Nach der SHA-256-Prüfung wird ausschließlich der erwartete WASM-URL-Ausdruck auf die feste Bibliotheksquelle umgestellt; unbekannte Modulformate bleiben blockiert.
- Der echte Browser-3MF-Download verliert nicht mehr `officialAudit`: Der Exportworker bekommt für 3MF die Gebäudeevidenz und amtliche Platzierung mit. Diese gezielte Änderung läuft auch in der geprüften GitHub-Pages-PIN-Vorschau, ohne die historischen Versionsprüfsummen außer Kraft zu setzen.
- Für die Wachenburg ergab der Manifold-Check zwei isolierte Restsplitter mit praktisch null Volumen (<0,02 mm³) bei 100 mm Modellbreite. Nur solche unprintbaren, unabhängigen CSG-Fragmente werden aus dem **Druckmesh** entfernt und als `printAdjustments` protokolliert; alle Quellflächen bleiben gespeichert. Wesentliche Baukörper werden nicht pauschal geglättet oder gelöscht.
- CI-/Chromium-Tests verwenden bei einem vom aktuellen Ubuntu-Runner nicht unterstützten Playwright-Headless-Download den installierten Chrome-Browser, ohne die Browserprüfungen zu überspringen. Mobile Exporte werden über den sichtbaren Workflow-Navigationsschritt geprüft.

## Verbindliche Freigabebedingung
`cd relief-studio/source && npm test` muss erfolgreich sein. CI enthält unter `CI=1` zusätzliche echte Browser-/Export- und amtliche Datenprüfungen. Ein fehlgeschlagener externer Anbieter, ein falscher Höhenbezug oder eine nichtmannigfaltige Geometrie blockiert die Behauptung einer vollständigen Freigabe. Keine Änderungen außerhalb von `relief-studio/`.

## Nicht Teil dieses Änderungsschrittes
- flächendeckende amtliche Gebäudemodell- und LiDAR-Versorgung;
- freie Rekonstruktion komplexer Landmarken und Kuppeln ohne Referenz;
- neue Mehrsegment-Dachflächen-Erkennung über die bestehende konservative Ebenenanpassung hinaus;
- Schattenkarten/SSAO-Renderer und vollständiger interaktiver Gebäude-Evidenzmodus;
- physischer Probedruck.

## Folgende priorisierte Meilensteine
1. Originalgetreuer Landmarken-Part-Graph mit qualitätsgeprüften Referenzen (Windeck, Wachenburg, Kirchen/Türme).
2. Multi-Segment-Dachmodelle aus dicht und qualifiziert klassifizierten Punktwolken mit Randdeckung und Holdout-Fehlerprüfung.
3. Regionale Datenkataloge samt CRS-/Höhenbezugsprüfung, Abdeckungs- und Lizenzdokumentation.
4. Premium-Beleuchtung ohne Änderung der Exportgeometrie.
5. Druckmaßstabsgerechte Details, Materialprofile, QA im Slicer und physische Testdrucke.
