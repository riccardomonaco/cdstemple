# Modifiche

`CDCase.tsx` è l'unico file sorgente modificato.

Il nuovo componente:

1. carica `/models/cd_music_02.glb` con `useGLTF`;
2. clona il GLB per ogni album e clona anche i materiali, evitando che una texture cambi gli altri album;
3. nasconde le 10 copie extra presenti nel file Sketchfab;
4. usa i nodi reali del modello per front, back e disco;
5. crea un piano interno per la texture `inside`, perché il GLB non contiene una mesh separata per quella grafica;
6. ricostruisce un pivot della cerniera usando `top.001_5` e `cover front.001_2`;
7. usa il disco 3D del GLB anche fuori dalla custodia;
8. mantiene drag, apertura, GRAB, RETURN, tray e stereo del progetto originale.

Il repository originale usa React 18, React Three Fiber 8, Drei 9 e Three 0.169; la modifica usa API già compatibili con queste dipendenze.
