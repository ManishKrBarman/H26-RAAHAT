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
String currentActivePair[2] = {"A", "C"};  // Both lanes in active pair
int activePairCount = 2;
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

// --- Helper: check if a lane is in the active pair ---
bool isInActivePair(char laneId) {
    for (int i = 0; i < activePairCount; i++) {
        if (currentActivePair[i][0] == laneId) return true;
    }
    return false;
}

// --- Helper: check if a lane is in the OTHER (non-active) pair ---
bool isInNextPair(char laneId) {
    return !isInActivePair(laneId);
}

// --- PAIR-BASED SIGNAL DISPLAY ---
void updateSignalDisplay() {
    bool blinkOn = (millis() / 300) % 2 == 0;

    for (int i = 0; i < 4; i++) {
        bool inActivePair = isInActivePair(lanes[i].id);
        bool inNextPair = isInNextPair(lanes[i].id);

        // 1. LANES IN THE ACTIVE PAIR → GREEN (or yellow buffer when expiring)
        if (inActivePair) {
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
        // 2. LANES IN THE NEXT PAIR → RED (or yellow buffer when about to go)
        else if (inNextPair) {
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
    }
}

void pollBackend() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WARN] WiFi disconnected, skipping poll");
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
        
        // Parse active_pair from response
        JsonArray pair = doc["active_pair"].as<JsonArray>();
        if (pair && pair.size() > 0) {
            activePairCount = min((int)pair.size(), 2);
            for (int i = 0; i < activePairCount; i++) {
                currentActivePair[i] = pair[i].as<String>();
            }
        } else {
            // Fallback: just use active_lane as single-lane pair
            currentActivePair[0] = currentActiveLane;
            activePairCount = 1;
        }
        
        Serial.printf("[OK] Signal: Pair=[%s<->%s]  Remaining=%d\n", 
            currentActivePair[0].c_str(), 
            activePairCount > 1 ? currentActivePair[1].c_str() : "--", 
            currentRemaining);
    } else {
        Serial.printf("[ERROR] Poll failed: HTTP %d  URL: %s\n", httpCode, url.c_str());
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
        Serial.println("[OK] Heartbeat sent OK");
    } else {
        Serial.printf("[ERROR] Heartbeat failed: HTTP %d\n", httpCode);
    }
    http.end();
}

void setup() {
    Serial.begin(115200);
    Serial.println("\n\n[INIT] ESP32 Signal Controller Starting...");
    
    pinMode(STATUS_LED, OUTPUT);
    for (int i = 0; i < 4; i++) {
        pinMode(lanes[i].red, OUTPUT); 
        pinMode(lanes[i].yellow, OUTPUT); 
        pinMode(lanes[i].green, OUTPUT);
    }

    Serial.printf("[WIFI] Connecting to WiFi: %s\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    while (WiFi.status() != WL_CONNECTED) {
        digitalWrite(STATUS_LED, !digitalRead(STATUS_LED));
        Serial.print(".");
        delay(500);
    }
    digitalWrite(STATUS_LED, HIGH);
    Serial.printf("\n[OK] WiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[TARGET] Backend target: %s:%d\n", SERVER_IP, SERVER_PORT);

    server.on(UriBraces("/set/{}/{}"), []() {
        String l = server.pathArg(0); String s = server.pathArg(1);
        l.toUpperCase(); s.toUpperCase();
        currentActiveLane = l;
        currentRemaining = (s == "GREEN") ? 30 : 0; 
        server.send(200, "text/plain", "OK");
    });

    server.begin();
    Serial.println("[OK] Local web server started on port 80");
    
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