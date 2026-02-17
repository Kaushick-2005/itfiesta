const mongoose = require("mongoose");

const gameSessionSchema = new mongoose.Schema({

  team_name: String,

  question_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Question"
  },

  round: Number,
  start_time: Date,
  end_time: Date,
  status: String,
  score: Number

});

module.exports = mongoose.model("GameSession", gameSessionSchema);
