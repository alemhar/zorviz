-- Owner policy: cap the manual discount staff can give, as a percentage of the subtotal
-- (null = no cap). Stops over-discounting — especially when entered as an amount, where the
-- effective % isn't obvious. The statutory Senior/PWD 20% is exempt from this cap.
ALTER TABLE app_config ADD COLUMN max_discount_pct REAL; -- fraction, e.g. 0.15 = 15%
