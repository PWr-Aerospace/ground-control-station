#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use tauri::Manager;

#[derive(Clone, serde::Serialize)]
struct GraphDataPayload {
    value: f64,
}

fn main() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .menu(if cfg!(target_os = "macos") {
            tauri::Menu::os_default(&context.package_info().name)
        } else {
            tauri::Menu::default()
        })
        .on_page_load(|app, _| {
            let app_copy = app.clone();
            let mut last_value = 0.0;
            std::thread::spawn(move || loop {
                let value = (rand::random::<f64>() * 100.0)
                    .round() // round the value to reduce noise in the graph
                    .clamp(0.0, 100.0); // clamp the value to be between 0 and 100
                if (last_value - value).abs() > f64::EPSILON {
                    app_copy
                        .emit_all("graph-data", GraphDataPayload { value })
                        .expect("failed to emit event");
                    last_value = value;
                }
                std::thread::sleep(std::time::Duration::from_secs(2));
            });
        })
        .run(context)
        .expect("error while running tauri application");
}
