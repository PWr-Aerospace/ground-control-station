// This is some example Arduino code that would send dummy data via a serial port
// This is intended for testing

#include <Arduino.h>

// Function to increment time by one second
String incrementTime(String time) {
  int hours = time.substring(0, 2).toInt();
  int minutes = time.substring(3, 5).toInt();
  int seconds = time.substring(6, 8).toInt();

  seconds++;
  if (seconds >= 60) {
    seconds = 0;
    minutes++;
    if (minutes >= 60) {
      minutes = 0;
      hours++;
      if (hours >= 24) {
        hours = 0;
      }
    }
  }

  return String((hours < 10 ? "0" : "") + String(hours) + ":" +
                (minutes < 10 ? "0" : "") + String(minutes) + ":" +
                (seconds < 10 ? "0" : "") + String(seconds));
}

void setup() {
  // Begin the Serial at 9600 Baud
  Serial.begin(9600);
}

void loop() {
  // Dummy data
  static int team_id = 1082;
  static String mission_time = "13:14:02";
  static float packet_count = 2.0;
  static String mode = "F";
  static String state = "LAUNCH_WAIT";
  static float altitude = 3.0;
  static String hs_deployed = "N";
  static String pc_deployed = "N";
  static String mast_raised = "N";
  static float temperature = 20.0;
  static float pressure = 101.3;
  static float voltage = 4.2;
  static String gps_time = "13:14:02";
  static float gps_altitude = 100.0;
  static float gps_latitude = 50.0;
  static float gps_longitude = -120.0;
  static int gps_sats = 10;
  static float tilt_x = 0.0;
  static float tilt_y = 0.0;
  static String cmd_echo = "CXON";

  // Increment values
  mission_time = incrementTime(mission_time);
  packet_count += 1;
  altitude += random(1, 5) / 10.0;
  temperature += random(-5, 6) / 10.0;
  pressure += random(-5, 6) / 10.0;
  voltage += random(-1, 2) / 10.0;
  gps_time = incrementTime(gps_time);
  gps_altitude += random(1, 5) / 10.0;
  gps_latitude += random(-5, 6) / 10000.0;
  gps_longitude += random(-5, 6) / 10000.0;
  gps_sats += random(-1, 2);
  tilt_x += random(-5, 6) / 100.0;
  tilt_y += random(-5, 6) / 100.0;

  // Concatenate and send data over serial port
  Serial.println(
    String(team_id) + "," +
    mission_time + "," +
    String(packet_count) + "," +
    mode + "," +
    state + "," +
    String(altitude) + "," +
    hs_deployed + "," +
    pc_deployed + "," +
    mast_raised + "," +
    String(temperature) + "," +
    String(pressure) + "," +
    String(voltage) + "," +
    gps_time + "," +
    String(gps_altitude) + "," +
    String(gps_latitude) + "," +
    String(gps_longitude) + "," +
    String(gps_sats) + "," +
    String(tilt_x) + "," +
    String(tilt_y) + "," +
    cmd_echo
  );

  // Wait for a second before sending the next set of data
  delay(1000);
}