FROM synthex/base:latest

RUN apk add --no-cache curl xz tar

RUN curl -fsSL https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz -o /tmp/zig.tar.xz \
    && tar -xf /tmp/zig.tar.xz -C /usr/local \
    && ln -sf /usr/local/zig-linux-x86_64-0.13.0/zig /usr/local/bin/zig \
    && rm /tmp/zig.tar.xz
