# 🎮 Maze Quest: Pac-Man Edition - Toteutussuunnitelma

Tämä suunnitelma kuvaa HTML5/JavaScript-pohjaisen labyrinttipelin toteutuksen, jossa käytetään SVG-grafiikkaa ja proceduraalista generointia.

## 1. Teknologiat ja Arkkitehtuuri
- **Ydin:** HTML5 & Vanilla JavaScript (ES6+).
- **Grafiikka:** SVG (Scalable Vector Graphics). SVG mahdollistaa tarkan ja skaalautuvan grafiikan, joka näyttää hyvältä kaikilla resoluutioilla.
- **Tyylit:** Moderni CSS, jossa käytetään tummaa teemaa, lasiefektejä (glassmorphism) ja pehmeitä animaatioita käyttöliittymän ympärillä.
- **Labyrintti:** 10x10 ruudukko, jossa mustat seinät ja valkoinen lattia.

## 2. Labyrintin Generointi (Recursive Backtracking)
Käytämme "Recursive Backtracking" -algoritmia (syvyyssuuntainen haku), joka on yleisin ja tehokkain tapa luoda "täydellinen" labyrintti:
- Jokainen ruutu on saavutettavissa.
- Labyrintissä on tasan yksi oikea reitti alun ja lopun välillä (ei silmukoita).
- Luodaan luonnollisia umpikujia ja haaroja.

**Vaiheet:**
1. Alustetaan 10x10 ruudukko, jossa kaikilla ruuduilla on kaikki neljä seinää.
2. Valitaan aloituspiste (0,0).
3. Liikutaan satunnaiseen naapuriin, jota ei ole vielä käyty, ja poistetaan seinä niiden väliltä.
4. Jos naapureita ei ole, palataan takaisinpäin (backtrack) edelliseen ruutuun.
5. Toistetaan, kunnes kaikki ruudut on käyty.

## 3. Pelimekaniikka ja Logiikka
- **Pelaaja:** Pac-Man-hahmo, joka liikkuu nuolinäppäimillä tai WASD:lla.
- **Pac-Man-tyylinen ohjaus:**
  - **Jatkuva liike:** Hahmo liikkuu automaattisesti valittuun suuntaan, kunnes se kohtaa seinän.
  - **Suunnan puskurointi (Input Buffering):** Jos pelaaja painaa suuntanäppäintä ennen risteystä, peli muistaa tämän suunnan ja kääntää hahmon heti, kun se on mahdollista.
  - **Kääntyminen:** Hahmo voi kääntyä 180 astetta välittömästi, mutta 90 asteen käännökset tapahtuvat vain ruudukon risteyskohdissa.
- **Liikkuminen:** Tarkistetaan törmäykset seinien kanssa ennen liikkumista. Liikkeestä tehdään sulavaa animaation avulla.
- **Aloitus ja Lopetus:**
  - Aloitus: Vasen yläkulma (0,0).
  - Maali: Oikea alakulma (9,9) - erotetaan esimerkiksi pienellä kimaltavalla efektillä tai kuvakkeella.
- **Kentät:** Kun pelaaja saavuttaa maalin, generoidaan uusi, uniikki 10x10 labyrintti.

## 4. Visuaalinen Ilme (Premium Look)
Vaikka labyrintti on perinteinen (mustat seinät, valkoinen lattia), ympäröivästä sovelluksesta tehdään moderni:
- **Tausta:** Tumma, tyylikäs liukuväri tai hienovarainen tekstuuri.
- **Käyttöliittymä:** Läpinäkyvät "Glassmorphism"-paneelit pisteytykselle ja ohjeille.
- **Pac-Man:** Hienosti animoitu SVG-hahmo, joka aukaisee ja sulkee suuta liikkuessaan.
- **Efektit:** Ruudun vaihtoanimaatiot ja voittoefektit.

## 5. Tiedostorakenne
- `index.html`: Perusrakenne ja SVG-container.
- `style.css`: Tyylit, animaatiot ja UI-asettelu.
- `maze.js`: Labyrintin generointialgoritmi.
- `game.js`: Pelin päälogiikka, pelaajan ohjaus ja renderöinti.
