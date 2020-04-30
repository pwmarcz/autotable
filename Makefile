
.PHONY: files
files: img/tiles.auto.png

img/tiles.auto.png: img/tiles.svg
	inkscape $< --export-png=$@ --export-width=512

.PHONY: dist
dist: files
	rm -rf dist
	./node_modules/.bin/parcel build index.html --public-url /autotable/ --cache-dir .cache/dist/

.PHONY: deploy
deploy: dist
	rsync -rva --checksum --delete dist/ pwmarcz.pl:homepage/autotable/
