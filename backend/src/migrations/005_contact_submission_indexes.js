/**
 * Migration: 005_contact_submission_indexes
 *
 * Adds indexes for contact submission queries and deduplication.
 *
 * Run with: mongosh < backend/src/migrations/005_contact_submission_indexes.js
 */

db = db.getSiblingDB('homeservice');

print('===========================================');
print('Migration: 005_contact_submission_indexes');
print('Started at: ' + new Date().toISOString());
print('===========================================');

const indexes = [
  { key: { submissionId: 1 }, name: 'contact_submission_id', unique: true },
  { key: { email: 1, createdAt: -1 }, name: 'contact_email_created' },
  { key: { status: 1, priority: -1, createdAt: -1 }, name: 'contact_status_priority' },
  { key: { department: 1, status: 1 }, name: 'contact_department_status' },
  { key: { isSpam: 1, createdAt: -1 }, name: 'contact_spam_created' },
  { key: { subjectCategory: 1, email: 1, createdAt: -1 }, name: 'contact_dedup_lookup' },
  { key: { ticketId: 1 }, name: 'contact_ticket_link', sparse: true },
];

for (const idx of indexes) {
  try {
    db.contactsubmissions.createIndex(idx.key, {
      name: idx.name,
      background: true,
      ...(idx.unique ? { unique: true } : {}),
      ...(idx.sparse ? { sparse: true } : {}),
    });
    print('Created index: ' + idx.name);
  } catch (e) {
    print('Index ' + idx.name + ' may already exist: ' + e.message);
  }
}

print('Migration complete at: ' + new Date().toISOString());
