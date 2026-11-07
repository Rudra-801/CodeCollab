FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 nodejs npm default-jdk-headless gcc g++ mono-mcs mono-runtime golang-go rustc php-cli ruby coreutils ca-certificates && npm install -g typescript@5.9.3 && apt-get clean && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --shell /bin/sh user
WORKDIR /home/user
USER user
