import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseCSVRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(field.trim());
      if (row.some(f => f !== '')) {
        rows.push(row);
      }
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    if (row.some(f => f !== '')) {
      rows.push(row);
    }
  }
  return rows;
}

function processCSV(filePath, category, idPrefix) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSVRows(content);
  
  const members = [];
  // row 0 is header
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawId = r[0] ? r[0].trim() : '';
    const name = r[1] ? r[1].trim() : '';
    const phone = r[2] ? r[2].trim() : '';
    const seat = r[3] ? r[3].trim() : '';
    const address = r[4] ? r[4].trim() : '';

    if (name && rawId && !isNaN(parseInt(rawId, 10))) {
      const id = `${idPrefix}-${parseInt(rawId, 10)}`;
      members.push({
        id,
        name,
        phone,
        category,
        initialSeatCode: seat,
        address: address,
        status: "active"
      });
    } else if (name && name !== 'SINGLE') {
      // Special row without ID or single
      console.log(`Special row without numeric ID in ${category}:`, r);
    }
  }
  return members;
}

const deluxe = processCSV(path.join(__dirname, 'members', 'Delux.csv'), 'Deluxe', 'D');
const premium = processCSV(path.join(__dirname, 'members', 'Premium.csv'), 'Premium', 'P');

console.log(`Parsed ${deluxe.length} Deluxe members`);
console.log(`Parsed ${premium.length} Premium members`);
console.log(`Total parsed: ${deluxe.length + premium.length}`);

// Check empty addresses
const deluxeEmpty = deluxe.filter(m => !m.address);
const premiumEmpty = premium.filter(m => !m.address);

console.log(`Deluxe with empty address: ${deluxeEmpty.length}`, deluxeEmpty.map(m => m.name));
console.log(`Premium with empty address: ${premiumEmpty.length}`, premiumEmpty.map(m => m.name));
