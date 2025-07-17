import fs from 'fs';
import path from 'path';

const USERS_FILE = path.resolve(__dirname, '../users.json');
const MAPS_FILE = path.resolve(__dirname, '../maps.json');

interface MapEntry {
  name: string;
  url: string;
  timestamp: number;
}

function readUsers(): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return new Set(data.users || []);
  } catch {
    return new Set();
  }
}

function readMapsData(): Record<string, MapEntry[]> {
  try {
    return JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function main() {
  console.log('📊 Bot User Statistics\n');
  
  const users = readUsers();
  const mapsData = readMapsData();
  
  console.log(`👥 Total unique users who interacted with bot: ${users.size}`);
  console.log(`🗺️  Users with uploaded maps: ${Object.keys(mapsData).length}`);
  
  if (users.size > 0) {
    console.log('\n📋 User IDs:');
    Array.from(users).sort().forEach(userId => {
      const hasMaps = userId in mapsData;
      const mapCount = hasMaps ? mapsData[userId].length : 0;
      console.log(`  ${userId} ${hasMaps ? `(${mapCount} maps)` : '(no maps)'}`);
    });
  }
  
  if (Object.keys(mapsData).length > 0) {
    console.log('\n🗺️  Maps by user:');
    Object.entries(mapsData).forEach(([userId, maps]) => {
      console.log(`  ${userId}: ${maps.length} maps`);
      maps.forEach(map => {
        console.log(`    - ${map.name} (${new Date(map.timestamp).toLocaleDateString()})`);
      });
    });
  }
  
  console.log('\n💾 Files:');
  console.log(`  users.json: ${fs.existsSync(USERS_FILE) ? '✅ exists' : '❌ missing'}`);
  console.log(`  maps.json: ${fs.existsSync(MAPS_FILE) ? '✅ exists' : '❌ missing'}`);
}

if (require.main === module) {
  main();
} 