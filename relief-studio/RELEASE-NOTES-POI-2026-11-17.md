# Relief Studio – historische und kulturelle Orte / reduzierte Fußzeile

**Datum:** 17. November 2026

## Ausgangspunkt
- Altes PDF *la-matanza-594x841mm.pdf*: zahlreiche beschriftete Kultur- und Geschichtsorte, darunter Iglesia El Salvador, Ícaro de metal, Achimencey Tinguaro, Casa Museo „Pino“, mehrere Ermitas.
- Neues PDF *la-matanza-210x297mm (1).pdf*: nur Ermita de San Diego de Alcalá beschriftet und im Studio die Meldung „Zusätzliche historische Orte konnten nicht geladen werden.“
- Die Kartenausschnitte sind nicht identisch; der explizite POI-Fehler ist der stärkere technische Befund.

## Änderungen
1. Die POI-Abfrage fordert benannte historische Orte, Kunstwerke, Museen, Aussichtspunkte und Kirchen **ohne** die potenziell sehr große unbenannte Baumliste an. Einzelbäume werden im 3D-Modus getrennt und zeitlich begrenzt abgefragt; ihr Ausfall blockiert Kulturmarker nicht.
2. Das POI-Zeitbudget wurde erweitert (insgesamt maximal 27 Sekunden; maximal 13 Sekunden pro Anbieter). Bei temporären Netzwerk-/Dienstfehlern wird höchstens ein anderer Overpass-Dienst versucht. **Keine Anbieterrotation bei HTTP 429** und kein stilles Verschlucken vollständig fehlender POIs.
3. Aktualisierter POI-Cache-Namensraum (`osm13:pois`) verhindert die Wiederverwendung älterer, auf einer überladenen Abfrage basierender POI-Pakete. Erfolgreiche Geometriepakete bleiben im Cache erhalten.
4. Untere Karten-/Poster-/Datenstatusleiste und Fußzeile im Studio ausgeblendet; die 3D-/Postervorschau erhält mehr Platz. Die Hilfe- und Quellenfunktion ist weiterhin über „?“ in der oberen Aktionsleiste erreichbar.
5. Server-Modus unterstützt ebenfalls getrennte optionale Baumabfragen.
6. Die PIN-Vorschau erhält denselben Patch nach den bestehenden offiziellen/geometrischen Release-Prüfungen. Die ursprünglichen verschlüsselten Basispakete und Exportwege bleiben unverändert.

## Prüfung
- Deterministische JS-Prüfung des vollständigen Datenladers mit simuliertem La-Matanza-Ausschnitt: fünf Kulturmarker nach erstem HTTP 503 und zweitem erfolgreichen Anbieter.
- HTTP 429: kein Anbieterwechsel, die geladenen Gebäude bleiben erhalten.
- Fehlgeschlagene Baumabfrage im Modellmodus: Kulturmarker bleiben bestehen.
- Reversibilität/Idempotenz des Release-Patches und Kompatibilität mit der vorherigen UI-Ausgabe getestet.
- Zusätzlich `tests/historic-poi29.test.mjs` und erweiterte `tests/ui29.test.mjs` im `npm test`-Skript aufgenommen.

**Grenze:** Reale OpenStreetMap-/Overpass-Verfügbarkeit und die exakte Zahl der Live-POIs sind von externen Diensten und dem gewählten Kartenausschnitt abhängig; der simulierte Regressionstest ersetzt keine vollständige Live-Abnahme.
