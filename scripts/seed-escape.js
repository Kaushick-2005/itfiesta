/**
 * Seed Escape Room Questions
 * Run: node scripts/seed-escape.js
 */

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => {
        console.error("MongoDB Error:", err);
        process.exit(1);
    });

const escapeQuestionSchema = new mongoose.Schema({
    level: Number,
    category: String,
    type: String,
    question: String,
    options: [String],
    answer: mongoose.Schema.Types.Mixed,
    marks: Number,
    createdAt: { type: Date, default: Date.now }
}, { strict: false });

const EscapeQuestion = mongoose.models.EscapeQuestion || mongoose.model("EscapeQuestion", escapeQuestionSchema);

async function seedQuestions() {
    try {
        // Read questions from JSON file
        const questionsPath = path.join(__dirname, "../public/escape/questions dataset.json");
        const questionsData = fs.readFileSync(questionsPath, "utf-8");
        const questions = JSON.parse(questionsData);
        
        console.log(`Found ${questions.length} questions in dataset`);
        
        // Clear existing questions
        await EscapeQuestion.deleteMany({});
        console.log("Cleared existing escape questions");
        
        // Prepare questions for insertion (remove MongoDB ObjectId format)
        const cleanQuestions = questions.map(q => ({
            level: q.level,
            category: q.category,
            type: q.type,
            question: q.question,
            options: q.options,
            answer: q.answer,
            marks: q.marks || 10
        }));
        
        // Insert questions
        await EscapeQuestion.insertMany(cleanQuestions);
        
        // Count by level
        const byLevel = {};
        cleanQuestions.forEach(q => {
            byLevel[q.level] = (byLevel[q.level] || 0) + 1;
        });
        
        console.log("✅ Escape questions seeded:");
        Object.keys(byLevel).sort().forEach(level => {
            console.log(`   Level ${level}: ${byLevel[level]} questions`);
        });
        
        mongoose.disconnect();
        
    } catch (err) {
        console.error("Seed error:", err);
        mongoose.disconnect();
        process.exit(1);
    }
}

seedQuestions();
