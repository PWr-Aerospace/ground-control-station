use std::error::Error;
use std::sync::Arc;
use tokio::io::AsyncReadExt;
use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc::{Receiver, Sender};
use tokio::sync::Mutex;
use tokio::time::{sleep, Duration};
use tokio_serial::SerialPortBuilderExt;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let port_name = "/dev/cu.usbmodem11101";

    let mut port = tokio_serial::new(port_name, 115200);
    port = port
        .flow_control(tokio_serial::FlowControl::None)
        .stop_bits(tokio_serial::StopBits::One)
        .parity(tokio_serial::Parity::None);

    let serial_port = Arc::new(Mutex::new(port.open_native_async().unwrap()));

    println!("Got the port");

    let read_port = Arc::clone(&serial_port);

    let (tx, mut rx): (Sender<String>, Receiver<String>) =
        tokio::sync::mpsc::channel(4096);

    // Read task
    tokio::spawn(async move {
        let mut message = String::new();
        loop {
            match read_port.lock().await.read_u8().await {
                Ok(byte) => {
                    if byte == b'\n' {
                        println!("Received: {:?}", message);
                        message.clear();
                    }
                    else {
                        message.push(char::from(byte));
                    }
                }
                Err(e) => {
                    eprintln!("Failed to read from serial_port: {}", e);
                }
            }
        }
    });

    // Sending message task
    println!("Second thread");
    tokio::spawn(async move {
        println!("Judasz");
        for i in 0..5 {
            tokio::time::sleep(Duration::new(2, 0)).await;
            println!("Sending a message");
            tx.send(format!("Message{}", i)).await.unwrap();
        }
    });

    // Write task
    let write_port = Arc::clone(&serial_port);
    println!("Third thread");
    tokio::spawn(async move {
        println!("Jesus christ 2");
        while let Some(command) = rx.recv().await {
            let command_to_be_sent = command.clone() + "\n";
            match write_port
                .lock()
                .await
                .write_all(command_to_be_sent.as_bytes())
                .await
            {
                Ok(_) => {
                    println!("Wrote command to port");
                }
                Err(e) => {
                    eprintln!("Failed to write to port: {}", e);
                }
            }
        }
    });

    tokio::signal::ctrl_c().await.unwrap();
    Ok(())
}
