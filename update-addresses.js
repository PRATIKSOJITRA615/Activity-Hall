import { REAL_MEMBERS } from './src/real-members.js';
import { db } from './src/firebase.js';
import { doc, setDoc } from 'firebase/firestore';

async function updateAddresses() {
  console.log(`Starting address update for ${REAL_MEMBERS.length} members in Firebase...`);

  let updated = 0;
  let errors = 0;

  for (const member of REAL_MEMBERS) {
    try {
      const docRef = doc(db, 'members', member.id);
      // Merge only the address field to avoid disrupting existing rotation state or status
      await setDoc(docRef, { address: member.address || '' }, { merge: true });
      updated++;
      if (updated % 25 === 0 || updated === REAL_MEMBERS.length) {
        console.log(`Updated ${updated}/${REAL_MEMBERS.length} member addresses...`);
      }
    } catch (err) {
      console.error(`Error updating member ${member.id} (${member.name}):`, err);
      errors++;
    }
  }

  console.log(`Address update complete! Updated: ${updated}, Errors: ${errors}`);
  process.exit(0);
}

updateAddresses();
