
all: files

SERVER = pwmarcz.pl

TEXTURES = img/sticks.auto.png img/tiles.auto.png img/center.auto.png img/winds.auto.png

ICONS = img/icon-16.auto.png img/icon-32.auto.png img/icon-96.auto.png

.PHONY: parcel
parcel: files
	./node_modules/.bin/parcel --no-hmr index.html about.html

.PHONY: server
server:
	cd server && yarn start

.PHONY: files
files: img/models.auto.glb $(ICONS)

img/tiles.auto.png: img/tiles.svg
	inkscape $< --actions 'select-by-id:layer2; object-set-attribute:style, display:none' \
		--export-filename=$@ --export-width=512 --export-background=#ffffff --export-background-opacity=1

img/tiles-labels.auto.png: img/tiles.svg
	inkscape $< --export-filename=$@ --export-width=512 --export-background=#ffffff --export-background-opacity=1

img/sticks.auto.png: img/sticks.svg
	inkscape $< --export-filename=$@ --export-width=256 --export-height=512

img/center.auto.png: img/center.svg
	inkscape $< --export-filename=$@ --export-width=512 --export-height=512

img/winds.auto.png: img/winds.svg
	inkscape $< --export-filename=$@ --export-width=128 --export-height=64

img/icon-%.auto.png: img/icon.svg
	inkscape $< --export-filename=$@ --export-width=$*

img/models.auto.glb: img/models.blend $(TEXTURES)
	blender $< --background --python export.py -- $@

.PHONY: build
build: files check
	rm -rf build
	./node_modules/.bin/parcel build *.html --public-url . --cache-dir .cache/build/ --dist-dir build/

.PHONY: build-server
build-server:
	cd server && yarn build

.PHONY: staging
staging: build
	rsync -rva --checksum --delete build/ $(SERVER):autotable/dist-staging/

.PHONY: release
release: build
	git push -f origin @:refs/heads/release/client
	rsync -rva --checksum --delete build/ $(SERVER):autotable/dist/

.PHONY: release-server
release-server: build-server
	git push -f origin @:refs/heads/release/server
	rsync -rva --checksum --delete --exclude node_modules/ server/ $(SERVER):autotable/server/
	ssh $(SERVER) 'cd autotable/server && yarn'
	ssh $(SERVER) 'sudo systemctl restart autotable-server.service'

.PHONY: test
test:
	cd server && yarn test

.PHONY: check
check:
	./node_modules/.bin/tsc --noEmit
