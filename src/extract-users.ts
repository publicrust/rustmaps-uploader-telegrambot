import fs from 'fs';
import path from 'path';

interface MapEntry {
  name: string;
  url: string;
  timestamp: number;
}

const MAPS_FILE = path.resolve(__dirname, '../maps.json');
const USERS_FILE = path.resolve(__dirname, '../users.json');

function readUsers(): Set<string> {
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return new Set(data.users || []);
  } catch {
    return new Set();
  }
}

function writeUsers(users: Set<string>) {
  const data = { users: Array.from(users) };
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function extractUsersFromMaps(): Set<string> {
  try {
    const mapsData = JSON.parse(fs.readFileSync(MAPS_FILE, 'utf8'));
    const userIds = new Set<string>();
    
    // Extract all user IDs from the maps.json file
    Object.keys(mapsData).forEach(userId => {
      userIds.add(userId);
    });
    
    return userIds;
  } catch (error) {
    console.error('Error reading maps.json:', error);
    return new Set();
  }
}

function main() {
  console.log('🔍 Extracting user IDs from maps.json...');
  
  const existingUsers = readUsers();
  const mapsUsers = extractUsersFromMaps();
  
  console.log(`📊 Found ${mapsUsers.size} users in maps.json`);
  console.log(`📊 Current users.json has ${existingUsers.size} users`);
  
  // Merge users from maps.json into users.json
  const allUsers = new Set([...existingUsers, ...mapsUsers]);
  
  writeUsers(allUsers);
  
  console.log(`✅ Successfully saved ${allUsers.size} unique user IDs to users.json`);
  console.log('📋 User IDs:', Array.from(allUsers).sort());
}

if (require.main === module) {
  main();
} 