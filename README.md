# CD Shelf
```
npm install
npm run dev        # sviluppo
npm test           # test del reducer
npm run build      # typecheck + build in dist/
```
Metti texture in `public/covers/<id>/` e audio in `public/audio/<id>/`, poi descrivi gli album in `src/data/albums.json`.
Deploy: Cloudflare Pages, build `npm run build`, output `dist`.
