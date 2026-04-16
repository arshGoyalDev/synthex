interface Template {
  id: string;
  name: string;
  description: string;
  language: string;
  color: string;
  icon: string;
  defaultPort?: number;
  getCommands: (projectName: string) => {
    // ← function not static array
    install: string[];
    setup: string[];
    postSetup: string[];
  };
  entryFile: (projectName: string) => string; // ← dynamic too
  runCommand: string;
}

const TEMPLATES: Record<string, Template> = {
  // ─── JavaScript / TypeScript ─────────────────────────────────────────────

  node: {
    id: "node",
    name: "Node.js",
    description: "JavaScript runtime for server-side development",
    language: "javascript",
    color: "#68A063",
    icon: "nodejs",
    defaultPort: 3000,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache nodejs npm"],
      setup: [
        `npm init -y`,
        `echo "console.log('Hello from ${projectName}!')" > /workspace/${projectName}/index.js`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/index.js`,
    runCommand: "node index.js",
  },

  node_ts: {
    id: "node_ts",
    name: "Node.js + TypeScript",
    description: "Node.js with TypeScript support",
    language: "typescript",
    color: "#3178C6",
    icon: "typescript",
    defaultPort: 3000,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache nodejs npm"],
      setup: [
        `mkdir ./src`,
        `npm init -y`,
        `npm install -D typescript ts-node @types/node`,
        `npx tsc --init`,
        `echo "console.log('Hello from ${projectName}!')" > /workspace/${projectName}/src/index.ts`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/src/index.ts`,
    runCommand: "npx ts-node src/index.ts",
  },

  react: {
    id: "react",
    name: "React",
    description: "Frontend development with React + Vite",
    language: "javascript",
    color: "#61DAFB",
    icon: "react",
    defaultPort: 5173,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache nodejs npm"],
      setup: [`npm create vite@latest . -- --template react`],
      postSetup: [`npm install`],
    }),
    entryFile: (projectName) => `${projectName}/src/App.jsx`,
    runCommand: "npm run dev -- --host",
  },

  react_ts: {
    id: "react_ts",
    name: "React + TypeScript",
    description: "Frontend development with React + Vite + TypeScript",
    language: "typescript",
    color: "#61DAFB",
    icon: "react",
    defaultPort: 5173,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache nodejs npm"],
      setup: [`npm create vite@latest . -- --template react-ts`],
      postSetup: [`npm install`],
    }),
    entryFile: (projectName) => `${projectName}/src/App.tsx`,
    runCommand: "npm run dev -- --host",
  },

  react_tailwind: {
    id: "react_tailwind",
    name: "React + Tailwind CSS",
    description: "React with Vite and Tailwind CSS",
    language: "typescript",
    color: "#06B6D4",
    icon: "react",
    defaultPort: 5173,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache nodejs npm"],
      setup: [`npm create vite@latest . -- --template react-ts`],
      postSetup: [
        `npm install`,
        `npm install -D tailwindcss @tailwindcss/vite`,
        // update vite.config to add tailwind plugin
        `cat > /workspace/${projectName}/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
EOF`,
        `echo "@import 'tailwindcss';" > /workspace/${projectName}/src/index.css`,
      ],
    }),
    entryFile: (projectName) => `${projectName}/src/App.tsx`,
    runCommand: "npm run dev -- --host",
  },

  nextjs: {
    id: "nextjs",
    name: "Next.js",
    description: "React framework for production with SSR and SSG",
    language: "typescript",
    color: "#000000",
    icon: "nextjs",
    defaultPort: 3000,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache nodejs npm"],
      setup: [
        `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/src/app/page.tsx`,
    runCommand: "npm run dev -- --hostname 0.0.0.0",
  },

  svelte: {
    id: "svelte",
    name: "Svelte",
    description: "Cybernetically enhanced web apps",
    language: "typescript",
    color: "#FF3E00",
    icon: "svelte",
    defaultPort: 5173,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache nodejs npm"],
      setup: [`npm create vite@latest . -- --template svelte-ts`],
      postSetup: [`npm install`],
    }),
    entryFile: (projectName) => `${projectName}/src/App.svelte`,
    runCommand: "npm run dev -- --host",
  },

  sveltekit: {
    id: "sveltekit",
    name: "SvelteKit",
    description: "Full-stack framework powered by Svelte",
    language: "typescript",
    color: "#FF3E00",
    icon: "svelte",
    defaultPort: 5173,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache nodejs npm"],
      setup: [
        // npx sv create needs --no-install to avoid interactive prompts
        `npx sv create . --template minimal --types ts --no-add-ons --no-install`,
      ],
      postSetup: [`npm install`],
    }),
    entryFile: (projectName) => `${projectName}/src/routes/+page.svelte`,
    runCommand: "npm run dev -- --host",
  },

  nestjs: {
    id: "nestjs",
    name: "NestJS",
    description: "Progressive Node.js framework for scalable server-side apps",
    language: "typescript",
    color: "#E0234E",
    icon: "nestjs",
    defaultPort: 3000,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache nodejs npm"],
      setup: [
        `npm install -g @nestjs/cli`,
        // --skip-git avoids git init errors, --skip-install handled in postSetup
        `nest new . --package-manager npm --skip-git --skip-install`,
      ],
      postSetup: [`npm install`],
    }),
    entryFile: (projectName) => `${projectName}/src/main.ts`,
    runCommand: "npm run start:dev",
  },

  encore_ts: {
    id: "encore_ts",
    name: "Encore.ts",
    description: "TypeScript backend framework with built-in infra",
    language: "typescript",
    color: "#6E56CF",
    icon: "encore",
    defaultPort: 4000,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache nodejs npm curl bash binutils",
        "curl -fsSL https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub -o /etc/apk/keys/sgerrand.rsa.pub",
        "GLIBC_VERSION=2.35-r1 && curl -fsSL https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VERSION}/glibc-${GLIBC_VERSION}.apk -o /tmp/glibc.apk",
        "apk add --no-cache /tmp/glibc.apk && rm -f /tmp/glibc.apk",
        "curl -fsSL https://encore.dev/install.sh | bash",
      ],
      setup: [
        `bash -c 'cd /workspace && $HOME/.encore/bin/encore app create ${projectName} --lang=typescript --example=hello-world --platform=false'`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/hello/hello.ts`,
    runCommand: "encore run",
  },

  // ─── Python ──────────────────────────────────────────────────────────────

  python: {
    id: "python",
    name: "Python",
    description: "General purpose scripting and development",
    language: "python",
    color: "#3572A5",
    icon: "python",
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache python3 py3-pip python3-dev"],
      setup: [
        `python3 -m venv venv`,
        // use printf instead of echo for multiline — more reliable
        `printf "def main():\\n    print('Hello from ${projectName}!')\\n\\nif __name__ == '__main__':\\n    main()\\n" > /workspace/${projectName}/main.py`,
        `echo "requests" > /workspace/${projectName}/requirements.txt`,
      ],
      postSetup: [
        `/workspace/${projectName}/venv/bin/pip install -r /workspace/${projectName}/requirements.txt`,
      ],
    }),
    entryFile: (projectName) => `${projectName}/main.py`,
    runCommand: "venv/bin/python main.py",
  },

  fastapi: {
    id: "fastapi",
    name: "FastAPI",
    description: "Modern, fast Python web framework for building APIs",
    language: "python",
    color: "#059669",
    icon: "fastapi",
    defaultPort: 8000,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache python3 py3-pip python3-dev gcc musl-dev"],
      setup: [
        `python3 -m venv venv`,
        `printf "fastapi\\nuvicorn[standard]\\n" > /workspace/${projectName}/requirements.txt`,
        `cat > /workspace/${projectName}/main.py << 'EOF'
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"message": "Hello from ${projectName}!"}
EOF`,
      ],
      postSetup: [
        `/workspace/${projectName}/venv/bin/pip install -r /workspace/${projectName}/requirements.txt`,
      ],
    }),
    entryFile: (projectName) => `${projectName}/main.py`,
    runCommand: "venv/bin/uvicorn main:app --reload --host 0.0.0.0",
  },

  django: {
    id: "django",
    name: "Django",
    description: "High-level Python web framework",
    language: "python",
    color: "#092E20",
    icon: "django",
    defaultPort: 8000,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache python3 py3-pip python3-dev gcc musl-dev"],
      setup: [
        `python3 -m venv venv`,
        `echo "django" > /workspace/${projectName}/requirements.txt`,
        `/workspace/${projectName}/venv/bin/pip install django`,
      ],
      postSetup: [
        // startproject needs to run after pip install
        `/workspace/${projectName}/venv/bin/django-admin startproject config /workspace/${projectName}`,
      ],
    }),
    entryFile: (projectName) => `${projectName}/config/settings.py`,
    runCommand: "venv/bin/python manage.py runserver 0.0.0.0:8000",
  },

  flask: {
    id: "flask",
    name: "Flask",
    description: "Lightweight Python web framework",
    language: "python",
    color: "#000000",
    icon: "flask",
    defaultPort: 5000,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache python3 py3-pip python3-dev"],
      setup: [
        `python3 -m venv venv`,
        `echo "flask" > /workspace/${projectName}/requirements.txt`,
        `cat > /workspace/${projectName}/app.py << 'EOF'
from flask import Flask

app = Flask(__name__)

@app.route("/")
def hello():
    return "Hello from ${projectName}!"

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
EOF`,
      ],
      postSetup: [
        `/workspace/${projectName}/venv/bin/pip install -r /workspace/${projectName}/requirements.txt`,
      ],
    }),
    entryFile: (projectName) => `${projectName}/app.py`,
    runCommand: "venv/bin/python app.py",
  },

  // ─── Rust ────────────────────────────────────────────────────────────────

  rust: {
    id: "rust",
    name: "Rust",
    description: "Systems programming with Rust",
    language: "rust",
    color: "#CE422B",
    icon: "rust",
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache curl gcc musl-dev",
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal",
      ],
      setup: [
        // source and cargo new in one command — source doesn't persist
        `bash -c 'source $HOME/.cargo/env && cargo init'`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/src/main.rs`,
    runCommand: "cargo run",
  },

  rust_web: {
    id: "rust_web",
    name: "Rust + Axum",
    description: "Rust web API with Axum framework",
    language: "rust",
    color: "#CE422B",
    icon: "rust",
    defaultPort: 3000,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache curl gcc musl-dev openssl-dev pkgconf",
        "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal",
      ],
      setup: [
        `bash -c 'source $HOME/.cargo/env && cargo init'`,
        `bash -c 'source $HOME/.cargo/env && cargo add axum tokio --features tokio/full'`,
        `cat > /workspace/${projectName}/src/main.rs << 'EOF'
use axum::{routing::get, Router};

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(|| async { "Hello from ${projectName}!" }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
EOF`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/src/main.rs`,
    runCommand: "cargo run",
  },

  // ─── Go ──────────────────────────────────────────────────────────────────

  go: {
    id: "go",
    name: "Go",
    description: "Fast, statically typed compiled language",
    language: "go",
    color: "#00ADD8",
    icon: "go",
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache go curl bash binutils",
        "curl -fsSL https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub -o /etc/apk/keys/sgerrand.rsa.pub",
        "GLIBC_VERSION=2.35-r1 && curl -fsSL https://github.com/sgerrand/alpine-pkg-glibc/releases/download/${GLIBC_VERSION}/glibc-${GLIBC_VERSION}.apk -o /tmp/glibc.apk",
        "apk add --no-cache /tmp/glibc.apk && rm -f /tmp/glibc.apk",
        "curl -fsSL https://encore.dev/install.sh | bash",
      ],
      setup: [
        `bash -c 'cd /workspace && $HOME/.encore/bin/encore app create ${projectName} --lang=go --example=hello-world --platform=false'`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/main.go`,
    runCommand: "go run main.go",
  },

  encore_go: {
    id: "encore_go",
    name: "Encore.go",
    description: "Go backend framework with built-in infra",
    language: "go",
    color: "#00ADD8",
    icon: "encore",
    defaultPort: 4000,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache go curl bash libc6-compat gcompat",
        "curl -fsSL https://encore.dev/install.sh | bash",
      ],
      setup: [
        `bash -c 'cd /workspace && $HOME/.encore/bin/encore app create ${projectName} --lang=go --example=hello-world --platform=false'`,
        // `bash -c 'cd /workspace && $HOME/.encore/bin/encore app create ${projectName} --example=hello-world'`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/hello/hello.go`,
    runCommand: "encore run",
  },

  gin: {
    id: "gin",
    name: "Go + Gin",
    description: "Go web framework with fast HTTP routing",
    language: "go",
    color: "#00ADD8",
    icon: "go",
    defaultPort: 8080,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache go"],
      setup: [
        `go mod init ${projectName}`,
        `cat > /workspace/${projectName}/main.go << 'EOF'
package main

import "github.com/gin-gonic/gin"

func main() {
    r := gin.Default()
    r.GET("/", func(c *gin.Context) {
        c.JSON(200, gin.H{"message": "Hello from ${projectName}!"})
    })
    r.Run(":8080")
}
EOF`,
        `cd /workspace/${projectName} && go get github.com/gin-gonic/gin`,
        `cd /workspace/${projectName} && go mod tidy`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/main.go`,
    runCommand: "go run main.go",
  },

  // ─── Java / JVM ──────────────────────────────────────────────────────────

  java: {
    id: "java",
    name: "Java",
    description: "Object-oriented programming with Java",
    language: "java",
    color: "#B07219",
    icon: "java",
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache openjdk21"],
      setup: [
        `cat > /workspace/${projectName}/Main.java << 'EOF'
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from ${projectName}!");
    }
}
EOF`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/Main.java`,
    runCommand: "javac Main.java && java Main",
  },

  spring_boot: {
    id: "spring_boot",
    name: "Spring Boot",
    description: "Java framework for production-ready Spring apps",
    language: "java",
    color: "#6DB33F",
    icon: "spring",
    defaultPort: 8080,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache openjdk21 curl unzip"],
      setup: [
        // download zip then unzip into workspace
        `curl -s "https://start.spring.io/starter.zip?type=maven-project&language=java&bootVersion=3.2.0&baseDir=${projectName}&groupId=com.synthex&artifactId=${projectName}&name=${projectName}&dependencies=web" -o /tmp/${projectName}.zip`,
        `unzip /tmp/${projectName}.zip -d /workspace`,
        `rm /tmp/${projectName}.zip`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) =>
      `${projectName}/src/main/java/com/synthex/${projectName}/${projectName}Application.java`,
    runCommand: "./mvnw spring-boot:run",
  },

  kotlin: {
    id: "kotlin",
    name: "Kotlin",
    description: "Modern JVM language by JetBrains",
    language: "kotlin",
    color: "#7F52FF",
    icon: "kotlin",
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache openjdk21 kotlin"],
      setup: [
        `cat > /workspace/${projectName}/main.kt << 'EOF'
fun main() {
    println("Hello from ${projectName}!")
}
EOF`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/main.kt`,
    runCommand:
      "kotlinc main.kt -include-runtime -d main.jar && java -jar main.jar",
  },

  // ─── Ruby ────────────────────────────────────────────────────────────────

  ruby: {
    id: "ruby",
    name: "Ruby",
    description: "Dynamic, open source programming language",
    language: "ruby",
    color: "#CC342D",
    icon: "ruby",
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache ruby ruby-dev gcc musl-dev make"],
      setup: [
        `echo 'puts "Hello from ${projectName}!"' > /workspace/${projectName}/main.rb`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/main.rb`,
    runCommand: "ruby main.rb",
  },

  rails: {
    id: "rails",
    name: "Ruby on Rails",
    description: "Full-stack web framework for Ruby",
    language: "ruby",
    color: "#CC0000",
    icon: "rails",
    defaultPort: 3000,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache ruby ruby-dev gcc musl-dev make nodejs npm tzdata sqlite-dev",
        "gem install rails --no-document",
      ],
      setup: [
        // --skip-git and --skip-bundle to avoid issues in container
        `cd /workspace && rails new ${projectName} --api --skip-git --skip-bundle --database=sqlite3`,
      ],
      postSetup: [`bundle install`],
    }),
    entryFile: (projectName) => `${projectName}/config/application.rb`,
    runCommand: "rails server -b 0.0.0.0",
  },

  sinatra: {
    id: "sinatra",
    name: "Sinatra",
    description: "Minimal Ruby web framework",
    language: "ruby",
    color: "#CC342D",
    icon: "ruby",
    defaultPort: 4567,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache ruby ruby-dev gcc musl-dev make",
        "gem install sinatra --no-document",
      ],
      setup: [
        `cat > /workspace/${projectName}/app.rb << 'EOF'
require 'sinatra'

get '/' do
  "Hello from ${projectName}!"
end
EOF`,
        `echo "gem 'sinatra'" > /workspace/${projectName}/Gemfile`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/app.rb`,
    runCommand: "ruby app.rb -o 0.0.0.0",
  },

  // ─── PHP ─────────────────────────────────────────────────────────────────

  php: {
    id: "php",
    name: "PHP",
    description: "General purpose scripting language for web development",
    language: "php",
    color: "#777BB4",
    icon: "php",
    defaultPort: 8000,
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache php83 php83-cli php83-mbstring"],
      setup: [
        `printf '<?php\necho "Hello from ${projectName}!\\n";\n' > /workspace/${projectName}/index.php`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/index.php`,
    runCommand: "php83 -S 0.0.0.0:8000",
  },

  laravel: {
    id: "laravel",
    name: "Laravel",
    description: "PHP framework for web artisans",
    language: "php",
    color: "#FF2D20",
    icon: "laravel",
    defaultPort: 8000,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache php83 php83-cli php83-mbstring php83-xml php83-zip php83-pdo php83-tokenizer php83-phar php83-dom php83-xmlwriter curl unzip",
        "curl -sS https://getcomposer.org/installer | php83 -- --install-dir=/usr/local/bin --filename=composer",
      ],
      setup: [
        `cd /workspace && composer create-project laravel/laravel ${projectName} --prefer-dist --no-interaction`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/routes/web.php`,
    runCommand: "php83 artisan serve --host=0.0.0.0",
  },

  // ─── C / C++ ─────────────────────────────────────────────────────────────

  cpp: {
    id: "cpp",
    name: "C++",
    description: "High performance systems programming",
    language: "cpp",
    color: "#F34B7D",
    icon: "cpp",
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache g++ gcc make cmake musl-dev"],
      setup: [
        `mkdir -p ./build`,
        `cat > /workspace/${projectName}/main.cpp << 'EOF'
#include <iostream>

int main() {
    std::cout << "Hello from ${projectName}!" << std::endl;
    return 0;
}
EOF`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/main.cpp`,
    runCommand: "g++ main.cpp -o build/app && ./build/app",
  },

  c: {
    id: "c",
    name: "C",
    description: "Low-level systems programming language",
    language: "c",
    color: "#555555",
    icon: "c",
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache gcc musl-dev make"],
      setup: [
        `mkdir -p ./build`,
        `cat > /workspace/${projectName}/main.c << 'EOF'
#include <stdio.h>

int main() {
    printf("Hello from ${projectName}!\n");
    return 0;
}
EOF`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/main.c`,
    runCommand: "gcc main.c -o build/app && ./build/app",
  },

  // ─── Zig ─────────────────────────────────────────────────────────────────

  zig: {
    id: "zig",
    name: "Zig",
    description: "General purpose systems programming language",
    language: "zig",
    color: "#F7A41D",
    icon: "zig",
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache curl xz tar",
        "curl -fsSL https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz -o /tmp/zig.tar.xz",
        "tar -xf /tmp/zig.tar.xz -C /usr/local",
        "ln -sf /usr/local/zig-linux-x86_64-0.13.0/zig /usr/local/bin/zig",
        "rm /tmp/zig.tar.xz",
      ],
      setup: [`zig init`],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/src/main.zig`,
    runCommand: "zig build run",
  },

  // ─── Deno ────────────────────────────────────────────────────────────────

  deno: {
    id: "deno",
    name: "Deno",
    description: "Secure JavaScript and TypeScript runtime",
    language: "typescript",
    color: "#70FFAF",
    icon: "deno",
    defaultPort: 8000,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache curl unzip",
        "curl -fsSL https://deno.land/install.sh | sh",
      ],
      setup: [
        `cat > /workspace/${projectName}/main.ts << 'EOF'
Deno.serve({ port: 8000 }, (_req) => {
  return new Response("Hello from ${projectName}!");
});
EOF`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) => `${projectName}/main.ts`,
    // source deno env in same command
    runCommand:
      "bash -c 'source $HOME/.deno/env && deno run --allow-net main.ts'",
  },

  // ─── .NET ────────────────────────────────────────────────────────────────

  dotnet: {
    id: "dotnet",
    name: "C# (.NET)",
    description: "Modern cross-platform .NET development",
    language: "csharp",
    color: "#512BD4",
    icon: "dotnet",
    defaultPort: 5000,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache curl bash icu-libs libgcc libssl3 libstdc++ zlib",
        "curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0 --install-dir /usr/local/dotnet",
        "ln -sf /usr/local/dotnet/dotnet /usr/local/bin/dotnet",
      ],
      setup: [
        `dotnet new console -n ${projectName} -o /workspace/${projectName} --no-restore`,
      ],
      postSetup: [`dotnet restore`],
    }),
    entryFile: (projectName) => `${projectName}/Program.cs`,
    runCommand: "dotnet run",
  },

  aspnet: {
    id: "aspnet",
    name: "ASP.NET Core",
    description: "Cross-platform .NET web framework",
    language: "csharp",
    color: "#512BD4",
    icon: "dotnet",
    defaultPort: 5000,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache curl bash icu-libs libgcc libssl3 libstdc++ zlib",
        "curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0 --install-dir /usr/local/dotnet",
        "ln -sf /usr/local/dotnet/dotnet /usr/local/bin/dotnet",
      ],
      setup: [
        `dotnet new webapi -n ${projectName} -o /workspace/${projectName} --no-openapi --no-restore`,
      ],
      postSetup: [`dotnet restore`],
    }),
    entryFile: (projectName) => `${projectName}/Program.cs`,
    runCommand: "dotnet run --urls http://0.0.0.0:5000",
  },

  // ─── Elixir ──────────────────────────────────────────────────────────────

  elixir: {
    id: "elixir",
    name: "Elixir",
    description: "Dynamic, functional language for scalable apps",
    language: "elixir",
    color: "#6E4A7E",
    icon: "elixir",
    getCommands: (projectName: string) => ({
      install: ["apk add --no-cache elixir"],
      setup: [`cd /workspace && mix new ${projectName} --no-git`],
      postSetup: [`mix deps.get`],
    }),
    entryFile: (projectName) => `${projectName}/lib/${projectName}.ex`,
    runCommand: "mix run",
  },

  phoenix: {
    id: "phoenix",
    name: "Phoenix",
    description: "Productive web framework for Elixir",
    language: "elixir",
    color: "#FD4F00",
    icon: "phoenix",
    defaultPort: 4000,
    getCommands: (projectName: string) => ({
      install: [
        "apk add --no-cache elixir nodejs npm inotify-tools",
        "mix local.hex --force",
        "mix local.rebar --force",
        "mix archive.install hex phx_new --force",
      ],
      setup: [
        `cd /workspace && mix phx.new ${projectName} --no-ecto --no-git --install`,
      ],
      postSetup: [],
    }),
    entryFile: (projectName) =>
      `${projectName}/lib/${projectName}_web/router.ex`,
    runCommand: "mix phx.server",
  },
};

type TemplateId = keyof typeof TEMPLATES;

export { type Template, TEMPLATES, type TemplateId };
