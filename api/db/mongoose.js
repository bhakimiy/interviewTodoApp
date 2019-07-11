// This file will handle connection logic to the MongoDB

const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost:27017/TaskManager', { useNewUrlParser: true}).then(() => {
    console.log("Connected to MongoDB");
}).catch((e) => {
    console.log("Error while attempting to connect to MongoDB");
    console.log(e);
});

// To Prevent deprecation warnings (from MongoDB native driver)
mongoose.set('userCreateIndex', true);
mongoose.set('userFindAndModify', false);

module.exports = {
    mongoose
};
