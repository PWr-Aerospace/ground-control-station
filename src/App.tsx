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
    const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
    const [isSimulationDataLoaded, setIsSimulationDataLoaded] = useState<boolean>(false);
    const [isSendingSimulationData, setIsSendingSimulationData] = useState<boolean>(false);
    const [isFlightMode, setIsFlightMode] = useState<boolean>(false);
    const [graphDataListener, setGraphDataListener] = useState<Promise<UnlistenFn> | null>(null);
    const [message, setMessage] = useState<string>("");


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

    const sendMessage = async () => {
        await invoke('send_message_to_device', { message })
            .then(() => {
                console.log("Message sent successfully");
                setMessage("");
            })
            .catch((e) => console.error("Error sending message to device", e));
    };
    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setMessage(event.target.value);
    };
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
        // setIsRecording(false);
        console.log("Path for the file: ", filePath);

        try {
            await invoke("save_csv", { output_file: filePath });
            // setIsConnected(false);
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
            await invoke("start_connection_and_reading", { device: selectedDevice, baudrate: selectedBaudRate });
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

    const startSimulation = async () => {

        if (!selectedDevice) {
            alert("Please select a device before starting.");
            return;
        }


        try {
            await invoke("start_simulation", { device: selectedDevice, baudrate: selectedBaudRate });
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
    }

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

    const setAsFLightMode = async () => {
        setIsFlightMode(true);
    };

    const setSimulationMode = async () => {
        setIsSimulationMode(true);
    };

    const loadSimulationData = async () => {
        const result = await dialog.open({
            multiple: false,
        });
        if (result !== null) {
            console.log("Selected file: ", result);
            let parsing_result = await invoke("load_simulation_data", { simulationDataPath: result }) as number;
            alert(`File at '${result}' has been loaded into memory and parsed. The number of correct parsed lines: ${parsing_result}`)
            setIsSimulationDataLoaded(true);
        } else {
            console.log("No file was selected.");
            alert("File was not selected!");
            setIsSimulationDataLoaded(false);
        }
    };

    const startSendingSimulationData = async () => {
        // await invoke("start_sending_simulation_data");
        if (!selectedDevice) {
            alert("Please select a device before starting.");
            return;
        }

        try {
            await invoke("start_sending_simulation_data");
            setIsSendingSimulationData(true);
        } catch (error) {
            console.error("Failed to start sending simulation data to the device:", error);
        }

    }

    const sendCustomMessage = async (message: string) => {
        console.log(`Sending custom message: ${message}`);
        await invoke('send_message_to_device', { message })
            .then(() => {
                console.log("Message sent successfully");
                setMessage("");
            })
            .catch((e) => console.error("Error sending message to device", e));
    };


    return (
        <div className="App">
            <div className="top-row">
                {/* First Column */}
                <div>
                    <DisplayLabel title="TEAM ID" value="1082" />
                    <DisplayLabel title="Payload software state" value={latestTelemetry?.state.toString() || ''} />
                    <DisplayLabel title="Mission time" value={latestTelemetry?.mission_time.toString() || '0.0'} />
                    <DisplayLabel title="Packet count" value={latestTelemetry?.packet_count.toString() || '0.0'} />
                    <DisplayLabel title="CMD_ECHO" value={latestTelemetry?.cmd_echo.toString() || '0.0'} />
                    <DisplayLabel title="GPS time" value={latestTelemetry?.gps_time.toString() || '0.0'} />
                </div>
                {/* Second Column */}
                <div>
                    <DisplayLabel
                        title="Simulation Status"
                        value={latestTelemetry?.mode === 'S' ? 'ENABLED' : (latestTelemetry?.mode === 'F' ? 'DISABLED' : '')}
                    />
                    <DisplayLabel title="Mast raised" value={latestTelemetry?.mast_raised.toString() || '0.0'} />
                    <DisplayLabel title="HS Deployed" value={latestTelemetry?.hs_deployed.toString() || '0.0'} />
                    <DisplayLabel title="PC Deployed" value={latestTelemetry?.pc_deployed.toString() || '0.0'} />
                    <DisplayLabel title="Tilt X" value={latestTelemetry ? latestTelemetry.tilt_x.toFixed(2) : '0.00'} />
                    <DisplayLabel title="Tilt Y" value={latestTelemetry ? latestTelemetry.tilt_y.toFixed(2) : '0.00'} />
                </div>
                {/* Third Column */}
                <div>
                    <Button text="Flight Mode" onClick={setAsFLightMode} disabled={isFlightMode || isSimulationMode} />
                    <Button text="Simulation Mode" onClick={setSimulationMode} disabled={isFlightMode || isSimulationMode} />
                    <Button text="Connect and Start Reading" onClick={startConnection} disabled={!isFlightMode && !isSimulationMode} />
                    <Button text="Start Sending Data in Simulation Mode" onClick={startSendingSimulationData} disabled={(!isSimulationDataLoaded || !isConnected) || isSendingSimulationData} />
                    <Button text="Load CSV Simulation" onClick={loadSimulationData} disabled={(!isSimulationDataLoaded && !isSimulationMode) || isSendingSimulationData} />
                    <Button text="Save CSV" onClick={stopAndSaveCSV} disabled={!isConnected} />
                </div>
                {/* Fourth Column */}
                <div>
                    {/* <Button text="Dupa Button" onClick={sendMessage} /> */}
                    <Button text="Simulation Enable" disabled={true} />
                    <Button text="Simulation Activate" disabled={true} />
                    <Button text="Simulation Disable" disabled={true} />
                    <Button text="Refresh Devices" onClick={fetchDevices} disabled={(isConnected || (!isFlightMode && !isSimulationMode))} />

                    <select value={selectedDevice} onChange={handleDeviceChange} disabled={(isConnected || (!isFlightMode && !isSimulationMode))}>
                        <option value="" disabled>Pick a device</option>
                        {devices.map((device) => (
                            <option key={device} value={device}>
                                {device}
                            </option>
                        ))}
                    </select>

                    <select id="baud-rate-select" onChange={handleBaudRateChange} disabled={(isConnected || (!isFlightMode && !isSimulationMode))} >
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
                        <Tab className="tab-button">Temperature</Tab>
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
                                                text: "Pressure [kPa]"
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
                        Mapa TBD
                    </TabPanel>
                    <TabPanel className="plot-container" >
                        <div>
                            <input type="text" value={message} onChange={handleInputChange} />
                            <Button text="Send" onClick={sendMessage} disabled={!isConnected} />
                            {/* Custom commands buttons */}

                            <Button text="Send Beep" onClick={() => sendCustomMessage("CMD,1082,BEEP")} disabled={!isConnected} />

                            <Button text="Set time" onClick={() => {
                                const now = new Date();
                                const hours = String(now.getUTCHours()).padStart(2, '0');
                                const minutes = String(now.getUTCMinutes()).padStart(2, '0');
                                const seconds = String(now.getUTCSeconds()).padStart(2, '0');
                                const formattedTime = `${hours}:${minutes}:${seconds}`;
                                sendCustomMessage(`CMD,1082,ST,${formattedTime}`);
                            }} disabled={!isConnected} />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 2fr)', gap: '10px' }}>

                                <Button text="Motor CW 0" onClick={() => sendCustomMessage("CMD,1082,MOTOR,CW,0")} disabled={!isConnected} />
                                <Button text="Motor CW 200" onClick={() => sendCustomMessage("CMD,1082,MOTOR,CW,200")} disabled={!isConnected} />
                                <Button text="Motor CW 400" onClick={() => sendCustomMessage("CMD,1082,MOTOR,CW,400")} disabled={!isConnected} />
                                <Button text="Motor CW 499" onClick={() => sendCustomMessage("CMD,1082,MOTOR,CW,499")} disabled={!isConnected} />
                                <Button text="Motor CCW 0" onClick={() => sendCustomMessage("CMD,1082,MOTOR,CCW,0")} disabled={!isConnected} />
                                <Button text="Motor CCW 200" onClick={() => sendCustomMessage("CMD,1082,MOTOR,CCW,200")} disabled={!isConnected} />
                                <Button text="Motor CCW 400" onClick={() => sendCustomMessage("CMD,1082,MOTOR,CCW,400")} disabled={!isConnected} />
                                <Button text="Motor CCW 499" onClick={() => sendCustomMessage("CMD,1082,MOTOR,CCW,499")} disabled={!isConnected} />

                                <Button text="Servo 1 0" onClick={() => sendCustomMessage("CMD,1082,SERVO,1,0")} disabled={!isConnected} />
                                <Button text="Servo 1 90" onClick={() => sendCustomMessage("CMD,1082,SERVO,1,90")} disabled={!isConnected} />
                                <Button text="Servo 1 180" onClick={() => sendCustomMessage("CMD,1082,SERVO,1,180")} disabled={!isConnected} />

                                <Button text="Servo 2 0" onClick={() => sendCustomMessage("CMD,1082,SERVO,2,0")} disabled={!isConnected} />
                                <Button text="Servo 2 90" onClick={() => sendCustomMessage("CMD,1082,SERVO,2,90")} disabled={!isConnected} />
                                <Button text="Servo 2 180" onClick={() => sendCustomMessage("CMD,1082,SERVO,2,180")} disabled={!isConnected} />

                                <Button text="Servo 3 0" onClick={() => sendCustomMessage("CMD,1082,SERVO,3,0")} disabled={!isConnected} />
                                <Button text="Servo 3 90" onClick={() => sendCustomMessage("CMD,1082,SERVO,3,90")} disabled={!isConnected} />
                                <Button text="Servo 3 180" onClick={() => sendCustomMessage("CMD,1082,SERVO,3,180")} disabled={!isConnected} />

                            </div>
                            {/* // CMD,1082,MOTOR,CW-CCW,0-499 */}
                        </div>
                    </TabPanel>
                    <TabPanel className="plot-container2">
                        {/* <DisplayLabel title="Time" value={latestTelemetry?.mission_time.toString() || '0.0'} /> */}
                        <div className="chart-item2">
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

                                        min: 20,
                                        max: 100,
                                        ticks: {
                                            precision: 1,
                                            font: {
                                                size: 30,

                                            }
                                        },
                                        title: {
                                            display: true,
                                            font: {
                                                weight: 'bold',
                                                size: 30,
                                            },
                                            text: "Temperature [C]"
                                        },
                                    },
                                    x: {
                                        title: {
                                            display: true,
                                            font: {
                                                weight: 'bold',
                                                size: 30,
                                            },
                                            text: "Time [hh:mm:ss]"
                                        },
                                        ticks: {
                                            precision: 1,
                                            font: {
                                                size: 30,

                                            }
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

                    </TabPanel>
                </Tabs>
            </div>
        </div >
    );
}

export default App;
