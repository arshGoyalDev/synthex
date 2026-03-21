interface Language {
  id: string;
  name: string;
  color: string;
  icon: string;
  installCommands: string[];
  runCommand?: string;
}

const LANGUAGES: Record<string, Language> = {
  javascript: {
    id: "javascript",
    name: "JavaScript",
    color: "#F7DF1E",
    icon: "javascript",
    installCommands: ["apk add --no-cache nodejs npm"],
    runCommand: "node index.js",
  },
  typescript: {
    id: "typescript",
    name: "TypeScript",
    color: "#3178C6",
    icon: "typescript",
    installCommands: [
      "apk add --no-cache nodejs npm",
      "npm install -g typescript ts-node",
    ],
    runCommand: "ts-node index.ts",
  },
  python: {
    id: "python",
    name: "Python",
    color: "#3572A5",
    icon: "python",
    installCommands: ["apk add --no-cache python3 py3-pip python3-dev"],
    runCommand: "python main.py",
  },
  rust: {
    id: "rust",
    name: "Rust",
    color: "#CE422B",
    icon: "rust",
    installCommands: [
      "apk add --no-cache curl gcc musl-dev",
      "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal",
      "source $HOME/.cargo/env",
    ],
    runCommand: "cargo run",
  },
  go: {
    id: "go",
    name: "Go",
    color: "#00ADD8",
    icon: "go",
    installCommands: ["apk add --no-cache go"],
    runCommand: "go run main.go",
  },
  java: {
    id: "java",
    name: "Java",
    color: "#B07219",
    icon: "java",
    installCommands: ["apk add --no-cache openjdk21"],
    runCommand: "javac Main.java && java Main",
  },
  cpp: {
    id: "cpp",
    name: "C++",
    color: "#F34B7D",
    icon: "cpp",
    installCommands: ["apk add --no-cache g++ gcc make cmake musl-dev"],
    runCommand: "g++ main.cpp -o app && ./app",
  },
  c: {
    id: "c",
    name: "C",
    color: "#555555",
    icon: "c",
    installCommands: ["apk add --no-cache gcc musl-dev make"],
    runCommand: "gcc main.c -o app && ./app",
  },
  ruby: {
    id: "ruby",
    name: "Ruby",
    color: "#CC342D",
    icon: "ruby",
    installCommands: ["apk add --no-cache ruby ruby-dev gcc musl-dev make"],
    runCommand: "ruby main.rb",
  },
  php: {
    id: "php",
    name: "PHP",
    color: "#777BB4",
    icon: "php",
    installCommands: ["apk add --no-cache php php-cli php-mbstring"],
    runCommand: "php index.php",
  },
  zig: {
    id: "zig",
    name: "Zig",
    color: "#F7A41D",
    icon: "zig",
    installCommands: [
      "apk add --no-cache curl xz tar",
      "curl -fsSL https://ziglang.org/download/0.13.0/zig-linux-x86_64-0.13.0.tar.xz -o /tmp/zig.tar.xz",
      "tar -xf /tmp/zig.tar.xz -C /usr/local",
      "ln -s /usr/local/zig-linux-x86_64-0.13.0/zig /usr/local/bin/zig",
    ],
    runCommand: "zig run main.zig",
  },
  elixir: {
    id: "elixir",
    name: "Elixir",
    color: "#6E4A7E",
    icon: "elixir",
    installCommands: ["apk add --no-cache elixir"],
    runCommand: "elixir main.exs",
  },
  kotlin: {
    id: "kotlin",
    name: "Kotlin",
    color: "#7F52FF",
    icon: "kotlin",
    installCommands: ["apk add --no-cache openjdk21 kotlin"],
    runCommand:
      "kotlinc main.kt -include-runtime -d main.jar && java -jar main.jar",
  },
  csharp: {
    id: "csharp",
    name: "C#",
    color: "#512BD4",
    icon: "dotnet",
    installCommands: [
      "apk add --no-cache curl bash icu-libs libgcc libssl3 libstdc++ zlib",
      "curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- --channel 8.0",
      "export PATH=$PATH:$HOME/.dotnet",
    ],
    runCommand: "dotnet run",
  },
};

type LanguageId = keyof typeof LANGUAGES;

export { type Language, LANGUAGES, type LanguageId };
