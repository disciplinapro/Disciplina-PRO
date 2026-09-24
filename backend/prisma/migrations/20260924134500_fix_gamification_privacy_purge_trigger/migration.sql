-- Keep the privacy purge exception compatible with the distinct row types
-- of xp_transactions and user_achievements.
CREATE OR REPLACE FUNCTION enforce_gamification_fact_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('app.private_data_purge', true) = 'on' THEN
        IF TG_TABLE_NAME = 'xp_transactions' THEN
            IF OLD."event_type" = 'tracker.mark.recorded.v1' THEN
                RETURN OLD;
            END IF;
        ELSIF TG_TABLE_NAME = 'user_achievements' THEN
            IF EXISTS (
                SELECT 1 FROM "internal_events"
                WHERE "id" = OLD."source_event_id" AND "type" = 'tracker.mark.recorded.v1'
            ) THEN
                RETURN OLD;
            END IF;
        END IF;
    END IF;
    RAISE EXCEPTION 'gamification facts are immutable' USING ERRCODE = '23514';
END;
$$;
