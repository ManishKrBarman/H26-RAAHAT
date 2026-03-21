const app = require("./app");
const mongoose = require("mongoose");

const PORT = 3000;


mongoose.connect("mongodb://127.0.0.1:27017/raahat")
    .then(() => console.log("DB connected"));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});