const mongoose = require("mongoose");
require("dotenv").config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => {
    console.log("MongoDB Error:", err);
    process.exit(1);
});

// Define schema (same as in blackbox.js)
const questionSchema = new mongoose.Schema({
    round: Number,
    formula: String,
    variables: Number,
    duration: Number,
    keywords: [String],
    maxScore: Number,
    evaluation: {
        requiredKeywords: [String],
        logicalOperators: [String],
        comparisons: [String],
        weight: {
            keywords: Number,
            logic: Number,
            comparisons: Number
        }
    }
});

const BlackBoxQuestion = mongoose.model("BlackBoxQuestion", questionSchema);

// Sample questions for all 3 rounds
const questions = [
    // ==================== ROUND 1 - Math/Logic ====================
    {
        round: 1,
        formula: "x + 10",
        variables: 1,
        duration: 480  // 8 minutes
    },
    {
        round: 1,
        formula: "x * 2",
        variables: 1,
        duration: 480
    },
    {
        round: 1,
        formula: "x + y",
        variables: 2,
        duration: 480
    },
    {
        round: 1,
        formula: "x * y",
        variables: 2,
        duration: 480
    },
    {
        round: 1,
        formula: "x * x",
        variables: 1,
        duration: 480
    },

    // ==================== ROUND 2 - Strings ====================
    {
        round: 2,
        formula: "x.length",
        variables: 1,
        duration: 600,
        keywords: ["length", "count", "characters", "number"],
        maxScore: 100
    },
    {
        round: 2,
        formula: "x.split('').reverse().join('')",
        variables: 1,
        duration: 600,
        keywords: ["reverse", "backwards", "flip", "opposite"],
        maxScore: 100
    },
    {
        round: 2,
        formula: "x.toUpperCase()",
        variables: 1,
        duration: 600,
        keywords: ["uppercase", "capital", "upper", "big"],
        maxScore: 100
    },
    {
        round: 2,
        formula: "x + y",
        variables: 2,
        duration: 600,
        keywords: ["concat", "join", "combine", "together", "append"],
        maxScore: 100
    },

    // ==================== ROUND 3 - Decision Logic ====================
    {
        round: 3,
        formula: "age >= 18 && score > 50 ? 'Eligible' : 'Not Eligible'",
        variables: 3,
        duration: 360,  // 6 minutes
        evaluation: {
            requiredKeywords: ["age", "score", "18", "50"],
            logicalOperators: ["and", "&&", "greater", ">="],
            comparisons: ["greater than", "at least", "more than"],
            weight: {
                keywords: 30,
                logic: 30,
                comparisons: 40
            }
        }
    },
    {
        round: 3,
        formula: "role === 'professional' && age > 25 ? 'Senior' : 'Junior'",
        variables: 3,
        duration: 360,
        evaluation: {
            requiredKeywords: ["role", "professional", "age", "25"],
            logicalOperators: ["and", "&&", "equals", "==="],
            comparisons: ["greater than", "equal to", "is"],
            weight: {
                keywords: 30,
                logic: 30,
                comparisons: 40
            }
        }
    }
];

async function seedQuestions() {
    try {
        // Clear existing questions
        await BlackBoxQuestion.deleteMany({});
        console.log("Cleared existing questions");

        // Insert new questions
        await BlackBoxQuestion.insertMany(questions);
        console.log(`✅ Seeded ${questions.length} questions successfully!`);

        // Show what was inserted
        const count = await BlackBoxQuestion.countDocuments();
        console.log(`Total questions in DB: ${count}`);

        const round1 = await BlackBoxQuestion.countDocuments({ round: 1 });
        const round2 = await BlackBoxQuestion.countDocuments({ round: 2 });
        const round3 = await BlackBoxQuestion.countDocuments({ round: 3 });

        console.log(`Round 1: ${round1} questions`);
        console.log(`Round 2: ${round2} questions`);
        console.log(`Round 3: ${round3} questions`);

        process.exit(0);
    } catch (error) {
        console.error("Error seeding questions:", error);
        process.exit(1);
    }
}

seedQuestions();
