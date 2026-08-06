import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parseCSV = (filePath, category, idPrefix) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  
  const members = [];
  
  // Skip header (first line)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Split by comma, handling potential quotes if any
    const parts = line.split(',');
    
    if (parts.length >= 4) {
      const id = parts[0].trim();
      const name = parts[1].trim();
      const phone = parts[2].trim();
      const seat = parts[3] ? parts[3].trim() : '';
      
      if (name && id) {
        members.push({
          id: `${category === "Deluxe" ? "D" : "P"}-${id}`,
          name: name,
          phone: phone,
          category: category,
          initialSeatCode: seat,
          // We will calculate indices later
          status: "active",
          createdAt: new Date().toISOString()
        });
      }
    }
  }
  
  return members;
};

const deluxeMembers = parseCSV(path.join(__dirname, 'members', 'Delux.csv'), 'Deluxe', 'D');
const premiumMembers = parseCSV(path.join(__dirname, 'members', 'Premium.csv'), 'Premium', 'P');

const allMembers = [...deluxeMembers, ...premiumMembers];

// Now we need to assign them initialSeatIndex based on their order so the rotation logic works.
// The rotation logic in App.jsx uses initialSeatIndex and currentSeatIndex (0 to N-1).
const processMembers = (categoryMembers) => {
  return categoryMembers.map((m, index) => {
    return {
      ...m,
      initialSeatIndex: index,
      currentSeatIndex: index
    };
  });
};

const finalDeluxe = processMembers(deluxeMembers);
const finalPremium = processMembers(premiumMembers);
const finalMembers = [...finalDeluxe, ...finalPremium];

const outputContent = `export const REAL_MEMBERS = ${JSON.stringify(finalMembers, null, 2)};\n`;

fs.writeFileSync(path.join(__dirname, 'src', 'real-members.js'), outputContent);
console.log('Successfully generated src/real-members.js with ' + finalMembers.length + ' members.');
