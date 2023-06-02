const mongoose = require("mongoose");

exports.connectDatabase = () => {
  mongoose
    .connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    .then((con) =>
      console.log(`Database Connected Successfully at ${con.connection.host}`)
    )
    .catch((err) => console.error(err));
};
