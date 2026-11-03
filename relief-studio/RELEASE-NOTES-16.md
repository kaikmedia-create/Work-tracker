# Relief Studio 16 – Kartendienst-Fallback bei fehlendem letztem Datenpaket

## Anlass
Die bereitgestellte Diagnose `2026-11-03T11-10-31-535Z` dokumentiert zwei fehlgeschlagene Anfragen für einen rund 2 × 1,9 km großen Weinheim-Ausschnitt. 6 von 7 benötigten OSM-Kartenpaketen waren bereits gespeichert, ebenso alle vier Höhenkacheln. Für das letzte Paket meldeten die drei bisherigen Overpass-Server wiederholt HEADER_TIMEOUT und HTTP 504. Es lag kein Geometrie-/STL-Fehler vor.

## Korrektur
- Für kleine Ausschnitte, die vollständig im europäischen Abdeckungsgebiet liegen, steht `https://ovp.dresel.systems/api/interpreter` als erster unabhängiger Overpass-Dienst zur Verfügung (Europe-Extract, laut OSM-Wiki täglich aktualisiert). Außerhalb Europas wird dieser Dienst nicht aufgerufen.
- Die bisherigen drei globalen Anbieter bleiben als Alternativen erhalten. HTTP 429 bleibt ein sofortiger Stopp ohne Anbieterwechsel.
- Pflichtdatenpakete können bei TIMEOUT, SIZE und SERVER-Fehlern bis fünf Teilungsebenen verkleinert werden, statt bei Ebene drei abzubrechen; nie als unvollständig erfolgreich markieren.
- Maximal zwei parallele OSM-Abfragen; Gesamtzeitlimit und einmalige Cache-Wiederaufnahme bleiben unverändert. Die maximale Anfragezahl beträgt 64 je Abruf.
- Fehlgeschlagene Kartendienst-Versuche und ihre Endpunkte werden in die bereits vorhandene lokale JSON-Diagnose aufgenommen; der `↓ Diagnose`-Knopf bleibt verfügbar.

## Grenzen
Öffentliche Overpass-Server haben keine garantierte Verfügbarkeit. Ein Erfolg mit dem exakt gemeldeten vollständigen Weinheim-Download muss getrennt nachgewiesen werden; synthetische Fallback-Tests ersetzen diese Prüfung nicht. Das Datum der europäischen OSM-Daten kann älter sein als das der globalen Dienste.
