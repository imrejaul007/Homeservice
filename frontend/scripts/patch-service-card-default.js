const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/components/customer/ServiceCard.tsx');
const s = fs.readFileSync(filePath, 'utf8');

const startMarker = '  // Default variant\n  return (';
const endMarker = '\n};\n\n// Memoize to prevent unnecessary re-renders';

const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker, start);
if (start === -1 || end === -1) {
  console.error('markers not found', { start, end });
  process.exit(1);
}

const block = `  // Default variant — mobile: horizontal list card; lg+: vertical grid card
  return (
    <motion
      onClick={handleClick}
`;
