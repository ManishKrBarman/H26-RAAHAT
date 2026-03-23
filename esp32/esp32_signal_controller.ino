#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <uri/UriBraces.h>

// --- CONFIG ---
const char* WIFI_SSID     = "Excitel_mywifi_o2"; 
const char* WIFI_PASSWORD = "@zxcvbnm";
const char* SERVER_IP     = "192.168.1.4";
const int   SERVER_PORT   = 3000;
const char* INTERSECTION_ID = "INT-001";

const int STATUS_LED = 2; 

// --- GLOBAL STATE ---
String currentActiveLane = "A"; 
int currentRemaining = 30;

struct Lane {
    int red; int yellow; int green;
    char id;
};

// KEPT ORIGINAL PINS AS REQUESTED
Lane lanes[4] = {
    {13, 12, 14, 'A'}, // Lane A
    {27, 26, 25, 'B'}, // Lane B
    {33, 32, 23, 'C'}, // Lane C
    {19, 18,  5, 'D'}  // Lane D
};

WebServer server(80);
unsigned long lastPoll = 0;

// --- DUAL BLINK LOGIC ---
void updateSignalDisplay() {
    char currentID = currentActiveLane[0];
    char nextID;
    
    // Determine the next lane in the A->B->C->D rotation
    if (currentID == 'A') nextID = 'B';
    else if (currentID == 'B') nextID = 'C';
    else if (currentID == 'C') nextID = 'D';
    else nextID = 'A';

    bool blinkOn = (millis() / 300) % 2 == 0;

    for (int i = 0; i < 4; i++) {
        // 1. THE CURRENT ACTIVE LANE
        if (lanes[i].id == currentID) {
            if (currentRemaining > 4) {
                // NORMAL GREEN
                digitalWrite(lanes[i].green,  HIGH);
                digitalWrite(lanes[i].yellow, LOW);
                digitalWrite(lanes[i].red,    LOW);
            } else {
                // BUFFER: BLINK YELLOW (PREPARE TO STOP)
                digitalWrite(lanes[i].green,  LOW);
                digitalWrite(lanes[i].red,    LOW);
                digitalWrite(lanes[i].yellow, blinkOn ? HIGH : LOW);
            }
        } 
        // 2. THE NEXT LANE IN QUEUE
        else if (lanes[i].id == nextID) {
            if (currentRemaining <= 4) {
                // BUFFER: BLINK YELLOW (PREPARE TO GO)
                digitalWrite(lanes[i].green,  LOW);
                digitalWrite(lanes[i].red,    LOW);
                digitalWrite(lanes[i].yellow, blinkOn ? HIGH : LOW);
            } else {
                // WAITING: SOLID RED
                digitalWrite(lanes[i].green,  LOW);
                digitalWrite(lanes[i].yellow, LOW);
                digitalWrite(lanes[i].red,    HIGH);
            }
        }
        // 3. ALL OTHER LANES
        else {
            digitalWrite(lanes[i].green,  LOW);
            digitalWrite(lanes[i].yellow, LOW);
            digitalWrite(lanes[i].red,    HIGH);
        }
    }
}

void pollBackend() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/esp32/signal/" + INTERSECTION_ID;
    http.begin(url);
    http.setTimeout(1500);
    
    if (http.GET() == 200) {
        StaticJsonDocument<512> doc;
        deserializeJson(doc, http.getString());
        currentActiveLane = doc["active_lane"].as<String>();
        currentRemaining = doc["remaining"] | 0;
    }
    http.end();
}

void setup() {
    Serial.begin(115200);
    pinMode(STATUS_LED, OUTPUT);
    for (int i = 0; i < 4; i++) {
        pinMode(lanes[i].red, OUTPUT); 
        pinMode(lanes[i].yellow, OUTPUT); 
        pinMode(lanes[i].green, OUTPUT);
    }

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
        delay(500);
    }
    digitalWrite(STATUS_LED, HIGH);

    server.on(UriBraces("/set/{}/{}"), []() {
        String l = server.pathArg(0); String s = server.pathArg(1);
        l.toUpperCase(); s.toUpperCase();
        currentActiveLane = l;
        currentRemaining = (s == "GREEN") ? 30 : 0; 
        server.send(200, "text/plain", "OK");
    });

    server.begin();
}

void loop() {
    server.handleClient();
    updateSignalDisplay();
    
    unsigned long now = millis();
    if (now - lastPoll >= 1000) {
        lastPoll = now;
        pollBackend();
    }
}