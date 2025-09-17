const db = require('../config/database');

async function addRecordedByColumn() {
  try {
    console.log('🔄 Adding recorded_by column to attendance table...');
    
    // Check if the column already exists
    const columnExists = await db.query(`
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'attendance' AND column_name = 'recorded_by'
    `);
    
    if (columnExists.rows.length > 0) {
      console.log('✅ recorded_by column already exists in attendance table');
      return;
    }
    
    // Add the recorded_by column
    await db.query(`
      ALTER TABLE attendance 
      ADD COLUMN recorded_by UUID REFERENCES users(id)
    `);
    
    console.log('✅ Successfully added recorded_by column to attendance table');
    
    // Verify the column was added
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'attendance' AND column_name = 'recorded_by'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Verified: recorded_by column exists');
      console.log(`   - Type: ${result.rows[0].data_type}`);
      console.log(`   - Nullable: ${result.rows[0].is_nullable === 'YES' ? 'Yes' : 'No'}`);
    } else {
      throw new Error('recorded_by column was not added successfully');
    }
    
  } catch (error) {
    console.error('❌ Error adding recorded_by column:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting attendance recorded_by column migration...');
    await addRecordedByColumn();
    console.log('🎉 Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

main();
