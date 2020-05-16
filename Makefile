
all: files

SERVER = pwmarcz.pl

TEXTURES = img/sticks.auto.png img/tiles.auto.png img/center.auto.png img/winds.auto.png

ICONS = img/icon-16.auto.png img/icon-32.auto.png img/icon-96.auto.png

.PHONY: parcel
parcel: files
	node run-parcel.js

.PHONY: files
files: img/models.auto.glb $(ICONS)

img/tiles.auto.png: img/tiles.svg
	inkscape $< --export-png=$@ --export-width=512

img/sticks.auto.png: img/sticks.svg
	inkscape $< --export-png=$@ --export-width=256 --export-height=512

img/center.auto.png: img/center.svg
	inkscape $< --export-png=$@ --export-width=512 --export-height=512

img/winds.auto.png: img/winds.svg
	inkscape $< --export-png=$@ --export-width=128 --export-height=64

img/icon-%.auto.png: img/icon.svg
	inkscape $< --export-png=$@ --export-width=$*

img/models.auto.glb: img/models.blend $(TEXTURES)
	blender $< --background --python export.py -- $@

.PHONY: build
build: files
	rm -rf build
	./node_modules/.bin/parcel build *.html --public-url /autotable/ --cache-dir .cache/build/ --out-dir build/

.PHONY: build-server
build-server:
	cd server && yarn build

.PHONY: deploy
deploy: build
	rsync -rva --checksum --delete build/ $(SERVER):autotable/dist/

.PHONY: deploy-server
deploy-server: build-server
	rsync -rva --checksum --delete --exclude node_modules/ server/ $(SERVER):autotable/server/
	ssh $(SERVER) 'cd autotable/server && yarn'
	ssh $(SERVER) 'sudo systemctl restart autotable-server.service'
