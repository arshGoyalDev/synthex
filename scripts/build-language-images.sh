#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

declare -a DOCKERFILES=(
  "synthex/base:latest packages/templates/base/Dockerfile.base"
  "synthex/javascript:latest packages/templates/base/Dockerfile.javascript"
  "synthex/python:latest packages/templates/base/Dockerfile.python"
  "synthex/go:latest packages/templates/base/Dockerfile.go"
  "synthex/rust:latest packages/templates/base/Dockerfile.rust"
  "synthex/java:latest packages/templates/base/Dockerfile.java"
  "synthex/cpp:latest packages/templates/base/Dockerfile.cpp"
  "synthex/c:latest packages/templates/base/Dockerfile.c"
  "synthex/ruby:latest packages/templates/base/Dockerfile.ruby"
  "synthex/php:latest packages/templates/base/Dockerfile.php"
  "synthex/zig:latest packages/templates/base/Dockerfile.zig"
  "synthex/elixir:latest packages/templates/base/Dockerfile.elixir"
  "synthex/kotlin:latest packages/templates/base/Dockerfile.kotlin"
  "synthex/csharp:latest packages/templates/base/Dockerfile.csharp"
  "synthex/encore-ts:latest packages/templates/base/Dockerfile.encore-ts"
  "synthex/encore-go:latest packages/templates/base/Dockerfile.encore-go"
)

for item in "${DOCKERFILES[@]}"; do
  image="${item%% *}"
  dockerfile="${item#* }"

  echo "Building ${image} from ${dockerfile}"
  docker build -t "${image}" -f "${ROOT_DIR}/${dockerfile}" "${ROOT_DIR}"
done

echo "All language images built successfully."
