# Relief Studio 20: Straßen und Wege im Druckmodell

Im Schritt **Relief → Straßen und Wege** kann man erhabene Straßen, Gravuren oder eine unveränderte Oberfläche wählen. Beide Exporte verwenden dasselbe 3D-Netz wie die Vorschau. Das Poster bleibt unverändert.

- Standard: **Erhaben**, 0,60 mm Profilhöhe. Nebenstraßen erhalten 70 %, Wege 55 % der Höhe. Das Profil ist als kartografisches Symbol überhöht, nicht als reale Bordsteinhöhe zu lesen.
- Haupt-, Verbindungs-, Nebenstraßen und Pfade haben unterschiedliche Breiten mit einer Mindestbreite im Modell. Die Konturen folgen dem vorhandenen Gelände. Kreuzungen nutzen das stärkste Profil, kein Aufaddieren.
- Nur Geländeflächen werden unterteilt. Grenzen zu Gebäuden, Gewässern und Rahmen bleiben fixiert. Eine Gravur lässt mindestens 0,6 mm Boden stehen. Frisch aus OSM geladene Tunnel und nicht aktive Straßen werden nicht als Straßenrelief eingezeichnet. Ältere Projekte können diese Kennzeichnung noch nicht enthalten.
- Bereits gespeicherte Karten lassen sich ohne Netzabruf neu berechnen. Bei Projekten ohne expliziten Profilmodus wird die frühere Null-Voreinstellung einmalig auf den neuen Standard umgestellt. Für die frühere flache Geometrie **Aus** wählen.
- Vorbilder: [Touch Mapper](https://touch-mapper.org/en/help) hebt Fußwege hervor; [Printed Canyon](https://www.printedcanyon.com/3d-printed-city-map) verbreitert Straßen zum Drucken; [FabLab Kanda-Nishikicho](https://digifab.or.jp/archives/7097) beschreibt bei Map2Model Straßenhöhe und Gravurtiefe.

Prüfen: `cd relief-studio/source && npm test`. `tests/streets20.test.mjs` misst Hauptstraßen und Wege, vergleicht erhaben/eingraviert/aus, prüft gemeinsame Kanten, Bodenstärke, unveränderte Dachhöhe, Formatmigration und tatsächliche STL-/3MF-Koordinaten. Das ist kein physischer Probedruck.
