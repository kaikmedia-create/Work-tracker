# Präzisions-3D · QA und Ausbaupfad (v28+)

Stand: 15.11.2026. Dieses Dokument grenzt die verifizierbare Änderung vom langfristigen Architekturziel ab.

## In diesem Änderungszweig
- Unberührte OSM-Gebäude behalten ihre Original-ID, erfasste Dachform/-richtung, Gebäude-Teilbeziehungen, nutzerimportierte Referenzdächer und vorhandene Dachpakete.
- Nur von amtlichen/Fach-Flächen tatsächlich beschnittene Restflächen werden schematisch modelliert; dabei werden unverifizierbare Dachannahmen verworfen.
- Die 3D-Modellprüfung weist pro Baukörper die Konstruktionsstufe `exact` (direkte Quelle), `measured` (klassifizierte Messung), `inferred` (Tags/Referenz) oder `fallback` aus. Eine direkte LoD2-Quelle ist dennoch bereits generalisiert. Das ist kein Maß für absolute Vermessungsgenauigkeit.
- Die bestehende 3MF-Metadaten-Datei übernimmt den neuen Gebäude-QA-Nachweis.
- Automatische Tests prüfen erhaltene Gebäude-Teile, Dachrichtungen, beschnittene Restflächen, Quellenklassen sowie bestehende exakte STL-/3MF-Exporte.

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
