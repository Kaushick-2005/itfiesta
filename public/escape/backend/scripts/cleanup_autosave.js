// Cleanup script: remove autosave fields added by earlier auto-validation
// Usage: set MONGO_URI in environment or create a .env in backend folder, then:
//    node scripts/cleanup_autosave.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not set in environment. Aborting.');
  process.exit(1);
}

async function run(){
  try{
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const teamSchema = new mongoose.Schema({}, { strict: false });
    const Team = mongoose.models.Team || mongoose.model('Team', teamSchema, 'teams');

    const unsetFields = {
      'level1_matchedQuestion': '', 'level1_solvedAt': '', 'level1_submitted': '', 'level1_attempts': '',
      'level2_matchedQuestion': '', 'level2_solvedAt': '', 'level2_submitted': '', 'level2_attempts': '',
      'level3_matchedQuestion': '', 'level3_solvedAt': '', 'level3_submitted': '', 'level3_attempts': '',
      'level4_matchedQuestion': '', 'level4_solvedAt': '', 'level4_submitted': '', 'level4_attempts': '',
      'level5_matchedQuestion': '', 'level5_solvedAt': '', 'level5_submitted': '', 'level5_attempts': ''
    };

    const res = await Team.updateMany({}, { $unset: unsetFields });
    console.log('Update result:', res.nModified !== undefined ? `modified ${res.nModified}` : res);
    await mongoose.disconnect();
    console.log('Done.');
  }catch(err){
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
