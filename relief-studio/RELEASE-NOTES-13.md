# Relief Studio 13 · Stabile 3D-Kartendaten

- Veralteter Kumi-Server durch Private.coffee ersetzt; VK Maps und FOSSGIS als weitere best-effort-Ausweichserver.
- Bei Header-Zeitüberschreitung werden unvollständige Gebäude- und Multipolygon-Pakete begrenzt unterteilt.
- 3D-Karten nutzen feinere Anfangspakete; Poster- und 3D-Workflows bleiben getrennt.
- Fertige Pakete und Aufteilungspläne bleiben für einen neuen Versuch im Cache.
- HTTP 429 und Retry-After werden respektiert. Maximal zwei parallele OSM-Abfragen.
- Unvollständige Overpass-Antworten werden nicht im lokalen Servercache gespeichert.
- Geländekacheln erhalten einen einzelnen begrenzten Retry nach temporären Netzwerkfehlern.
- GitHub Pages bekommt das SHA-256-geprüfte Upgrade 13; Architektur/Export bleiben unverändert.

**Grenze:** Öffentliche Overpass-Instanzen garantieren keine Verfügbarkeit. Für kommerziellen Betrieb eigenen oder abgesicherten Datendienst erwägen.
