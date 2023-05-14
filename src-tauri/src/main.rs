#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use serialport::available_ports;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Condvar;
use std::{
    env,
    sync::{Arc, Mutex},
};
use tauri::Manager;
use tokio::io::AsyncWriteExt;
use tokio::io::{AsyncReadExt, BufReader};
use tokio_serial::SerialPortBuilderExt;
// use futures_util::future::try_future::TryFutureExt;
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
    packet_count: f32,
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

struct ConnectedDevice {
    buf_reader: Arc<Mutex<BufReader<tokio_serial::SerialStream>>>,
    is_recording: AtomicBool,
    telemetry_data: Mutex<Vec<Telemetry>>,
}

impl ConnectedDevice {
    fn new(buf_reader: BufReader<tokio_serial::SerialStream>) -> Self {
        Self {
            buf_reader: Arc::new(Mutex::new(buf_reader)),
            is_recording: AtomicBool::new(false),
            telemetry_data: Mutex::new(vec![]),
        }
    }
}

// Wrap the ConnectedDevice in an Arc and Mutex for shared access
lazy_static! {
    static ref SHARED_CONNECTED_DEVICE: Arc<Mutex<Option<ConnectedDevice>>> =
        Arc::new(Mutex::new(None));
    static ref SHARED_DEVICE_AVAILABILITY_FLAG: Arc<(Mutex<bool>, Condvar)> =
        Arc::new((Mutex::new(false), Condvar::new()));
}

#[tokio::main]
async fn main() {
    let context = tauri::generate_context!();

    let connected_device = SHARED_CONNECTED_DEVICE.clone();
    let device_available = SHARED_DEVICE_AVAILABILITY_FLAG.clone();

    tauri::Builder::default()
        .menu(if cfg!(target_os = "macos") {
            tauri::Menu::os_default(&context.package_info().name)
        } else {
            tauri::Menu::default()
        })
        .on_page_load(move |app, _| {
            let app_copy = app;
            let connected_device_clone = connected_device.clone();
            let device_available_clone = device_available.clone();

            std::thread::spawn(move || {
                let async_block = async move {
                    println!("Got the lock");

                    loop {
                        println!("In the main loop");
                        let (lock, cvar) = &*device_available_clone;
                        let mut device_is_available = lock.lock().unwrap();

                        while !*device_is_available {
                            device_is_available =
                                cvar.wait(device_is_available).unwrap();
                        }

                        let connected_device_lock =
                            connected_device_clone.lock().unwrap();
                        if let Some(ref connected_device) = &*connected_device_lock {
                            println!("Starting to read!");
                            let mut message = String::new();

                            while let Ok(byte) = connected_device
                                .buf_reader
                                .lock()
                                .unwrap()
                                .read_u8()
                                .await
                            {
                                if byte == b'\n' {
                                    // Process the complete message
                                    println!("Received message: {:?}", message);
                                    let mut csv_reader = csv::ReaderBuilder::new()
                                        .has_headers(false)
                                        .from_reader(message.as_bytes());
                                    for result in csv_reader.deserialize::<Telemetry>()
                                    {
                                        let telemetry = result.unwrap();
                                        println!("{:#?}", telemetry);

                                        let mut telemetry_data_lock = connected_device
                                            .telemetry_data
                                            .lock()
                                            .unwrap();
                                        app_copy
                                            .emit_all("graph-data", telemetry.clone())
                                            .expect("failed to emit event");
                                        telemetry_data_lock.push(telemetry);
                                    }

                                    // Reset the message buffer for the next message
                                    message.clear();
                                } else {
                                    // Append the byte to the current message
                                    message.push(char::from(byte));
                                }
                            }
                        }
                        println!("Existing main loop.");
                    }
                };
                tokio::runtime::Runtime::new()
                    .unwrap()
                    .block_on(async_block);
            });
        })
        .invoke_handler(tauri::generate_handler![
            get_serial_ports_command,
            connect_to_device,
            start_recording,
            stop_recording_and_save_csv
        ])
        .run(context)
        .expect("error while running tauri application");
}

#[tauri::command(rename_all = "snake_case")]
async fn connect_to_device(device: String, baudrate: i32) -> Result<(), String> {
    println!("Connecting to: {}", device);
    println!("Connecting with baud rate: {}", baudrate);
    let mut builder = tokio_serial::new(device, baudrate.try_into().unwrap());
    builder = builder
        .flow_control(tokio_serial::FlowControl::None)
        .stop_bits(tokio_serial::StopBits::One)
        .parity(tokio_serial::Parity::None);

    match builder.open_native_async() {
        Ok(serial_stream) => {
            let buf_reader = BufReader::with_capacity(4096, serial_stream);
            let connected_device = ConnectedDevice::new(buf_reader);
            let mut connected_device_lock = SHARED_CONNECTED_DEVICE.lock().unwrap();
            let device_available = SHARED_DEVICE_AVAILABILITY_FLAG.clone();
            *connected_device_lock = Some(connected_device);
            println!("Connected!");

            let (lock, cvar) = &*device_available;
            let mut device_is_available = lock.lock().unwrap();
            *device_is_available = true;
            cvar.notify_one();

            Ok(())
        }
        Err(e) => Err(format!("Error connecting to device: {}", e)),
    }
}

#[tauri::command(rename_all = "snake_case")]
async fn start_recording() -> Result<(), String> {
    let connected_device_lock = SHARED_CONNECTED_DEVICE.lock().unwrap();
    if let Some(connected_device) = connected_device_lock.as_ref() {
        connected_device.is_recording.store(true, Ordering::Relaxed);
        Ok(())
    } else {
        Err("No connected device found.".to_string())
    }
}

#[tauri::command(rename_all = "snake_case")]
async fn stop_recording_and_save_csv(output_file: String) -> Result<(), String> {
    let mut connected_device_lock = SHARED_CONNECTED_DEVICE.lock().unwrap();
    if let Some(connected_device) = connected_device_lock.as_mut() {
        connected_device
            .is_recording
            .store(false, Ordering::Relaxed);

        let telemetry_data_lock = connected_device.telemetry_data.lock().unwrap();
        let mut csv_writer = csv::Writer::from_path(output_file)
            .map_err(|e| format!("Error creating CSV file: {}", e))?;
        for telemetry in telemetry_data_lock.iter() {
            csv_writer
                .serialize(telemetry)
                .map_err(|e| format!("Error writing CSV data: {}", e))?;
        }
        csv_writer
            .flush()
            .map_err(|e| format!("Error flushing CSV data: {}", e))?;
        Ok(())
    } else {
        Err("No connected device found.".to_string())
    }
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

#[tauri::command(rename_all = "snake_case")]
async fn send_message(message: String) -> Result<(), String> {
    let connected_device_lock = SHARED_CONNECTED_DEVICE.lock().unwrap();
    if let Some(connected_device) = connected_device_lock.as_ref() {
        let mut buf_writer = connected_device.buf_reader.lock().unwrap();
        buf_writer
            .write_all(message.as_bytes())
            .await
            .map_err(|e| format!("Error sending message: {}", e))?;
        buf_writer
            .flush()
            .await
            .map_err(|e| format!("Error flushing message: {}", e))?;
        Ok(())
    } else {
        Err("No connected device found.".to_string())
    }
}

// <Chart
// options={{
//     chart: {
//         id: "john-chart",
//         toolbar: {
//             show: false,
//         },
//     },
//     xaxis: {
//         tickAmount: 10,
//         title: {
//             text: "Time [hh:mm:ss]",
//         },
//         type: "category",
//         categories: graphData.time,
//     },
//     yaxis: {
//         labels: {
//             formatter: (value: number) => {
//                 return value.toFixed(1);
//             },
//         }, title: { text: "Celsius [C]" }
//     },
//     title: {
//         text: "Temperature",
//         align: "center",
//         style: {
//             fontSize: "20px",
//             fontWeight: "bold",
//         },
//     },
//     colors: ["#ff0000"],
//     stroke: {
//         width: 1,
//         curve: "straight",
//     },
//     markers: {
//         size: 0,
//     },
//     legend: {
//         show: true,
//         position: "top",
//         horizontalAlign: "right",
//         labels: {
//             colors: "#fff",
//         },
//     },
// }}
// series={temperatureSeries}
// type="line"
// width={500}
// />
// <Chart
// options={{
//     chart: {
//         id: "john-chart",
//         toolbar: {
//             show: false,
//         },
//     },
//     xaxis: {
//         tickAmount: 10,
//         title: {
//             text: "Time [hh:mm:ss]",
//         },
//         type: "category",
//         categories: graphData.time,
//     },
//     yaxis: {
//         labels: {
//             formatter: (value: number) => {
//                 return value.toFixed(1);
//             },
//         }, title: { text: "Pressure [kPa]" }
//     },
//     title: {
//         text: "Pressure",
//         align: "center",
//         style: {
//             fontSize: "20px",
//             fontWeight: "bold",
//         },
//     },
//     colors: ["#ff0000"],
//     stroke: {
//         width: 1,
//         curve: "straight",
//     },
//     markers: {
//         size: 0,
//     },
//     legend: {
//         show: true,
//         position: "top",
//         horizontalAlign: "right",
//         labels: {
//             colors: "#fff",
//         },
//     },
// }}
// series={pressureSeries}
// type="line"
// width={500}
// />
