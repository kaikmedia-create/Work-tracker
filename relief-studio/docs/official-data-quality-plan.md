# Bessere 3D-Modelle aus amtlichen Daten

Planungsstand: 6. November 2026. Diese Freigabe entfernt nur die Vergleichsoberfläche. Die folgenden Datenadapter und Modellierungsverbesserungen sind geplant, nicht in diesem Commit implementiert.

## Grundsatz

Passende amtliche 3D-Gebäudeflächen haben Vorrang vor einer reinen Höhenkorrektur und vor einem rohen Oberflächenraster. Gebäude sollen klare Wände, Firste, Dachflächen, Innenhöfe und unterscheidbare Teilkörper behalten. Ein neuer Ort innerhalb einer eingebundenen Anbieter-Abdeckung braucht kein Stadtpaket. Die derzeit recherchierten Angebote sind regional; eine weltweit einheitliche amtliche Detailabdeckung ist damit nicht nachgewiesen.

OSM und Overture bleiben als vorhandene, gekennzeichnete Ersatzbasis möglich, sind aber keine amtliche Vermessung. Eigene Rekonstruktionen aus amtlichen Messpunkten müssen als abgeleitete Ergebnisse bezeichnet werden. Keine Namenserkennung, die Kirchen erfundene Türme zuweist. Keine neue Vergleichsoberfläche.

## Geprüfte Quellen und ihre Grenzen

- Deutschland: LoD2 der Vermessungsverwaltungen/AdV, mit standardisierten Dachformen und tatsächlichen Firstverläufen; Zugang und Lizenz je Landesprodukt prüfen. LoD2 enthält nicht jedes architektonische Detail. https://www.adv-online.de/de/produkte/3d-gebaeudemodell
- Niederlande: Kadaster/PDOK, 3D Objecten Gebouwen in CityJSON mit LoD2.2, bei fehlenden AHN-Daten LoD1.3. Tatsächliche Detailstufe je Objekt prüfen. https://3d.kadaster.nl/productbeschrijving/ und https://api.pdok.nl/kadaster/3d-basisvoorziening/ogc/v1
- Schweiz/Liechtenstein: swisstopo swissBUILDINGS3D 3.0 Beta, geschlossene Modelle oder getrennte Dach-, Wand- und Bodenflächen. Kleine Anbauten und Gauben sind grundsätzlich nicht vollständig modelliert. https://www.swisstopo.admin.ch/en/landscape-model-swissbuildings3d-3-0-beta
- Japan: MLIT/Kommunen, PLATEAU CityGML. Abdeckung und Detailstufe je Datensatz prüfen; keine pauschale LoD3-Zusage. https://www.mlit.go.jp/plateau/en/ und https://www.mlit.go.jp/plateau/faq/
- Frankreich: IGN LiDAR HD, klassifizierte Punktwolken und Boden-/Oberflächen-/Höhenmodelle. Lieferbare Kacheln statt Ausbauziele prüfen. https://www.data.gouv.fr/datasets/nuages-de-points-lidar-hd
- USA: USGS 3DEP, Punktwolken und Geländemodelle. Nicht überall ausreichende Gebäude-/Vegetationsklassifizierung; kein fertiger Dachmodellbestand. https://www.usgs.gov/3d-elevation-program/about-3dep-products-services und https://www.usgs.gov/centers/community-for-data-integration-cdi/science/3deppcc-automated-dl-based-point-cloud
- Neuseeland: LINZ, LiDAR sowie 1-m-DEM und -DSM; tatsächliche Abdeckung prüfen. Rasterauflösung ist keine Genauigkeitsgarantie. https://www.linz.govt.nz/products-services/data/types-linz-data/elevation-data/access-elevation-data

3DBAG von TU Delft/3DGI ist ein abgeleitetes Produkt aus amtlichen Ausgangsdaten, nicht identisch mit dem amtlichen Kadaster-Produkt. https://docs.3dbag.nl/en/copyright/

Vor produktiver Anbindung: Lizenz, Bearbeitung, Weitergabe, kommerzieller STL-Vertrieb, Attribution, Zugriff und Kosten je konkretem Angebot dokumentieren. Keine kostenpflichtigen Dienste ohne Freigabe aktivieren.

## Umsetzung in Prioritätsreihenfolge

1. Gemeinsames CityJSON-/CityGML-Gebäudeformat: Objekt-ID, Grundriss, Innenhöfe, Teile, Wände, Dächer, Boden, Quelle, Aufnahmezeit, Detailstufe und Höhenbezug. Originale Dachflächen direkt nutzen, nicht erst in ein grobes Raster umwandeln. Firste, Grate und Kehlen beim Vereinfachen schützen. Semantische Flächen sind im CityGML-Datenmodell vorgesehen: https://docs.ogc.org/guides/20-066.html

2. Gebäude zuverlässig zuordnen: Register-ID bevorzugen; sonst Überdeckung, Größe, Lage und zeitlichen Stand prüfen. Eins-zu-viele-Zuordnungen berücksichtigen. Ein Mittelpunkt allein genügt nicht. Dachüberstände nicht blind auf einen abweichenden Grundriss beschneiden. Unsichere Zuordnungen verwerfen und protokollieren.

3. Höhen und Gelände vereinheitlichen: Bodenmodell, Oberflächenmodell und Höhe über Grund getrennt halten. Einheiten, Lagebezug und vertikales Datum vor der Zusammenführung transformieren. Keine Gebäude doppelt auf vorhandene Dachhöhen setzen. Geländeüberhöhung nicht auf absolute Gebäudehöhen anwenden. Hanggebäude und Sockel gesondert prüfen.

4. Ohne fertiges Dachmodell: aus hinreichend dichten amtlichen Messpunkten zusammenhängende Dachflächen robust schätzen. Vegetation und Ausreißer ausschließen; aus Ebenenschnitten Firste ableiten. Hohe Türme als belegte Teilkörper, nicht als Maximalhöhe des ganzen Gebäudes. Grenzwerte für Abdeckung, Restfehler und Lagepassung mit unabhängigen Prüfdaten kalibrieren. Bei schlechter Grundlage keine erfundene Dachform ergänzen.

5. Straßen, Gewässer und Bäume als eigene Objekte: passende amtliche Flächen und Höhen verwenden. Brücken und Tunnel nicht unkontrolliert in Gelände fräsen. Vegetation aus klassifizierten Messpunkten oder Baumkatastern; keine Verschmelzung von Kronen und Dächern.

6. Servergestützte Datenvorbereitung und versionierte Kacheln: große Landesarchive nicht aufs Handy laden. Anbieter, Datensatzstand, Transformation und Modellierungsregeln als Cache-Schlüssel verwenden. Vorschau grafikbeschleunigt und sichtabhängig; Export aus geprüfter Druckgeometrie. Serverkosten vor Einführung gesondert freigeben.

7. Druckaufbereitung zuletzt: Mindeststärken und Vereinfachungen im Druckmaßstab, nicht als wahllose Glättung. Bei 2.000 m Ausschnitt auf 200 mm sind 0,5 m in der Realität nur 0,05 mm im Druckmodell. Silhouette, Dachform und Höhenstaffelung haben Vorrang vor winzigen Fassadendetails.

## Abnahme statt bloßer Testzählung

Erster Meilenstein: derselbe Importpfad verarbeitet zwei amtliche Anbieter auf unterschiedlichen Kontinenten, beispielsweise Kadaster und PLATEAU. Danach Deutschland und swisstopo erschließen und geeignete IGN-/USGS-/LINZ-Punktwolken ergänzen. Keine Orts-Sonderregeln; Testausschnitte vorab festlegen und zufällige weitere Gebiete innerhalb der Abdeckung prüfen.

Drei getrennte Qualitätsnachweise: Datenabdeckung, architektonische Richtigkeit, Druckbarkeit. Eine geschlossene STL beweist keine richtige Dachform. Normale Häuser, Industriehallen, Hochhäuser, Kirchen, Innenhöfe, Hanglagen und Datenbestandsgrenzen prüfen. Dachform, Höhe und Silhouette gegen unabhängige oder zurückgehaltene Referenzen kontrollieren. Fälle ohne amtliche Daten als Rückfallbetrieb zählen, nicht als Detailverbesserung.

Reale STL-/3MF-Downloads, geschlossene konsistent orientierte Körper ohne unerlaubte Überschneidungen, reale Mobilgeräte, Speichergrenzen, Abbruch/Wiederaufnahme und physische Probedrucke gehören zur späteren Abnahme. Source-Lücken, abgelehnte Zuordnungen und Vereinfachungen bleiben im Diagnose- und Quellenbericht sichtbar.
