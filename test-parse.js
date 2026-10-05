import fs from 'fs';
import path from 'path';

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

const delux = parseCSVRows(fs.readFileSync('members/Delux.csv', 'utf8'));
console.log('Delux headers:', delux[0]);
console.log('Delux row count:', delux.length);
delux.slice(1).forEach((r, idx) => {
  console.log(`Delux ${idx + 1}: ID=${r[0]}, Name=${r[1]}, Phone=${r[2]}, Seat=${r[3]}, Address=${r[4]}`);
});

const prem = parseCSVRows(fs.readFileSync('members/Premium.csv', 'utf8'));
console.log('\nPremium headers:', prem[0]);
console.log('Premium row count:', prem.length);
prem.slice(1).forEach((r, idx) => {
  console.log(`Premium ${idx + 1}: ID=${r[0]}, Name=${r[1]}, Phone=${r[2]}, Seat=${r[3]}, Address=${r[4]}`);
});
