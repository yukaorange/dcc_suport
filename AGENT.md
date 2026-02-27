# AGENTS.md

## プロジェクトの前提

Adobe CC（Illustrator / Photoshop / After Effects）でグラフィック制作中、AIが画面を自律的に監視し、制作の方針に沿ったコーチングをリアルタイムで行うCLIツール。

## ドキュメント

作業開始時にまず `docs/README.md` を読み、プロジェクト全体の構成を把握すること。

- `.claude/rules/coderule.md` — コーディングルール
- `.claude/rules/convention.md` — 設計原則・テスト・セキュリティ

## rule

- ALWAYS use bun instead of npm. (DO NOT use dotenv, env)
- NEVER include comments which describes a code line-by-line
- コメントを書く場合は「何をしているか」ではなく「なぜそうしているか」を書くこと
