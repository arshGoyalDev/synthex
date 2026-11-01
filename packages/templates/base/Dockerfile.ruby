FROM synthex/base:latest

RUN apk add --no-cache ruby ruby-dev ruby-bundler gcc musl-dev make

# Bundler otherwise attempts to write into the system gem directory.
ENV BUNDLE_PATH=.synthex-deps/bundle
