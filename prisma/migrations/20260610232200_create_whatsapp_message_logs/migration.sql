-- CreateTable
CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_number TEXT NOT NULL,
  from_number TEXT DEFAULT '+918130773789',
  template_name TEXT,
  message_body TEXT,
  status TEXT DEFAULT 'sent', -- sent / delivered / read / failed
  message_id TEXT UNIQUE, -- Meta's wamid
  error_details JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS whatsapp_message_logs_sent_at_idx ON whatsapp_message_logs (sent_at DESC);
