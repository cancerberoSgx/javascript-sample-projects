# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)




# seba notes

how to install some of the requirements

```sh
sudo pacman -Syu
sudo pacman -S --needed \
  webkit2gtk-4.1 \
  base-devel \
  curl \
  wget \
  file \
  openssl \
  appmenu-gtk-module \
  libappindicator-gtk3 \
  librsvg \
  xdotool
```


https://github.com/linuxdeploy/linuxdeploy-plugin-gtk

```sh
# get linuxdeploy and linuxdeploy-plugin-gtk
wget -c "https://raw.githubusercontent.com/linuxdeploy/linuxdeploy-plugin-gtk/master/linuxdeploy-plugin-gtk.sh"
wget -c "https://github.com/linuxdeploy/linuxdeploy/releases/download/continuous/linuxdeploy-x86_64.AppImage"
# make them executable so that we can call them (and also, plugins called from linuxdeploy are called like binaries)
chmod +x linuxdeploy-x86_64.AppImage linuxdeploy-plugin-gtk.sh

mv linuxdeploy-x86_64.AppImage linuxdeploy-plugin-gtk.sh .local/bin/
```


how to run build verbose 
```sh
npx tauri -v build
```

how to execute the build command successfully:

```sh
export NO_STRIP=true
npm run tauri build
```

