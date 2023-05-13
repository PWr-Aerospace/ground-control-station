import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "./index.css";
import Chart from "react-apexcharts";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "./styles.css";
import { invoke } from '@tauri-apps/api/tauri';


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
    const [graphData, setGraphData] = useState<number[]>([]);
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
            // if (deviceList.length > 0) {
            //     setSelectedDevice(deviceList[0]);
            // }
        } catch (error) {
            console.error("Failed to fetch devices:", error);
        }
    }
    useEffect(() => {

        fetchDevices();
    }, []);

    const stopAndSaveCSV = async () => {
        setIsRecording(false);

        // Unlisten the event
        if (graphDataListener) {
            graphDataListener.then((unlisten: UnlistenFn) => {
                unlisten();
            });
            setGraphDataListener(null); // Reset the listener state
        }

        try {
            await invoke("stop_recording_and_save_csv", { data: graphData });
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
                    console.log(telemetry.altitude)
                    setGraphData((old) => [...old, telemetry.altitude]);
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
        // if (!isConnected || !isRecording) return;
        if (!isConnected || !isRecording) {
            return;
        }

        const graphDataListener = listen(
            "graph-data",
            ({ payload: telemetry }: { payload: Telemetry }) => {
                console.log(telemetry.altitude)
                setGraphData((old) => [...old, telemetry.altitude]);
            }
        );

        return () => {
            graphDataListener.then((unlisten: UnlistenFn) => {
                unlisten();
            });
        };
    }, [isConnected, isRecording]);

    const series = [
        {
            name: "series-1",
            data: graphData,
        },
    ];

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
                    <DisplayLabel title="Mission time" value="0:06" />
                    <DisplayLabel title="Packet count" value="6" />
                    <DisplayLabel title="CMD_ECHO" value="" />
                    <DisplayLabel title="GPS time" value="" />
                    <DisplayLabel title="Pointing Error" value="" />
                </div>
                {/* Second Column */}
                <div>
                    <DisplayLabel title="Simulation Status" value="DISABLED" />
                    <DisplayLabel title="Mast raised" value="FALSE" />
                    <DisplayLabel title="HS Deployed" value="FALSE" />
                    <DisplayLabel title="PC Deployed" value="FALSE" />
                    <DisplayLabel title="Tilt X" value="0.0" />
                    <DisplayLabel title="Tilt Y" value="0.0" />
                </div>
                {/* Third Column */}
                <div>
                    <Button text="Start" onClick={startConnection} disabled={isConnected} />
                    <Button text="Start Telemetry" disabled={isConnected} />
                    <Button text="Stop Telemetry" />
                    <Button text="Stop and Save CSV" onClick={stopAndSaveCSV} />
                    <Button text="Load CSV" disabled={isConnected} />
                </div>
                {/* Fourth Column */}
                <div>
                    <Button text="Stop and Save CSV" />
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
                        <Tab className="tab-button">Plot 1</Tab>
                        <Tab className="tab-button">Map</Tab>
                        <Tab className="tab-button">Custom Commands</Tab>
                    </TabList>

                    <TabPanel className="plot-container">
                        <Chart
                            options={{
                                chart: {
                                    id: "john-chart",
                                    toolbar: {
                                        show: false,
                                    },
                                },
                                xaxis: {
                                    title: {
                                        text: "Time [s]",
                                    },
                                    type: "numeric",
                                },
                                yaxis: { title: { text: "Altitude [m]" } },
                                title: {
                                    text: "Example Altitude",
                                    align: "center",
                                    style: {
                                        fontSize: "20px",
                                        fontWeight: "bold",
                                    },
                                },
                                colors: ["#ff0000"],
                                stroke: {
                                    width: 1,
                                    curve: "straight",
                                },
                                markers: {
                                    size: 0,
                                },
                                legend: {
                                    show: true,
                                    position: "top",
                                    horizontalAlign: "right",
                                    labels: {
                                        colors: "#fff",
                                    },
                                },
                            }}
                            series={series}
                            type="line"
                            width={500}
                        />
                    </TabPanel>
                    <TabPanel className="plot-container">
                        <Chart
                            options={{
                                chart: {
                                    id: "john-chart",
                                    toolbar: {
                                        show: false,
                                    },
                                },
                                xaxis: {
                                    title: {
                                        text: "Time [s]",
                                    },
                                    type: "numeric",
                                },
                                yaxis: { title: { text: "Dupa [m]" } },
                                title: {
                                    text: "Example Altitude",
                                    align: "center",
                                    style: {
                                        fontSize: "20px",
                                        fontWeight: "bold",
                                    },
                                },
                                colors: ["#ff0000"],
                                stroke: {
                                    width: 1,
                                    curve: "straight",
                                },
                                markers: {
                                    size: 0,
                                },
                                legend: {
                                    show: true,
                                    position: "top",
                                    horizontalAlign: "right",
                                    labels: {
                                        colors: "#fff",
                                    },
                                },
                            }}
                            series={series}
                            type="line"
                            width={500}
                        />
                    </TabPanel>

                </Tabs>
            </div>
        </div >
    );
}

export default App;
