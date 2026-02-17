const mongoose = require("mongoose");

const evaluationSchema = new mongoose.Schema({
  requiredKeywords: [String],
  logicalOperators: [String],
  comparisons: [String],
  weight: {
    keywords: Number,
    logic: Number,
    comparisons: Number
  }
}, { _id: false });

const questionSchema = new mongoose.Schema({
  round: Number,
  formula: String,
  variables: Number,
  duration: Number,

  // Round 2 simple keyword scoring
  keywords: [String],
  maxScore: Number,

  // Round 3 structured scoring
  evaluation: evaluationSchema
});

module.exports = mongoose.model("Question", questionSchema);
