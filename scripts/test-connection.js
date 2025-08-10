const { Client } = require('pg');

// 여러 연결 방법 테스트
const connectionConfigs = [
  // 설정 1: 기본 설정
  {
    name: 'Basic Connection',
    config: {
      host: 'aws-0-ap-northeast-2.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: 'postgres.lhqzjnpwuftaicjurqxq',
      password: 'UnbleYum1106!',
    }
  },
  // 설정 2: SSL 비활성화
  {
    name: 'No SSL',
    config: {
      host: 'aws-0-ap-northeast-2.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: 'postgres.lhqzjnpwuftaicjurqxq',
      password: 'UnbleYum1106!',
      ssl: false
    }
  },
  // 설정 3: SSL 허용하지만 검증 안함
  {
    name: 'SSL No Verify',
    config: {
      host: 'aws-0-ap-northeast-2.pooler.supabase.com',
      port: 5432,
      database: 'postgres',
      user: 'postgres.lhqzjnpwuftaicjurqxq',
      password: 'UnbleYum1106!',
      ssl: { rejectUnauthorized: false }
    }
  },
  // 설정 4: Connection String
  {
    name: 'Connection String',
    connectionString: 'postgresql://postgres.lhqzjnpwuftaicjurqxq:UnbleYum1106!@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres'
  }
];

async function testConnection(connectionConfig) {
  const client = new Client(connectionConfig.connectionString ? 
    { connectionString: connectionConfig.connectionString } : 
    connectionConfig.config);
  
  try {
    console.log(`\n🔗 ${connectionConfig.name} 테스트 중...`);
    await client.connect();
    
    // 간단한 쿼리 테스트
    const result = await client.query('SELECT version();');
    console.log(`✅ ${connectionConfig.name} 성공!`);
    console.log(`   PostgreSQL 버전: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`);
    
    return true;
  } catch (error) {
    console.log(`❌ ${connectionConfig.name} 실패:`);
    console.log(`   오류: ${error.message}`);
    return false;
  } finally {
    try {
      await client.end();
    } catch (e) {
      // 연결 종료 오류 무시
    }
  }
}

async function main() {
  console.log('🚀 Supabase PostgreSQL 연결 테스트 시작\n');
  console.log('대상 호스트: aws-0-ap-northeast-2.pooler.supabase.com:5432');
  console.log('사용자: postgres.lhqzjnpwuftaicjurqxq');
  
  let successCount = 0;
  
  for (const config of connectionConfigs) {
    const success = await testConnection(config);
    if (success) {
      successCount++;
      break; // 첫 번째 성공하는 연결을 찾으면 중단
    }
  }
  
  console.log(`\n📊 결과: ${successCount}/${connectionConfigs.length} 연결 방법 성공`);
  
  if (successCount === 0) {
    console.log('\n❌ 모든 연결 방법이 실패했습니다.');
    console.log('\n가능한 해결책:');
    console.log('1. 인터넷 연결 확인');
    console.log('2. Supabase 프로젝트 활성 상태 확인');
    console.log('3. 비밀번호 재확인');
    console.log('4. 방화벽 설정 확인');
    console.log('5. Supabase 웹 인터페이스에서 직접 SQL 실행 고려');
  } else {
    console.log('\n✅ 연결이 성공했습니다. 이제 스키마를 생성할 수 있습니다.');
  }
}

main().catch(console.error);