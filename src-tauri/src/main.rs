#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]
extern crate url;

use core::panic;
use csv::WriterBuilder;
use lazy_static::lazy_static;
use serde::ser::Serializer;
use serde::{Deserialize, Serialize};
use serialport::available_ports;
use std::fs::OpenOptions;
use std::io::Read;
use std::path::PathBuf;

use chrono::{DateTime, Datelike, Timelike, Utc};
use dirs;
use std::{env, fs::File, sync::Arc};
use tauri::http::{header::*, status::StatusCode, ResponseBuilder};
use tauri::{AppHandle, Manager};
use tokio::io::{split, AsyncReadExt, AsyncWriteExt, WriteHalf};
use tokio_serial::{SerialPortBuilderExt, SerialStream};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[allow(dead_code)]
struct Telemetry {
    team_id: i32,
    /// MISSION_TIME is UTC time in format hh:mm:ss, where hh is hours, mm is minutes,
    /// and ss is seconds. E.g., '13:14:02' indicates 1:14:02 PM
    mission_time: String,
    /// PACKET_COUNT is the total count of transmitted packets since turn on, which is to be
    /// reset to zero by command when the CanSat is installed in the rocket on the launch pad
    /// at the beginning of the mission and maintained through processor reset.
    packet_count: i32,
    /// 'F' for flight mode and 'S' for simulation mode
    mode: String,
    /// STATE is the operating state of the software. (e.g., LAUNCH_WAIT, ASCENT,
    /// ROCKET_SEPARATION, DESCENT, HS_RELEASE, LANDED, etc.). Teams may
    /// define their own states. This should be a human readable description as the judges
    /// will review it after the launch in the .csv files
    state: String,
    /// ALTITUDE is the altitude in units of meters and must be relative to ground level at the
    /// launch site. The resolution must be 0.1 meters
    altitude: f32,
    /// 'P' indicates the Probe with heat shield is deployed, 'N' otherwise
    hs_deployed: String,
    /// 'C' indicates the Probe parachute is deployed (at 200 m), 'N' otherwise
    pc_deployed: String,
    /// 'M' indicates the flag mast has been raised after landing, 'N' otherwise
    mast_raised: String,
    /// TEMPERATURE is the temperature in degrees Celsius with a resolution of 0.1 degrees
    temperature: f32,
    /// PRESSURE is the air pressure of the sensor used. Value must be in kPa with
    /// a resolution of 0.1 kPa
    pressure: f32,
    /// VOLTAGE is the voltage of the CanSat power bus with a resolution of 0.1 volts
    voltage: f32,
    /// GPS_TIME is the time from the GPS receiver. The time must be reported in UTC and
    /// have a resolution of a second
    gps_time: String,
    /// GPS_ALTITUDE is the altitude from the GPS receiver in meters above mean sea
    /// level with a resolution of 0.1 meters
    gps_altitude: f32,
    /// GPS_LATITUDE is the latitude from the GPS receiver in decimal degrees with a
    /// resolution of 0.0001 degrees North
    gps_latitude: f32,
    /// GPS_LONGITUDE is the longitude from the GPS receiver in decimal degrees with a
    /// resolution of 0.0001 degrees West
    gps_longitude: f32,
    /// GPS_SATS is the number of GPS satellites being tracked by the GPS receiver. This
    /// must be an integer
    gps_sats: i32,
    /// TILT_X, TILT_Y are the angles of the CanSat X and Y axes in degrees, with a
    /// resolution of 0.01 degrees, where zero degrees is defined as when the axes are
    /// perpendicular to the Z axis which is defined as towards the center of gravity of the
    /// Earth
    tilt_x: f32,
    tilt_y: f32,
    /// CMD_ECHO is the text of the last command received and processed by the CanSat.
    /// For example, CXON or SP101325. See the command section for details of command
    /// formats. Do not include commas characters
    cmd_echo: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TelemetryCsv {
    team_id: i32,
    /// MISSION_TIME is UTC time in format hh:mm:ss, where hh is hours, mm is minutes,
    /// and ss is seconds. E.g., '13:14:02' indicates 1:14:02 PM
    mission_time: String,
    /// PACKET_COUNT is the total count of transmitted packets since turn on, which is to be
    /// reset to zero by command when the CanSat is installed in the rocket on the launch pad
    /// at the beginning of the mission and maintained through processor reset.
    packet_count: i32,
    /// 'F' for flight mode and 'S' for simulation mode
    mode: String,
    /// STATE is the operating state of the software. (e.g., LAUNCH_WAIT, ASCENT,
    /// ROCKET_SEPARATION, DESCENT, HS_RELEASE, LANDED, etc.). Teams may
    /// define their own states. This should be a human readable description as the judges
    /// will review it after the launch in the .csv files
    state: String,
    /// ALTITUDE is the altitude in units of meters and must be relative to ground level at the
    /// launch site. The resolution must be 0.1 meters
    altitude: String,
    /// 'P' indicates the Probe with heat shield is deployed, 'N' otherwise
    hs_deployed: String,
    /// 'C' indicates the Probe parachute is deployed (at 200 m), 'N' otherwise
    pc_deployed: String,
    /// 'M' indicates the flag mast has been raised after landing, 'N' otherwise
    mast_raised: String,
    /// TEMPERATURE is the temperature in degrees Celsius with a resolution of 0.1 degrees
    temperature: String,
    /// PRESSURE is the air pressure of the sensor used. Value must be in kPa with
    /// a resolution of 0.1 kPa
    pressure: String,
    /// VOLTAGE is the voltage of the CanSat power bus with a resolution of 0.1 volts
    voltage: String,
    /// GPS_TIME is the time from the GPS receiver. The time must be reported in UTC and
    /// have a resolution of a second
    gps_time: String,
    /// GPS_ALTITUDE is the altitude from the GPS receiver in meters above mean sea
    /// level with a resolution of 0.1 meters
    gps_altitude: String,
    /// GPS_LATITUDE is the latitude from the GPS receiver in decimal degrees with a
    /// resolution of 0.0001 degrees North
    gps_latitude: String,
    /// GPS_LONGITUDE is the longitude from the GPS receiver in decimal degrees with a
    /// resolution of 0.0001 degrees West
    gps_longitude: String,
    /// GPS_SATS is the number of GPS satellites being tracked by the GPS receiver. This
    /// must be an integer
    gps_sats: i32,
    /// TILT_X, TILT_Y are the angles of the CanSat X and Y axes in degrees, with a
    /// resolution of 0.01 degrees, where zero degrees is defined as when the axes are
    /// perpendicular to the Z axis which is defined as towards the center of gravity of the
    /// Earth
    tilt_x: String,
    tilt_y: String,
    /// CMD_ECHO is the text of the last command received and processed by the CanSat.
    /// For example, CXON or SP101325. See the command section for details of command
    /// formats. Do not include commas characters
    cmd_echo: String,
}

lazy_static! {
    static ref SHARED_SENDER: Arc<tokio::sync::Mutex<Option<WriteHalf<SerialStream>>>> =
        Arc::new(tokio::sync::Mutex::new(None));
    static ref TELEMETRY: Arc<tokio::sync::Mutex<Vec<Telemetry>>> =
        Arc::new(tokio::sync::Mutex::new(vec![]));
    static ref SIMULATION_DATA: Arc<tokio::sync::Mutex<Vec<SimulationData>>> =
        Arc::new(tokio::sync::Mutex::new(vec![]));
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
        .register_uri_scheme_protocol("tiles", |app, request| {
            let path = request.uri().strip_prefix("tiles://localhost/").unwrap();
            let path = percent_encoding::percent_decode(path.as_bytes())
                .decode_utf8_lossy()
                .to_string();
            // This needs to be fixed
            let tile_resources_path = app
                .path_resolver()
                .resolve_resource(format!("tiles_download/{}", path))
                .expect("Cannot resolve tile resource.");
            println!("Resolved resources path: {:?}", tile_resources_path);
            // let tile_resources_path = app.
            let mut file = match File::open(&tile_resources_path) {
                Ok(file) => file,
                Err(_) => {
                    return ResponseBuilder::new()
                        .status(StatusCode::NOT_FOUND)
                        .body(Vec::new())
                }
            };

            let mut buf = Vec::new();
            match file.read_to_end(&mut buf) {
                Ok(_) => {}
                Err(_) => {
                    return ResponseBuilder::new()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .body(Vec::new())
                }
            };

            ResponseBuilder::new()
                .status(StatusCode::OK)
                .header(CONTENT_TYPE, "image/png")
                .body(buf)
        })
        .register_uri_scheme_protocol("images", |app, request| {
            // url="tiles://localhost/{z}/{x}/{y}.png"
            let path = request.uri().strip_prefix("images://localhost/").unwrap();
            let path = percent_encoding::percent_decode(path.as_bytes())
                .decode_utf8_lossy()
                .to_string();
            // This needs to be fixed
            let tile_resources_path = app
                .path_resolver()
                .resolve_resource(format!("leaflet/images/{}", path))
                .expect("Cannot resolve tile resource.");
            println!("Resolved resources path: {:?}", tile_resources_path);
            // let tile_resources_path = app.
            let mut file = match File::open(&tile_resources_path) {
                Ok(file) => file,
                Err(_) => {
                    return ResponseBuilder::new()
                        .status(StatusCode::NOT_FOUND)
                        .body(Vec::new())
                }
            };

            let mut buf = Vec::new();
            match file.read_to_end(&mut buf) {
                Ok(_) => {}
                Err(_) => {
                    return ResponseBuilder::new()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .body(Vec::new())
                }
            };

            ResponseBuilder::new()
                .status(StatusCode::OK)
                .header(CONTENT_TYPE, "image/png")
                .body(buf)
        })
        .on_page_load(move |_, _| {})
        .invoke_handler(tauri::generate_handler![
            get_serial_ports_command,
            start_connection_and_reading,
            save_csv,
            send_message_to_device,
            load_simulation_data,
            start_sending_simulation_data,
        ])
        .run(context)
        .expect("error while running tauri application");
}

#[tauri::command(rename_all = "snake_case")]
async fn start_connection_and_reading(
    app_handle: AppHandle,
    device: String,
    baudrate: i32,
) -> Result<(), String> {
    println!("Connecting to: {}", device);
    println!("Connecting with baud rate: {}", baudrate);

    let mut builder = tokio_serial::new(device, baudrate.try_into().unwrap());
    builder = builder
        .flow_control(tokio_serial::FlowControl::None)
        .stop_bits(tokio_serial::StopBits::One)
        .parity(tokio_serial::Parity::None);

    match builder.open_native_async() {
        Ok(serial_stream) => {
            let (mut read_port, write_port) = split(serial_stream);

            println!("Connected!");

            *SHARED_SENDER.lock().await = Some(write_port);
            println!("Passed the shared write port to the aliens");

            println!("Spawning reading thread");
            // Add a temp file
            let now: DateTime<Utc> = Utc::now();
            let filename = format!(
                "log_flight_data_{:04}{:02}{:02}_{:02}_{:02}_{:02}_UTC.txt",
                now.year(),
                now.month(),
                now.day(),
                now.hour(),
                now.minute(),
                now.second()
            );

            let mut path = match dirs::home_dir() {
                Some(path) => PathBuf::from(path),
                None => {
                    panic!("Failed to create temp file!");
                }
            };

            // Add the ".gcs" directory to the path
            path.push(".gcs");

            // Create the directory if it doesn't exist
            std::fs::create_dir_all(&path).unwrap();

            // Add the filename to the path
            path.push(filename);

            let temp_file = OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .open(&path)
                .map_err(|e| format!("Error opening file at {:?}: {}", path, e))?;

            // Read task
            tokio::spawn(async move {
                let mut message = String::new();
                let mut csv_writer = WriterBuilder::new()
                    .has_headers(true)
                    .from_writer(temp_file);
                loop {
                    match read_port.read_u8().await {
                        Ok(byte) => {
                            if byte == b'\n' {
                                println!("Received: {:?}", message);

                                let mut csv_reader = csv::ReaderBuilder::new()
                                    .has_headers(false)
                                    .from_reader(message.as_bytes());
                                for result in csv_reader.deserialize::<Telemetry>() {
                                    // let telemetry = result.unwrap();
                                    let telemetry = match result {
                                        Ok(new_telemetry) => new_telemetry,
                                        Err(e) => {
                                            eprintln!("Failed to deserialize a message from the device: {:?}", e);
                                            continue;
                                        }
                                    };
                                    // println!("{:#?}", telemetry);
                                    if telemetry.team_id == 1082 {
                                        // Write to the temp file

                                        let telemetry_csv = TelemetryCsv {
                                            team_id: telemetry.team_id.clone(),
                                            mission_time: telemetry
                                                .mission_time
                                                .clone(),
                                            packet_count: telemetry
                                                .packet_count
                                                .clone(),
                                            mode: telemetry.mode.clone(),
                                            state: telemetry.state.clone(),
                                            altitude: format!(
                                                "{:.1}",
                                                telemetry.altitude.clone()
                                            ),
                                            hs_deployed: telemetry.hs_deployed.clone(),
                                            pc_deployed: telemetry.pc_deployed.clone(),
                                            mast_raised: telemetry.mast_raised.clone(),
                                            temperature: format!(
                                                "{:.1}",
                                                telemetry.temperature.clone()
                                            ),
                                            pressure: format!(
                                                "{:.1}",
                                                telemetry.pressure.clone()
                                            ),
                                            voltage: format!(
                                                "{:.1}",
                                                telemetry.voltage.clone()
                                            ),
                                            gps_time: telemetry.gps_time.clone(),
                                            gps_altitude: format!(
                                                "{:.1}",
                                                telemetry.gps_altitude.clone()
                                            ),
                                            gps_latitude: format!(
                                                "{:.4}",
                                                telemetry.gps_latitude.clone()
                                            ),
                                            gps_longitude: format!(
                                                "{:.4}",
                                                telemetry.gps_longitude.clone()
                                            ),
                                            gps_sats: telemetry.gps_sats.clone(),
                                            tilt_x: format!(
                                                "{:.2}",
                                                telemetry.tilt_x.clone()
                                            ),
                                            tilt_y: format!(
                                                "{:.2}",
                                                telemetry.tilt_y.clone()
                                            ),
                                            cmd_echo: telemetry.cmd_echo.clone(),
                                        };

                                        let _ =
                                            csv_writer.serialize(telemetry_csv.clone());
                                        let _ = csv_writer.flush();

                                        let mut all_telemetry = TELEMETRY.lock().await;
                                        app_handle
                                            .emit_all("graph-data", telemetry.clone())
                                            .expect("failed to emit event");
                                        all_telemetry.push(telemetry.clone());
                                    } else {
                                        println!("The received packet didnt have team is 1082")
                                    }
                                }

                                message.clear();
                            } else {
                                message.push(char::from(byte));
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to read from serial_port: {}", e);
                        }
                    }
                }
            });

            Ok(())
        }
        Err(e) => Err(format!("Error connecting to device: {}", e)),
    }
}

#[tauri::command(rename_all = "snake_case")]
async fn save_csv(output_file: String) -> Result<(), String> {
    println!("Got the lock");
    let telemetry = TELEMETRY.lock().await;
    let telemetry = telemetry.clone();

    let file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&output_file)
        .map_err(|e| format!("Error opening file at {}: {}", output_file, e))?;

    let mut csv_writer = WriterBuilder::new().has_headers(true).from_writer(file);

    for t in telemetry.iter() {
        let telemetry_csv = TelemetryCsv {
            team_id: t.team_id.clone(),
            mission_time: t.mission_time.clone(),
            packet_count: t.packet_count.clone(),
            mode: t.mode.clone(),
            state: t.state.clone(),
            altitude: format!("{:.1}", t.altitude.clone()),
            hs_deployed: t.hs_deployed.clone(),
            pc_deployed: t.pc_deployed.clone(),
            mast_raised: t.mast_raised.clone(),
            temperature: format!("{:.1}", t.temperature.clone()),
            pressure: format!("{:.1}", t.pressure.clone()),
            voltage: format!("{:.1}", t.voltage.clone()),
            gps_time: t.gps_time.clone(),
            gps_altitude: format!("{:.1}", t.gps_altitude.clone()),
            gps_latitude: format!("{:.4}", t.gps_latitude.clone()),
            gps_longitude: format!("{:.4}", t.gps_longitude.clone()),
            gps_sats: t.gps_sats.clone(),
            tilt_x: format!("{:.2}", t.tilt_x.clone()),
            tilt_y: format!("{:.2}", t.tilt_y.clone()),
            cmd_echo: t.cmd_echo.clone(),
        };
        csv_writer
            .serialize(telemetry_csv)
            .map_err(|e| format!("Error writing CSV data: {}", e))?;
    }
    csv_writer
        .flush()
        .map_err(|e| format!("Error flushing CSV data: {}", e))?;

    Ok(())
}

fn get_serial_ports() -> Vec<String> {
    match available_ports() {
        Ok(ports) => ports.into_iter().map(|p| p.port_name).collect(),
        Err(e) => {
            eprintln!("Failed to get serial ports: {}", e);
            Vec::new()
        }
    }
}

#[tauri::command(rename_all = "snake_case")]
fn get_serial_ports_command() -> Vec<String> {
    println!("Fetching serial ports");
    get_serial_ports()
}

#[tauri::command]
async fn send_message_to_device(message: String) -> Result<(), String> {
    println!("About to send");
    let new_message = message + "\r\n";
    let mut shared_sender_lock = SHARED_SENDER.lock().await;
    println!("Got lock on the sender");
    if let Some(shared_sender) = shared_sender_lock.as_mut() {
        println!("Got shared sender as mut");
        match shared_sender.write_all(new_message.as_bytes()).await {
            Ok(_) => {
                println!("Wrote command to port");
            }
            Err(e) => {
                eprintln!("Failed to write to port: {}", e);
            }
        }
        Ok(())
    } else {
        Err("No connected device found.".to_string())
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct SimulationData {
    cmd: String,
    team_id: String,
    simp: String,
    pressure: f32,
}

impl SimulationData {
    fn as_command_string(&self) -> String {
        format!(
            "{},{},{},{}",
            self.cmd, self.team_id, self.simp, self.pressure
        )
    }
}

#[tauri::command]
async fn load_simulation_data(simulation_data_path: String) -> Result<usize, String> {
    println!("Starting to read sim data");
    let file = File::open(simulation_data_path).map_err(|err| err.to_string())?;
    let mut rdr = csv::ReaderBuilder::new()
        .has_headers(false)
        .comment(Some(b'#'))
        .from_reader(file);

    let mut simulation_data: Vec<SimulationData> = Vec::new();

    println!("Parsing sim data");
    for result in rdr.deserialize::<SimulationData>() {
        match result {
            Ok(mut record) => {
                // Validate that the record matches expected format
                if record.cmd != "CMD" || record.simp != "SIMP" {
                    continue;
                }

                // Replace $ with team id
                if record.team_id == "$" {
                    record.team_id = "1082".to_string();
                }

                simulation_data.push(record);
            }
            Err(e) => {
                eprintln!("Failed to deserialize a line: {:?}", e);
            }
        }
    }

    println!("Got the simulation data, length: {}", simulation_data.len());
    for i in simulation_data.iter().take(10) {
        println!("{:?}", i.as_command_string());
    }

    *SIMULATION_DATA.lock().await = simulation_data;

    Ok(SIMULATION_DATA.lock().await.len())
}

#[tauri::command(rename_all = "snake_case")]
async fn start_sending_simulation_data() -> Result<(), String> {
    println!("Entered sending sim data");
    let simulation_data = SIMULATION_DATA.lock().await;
    let simulation_data = simulation_data.clone();

    tokio::spawn(async move {
        println!("Spawned sending sim data thread");
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(1));
        for data in simulation_data {
            interval.tick().await;
            println!("About to send data");

            let command_string = data.as_command_string();

            if let Err(e) = send_message_to_device(command_string).await {
                // handle the error here, maybe with `println!` or `log::error!`
                println!("Error sending message to device: {}", e);
            }
            println!("Sim Data sent!");
        }
    });

    Ok(())
}
