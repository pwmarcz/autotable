# Autotable

Autotable is a tabletop simulator for Riichi Mahjong.

For more information, see the about page: https://pwmarcz.pl/autotable/about.html

## Contributions

This is a very opinionated project. I will be grateful for contributions that fix bugs or improve player experience. However, I will probably not want to merge any of:

* Making the engine **too general**, at the cost of simplicity. I'm not interested in a general-purpose tabletop engine.
* Other mahjong **variants** than Riichi Mahjong, unless it has a low maintenance cost. Same reason as above - I would rather have a great support for Riichi than mediocre support for all kinds of mahjong.
* Any form of **automation**, such as automatic tile drawing sorting, scoring etc. This is contrary to the project's philosophy.

However, please don't feel discouraged from making these changes in your own fork! While I want to do my thing here, I would be very interested to see in what directions people take the project.

## Running

You need the following:

* GNU make
* node and yarn
* Inkscape (for textures: .svg -> .png conversion)
* Blender (for 3D models: .blend -> .glb conversion)

Run:

* `yarn` to install packages
* `make parcel` to run and serve frontend
* `make files` to re-generate static files (textures and models)
* `make server` to run server

## Deployment

The frontend can be served as static files. Run `make build`.

The server is a WebSocket application. You can run it locally, and use your HTTP server to expose it to the world.

By default, the frontend should be under `/autotable/` and server under `/autotable/ws`.

Here is what I use for nginx:

    location /autotable/ {
        expires 0d;
        alias <path_to_autotable>/dist/;
    }

    location /autotable/ws {
        proxy_pass http://127.0.0.1:1235/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Prevent dropping idle connections
        proxy_read_timeout 7d;
    }

## License

All of my code is licensed under MIT. See COPYING.

However, I'm also using external assets, licensed under CC licenses. Note that the tile images are under a Non-Commercial license.

* The tile images (`img/tiles.svg`) were originally posted at [Kanojo.de blog](https://web.archive.org/web/20160717012415/http://blog.kanojo.de/2011/07/01/more-shirt-stuff-t-shirt-logo-ideas/). They're licensed as **CC BY-NC-SA**.

* The table texture (`img/table.jpg`) is from [CC0 Textures](https://cc0textures.com/view?id=Fabric030). It's licensed as CC0.

* The sounds (`sound/`) come from [OpenGameArt](https://opengameart.org/) ([Thwack Sounds](https://opengameart.org/content/thwack-sounds), [Casino sound effects](https://opengameart.org/content/54-casino-sound-effects-cards-dice-chips)) and are licensed as CC0.
