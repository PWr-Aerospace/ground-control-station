#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::Deserialize;
use std::env;
use tauri::Manager;
use tokio::io::{AsyncReadExt, BufReader};
use tokio_serial::SerialPortBuilderExt;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Telemetry {
    team_id: f32,
    mission_time: f32,
    packet_count: f32,
    mode: String,
    state: String,
    altitude: f32,
    hs_deployed: String,
    pc_deployed: String,
    mast_raised: String,
    temperature: f32,
    voltage: f32,
    gps_time: String,
    gps_altitude: f32,
    gps_latitude: f32,
    gps_longitude: f32,
    tilt_x: f32,
    tilt_y: f32,
    cmd_echo: String,
}
#[derive(Clone, serde::Serialize)]
struct GraphDataPayload {
    value: f32,
}

#[tokio::main]
async fn main() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .menu(if cfg!(target_os = "macos") {
            tauri::Menu::os_default(&context.package_info().name)
        } else {
            tauri::Menu::default()
        })
        .on_page_load(|app, _| {
            let app_copy = app.clone();

            let port_name = String::from("/dev/cu.usbmodem11301");

            // Configure the serial port settings
            let mut builder = tokio_serial::new(port_name, 115200);
            builder = builder
                .flow_control(tokio_serial::FlowControl::None)
                .stop_bits(tokio_serial::StopBits::One)
                .parity(tokio_serial::Parity::None);

            // Open the serial port
            let port = builder.open_native_async().unwrap();

            // Create a buffer for reading bytes from the serial port
            let mut buf_reader = BufReader::with_capacity(4096, port);
            let mut message = String::new();

            std::thread::spawn(move || {
                let async_block = async move {
                    while let Some(byte) = buf_reader.read_u8().await.ok() {
                        if byte == b'\n' {
                            // Process the complete message
                            println!("Received message: {:?}", message);
                            let mut csv_reader = csv::ReaderBuilder::new()
                                .has_headers(false)
                                .from_reader(message.as_bytes());
                            for result in csv_reader.deserialize::<Telemetry>() {
                                let telemetry = result.unwrap();
                                println!("{:#?}", telemetry);
                                app_copy
                                    .emit_all(
                                        "graph-data",
                                        GraphDataPayload {
                                            value: telemetry.mission_time,
                                        },
                                    )
                                    .expect("failed to emit event");
                            }

                            // Reset the message buffer for the next message
                            message.clear();
                        } else {
                            // Append the byte to the current message
                            message.push(char::from(byte));
                        }
                    }
                };
                tokio::runtime::Runtime::new()
                    .unwrap()
                    .block_on(async_block);
            });
        })
        .run(context)
        .expect("error while running tauri application");
}
