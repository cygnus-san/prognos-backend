import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function parseDate(dateString: string): Date {
  // Try to parse various date formats
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format. Use formats like: 2024-12-31, 12/31/2024, or Dec 31 2024');
  }
  return date;
}

async function createPool() {
  try {
    console.log('🚀 Create a new prediction pool\n');
    
    const title = await askQuestion('Pool title: ');
    if (!title.trim()) {
      console.log('❌ Title is required');
      process.exit(1);
    }
    
    const description = await askQuestion('Pool description: ');
    if (!description.trim()) {
      console.log('❌ Description is required');
      process.exit(1);
    }
    
    const tag = await askQuestion('Pool tag (e.g., sports, politics, crypto): ');
    if (!tag.trim()) {
      console.log('❌ Tag is required');
      process.exit(1);
    }
    
    const deadlineString = await askQuestion('Pool deadline (e.g., 2024-12-31 or Dec 31 2024): ');
    let deadline: Date;
    try {
      deadline = parseDate(deadlineString);
      if (deadline <= new Date()) {
        console.log('❌ Deadline must be in the future');
        process.exit(1);
      }
    } catch (error) {
      console.log(`❌ ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
    
    const image = await askQuestion('Image URL (optional, press Enter to skip): ');
    
    // Create the pool
    const pool = await prisma.pool.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        tag: tag.trim().toLowerCase(),
        deadline,
        image: image.trim() || null,
        totalStake: 0
      }
    });
    
    console.log('\n✅ Pool created successfully!');
    console.log(`📊 Pool ID: ${pool.id}`);
    console.log(`📝 Title: ${pool.title}`);
    console.log(`🏷️  Tag: ${pool.tag}`);
    console.log(`⏰ Deadline: ${pool.deadline.toLocaleDateString()}`);
    
    rl.close();
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('❌ Error creating pool:', error instanceof Error ? error.message : String(error));
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.length > 2) {
  // Quick creation mode with CLI args
  const [title, description, tag, deadline, image] = process.argv.slice(2);
  
  if (!title || !description || !tag || !deadline) {
    console.log('❌ Usage: npm run create-pool [title] [description] [tag] [deadline] [image?]');
    console.log('   Or run: npm run create-pool (for interactive mode)');
    process.exit(1);
  }
  
  (async () => {
    try {
      const deadlineDate = parseDate(deadline);
      if (deadlineDate <= new Date()) {
        console.log('❌ Deadline must be in the future');
        process.exit(1);
      }
      
      const pool = await prisma.pool.create({
        data: {
          title: title.trim(),
          description: description.trim(),
          tag: tag.trim().toLowerCase(),
          deadline: deadlineDate,
          image: image?.trim() || null,
          totalStake: 0
        }
      });
      
      console.log('✅ Pool created successfully!');
      console.log(`📊 Pool ID: ${pool.id}`);
      console.log(`📝 Title: ${pool.title}`);
      console.log(`🏷️  Tag: ${pool.tag}`);
      console.log(`⏰ Deadline: ${pool.deadline.toLocaleDateString()}`);
      
      await prisma.$disconnect();
    } catch (error) {
      console.error('❌ Error creating pool:', error instanceof Error ? error.message : String(error));
      await prisma.$disconnect();
      process.exit(1);
    }
  })();
} else {
  // Interactive mode
  createPool();
}