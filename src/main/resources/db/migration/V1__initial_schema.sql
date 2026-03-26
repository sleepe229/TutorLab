-- V1: Initial schema — all persistent data migrated from Redis to PostgreSQL

-- ── TUTORS ────────────────────────────────────────────────────────────────────

CREATE TABLE tutors (
    id TEXT PRIMARY KEY,
    full_name TEXT,
    login TEXT UNIQUE,
    password TEXT,
    photo_url TEXT,
    about TEXT,
    hourly_rate INTEGER,
    is_public_profile BOOLEAN NOT NULL DEFAULT FALSE,
    google_id TEXT UNIQUE,
    email TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tutor_subjects (
    tutor_id TEXT NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    subject TEXT NOT NULL
);

CREATE TABLE tutor_favorite_students (
    tutor_id TEXT NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    PRIMARY KEY (tutor_id, student_id)
);

-- ── STUDENTS ──────────────────────────────────────────────────────────────────

CREATE TABLE students (
    id TEXT PRIMARY KEY,
    tutor_id TEXT NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    age INTEGER,
    photo_url TEXT,
    price_per_lesson INTEGER,
    trial_lessons_count INTEGER NOT NULL DEFAULT 1,
    student_account_id TEXT,
    interests JSONB NOT NULL DEFAULT '[]',
    material_urls JSONB NOT NULL DEFAULT '[]',
    lesson_dates JSONB NOT NULL DEFAULT '[]',
    lesson_materials JSONB NOT NULL DEFAULT '{}',
    lesson_payments JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_students_tutor_id ON students(tutor_id);
CREATE INDEX idx_students_account_id ON students(student_account_id);

CREATE TABLE progress_notes (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    snapshot_id TEXT,
    note_date TIMESTAMPTZ,
    note_text TEXT,
    skill_tags JSONB NOT NULL DEFAULT '[]',
    rating INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_progress_notes_student_id ON progress_notes(student_id);

-- ── STUDENT ACCOUNTS ──────────────────────────────────────────────────────────

CREATE TABLE student_accounts (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    first_name TEXT,
    last_name TEXT,
    photo_url TEXT,
    google_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE student_account_links (
    account_id TEXT NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    PRIMARY KEY (account_id, student_id)
);

-- ── CHATS ─────────────────────────────────────────────────────────────────────

CREATE TABLE chats (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'DIRECT',
    tutor_id TEXT,
    tutor_name TEXT,
    student_account_id TEXT,
    student_name TEXT,
    last_message TEXT,
    last_timestamp BIGINT,
    unread_count_tutor INTEGER NOT NULL DEFAULT 0,
    unread_count_student INTEGER NOT NULL DEFAULT 0,
    group_name TEXT,
    group_avatar_url TEXT,
    creator_id TEXT,
    creator_role TEXT,
    blocked_by_tutor BOOLEAN NOT NULL DEFAULT FALSE,
    blocked_by_student BOOLEAN NOT NULL DEFAULT FALSE,
    hidden_for_tutor BOOLEAN NOT NULL DEFAULT FALSE,
    hidden_for_student BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chats_tutor_id ON chats(tutor_id);
CREATE INDEX idx_chats_student_account_id ON chats(student_account_id);
-- Ensures at most one DIRECT chat per tutor+student pair
CREATE UNIQUE INDEX idx_chats_direct_match
    ON chats(tutor_id, student_account_id) WHERE type = 'DIRECT';

CREATE TABLE chat_participants (
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    participant_id TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (chat_id, participant_id)
);

CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id TEXT,
    sender_role TEXT,
    sender_name TEXT,
    text TEXT,
    type TEXT NOT NULL DEFAULT 'TEXT',
    invite_student_id TEXT,
    file_url TEXT,
    file_name TEXT,
    timestamp BIGINT,
    edited_at BIGINT,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_chat_id_ts ON chat_messages(chat_id, timestamp);

-- ── SESSION SNAPSHOTS ─────────────────────────────────────────────────────────

CREATE TABLE session_snapshots (
    id TEXT PRIMARY KEY,
    session_id TEXT UNIQUE,
    tutor_id TEXT,
    student_id TEXT,
    title TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    student_first_name TEXT,
    student_last_name TEXT,
    slide_urls JSONB NOT NULL DEFAULT '[]',
    slide_drawings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_snapshots_tutor_id ON session_snapshots(tutor_id);
CREATE INDEX idx_snapshots_student_id ON session_snapshots(student_id);

-- ── LESSON RECAPS ─────────────────────────────────────────────────────────────

CREATE TABLE lesson_recaps (
    snapshot_id TEXT PRIMARY KEY,
    topics_covered JSONB NOT NULL DEFAULT '[]',
    struggled_with JSONB NOT NULL DEFAULT '[]',
    homework_assigned TEXT,
    next_session_focus TEXT,
    raw_response TEXT,
    generated_at TIMESTAMPTZ,
    generation_failed BOOLEAN NOT NULL DEFAULT FALSE,
    attempt_count INTEGER NOT NULL DEFAULT 0
);
