# Relief Studio 28 · Amtliche Flächen zuerst

Stand: 11. November 2026. Implementierung im bestehenden Studio, keine Neuentwicklung.

## Quellenregel

Der neue Standard übernimmt vollständige Dach-, Wand- und Bodenflächen aus geeigneten CityGML-/CityJSON-Gebäudemodellen. Die Flächen werden trianguliert und als geschlossene Körper mit dem Druckgelände verbunden, nicht in ein Höhenraster umgerechnet. Innenhöfe bleiben als Innenringe erhalten. Künstliche Gebäude-/Wahrzeichenüberhöhung ist in diesem Modus deaktiviert.

Nur ohne vorhandenes Flächenmodell und mit dokumentiertem Nachweis der Abwesenheit darf die Form aus klassifizierten amtlichen Messpunkten abgeleitet werden. Gebäudeklasse 6 und Bodenklasse 2 werden getrennt verwendet. Vegetation ist ausgeschlossen. Punktdichte, räumliche Abdeckung, Randbelegung und Ebenenabweichung werden geprüft; komplexe oder unzureichend belegte Formen bleiben unrekonstruiert. Ein Dienstausfall gilt nicht als Abwesenheit.

## Tatsächlich angebundene Daten

- Automatisch ausgelieferte LGL-BW-LoD2-Ausschnitte: Burg Windeck (2 Gebäudekörper) und Wachenburg (15 Gebäudekörper). Das ist keine vollständige Weinheim-Abdeckung. Originalflächen, keine neu erfundenen Dachtypen. Archiv-Prüfsummen und Attribution stehen im Datenpaket.
- Live-Fachmodelle von 3DBAG für die Niederlande. Die Oberfläche bezeichnet sie als Fachmodelle aus amtlichen Grundlagen, nicht als unmittelbar amtliche Vermessungsflächen.
- Lokaler Import von LGL-BW CityGML/ZIP, attributiertem CityJSON, vorbereiteten Flächenpaketen und qualifizierten Messpunkt-JSON-Dateien.

Die LGL-ZIP-Daten erlauben keinen direkten Browserzugriff von GitHub Pages. Deshalb werden die beiden geprüften Ausschnitte mit der Website ausgeliefert. Andere LGL-Ausschnitte benötigen derzeit Dateiimport oder weitere bereitgestellte Pakete. Ein flächendeckender automatischer LAS-/LAZ-Download ist nicht implementiert.

Nicht belegte Gebäude bleiben ausdrücklich schematische Kartenkörper. LoD2-Quelldaten sind bereits generalisiert und garantieren keine Fassadendetails, Zinnen oder vollständige Ruinengeometrie. Die Punktdaten-Quelle wird beim Import angegeben, nicht kryptografisch authentifiziert.

## Vorschau und Druck

Vorschau, STL und 3MF verwenden denselben Flächenkörper. Amtliche Modelle werden nicht durch eine vereinfachte Rastervorschau ersetzt. Quellen, Rekonstruktionsmethode und Druckanpassungen werden ausgewiesen; 3MF enthält zusätzlich Metadata/sources.json. Druckanpassungen sind einheitlicher Maßstab, starre vertikale Platzierung, Ausschnitt und gesonderte Fundamentstütze. Die Dachform selbst wird dabei nicht neu geschätzt.

## Prüfung

Die 402 lokalen automatischen Prüfungen der erweiterten Suite sind bestanden. Separate CI-Prüfungen testen echte LGL-/3DBAG-Daten sowie PIN-Zugang, Desktop-/schmale Browseransicht, Worker-Berechnung und STL-/3MF-Downloads. Den verbindlichen Status zeigt der jeweilige CI-Lauf des veröffentlichten Commits. Ein physischer Probedruck und eine vollständige architektonische Abnahme aller Gebäude sind damit nicht ersetzt.

## Bedienung

Studio neu öffnen. Im 3D-Modus ist „Amtliche Flächen zuerst · Standard“ vorausgewählt. Bei einem bereits gespeicherten Projekt den Modus auswählen und „Flächen erneut prüfen“ verwenden. Über „Amtliche Datei importieren“ lassen sich weitere geeignete Quelldaten einlesen. Die bisherigen klassischen Modi bleiben ausdrücklich auswählbar. Poster-Funktionen bleiben getrennt.
