# Integrazione modello 3D Sketchfab

Questa cartella contiene i file necessari per sostituire la custodia CD costruita con primitive Three.js con il modello `cd_music_02.glb`.

## Installazione

Copia `src/objects/CDCase.tsx` nel progetto sostituendo il file omonimo.

Copia `public/models/cd_music_02.glb` nel progetto:

```text
public/models/cd_music_02.glb
```

Non sono necessarie modifiche a `albums.json`, `schema.ts`, reducer o Scene.

## Cosa usa il codice

Il GLB contiene 11 copie della custodia. Il codice usa soltanto:

- `CD_CASE.001_6` come custodia master
- `Object_8` per la cover posteriore
- `Object_10` per la cover frontale
- `Object_5` + `Object_6` per il CD 3D
- `top.001_5` + `cover front.001_2` per il coperchio

Le altre copie del GLB vengono nascoste.

Le texture dell'album vengono applicate così:

```text
front  -> Object_10
back   -> Object_8
disk   -> Object_5
inside -> piano aggiunto in runtime dentro la custodia
```

Il disco 3D viene inoltre riutilizzato quando è in mano o sul tray.
