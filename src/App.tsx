import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "./index.css";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "./styles.css";
import { invoke } from '@tauri-apps/api/tauri';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { dialog } from '@tauri-apps/api';

import {
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
);

interface DisplayLabelProps {
    title: string;
    value: string;
}

interface Telemetry {
    team_id: number;
    mission_time: string;
    packet_count: number;
    mode: string;
    state: string;
    altitude: number;
    hs_deployed: string;
    pc_deployed: string;
    mast_raised: string;
    temperature: number;
    pressure: number;
    voltage: number;
    gps_time: string;
    gps_altitude: number;
    gps_latitude: number;
    gps_longitude: number;
    gps_sats: number;
    tilt_x: number;
    tilt_y: number;
    cmd_echo: string;
}

interface GraphData {
    time: string[];
    altitude: number[];
    temperature: number[];
    pressure: number[];
    voltage: number[];
    tiltx: number[];
    tilty: number[];
}

async function getFileSavePath() {
    const result = await dialog.save({
        defaultPath: 'flight_data.csv',
    });

    if (result === null) {
        console.log('File save was canceled');
    } else {
        console.log('File will be saved to', result);
    }
    return result;
}


const DisplayLabel = ({ title, value }: DisplayLabelProps) => {
    return (
        <div className="display-label-container">
            <p>{title}:</p>
            <p>{value}</p>
        </div>
    );
};

interface ButtonProps {
    text: string;
    onClick?: () => void;
    disabled?: boolean;


}
const Button = ({ text, onClick, disabled }: ButtonProps) => {
    return (
        <button className="button" onClick={onClick} disabled={disabled}>
            <p className="button-text">{text}</p>
        </button>
    );
};



function App() {
    const [graphData, setGraphData] = useState<GraphData>({
        time: [],
        altitude: [],
        temperature: [],
        pressure: [],
        voltage: [],
        tiltx: [],
        tilty: [],
    });
    const [latestTelemetry, setLatestTelemetry] = useState<Telemetry | null>(null);

    const [devices, setDevices] = useState<string[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>("");
    const [selectedBaudRate, setSelectedBaudRate] = useState<number>(115200);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [graphDataListener, setGraphDataListener] = useState<Promise<UnlistenFn> | null>(null);


    async function fetchDevices() {
        try {
            const deviceList = await invoke<string[]>("get_serial_ports_command");
            setDevices(deviceList);
        } catch (error) {
            console.error("Failed to fetch devices:", error);
        }
    }

    useEffect(() => {

        fetchDevices();
    }, []);

    const sendDummyMessage = async () => {
        await invoke('send_message_to_device', { message: "DUPA" })
            .then(() => console.log("Message sent successfully"))
            .catch((e) => console.error("Error sending message to device", e));
    }

    const stopAndSaveCSV = async () => {

        // Get the file path from the user
        const filePath = await getFileSavePath();
        if (filePath === null) {
            console.log('File save was canceled');
            return; // Exit the function early
        }
        // Unlisten the event
        if (graphDataListener) {
            graphDataListener.then((unlisten: UnlistenFn) => {
                unlisten();
            });
            setGraphDataListener(null); // Reset the listener state
        }
        setIsRecording(false);
        console.log("Path for the file: ", filePath);

        try {
            await invoke("stop_recording_and_save_csv", { output_file: filePath });
            setIsConnected(false);
        } catch (error) {
            console.error("Failed to disconnect and save CSV:", error);
        }
    };


    const startConnection = async () => {
        if (!selectedDevice) {
            alert("Please select a device before starting.");
            return;
        }

        try {
            await invoke("connect_to_device", { device: selectedDevice, baudrate: selectedBaudRate });
            setIsConnected(true);
            setIsRecording(true);

            const graphDataListener = listen(
                "graph-data",
                ({ payload: telemetry }: { payload: Telemetry }) => {
                    setLatestTelemetry(telemetry);
                    setGraphData((old) => ({
                        time: [...old.time, telemetry.mission_time],
                        altitude: [...old.altitude, telemetry.altitude],
                        temperature: [...old.temperature, telemetry.temperature],
                        pressure: [...old.pressure, telemetry.pressure],
                        voltage: [...old.voltage, telemetry.voltage],
                        tiltx: [...old.tiltx, telemetry.tilt_x],
                        tilty: [...old.tilty, telemetry.tilt_y],
                    }));
                }
            );

            // Save listener to state so we can unlisten later
            setGraphDataListener(graphDataListener);

        } catch (error) {
            console.error("Failed to connect to the device:", error);
        }
    };

    const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedDevice(event.target.value);
    };

    const handleBaudRateChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedBaudRate(parseInt(event.target.value));
    };



    useEffect(() => {
        if (!isConnected || !isRecording) {
            return;
        }

        const graphDataListener = listen(
            "graph-data",
            ({ payload: telemetry }: { payload: Telemetry }) => {
                setLatestTelemetry(telemetry);
                setGraphData((old) => ({
                    time: [...old.time, telemetry.mission_time],
                    altitude: [...old.altitude, telemetry.altitude],
                    temperature: [...old.temperature, telemetry.temperature],
                    pressure: [...old.pressure, telemetry.pressure],
                    voltage: [...old.voltage, telemetry.voltage],
                    tiltx: [...old.tiltx, telemetry.tilt_x],
                    tilty: [...old.tilty, telemetry.tilt_y],
                }));
            }
        );

        return () => {
            graphDataListener.then((unlisten: UnlistenFn) => {
                unlisten();
            });
        };
    }, [isConnected, isRecording]);


    const altitudeData = {
        labels: graphData.time,
        datasets: [{
            label: "Altitude",
            data: graphData.altitude,
            fill: false,
            borderColor: '#ff0000'
        }]
    };

    const voltageData = {
        labels: graphData.time,
        legend: {
            display: false
        },
        datasets: [{
            label: "Voltage",
            data: graphData.voltage,
            fill: false,
            borderColor: '#ff0000'
        }]
    };

    const pressureData = {
        labels: graphData.time,
        datasets: [{
            label: "Pressure",
            data: graphData.pressure,
            fill: false,
            borderColor: '#ff0000'
        }]
    };

    const temperatureData = {
        labels: graphData.time,
        datasets: [{
            label: "Temperature",
            data: graphData.temperature,
            fill: false,
            borderColor: '#ff0000'
        }]
    };

    const tiltxData = {
        labels: graphData.time,
        datasets: [{
            label: "Tilt X",
            data: graphData.tiltx,
            fill: false,
            borderColor: '#ff0000'
        }]
    };

    const tiltyData = {
        labels: graphData.time,
        datasets: [{
            label: "Tilt Y",
            data: graphData.tilty,
            fill: false,
            borderColor: '#ff0000'
        }]
    };


    return (
        <div className="App">
            <div className="top-row">
                {/* First Column */}
                <div>
                    <DisplayLabel title="TEAM ID" value="1082" />
                    <DisplayLabel
                        title="Container Software state"
                        value="IDLE"
                    />
                    <DisplayLabel title="Payload software state" value="IDLE" />
                    <DisplayLabel title="Mission time" value={latestTelemetry?.mission_time.toString() || '0.0'} />
                    <DisplayLabel title="Packet count" value={latestTelemetry?.packet_count.toString() || '0.0'} />
                    <DisplayLabel title="CMD_ECHO" value={latestTelemetry?.cmd_echo.toString() || '0.0'} />
                    <DisplayLabel title="GPS time" value={latestTelemetry?.gps_time.toString() || '0.0'} />
                    <DisplayLabel title="Pointing Error" value="" />
                </div>
                {/* Second Column */}
                <div>
                    <DisplayLabel title="Simulation Status" value="DISABLED" />
                    <DisplayLabel title="Mast raised" value={latestTelemetry?.mast_raised.toString() || '0.0'} />
                    <DisplayLabel title="HS Deployed" value={latestTelemetry?.hs_deployed.toString() || '0.0'} />
                    <DisplayLabel title="PC Deployed" value={latestTelemetry?.pc_deployed.toString() || '0.0'} />
                    <DisplayLabel title="Tilt X" value={latestTelemetry ? latestTelemetry.tilt_x.toFixed(2) : '0.00'} />
                    <DisplayLabel title="Tilt Y" value={latestTelemetry ? latestTelemetry.tilt_y.toFixed(2) : '0.00'} />
                </div>
                {/* Third Column */}
                <div>
                    <Button text="Start" onClick={startConnection} disabled={isConnected} />
                    <Button text="Stop and Save CSV" onClick={stopAndSaveCSV} />
                    <Button text="Load CSV Simulation" disabled={isConnected} />
                </div>
                {/* Fourth Column */}
                <div>
                    <Button text="Dupa Button" onClick={sendDummyMessage} />
                    <Button text="Simulation Enable" />

                    <Button text="Simulation Activate" />
                    <Button text="Simulation Disable" />

                    <Button text="Refresh Devices" onClick={fetchDevices} disabled={isConnected} />

                    <select value={selectedDevice} onChange={handleDeviceChange} disabled={isConnected}>
                        <option value="" disabled>Pick a device</option>
                        {devices.map((device) => (
                            <option key={device} value={device}>
                                {device}
                            </option>
                        ))}
                    </select>

                    <select id="baud-rate-select" onChange={handleBaudRateChange} disabled={isConnected} >
                        <option value="9600">9600</option>
                        <option value="14400">14400</option>
                        <option value="19200">19200</option>
                        <option value="38400">38400</option>
                        <option value="57600">57600</option>
                        <option value="115200" selected>115200</option>
                    </select>
                </div>
            </div>
            <div className="bottom-row">
                <Tabs className="tab-buttons">
                    <TabList>
                        <Tab className="tab-button">Plots</Tab>
                        <Tab className="tab-button">Map</Tab>
                        <Tab className="tab-button">Custom Commands</Tab>
                    </TabList>

                    <TabPanel className="plot-container" >
                        <div className="chart-grid">
                            <div className="chart-item">
                                <Line options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: {
                                        title: {
                                            display: true,
                                            font: {
                                                weight: 'bold',
                                                size: 16,
                                            },
                                            text: 'Voltage',
                                        },
                                    },
                                    scales: {
                                        y: {
                                            ticks: {
                                                precision: 2
                                            },
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Voltage [V]"
                                            },
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Time [hh:mm:ss]"
                                            },
                                        }
                                    },
                                    animation: false,
                                    elements: {
                                        point: {
                                            pointStyle: false,
                                        }
                                    }
                                }} data={voltageData} />
                            </div>
                            <div className="chart-item">
                                <Line options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: {
                                        title: {
                                            display: true,
                                            font: {
                                                weight: 'bold',
                                                size: 16,
                                            },
                                            text: 'Altitude',
                                        },
                                    },
                                    scales: {
                                        y: {
                                            ticks: {
                                                precision: 1
                                            },
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Altitude [m]"
                                            },
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Time [hh:mm:ss]"
                                            },
                                        }
                                    },
                                    animation: false,
                                    elements: {
                                        point: {
                                            pointStyle: false,
                                        }
                                    }
                                }} data={altitudeData} />
                            </div>
                            <div className="chart-item">
                                <Line options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: {
                                        title: {
                                            display: true,
                                            font: {
                                                weight: 'bold',
                                                size: 16,
                                            },
                                            text: 'Pressure',
                                        },
                                    },

                                    scales: {
                                        y: {
                                            ticks: {
                                                precision: 1
                                            },
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Pressure [pKa]"
                                            },
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Time [hh:mm:ss]"
                                            },
                                        }
                                    },
                                    animation: false,
                                    elements: {
                                        point: {
                                            pointStyle: false,
                                        }
                                    }
                                }} data={pressureData} />
                            </div>
                            <div className="chart-item">
                                <Line options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: {
                                        title: {
                                            display: true,
                                            font: {
                                                weight: 'bold',
                                                size: 16,
                                            },
                                            text: 'Temperature',
                                        },
                                    },
                                    scales: {
                                        y: {
                                            ticks: {
                                                precision: 1
                                            },
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Temperature [C]"
                                            },
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Time [hh:mm:ss]"
                                            },
                                        }
                                    },
                                    animation: false,
                                    elements: {
                                        point: {
                                            pointStyle: false,
                                        }
                                    }
                                }} data={temperatureData} />
                            </div>
                            <div className="chart-item">
                                <Line options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: {
                                        title: {
                                            display: true,
                                            font: {
                                                weight: 'bold',
                                                size: 16,
                                            },
                                            text: 'Tilt angle in the X axis',
                                        },
                                    },
                                    scales: {
                                        y: {
                                            ticks: {
                                                precision: 2
                                            },
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Tilt angle [°]"
                                            },
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Time [hh:mm:ss]"
                                            },
                                        }
                                    },
                                    animation: false,
                                    elements: {
                                        point: {
                                            pointStyle: false,
                                        }
                                    }
                                }
                                } data={tiltxData} />
                            </div>
                            <div className="chart-item">
                                <Line options={{
                                    maintainAspectRatio: false,
                                    responsive: true,
                                    plugins: {
                                        title: {
                                            display: true,
                                            font: {
                                                weight: 'bold',
                                                size: 16,
                                            },
                                            text: 'Tilt angle in the Y axis',
                                        },
                                    },
                                    scales: {
                                        y: {
                                            ticks: {
                                                precision: 2
                                            },
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Tilt angle [°]"
                                            },
                                        },
                                        x: {
                                            title: {
                                                display: true,
                                                font: {
                                                    weight: 'bold',
                                                    size: 16,
                                                },
                                                text: "Time [hh:mm:ss]"
                                            },
                                        }
                                    },
                                    animation: false,
                                    elements: {
                                        point: {
                                            pointStyle: false,
                                        }
                                    }
                                }} data={tiltyData} />
                            </div>
                        </div>


                    </TabPanel>
                    <TabPanel className="plot-container">
                        {/* TBD */}
                    </TabPanel>

                </Tabs>
            </div>
        </div >
    );
}

export default App;
