-- Add "completed" status to the request_status enum
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'completed';