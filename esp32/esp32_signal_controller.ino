#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <uri/UriBraces.h>

// --- CONFIG ---
const char* WIFI_SSID     = "Excitel_mywifi_o2"; 
const char* WIFI_PASSWORD = "@zxcvbnm";
const char* SERVER_IP     = "192.168.1.6";  // <-- Your machine's current WiFi IP
const int   SERVER_PORT   = 3000;
const char* INTERSECTION_ID = "INT-001";
const char* DEVICE_ID      = "esp32-signal-01";

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
unsigned long lastHeartbeat = 0;

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
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠️ WiFi disconnected, skipping poll");
        return;
    }

    HTTPClient http;
    String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/esp32/signal/" + INTERSECTION_ID;
    http.begin(url);
    http.setTimeout(1500);
    
    int httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        StaticJsonDocument<512> doc;
        deserializeJson(doc, payload);
        currentActiveLane = doc["active_lane"].as<String>();
        currentRemaining = doc["remaining"] | 0;
        Serial.printf("✅ Signal: Lane=%s  Remaining=%d\n", currentActiveLane.c_str(), currentRemaining);
    } else {
        Serial.printf("❌ Poll failed: HTTP %d  URL: %s\n", httpCode, url.c_str());
    }
    http.end();
}

void sendHeartbeat() {
    if (WiFi.status() != WL_CONNECTED) return;

    HTTPClient http;
    String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/esp32/heartbeat";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(2000);

    StaticJsonDocument<200> doc;
    doc["device_id"] = DEVICE_ID;
    doc["intersection_id"] = INTERSECTION_ID;
    doc["ip"] = WiFi.localIP().toString();

    String body;
    serializeJson(doc, body);

    int httpCode = http.POST(body);
    if (httpCode == 200) {
        Serial.println("💓 Heartbeat sent OK");
    } else {
        Serial.printf("❌ Heartbeat failed: HTTP %d\n", httpCode);
    }
    http.end();
}

void setup() {
    Serial.begin(115200);
    Serial.println("\n\n🚦 ESP32 Signal Controller Starting...");
    
    pinMode(STATUS_LED, OUTPUT);
    for (int i = 0; i < 4; i++) {
        pinMode(lanes[i].red, OUTPUT); 
        pinMode(lanes[i].yellow, OUTPUT); 
        pinMode(lanes[i].green, OUTPUT);
    }

    Serial.printf("📶 Connecting to WiFi: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
        Serial.print(".");
        delay(500);
    }
    digitalWrite(STATUS_LED, HIGH);
    Serial.printf("\n✅ WiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("🎯 Backend target: %s:%d\n", SERVER_IP, SERVER_PORT);

    server.on(UriBraces("/set/{}/{}"), []() {
        String l = server.pathArg(0); String s = server.pathArg(1);
        l.toUpperCase(); s.toUpperCase();
        currentActiveLane = l;
        currentRemaining = (s == "GREEN") ? 30 : 0; 
        server.send(200, "text/plain", "OK");
    });

    server.begin();
    Serial.println("🌐 Local web server started on port 80");
    
    // Send first heartbeat immediately
    sendHeartbeat();
}

void loop() {
    server.handleClient();
    updateSignalDisplay();
    
    unsigned long now = millis();
    
    // Poll backend for signal state every 1 second
    if (now - lastPoll >= 1000) {
        lastPoll = now;
        pollBackend();
    }
    
    // Send heartbeat every 10 seconds
    if (now - lastHeartbeat >= 10000) {
        lastHeartbeat = now;
        sendHeartbeat();
    }
}