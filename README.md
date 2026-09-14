# ArcMarket+

A native app store for CachyOS: search and install from the official repos, the
AUR, and (optionally) Chaotic-AUR's prebuilt AUR binaries, all from one Electron
GUI backed by [paru](https://github.com/Morganamilo/paru).

## One-time setup

Run `~/Desktop/setup-arcmarket.sh` from a terminal. It will:

1. Install `base-devel git nodejs npm electron github-cli` via pacman.
2. Build and install `paru` (AUR helper) from the AUR.
3. Optionally enable the Chaotic-AUR binary repo.
4. Log you into GitHub via `gh auth login`.

## Running

```
electron .
```
or use the installed desktop launcher ("ArcMarket+" in your application menu).

## How package actions work

Search and package-info are read-only and run in the background. Install,
remove, and "Update All" open a terminal window running `paru`, since pacman/
paru need an interactive terminal to prompt for your sudo password.

## Auto-update while running

`systemd/arcmarket-autopull.timer` periodically runs `scripts/autopull.sh`,
which fast-forwards this repo from `origin/main`. The running app watches
`.git/refs/heads/main` and relaunches itself automatically when that ref
changes — so pushing a commit updates the app on this machine within a few
minutes, without needing to quit and reopen it. You can also click
"Check app updates" in the header to pull immediately.

Enable it with:

```
systemctl --user enable --now arcmarket-autopull.timer
```
(the unit files are symlinked into `~/.config/systemd/user/` by the setup
flow; see `systemd/` in this repo for the source files.)
