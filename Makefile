
.PHONY: files
files: img/tiles.auto.png

img/tiles.auto.png: img/tiles.svg
	inkscape $< --export-png=$@ --export-width=512

.PHONY: build
build: files
	rm -rf build
	./node_modules/.bin/parcel build index.html --public-url /autotable/ --cache-dir .cache/build/ --out-dir build/

.PHONY: deploy
deploy: build
	rsync -rva --checksum --delete build/ pwmarcz.pl:homepage/autotable/
