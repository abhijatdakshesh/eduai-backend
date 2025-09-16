const db = require('../config/database');

const createCommunicationsTable = async () => {
  try {
    console.log('🔄 Creating communications table...');

    // Communications table
    await db.query(`
      CREATE TABLE IF NOT EXISTS communications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id VARCHAR(50) NOT NULL,
        parent_id UUID NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('whatsapp', 'ai_call')),
        status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'failed', 'scheduled', 'completed', 'cancelled')),
        message TEXT,
        call_script TEXT,
        attendance_status VARCHAR(20),
        attendance_date DATE,
        attendance_notes TEXT,
        sent_at TIMESTAMP,
        scheduled_at TIMESTAMP,
        completed_at TIMESTAMP,
        duration INTEGER, -- for calls, in seconds
        external_id VARCHAR(100), -- WhatsApp message ID or call ID
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Create indexes for performance
    await db.query(`CREATE INDEX IF NOT EXISTS idx_communications_student_id ON communications(student_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_communications_parent_id ON communications(parent_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_communications_type ON communications(type);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_communications_status ON communications(status);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_communications_created_at ON communications(created_at DESC);`);

    console.log('✅ Communications table created successfully!');
    console.log('📊 Created table: communications');
    console.log('🔍 Created indexes: student_id, parent_id, type, status, created_at');

  } catch (error) {
    console.error('❌ Communications table creation failed:', error);
    throw error;
  }
};

// Run migration
createCommunicationsTable()
  .then(() => {
    console.log('🎉 Communications migration completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Communications migration failed:', error);
    process.exit(1);
  });
