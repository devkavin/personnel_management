CREATE TABLE schedule_plan_regattas (
  plan_id BIGINT UNSIGNED NOT NULL,
  regatta_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (plan_id, regatta_id),
  CONSTRAINT fk_schedule_plan_regattas_plan FOREIGN KEY (plan_id) REFERENCES schedule_plans(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_plan_regattas_regatta FOREIGN KEY (regatta_id) REFERENCES regattas(id) ON DELETE RESTRICT,
  INDEX idx_schedule_plan_regattas_regatta (regatta_id, plan_id)
);
