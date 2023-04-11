import { useEffect, useState } from "react";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import "./index.css";
import Chart from "react-apexcharts";
import { Tab, Tabs, TabList, TabPanel } from "react-tabs";
import "./styles.css";

interface DisplayLabelProps {
    title: string;
    value: string;
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

    useEffect(() => {
        const graphDataListener = listen(
            "graph-data",
            ({ payload: { value } }: { payload: { value: number } }) => {
                setGraphData((old) => [...old, value]);
            }
        );

        return () => {
            graphDataListener.then((unlisten: UnlistenFn) => {
                unlisten();
            });
        };
    }, []);
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
                    <Button text="Start" />
                    <Button text="Start Telemetry" />
                    <Button text="Stop Telemetry" />
                    <Button text="Stop and Save CSV" />
                    <Button text="Load CSV" />
                </div>
                {/* Fourth Column */}
                <div>
                    <Button text="Stop and Save CSV" />
                    <Button text="Simulation Enable" />
                    <Button text="Simulation Activate" />
                    <Button text="Simulation Disable" />
                    <Button text="Serial Options" />
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
                                yaxis: { title: { text: "Voltage [V]" } },
                                title: {
                                    text: "Example Voltage",
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
                                    size: 4,
                                    shape: "circle",
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
                                yaxis: { title: { text: "Voltage [V]" } },
                                title: {
                                    text: "Example Voltage",
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
                                    size: 4,
                                    shape: "circle",
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
