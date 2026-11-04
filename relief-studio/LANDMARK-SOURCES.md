# Dachmodelle und Quellen

Für sechs Bauwerke werden mitgelieferte Dachflächen nur anhand der OSM-ID und der räumlichen Übereinstimmung dem Grundriss zugeordnet (kein Namensabgleich). Eine ausdrücklich erfasste neue OSM-Dachform oder Teilgliederung hat Vorrang vor der mitgelieferten Referenz. Nutzerimportierte vollständige Dachflächen haben Vorrang vor dem Katalog. Bestehende Projektdateien behalten ihre Ursprungsdaten. Projekt und neue STL neu öffnen bzw. exportieren.

**Datenquelle:** Landesamt für Geoinformation und Landentwicklung Baden-Württemberg (LGL), https://www.lgl-bw.de/ · LoD2 und digitales Orthophoto DOP20. Datenlizenz Deutschland – Namensnennung – Version 2.0, https://www.govdata.de/dl-de/by-2-0. Quelle: https://opengeodata.lgl-bw.de/data/lod2/LoD2_32_475_5488_2_bw.zip · DOP20: https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DOP_20_C · abgerufen 2026-11-04. Bearbeitung: von ETRS89/UTM32 nach WGS84 transformiert, relativ zum niedrigsten Gebäudeboden, Dachpolygone trianguliert und auf die Geländeoberfläche des Reliefs gesetzt. Grundrisse/Zuordnung: © OpenStreetMap-Mitwirkende, https://www.openstreetmap.org/copyright .

| OSM-Objekt | Bauwerk | CityGML-Objekt |
|---|---|---|
| way/274663761 | Peterskirche | DEBW_001000rOZoG |
| way/347204504 | Herz Jesu | DEBW_001000rOZxG |
| way/104325167 | Blauer Hut | DEBW_001000rPac4 |
| way/126201382 | St. Laurentius | DEBW_001000rOXvD |
| way/323257338 | Evangelische Stadtkirche | DEBW_001000rP02g |
| way/104325177 | Roter Turm | DEBW_001000rPacg |

**Sonderfall Peterskirche:** Die zugeordnete amtliche Datei modelliert das Hauptdach, aber nicht die volle Turmhöhe. Die Turmposition und Dachkontur wurden nach dem DOP20 angenähert. Die Gemeinde dokumentiert 48 m einschließlich Wetterhahn (https://www.ekiwhm.de/orte/kirchen/peterskirche/). Im Modell sind der Dachansatz bei 38 m sowie die Spitze bei 47 m angenähert. Kein Wetterhahn, keine modellierten Fenster und kein Fassadenaufmaß. Die anderen fünf Modelle entsprechen ihren amtlichen generalisierten Dachflächen; auch sie sind keine Fotogrammetrie-Modelle.

## Eigene Dächer weltweit

Im Schritt **Relief → 3D-Gebäude aus eigener Quelle** können ergänzende Dachflächen lokal importiert werden. Erwartet wird eine GeoJSON-FeatureCollection mit den Zusatzfeldern `source` (einschließlich Lizenz/Attribution) und `height_reference: "ground"`. Jedes Feature ist ein einzelnes, geschlossenes Polygon-Dreieck mit `properties.osm_id`, z. B. `way/123`. Alle Positionen sind `[Längengrad, Breitengrad, Höhe in Metern über demselben lokalen Gebäudeboden]` – keine absoluten Meereshöhen. Alle Dachflächen eines Gebäudes müssen enthalten sein; Wände erzeugt das Studio selbst. IDs und Lage müssen mit dem geladenen Gebäude übereinstimmen. Höchstens 8 MB, 20.000 Dreiecke je Datei, 4.000 je Gebäude. Daten bleiben im Projekt; danach speichern. Das ist kein direkter Import beliebiger CityGML-, BIM-, OBJ- oder STL-Dateien.

Auch ohne Import werden weltweit OSM-Grundrisse, erfasste Gebäudeteile sowie unterstützte Dachformen verwendet. Neue Datenabfragen lesen auch `type=building`-Mitgliedschaften. Ungenügende Daten bleiben als Vereinfachung gekennzeichnet; der Gebäudename allein erzeugt keinen Turm.
