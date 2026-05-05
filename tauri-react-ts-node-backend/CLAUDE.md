# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Tauri v2 desktop app using React + TypeScript (frontend) and Rust (backend). The frontend is built with Vite and communicates with Rust via Tauri's `invoke` IPC mechanism.

## Commands

### Development
```sh
npm run tauri dev       # Start app in dev mode (launches Vite + Rust backend)
npm run dev             # Vite only (no Tauri shell)
```

### Build
```sh
# Must set NO_STRIP=true on Linux to avoid strip errors
export NO_STRIP=true
npm run tauri build     # Production build + bundle

# Verbose build
npx tauri -v build
```

### Frontend only
```sh
npm run build           # tsc + vite build
npm run preview         # Preview the Vite dist
```

## Architecture

Two runtimes communicate via Tauri IPC:

**Frontend** (`src/`) — React 18 + TypeScript, bundled by Vite to `dist/`. Calls Rust commands using `invoke("command_name", { args })` from `@tauri-apps/api/core`.

**Backend** (`src-tauri/`) — Rust library crate (`tauri_test_lib`). Commands are defined as `#[tauri::command]` functions in `src/lib.rs` and registered in `.invoke_handler(tauri::generate_handler![...])`. `main.rs` just calls `lib.rs::run()`.

**Tauri config** (`src-tauri/tauri.conf.json`) — defines the app window, bundle targets, `beforeDevCommand`/`beforeBuildCommand` hooks, and the dev URL (fixed at `http://localhost:1420`).

Vite's dev server is pinned to port **1420** (strict — will fail if occupied). HMR uses port 1421 when `TAURI_DEV_HOST` is set (mobile/remote dev).

## Linux Setup (Manjaro/Arch)

Required system packages:
```sh
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg xdotool
```
