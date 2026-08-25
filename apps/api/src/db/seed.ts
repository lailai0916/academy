import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import type { ContentImportItem } from '@lailai/academy-shared';
import { config } from '../config.js';
import { closeDatabase, db } from './index.js';
import { contentItems, profiles, users } from './schema.js';

const starterContent: ContentImportItem[] = [
  {
    key: 'word-significant',
    kind: 'word',
    grade: '高一',
    textbook: '人教版普通高中英语',
    unit: '必修第一册 · Welcome Unit',
    tags: ['高频', '阅读'],
    payload: {
      headword: 'significant',
      phonetic: '/sɪɡˈnɪfɪkənt/',
      meanings: ['重要的；有重大意义的', '显著的'],
      example: 'Small habits can make a significant difference over time.',
      exampleTranslation: '长期坚持的小习惯会带来显著变化。',
      aliases: ['important', 'notable'],
    },
  },
  {
    key: 'word-concentrate',
    kind: 'word',
    grade: '高一',
    textbook: '人教版普通高中英语',
    unit: '必修第一册 · Welcome Unit',
    tags: ['高频', '写作'],
    payload: {
      headword: 'concentrate',
      phonetic: '/ˈkɒnsntreɪt/',
      meanings: ['集中注意力；专注', '使集中'],
      example: 'It is difficult to concentrate when the room is noisy.',
      exampleTranslation: '房间嘈杂时很难集中注意力。',
      aliases: ['focus'],
    },
  },
  {
    key: 'word-recommend',
    kind: 'word',
    grade: '高一',
    textbook: '人教版普通高中英语',
    unit: '必修第一册 · Unit 1',
    tags: ['高频', '语法'],
    payload: {
      headword: 'recommend',
      phonetic: '/ˌrekəˈmend/',
      meanings: ['推荐；建议'],
      example: 'The teacher recommended reading the article twice.',
      exampleTranslation: '老师建议把这篇文章读两遍。',
      aliases: ['suggest'],
    },
  },
  {
    key: 'word-responsible',
    kind: 'word',
    grade: '高一',
    textbook: '人教版普通高中英语',
    unit: '必修第一册 · Unit 1',
    tags: ['高频', '写作'],
    payload: {
      headword: 'responsible',
      phonetic: '/rɪˈspɒnsəbl/',
      meanings: ['负责的；有责任的'],
      example: 'Students should be responsible for their own learning.',
      exampleTranslation: '学生应当对自己的学习负责。',
      aliases: ['accountable'],
    },
  },
  {
    key: 'word-challenge',
    kind: 'word',
    grade: '高一',
    textbook: '人教版普通高中英语',
    unit: '必修第一册 · Unit 1',
    tags: ['高频', '完形'],
    payload: {
      headword: 'challenge',
      phonetic: '/ˈtʃælɪndʒ/',
      meanings: ['挑战；艰巨任务', '向……挑战'],
      example: 'The new course is a challenge, but it is worth the effort.',
      exampleTranslation: '新课程很有挑战性，但值得付出努力。',
      aliases: ['difficulty'],
    },
  },
  {
    key: 'word-prefer',
    kind: 'word',
    grade: '高一',
    textbook: '人教版普通高中英语',
    unit: '必修第一册 · Unit 1',
    tags: ['高频', '语法'],
    payload: {
      headword: 'prefer',
      phonetic: '/prɪˈfɜːr/',
      meanings: ['较喜欢；更愿意'],
      example: 'I prefer reviewing in short sessions to studying all night.',
      exampleTranslation: '比起通宵学习，我更喜欢短时多次复习。',
      aliases: ['favor'],
    },
  },
  {
    key: 'poem-duange-cao-cao',
    kind: 'poem',
    grade: '高一',
    textbook: '部编版普通高中语文',
    unit: '必修上册 · 第三单元',
    tags: ['必背', '情景默写'],
    payload: {
      title: '短歌行（节选）',
      author: '曹操',
      dynasty: '东汉末年',
      lines: [
        '对酒当歌，人生几何！譬如朝露，去日苦多。',
        '慨当以慷，忧思难忘。何以解忧？唯有杜康。',
        '青青子衿，悠悠我心。但为君故，沉吟至今。',
        '月明星稀，乌鹊南飞。绕树三匝，何枝可依？',
        '山不厌高，海不厌深。周公吐哺，天下归心。',
      ],
      translation: '诗人感叹人生短暂，表达求贤若渴以及建功立业的愿望。',
      notes: ['“子衿”借指贤才。', '“吐哺”用周公礼贤下士的典故。'],
      keyPoints: ['用典', '比兴', '求贤主题', '情景默写'],
    },
  },
  {
    key: 'poem-duanju-dufu',
    kind: 'poem',
    grade: '高一',
    textbook: '部编版普通高中语文',
    unit: '必修上册 · 第三单元',
    tags: ['必背', '名句'],
    payload: {
      title: '登高',
      author: '杜甫',
      dynasty: '唐',
      lines: [
        '风急天高猿啸哀，渚清沙白鸟飞回。',
        '无边落木萧萧下，不尽长江滚滚来。',
        '万里悲秋常作客，百年多病独登台。',
        '艰难苦恨繁霜鬓，潦倒新停浊酒杯。',
      ],
      translation: '诗人登高望远，以深秋景象寄托羁旅、病老和忧国之情。',
      notes: ['“渚”指水中的小洲。', '“繁霜鬓”形容白发增多。'],
      keyPoints: ['对仗', '悲秋意象', '情景交融'],
    },
  },
  {
    key: 'poem-mengyou-tianmu',
    kind: 'poem',
    grade: '高一',
    textbook: '部编版普通高中语文',
    unit: '必修上册 · 第三单元',
    tags: ['必背', '理解性默写'],
    payload: {
      title: '梦游天姥吟留别（节选）',
      author: '李白',
      dynasty: '唐',
      lines: [
        '世间行乐亦如此，古来万事东流水。',
        '别君去兮何时还？且放白鹿青崖间，须行即骑访名山。',
        '安能摧眉折腰事权贵，使我不得开心颜！',
      ],
      translation: '诗人借梦境与离别抒发不事权贵、追求自由的态度。',
      notes: ['“摧眉折腰”指低头弯腰，形容卑躬屈膝。'],
      keyPoints: ['浪漫主义', '卒章显志', '理解性默写'],
    },
  },
  {
    key: 'poem-niannujiao-chibi',
    kind: 'poem',
    grade: '高一',
    textbook: '部编版普通高中语文',
    unit: '必修上册 · 第三单元',
    tags: ['必背', '豪放词'],
    payload: {
      title: '念奴娇·赤壁怀古',
      author: '苏轼',
      dynasty: '宋',
      lines: [
        '大江东去，浪淘尽，千古风流人物。',
        '故垒西边，人道是，三国周郎赤壁。',
        '乱石穿空，惊涛拍岸，卷起千堆雪。',
        '江山如画，一时多少豪杰。',
        '遥想公瑾当年，小乔初嫁了，雄姿英发。',
        '羽扇纶巾，谈笑间，樯橹灰飞烟灭。',
        '故国神游，多情应笑我，早生华发。',
        '人生如梦，一尊还酹江月。',
      ],
      translation: '词人由赤壁壮景追怀周瑜，并感慨自身经历与人生。',
      notes: ['“纶巾”是古代配有青丝带的头巾。', '“酹”指把酒洒在地上祭奠。'],
      keyPoints: ['豪放词', '写景咏史', '人物对比'],
    },
  },
];

export async function seedDatabase() {
  for (const item of starterContent) {
    await db
      .insert(contentItems)
      .values({ ...item, status: 'published' })
      .onConflictDoUpdate({
        target: contentItems.key,
        set: {
          grade: item.grade,
          kind: item.kind,
          payload: item.payload,
          tags: item.tags,
          textbook: item.textbook,
          unit: item.unit,
          updatedAt: new Date(),
        },
      });
  }

  if (!config.BOOTSTRAP_ADMIN_PASSWORD) {
    return;
  }

  const username = config.BOOTSTRAP_ADMIN_USERNAME.toLowerCase();
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));
  if (existing) {
    return;
  }

  const passwordHash = await argon2.hash(config.BOOTSTRAP_ADMIN_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
  const [admin] = await db
    .insert(users)
    .values({ username, passwordHash, role: 'admin' })
    .returning({ id: users.id });
  await db.insert(profiles).values({
    userId: admin.id,
    displayName: '管理员',
    grade: '高一',
    targetScore: 750,
    dailyGoal: 20,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedDatabase();
  await closeDatabase();
}
