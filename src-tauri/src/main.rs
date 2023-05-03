#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use serde::Deserialize;
use std::env;
use tauri::Manager;
use tokio::io::{AsyncReadExt, BufReader};
use tokio_serial::SerialPortBuilderExt;
use serialport::available_ports;

fn get_serial_ports() -> Vec<String> {
    match available_ports() {
        Ok(ports) => {
            ports.into_iter().map(|p| p.port_name).collect()
        }
        Err(e) => {
            eprintln!("Failed to get serial ports: {}", e);
            Vec::new()
        }
    }
}


#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Telemetry {
    team_id: i32,
    // MISSION_TIME is UTC time in format hh:mm:ss, where hh is hours, mm is minutes,
    // and ss is seconds. E.g., '13:14:02' indicates 1:14:02 PM
    mission_time: String,
    // PACKET_COUNT is the total count of transmitted packets since turn on, which is to be
    // reset to zero by command when the CanSat is installed in the rocket on the launch pad
    // at the beginning of the mission and maintained through processor reset.
    packet_count: f32,
    // 'F' for flight mode and 'S' for simulation mode
    mode: String,
    // STATE is the operating state of the software. (e.g., LAUNCH_WAIT, ASCENT,
    // ROCKET_SEPARATION, DESCENT, HS_RELEASE, LANDED, etc.). Teams may
    // define their own states. This should be a human readable description as the judges
    // will review it after the launch in the .csv files
    state: String,
    // ALTITUDE is the altitude in units of meters and must be relative to ground level at the
    // launch site. The resolution must be 0.1 meters
    altitude: f32,
    // 'P' indicates the Probe with heat shield is deployed, 'N' otherwise
    hs_deployed: String,
    // 'C' indicates the Probe parachute is deployed (at 200 m), 'N' otherwise
    pc_deployed: String,
    // 'M' indicates the flag mast has been raised after landing, 'N' otherwise
    mast_raised: String,
    // TEMPERATURE is the temperature in degrees Celsius with a resolution of 0.1 degrees
    temperature: f32,
    // PRESSURE is the air pressure of the sensor used. Value must be in kPa with
    // a resolution of 0.1 kPa
    pressure: f32,
    // VOLTAGE is the voltage of the CanSat power bus with a resolution of 0.1 volts
    voltage: f32,
    // GPS_TIME is the time from the GPS receiver. The time must be reported in UTC and
    // have a resolution of a second
    gps_time: String,
    // GPS_ALTITUDE is the altitude from the GPS receiver in meters above mean sea
    // level with a resolution of 0.1 meters
    gps_altitude: f32,
    // GPS_LATITUDE is the latitude from the GPS receiver in decimal degrees with a
    // resolution of 0.0001 degrees North
    gps_latitude: f32,
    // GPS_LONGITUDE is the longitude from the GPS receiver in decimal degrees with a
    // resolution of 0.0001 degrees West
    gps_longitude: f32,
    // GPS_SATS is the number of GPS satellites being tracked by the GPS receiver. This
    // must be an integer
    gps_sats: i32,
    // TILT_X, TILT_Y are the angles of the CanSat X and Y axes in degrees, with a
    // resolution of 0.01 degrees, where zero degrees is defined as when the axes are
    // perpendicular to the Z axis which is defined as towards the center of gravity of the
    // Earth
    tilt_x: f32,
    tilt_y: f32,
    // CMD_ECHO is the text of the last command received and processed by the CanSat.
    // For example, CXON or SP101325. See the command section for details of command
    // formats. Do not include commas characters
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
            println!("{:?}", get_serial_ports());
            let port_name = String::from("/dev/cu.usbmodem11101");

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
                                            value: telemetry.voltage,
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
