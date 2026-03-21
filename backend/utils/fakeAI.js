function fakeAI(lane) {
    return {
        lane,
        vehicle_count: Math.floor(Math.random() * 50),
        avg_speed: Math.floor(Math.random() * 40),
        density: ["low", "medium", "high"][Math.floor(Math.random() * 3)],
        emergency: Math.random() < 0.1
    };
}

module.exports = { fakeAI };