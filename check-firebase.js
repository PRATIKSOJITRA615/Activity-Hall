import { db } from './src/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

async function checkFirebaseMembers() {
  const snapshot = await getDocs(collection(db, 'members'));
  console.log(`Found ${snapshot.size} members in Firebase.`);
  
  let withAddress = 0;
  let withoutAddress = 0;
  const sample = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.address && data.address.trim() !== '') {
      withAddress++;
    } else {
      withoutAddress++;
    }
    if (sample.length < 5) {
      sample.push({ id: doc.id, name: data.name, phone: data.phone, address: data.address || '' });
    }
  });

  console.log(`With address: ${withAddress}, Without address: ${withoutAddress}`);
  console.log('Sample members:', sample);
  process.exit(0);
}

checkFirebaseMembers();
