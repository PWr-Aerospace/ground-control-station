# Ground Control Station

<!-- markdownlint-disable MD013 -->
<!-- ![Crates.io](https://img.shields.io/crates/l/ground-control-station) ![Crates.io](https://img.shields.io/crates/v/ground-control-station) ![docs.rs](https://img.shields.io/docsrs/ground-control-station) -->
[![🧪 Tests](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/tests.yml/badge.svg)](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/tests.yml) [![🖋 Check linting](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/lint.yml/badge.svg)](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/lint.yml) [![🔨 Build](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/build.yml/badge.svg)](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/build.yml) [![📦 Package](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/package.yml/badge.svg)](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/package.yml) [![👔 Check formatting](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/format.yml/badge.svg)](https://github.com/PWr-Aerospace/ground-control-station/actions/workflows/format.yml)
<!-- markdownlint-enable MD013 -->

CanSat Ground Control Station.

## Development

In order to locally run development versions and build your own follow these steps to setup your local environment:

1. Install rust following instructions on the official web page: <https://www.rust-lang.org/tools/install>
2. Install `node` and `npm`, node has to be at least version 16
3. Install the `tauri` project management plugin for `cargo` (this will take a while):

    ```bash
    cargo install tauri-cli
    ```

4. Install the local JS server `vite` using npm

    ```bash
    npm install vite
    ```

5. If you are on `Ubuntu` install these packages using `apt`:

    ```bash
    sudo apt-get update ; sudo apt-get install -y libgtk-3-dev webkit2gtk-4.0 libappindicator3-dev librsvg2-dev patchelf libudev-dev
    ```

6. Now you should be capable of building the application. Navigate to the root
of the cloned repository and run:

    For a development build:

    ```bash
    cargo tauri dev
    ```

    For release build (that will create an installer for your operating system):

    ```bash
    cargo tauri build
    ```

7. If your build failed saying that tsc is not a known command you have to explicitly
    install typescript by running:

    ```bash
    npm install -g typescript
    ```

## Credits

This package was created with Cookiecutter, and the
`John15321/cookiecutter-krabby-patty` project template.

Cookiecutter: <https://github.com/audreyr/cookiecutter>

`John15321/cookiecutter-krabby-patty`: <https://github.com/John15321/cookiecutter-krabby-patty>
