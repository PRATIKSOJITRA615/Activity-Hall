import { REAL_MEMBERS } from './src/real-members.js';
import { db } from './src/firebase.js';
import { collection, doc, setDoc } from 'firebase/firestore';

async function upload() {
  console.log(`Starting upload of ${REAL_MEMBERS.length} members...`);
  
  let success = 0;
  let errors = 0;

  for (const member of REAL_MEMBERS) {
    try {
      // Use member.id as the document ID in Firestore for consistency
      const docRef = doc(db, 'members', member.id);
      await setDoc(docRef, member);
      success++;
      if (success % 25 === 0) console.log(`Uploaded ${success} members...`);
    } catch (err) {
      console.error(`Error uploading member ${member.id}:`, err);
      errors++;
    }
  }

  console.log(`Upload complete! Success: ${success}, Errors: ${errors}`);
  process.exit(0);
}

upload();
