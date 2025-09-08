import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Generate deadlines: some 10-30 minutes from now, some 1 day from now
const now = new Date();
const getRandomMinutesFromNow = (min: number, max: number) => new Date(now.getTime() + (min + Math.random() * (max - min)) * 60 * 1000);
const getOneDayFromNow = () => new Date(now.getTime() + 24 * 60 * 60 * 1000);

const testPools = [
  {
    title: "Will Bitcoin reach $150K by end of 2024?",
    description: "Bitcoin has been on a bull run this year. Will it reach the milestone of $150,000 by December 31st, 2024?",
    tag: "crypto",
    deadline: getRandomMinutesFromNow(10, 30),
    image: "https://images.unsplash.com/photo-1605792657660-596af9009e82?w=800&h=400&fit=crop"
  },
  {
    title: "Will the Lakers make the NBA playoffs this season?",
    description: "After last season's performance, will the Los Angeles Lakers secure a playoff spot in the 2024-25 NBA season?",
    tag: "sports",
    deadline: getRandomMinutesFromNow(15, 25),
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=400&fit=crop"
  },
  {
    title: "Will AI replace more than 30% of software engineering jobs by 2026?",
    description: "With the rapid advancement of AI coding tools, will artificial intelligence replace over 30% of traditional software engineering positions by 2026?",
    tag: "technology",
    deadline: getOneDayFromNow(),
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=400&fit=crop"
  },
  {
    title: "Will Tesla stock hit $500 before 2025?",
    description: "Tesla's stock has been volatile this year. Will TSLA reach $500 per share before January 1st, 2025?",
    tag: "finance",
    deadline: getRandomMinutesFromNow(20, 30),
    image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=400&fit=crop"
  },
  {
    title: "Will there be a major earthquake (7.0+) in California in 2024?",
    description: "California sits on several fault lines. Will there be a major earthquake of magnitude 7.0 or higher in California before the end of 2024?",
    tag: "weather",
    deadline: getRandomMinutesFromNow(12, 18),
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=400&fit=crop"
  },
  {
    title: "Will SpaceX successfully land humans on Mars by 2030?",
    description: "Elon Musk has set ambitious goals for Mars colonization. Will SpaceX achieve a successful human landing on Mars by 2030?",
    tag: "space",
    deadline: getOneDayFromNow(),
    image: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800&h=400&fit=crop"
  },
  {
    title: "Will Netflix subscriber count exceed 300 million by 2025?",
    description: "Netflix continues to expand globally. Will they surpass 300 million subscribers worldwide by the end of 2025?",
    tag: "entertainment",
    deadline: getOneDayFromNow(),
    image: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800&h=400&fit=crop"
  },
  {
    title: "Will remote work become permanent for 50%+ of tech companies?",
    description: "Post-pandemic work trends are still evolving. Will more than 50% of major tech companies adopt permanent remote work policies by 2025?",
    tag: "business",
    deadline: getRandomMinutesFromNow(10, 20),
    image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&h=400&fit=crop"
  }
];

async function createTestPools() {
  try {
    console.log('🚀 Creating test pools...\n');
    
    for (let i = 0; i < testPools.length; i++) {
      const poolData = testPools[i];
      
      console.log(`Creating pool ${i + 1}/${testPools.length}: ${poolData.title.substring(0, 50)}...`);
      
      const pool = await prisma.pool.create({
        data: {
          ...poolData,
          totalStake: Math.random() * 10000 // Random stake amount for testing
        }
      });
      
      console.log(`✅ Created pool with ID: ${pool.id}`);
    }
    
    console.log(`\n🎉 Successfully created ${testPools.length} test pools!`);
    
    // Show summary
    const allPools = await prisma.pool.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`\n📊 Total pools in database: ${allPools.length}`);
    console.log('\n📝 Recent pools:');
    allPools.slice(0, 5).forEach(pool => {
      console.log(`   • ${pool.title} (${pool.tag})`);
    });
    
  } catch (error) {
    console.error('❌ Error creating test pools:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestPools();