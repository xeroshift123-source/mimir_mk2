CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY, google_sub text NOT NULL UNIQUE, email text, nickname text NOT NULL,
 selected_account uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS oauth_flows (
 state_hash text PRIMARY KEY, verifier text NOT NULL, nonce text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS link_challenges (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, code text NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS commander_accounts (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 open_id text NOT NULL UNIQUE, profile jsonb NOT NULL, revision uuid NOT NULL,
 scores jsonb NOT NULL DEFAULT '{}', score_status text NOT NULL DEFAULT 'not_configured',
 score_started_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
 last_attempt_at timestamptz
);
CREATE INDEX IF NOT EXISTS accounts_owner ON commander_accounts(owner_id);
CREATE TABLE IF NOT EXISTS sync_leases (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, owner uuid NOT NULL,
 expires_at timestamptz NOT NULL, last_attempt_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS service_leases (
 name text PRIMARY KEY, owner uuid NOT NULL, expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS account_element_scores (
 account_id uuid NOT NULL REFERENCES commander_accounts(id) ON DELETE CASCADE,
 weakness text NOT NULL,policy_hash text NOT NULL,calc_version text NOT NULL,
 damage bigint NOT NULL CHECK(damage>=0),score double precision NOT NULL,
 PRIMARY KEY(account_id,weakness)
);
CREATE INDEX IF NOT EXISTS element_scores_comparison ON account_element_scores(weakness,policy_hash,calc_version,damage);

CREATE TABLE IF NOT EXISTS badge_unlocks (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,badge_id text NOT NULL,acquired_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,badge_id));
CREATE TABLE IF NOT EXISTS badge_showcases (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,badge_ids text[] NOT NULL DEFAULT '{}');
CREATE TABLE IF NOT EXISTS badge_revisions (account_id uuid PRIMARY KEY REFERENCES commander_accounts(id) ON DELETE CASCADE,revision uuid NOT NULL);

ALTER TABLE users ADD COLUMN IF NOT EXISTS picture text;
CREATE TABLE IF NOT EXISTS shared_decks (
 id uuid PRIMARY KEY,author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title text NOT NULL,description text NOT NULL,season text NOT NULL,raid_type text NOT NULL,
 data jsonb NOT NULL,nikke_ids text[] NOT NULL,upvotes integer NOT NULL DEFAULT 0,downvotes integer NOT NULL DEFAULT 0,
 score integer NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shared_decks_latest ON shared_decks(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS shared_decks_season_latest ON shared_decks(season,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS shared_decks_score ON shared_decks(score DESC,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS shared_decks_nikkes ON shared_decks USING gin(nikke_ids);
CREATE TABLE IF NOT EXISTS shared_deck_votes (
 deck_id uuid NOT NULL REFERENCES shared_decks(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 value smallint NOT NULL CHECK(value IN (-1,1)),PRIMARY KEY(deck_id,user_id)
);
