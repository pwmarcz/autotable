FROM node:12.18 AS base

FROM base AS build
WORKDIR /build/
COPY ./ /build
RUN yarn
RUN yarn build

FROM base
ENV NODE_ENV production
COPY --from=build /build/dist /dist
WORKDIR /dist
COPY --from=build /build/package.json /build/yarn.lock ./
RUN yarn install --production
ENTRYPOINT node index.js
