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
}

const Button = ({ text, onClick }: ButtonProps) => {
    return (
        <button className="button" onClick={onClick}>
            <p className="button-text">{text}</p>
        </button>
    );
};




function App() {
    const [graphData, setGraphData] = useState<number[]>([]);
    const [devices, setDevices] = useState<string[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<string>("");
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isRecording, setIsRecording] = useState<boolean>(false);


    useEffect(() => {
        async function fetchDevices() {
            try {
                const deviceList = await invoke<string[]>("get_serial_ports_command");
                setDevices(deviceList);
                if (deviceList.length > 0) {
                    setSelectedDevice(deviceList[0]);
                }
            } catch (error) {
                console.error("Failed to fetch devices:", error);
            }
        }

        fetchDevices();
    }, []);

    const stopAndSaveCSV = async () => {
        setIsRecording(false);

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
            await invoke("connect_to_device", { device: selectedDevice });
            setIsConnected(true);
            setIsRecording(true);
        } catch (error) {
            console.error("Failed to connect to the device:", error);
        }
    };

    const handleDeviceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedDevice(event.target.value);
    };


    useEffect(() => {
        // if (!isConnected || !isRecording) return;
        if (!selectedDevice) {
            window.alert("Please select a device before starting.");
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
                    <Button text="Start" onClick={startConnection} />
                    <Button text="Start Telemetry" />
                    <Button text="Stop Telemetry" />
                    <Button text="Stop and Save CSV" onClick={stopAndSaveCSV} />
                    <Button text="Load CSV" />
                </div>
                {/* Fourth Column */}
                <div>
                    <Button text="Stop and Save CSV" />
                    <Button text="Simulation Enable" />
                    <Button text="Simulation Activate" />
                    <Button text="Simulation Disable" />
                    <Button text="Serial Options" />
                    <select value={selectedDevice} onChange={handleDeviceChange}>
                        {devices.map((device) => (
                            <option key={device} value={device}>
                                {device}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="bottom-row">
                <Tabs className="tab-buttons">
                    <TabList>
                        <Tab className="tab-button">Plot 1</Tab>
                        <Tab className="tab-button">Plot 2</Tab>
                        <Tab className="tab-button">Plot 3</Tab>
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
