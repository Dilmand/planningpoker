import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function createAdminUser(username: string, password: string) {
  try {
    // Check if admin already exists
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { username }
    });

    if (existingAdmin) {
      console.log(`Admin user '${username}' already exists.`);
      return;
    }

    // Hash the password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create the admin user
    const admin = await prisma.adminUser.create({
      data: {
        username,
        passwordHash
      }
    });

    console.log(`Admin user created successfully with ID: ${admin.id}`);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if this script is being run directly
if (require.main === module) {
  // Get username and password from command-line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: ts-node createAdmin.ts <username> <password>');
    process.exit(1);
  }

  const [username, password] = args;
  
  createAdminUser(username, password)
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

export { createAdminUser }; 