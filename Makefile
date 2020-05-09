
all: files

TEXTURES = img/sticks.auto.png img/tiles.auto.png img/center.auto.png img/winds.auto.png

.PHONY: parcel
parcel: files
	./node_modules/.bin/parcel index.html

.PHONY: files
files: img/models.auto.glb

img/tiles.auto.png: img/tiles.svg
	inkscape $< --export-png=$@ --export-width=512

img/sticks.auto.png: img/sticks.svg
	inkscape $< --export-png=$@ --export-width=256 --export-height=512

img/center.auto.png: img/center.svg
	inkscape $< --export-png=$@ --export-width=512 --export-height=512

img/winds.auto.png: img/winds.svg
	inkscape $< --export-png=$@ --export-width=128 --export-height=64

img/models.auto.glb: img/models.blend $(TEXTURES)
	blender $< --background --python export.py -- $@

.PHONY: build
build: files
	rm -rf build
	./node_modules/.bin/parcel build index.html --public-url /autotable/ --cache-dir .cache/build/ --out-dir build/

.PHONY: deploy
deploy: build
	rsync -rva --checksum --delete build/ pwmarcz.pl:homepage/autotable/
