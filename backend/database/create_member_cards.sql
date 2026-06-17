CREATE TABLE member_cards (
  id         SERIAL PRIMARY KEY,
  member_id  INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  card_no    VARCHAR(50) NOT NULL UNIQUE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_member_cards_member_id ON member_cards(member_id);
CREATE INDEX idx_member_cards_card_no   ON member_cards(card_no);

INSERT INTO member_cards (member_id, card_no, is_primary)
SELECT id, card_no, true FROM members WHERE card_no IS NOT NULL;
