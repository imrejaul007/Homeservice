# Log Work Skill

Automatically logs work from the current chat session to `work.md`.

## Usage

```
/log-work
```

## What To Do

When this skill is invoked, you MUST perform these steps:

### Step 1: Read Existing Work Log
Read the file `C:\Users\user\OneDrive\Desktop\rez-v5\Homeservice\work.md` to see what's already documented.

### Step 2: Analyze Chat Context
Review the ENTIRE chat conversation and identify:
- Files that were created or modified
- Bug fixes, features, or improvements implemented
- Business logic changes
- Any work that was done during this session

### Step 3: Identify New Work
Compare what was done in the chat against what's already in `work.md`.
- Skip anything that's already documented
- Focus on NEW work that isn't recorded yet

### Step 4: Write to work.md
Append the new work to `work.md` with this format:

```markdown
## YYYY-MM-DD

### Feature/Section Name

- [HH:MM] Description of work done
  - Files: file1.ts, file2.tsx

- [HH:MM] Another piece of work
  - Files: file3.ts
```

**Rules:**
- Use today's date (get from system context or `currentDate`)
- Group related changes under a descriptive section header
- Include the files that were modified
- Keep descriptions concise but informative
- Do NOT duplicate existing entries
- Do NOT make up work - only log what was actually done

## Example

If the chat discussed adding user authentication:

**Input (chat context):**
- Created auth.service.ts
- Added login endpoint to auth.routes.ts
- Updated User model with new fields

**Output (appended to work.md):**
```markdown
## 2026-06-12

### User Authentication

- [HH:MM] Implemented user authentication system
  - Created: backend/src/services/auth.service.ts
  - Modified: backend/src/routes/auth.routes.ts
  - Modified: backend/src/models/user.model.ts
```

## File Location

Work log: `C:\Users\user\OneDrive\Desktop\rez-v5\Homeservice\work.md`