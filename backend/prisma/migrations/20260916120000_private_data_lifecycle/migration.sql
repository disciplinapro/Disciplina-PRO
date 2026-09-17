-- Private-data deletion is the only controlled exception to append-only event storage.
-- The application must enable it transaction-locally with app.private_data_purge=on.
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('app.private_data_purge', true) = 'on'
       AND OLD."action" IN ('PRIVATE_RESPONSE_CREATED', 'PRIVATE_RESPONSE_REPLACED') THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'audit_events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_internal_event_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('app.private_data_purge', true) = 'on'
       AND OLD."type" = 'tracker.mark.recorded.v1' THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'internal events are immutable' USING ERRCODE = '23514';
END;
$$;

CREATE OR REPLACE FUNCTION enforce_internal_event_delivery_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE'
       AND current_setting('app.private_data_purge', true) = 'on'
       AND EXISTS (
           SELECT 1 FROM "internal_events"
           WHERE "id" = OLD."internal_event_id" AND "type" = 'tracker.mark.recorded.v1'
       ) THEN
        RETURN OLD;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'internal event deliveries cannot be deleted' USING ERRCODE = '23514';
    END IF;
    IF NEW."internal_event_id" <> OLD."internal_event_id"
        OR NEW."consumer" <> OLD."consumer"
        OR NEW."created_at" <> OLD."created_at" THEN
        RAISE EXCEPTION 'internal event delivery identity is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_gamification_fact_immutability() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' AND current_setting('app.private_data_purge', true) = 'on' THEN
        IF TG_TABLE_NAME = 'xp_transactions' AND OLD."event_type" = 'tracker.mark.recorded.v1' THEN
            RETURN OLD;
        END IF;
        IF TG_TABLE_NAME = 'user_achievements' AND EXISTS (
            SELECT 1 FROM "internal_events"
            WHERE "id" = OLD."source_event_id" AND "type" = 'tracker.mark.recorded.v1'
        ) THEN
            RETURN OLD;
        END IF;
    END IF;
    RAISE EXCEPTION 'gamification facts are immutable' USING ERRCODE = '23514';
END;
$$;

-- Rollback restores the prior function bodies from migrations
-- 20260716030447, 20260726200000 and 20260726230000. Deleted private data is
-- intentionally unrecoverable and must only be restored from an authorized backup.
