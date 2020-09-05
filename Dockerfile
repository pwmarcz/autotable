FROM debian:bullseye-slim AS inkscape
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y --no-install-recommends install \
    inkscape \
    make

WORKDIR /build/
COPY Makefile ./
COPY img/*.svg ./img/
RUN make svgs

FROM debian:bullseye-slim AS blender
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        blender \
        make


WORKDIR /build/
COPY Makefile ./
COPY --from=inkscape /build/img/* ./img/
COPY export.py ./
COPY img/* ./img/
RUN make files

FROM node:12.18 AS parcel
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get -y --no-install-recommends install \
    make

COPY ./ /build/
COPY --from=blender /build/img/* ./img/
WORKDIR /build/

RUN yarn
RUN make -o files build

FROM nginx
COPY --from=parcel /build/build /dist
COPY ./nginx.conf /etc/nginx/nginx.conf
